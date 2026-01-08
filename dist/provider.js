import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel } from "./config";
export function selectModel(client, wireApi, modelId) {
    return wireApi === "chat" ? client.chat(modelId) : client.responses(modelId);
}
const DEFAULT_CODEX_INSTRUCTIONS = "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";
const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");
const BUNDLED_PROMPT = path.join(ASSETS_DIR, "prompt.md");
const BUNDLED_CODEX_PROMPT = path.join(ASSETS_DIR, "gpt_5_codex_prompt.md");
const BUNDLED_APPLY_PATCH = path.join(ASSETS_DIR, "apply_patch_tool_instructions.md");
function readFileTrimmed(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    catch {
        return undefined;
    }
}
function readBundled(filePath, fallback) {
    try {
        return fs.readFileSync(filePath, "utf8");
    }
    catch {
        return fallback;
    }
}
function isCodexModel(modelId) {
    return modelId.includes("codex");
}
function needsSpecialApplyPatchInstructions(modelId) {
    if (isCodexModel(modelId))
        return false;
    return (modelId.startsWith("o3") ||
        modelId.startsWith("o4-mini") ||
        modelId.startsWith("gpt-4.1") ||
        modelId.startsWith("gpt-4o") ||
        modelId.startsWith("gpt-3.5") ||
        modelId.startsWith("gpt-5"));
}
function hasApplyPatchTool(tools) {
    if (!Array.isArray(tools))
        return false;
    return tools.some((tool) => tool?.name === "apply_patch");
}
function resolveBaseInstructions(opts) {
    const fromFile = opts.instructionsFile && path.isAbsolute(opts.instructionsFile)
        ? readFileTrimmed(opts.instructionsFile)
        : opts.instructionsFile
            ? readFileTrimmed(path.join(opts.codexHome, opts.instructionsFile))
            : undefined;
    const fromInline = opts.instructions?.trim();
    if (fromFile ?? fromInline)
        return fromFile ?? fromInline ?? DEFAULT_CODEX_INSTRUCTIONS;
    if (isCodexModel(opts.modelId)) {
        return readBundled(BUNDLED_CODEX_PROMPT, DEFAULT_CODEX_INSTRUCTIONS);
    }
    const base = readBundled(BUNDLED_PROMPT, DEFAULT_CODEX_INSTRUCTIONS);
    if (needsSpecialApplyPatchInstructions(opts.modelId) && !hasApplyPatchTool(opts.tools)) {
        const applyPatch = readBundled(BUNDLED_APPLY_PATCH, "");
        return applyPatch.trim().length > 0 ? `${base}\n${applyPatch}` : base;
    }
    return base;
}
function resolveUserInstructions(opts) {
    if (opts.includeUserInstructions === false)
        return undefined;
    const fromFile = opts.userInstructionsFile && path.isAbsolute(opts.userInstructionsFile)
        ? readFileTrimmed(opts.userInstructionsFile)
        : opts.userInstructionsFile
            ? readFileTrimmed(path.join(opts.codexHome, opts.userInstructionsFile))
            : undefined;
    if (fromFile)
        return fromFile;
    return readFileTrimmed(path.join(opts.codexHome, "AGENTS.md"));
}
function hasUserInstructionsTag(prompt) {
    if (!Array.isArray(prompt))
        return false;
    return prompt.some((msg) => {
        if (msg?.role !== "user")
            return false;
        const content = msg?.content;
        if (typeof content === "string")
            return content.includes("<user_instructions>");
        if (Array.isArray(content)) {
            return content.some((part) => part?.type === "text" && String(part.text).includes("<user_instructions>"));
        }
        return false;
    });
}
function injectUserInstructions(prompt, userInstructions) {
    const wrapped = `<user_instructions>\n${userInstructions}\n</user_instructions>`;
    const message = {
        role: "user",
        content: [{ type: "text", text: wrapped }],
    };
    if (Array.isArray(prompt)) {
        return [message, ...prompt];
    }
    return [message];
}
export function withResponsesInstructions(options, instructionOptions) {
    const existing = options.providerOptions?.openai?.instructions;
    if (typeof existing === "string" && existing.length > 0)
        return options;
    const instructions = resolveBaseInstructions({
        ...instructionOptions,
        tools: options.tools,
    });
    const userInstructions = resolveUserInstructions(instructionOptions);
    const nextPrompt = userInstructions && !hasUserInstructionsTag(options.prompt)
        ? injectUserInstructions(options.prompt, userInstructions)
        : options.prompt;
    return {
        ...options,
        prompt: nextPrompt,
        providerOptions: {
            ...(options.providerOptions ?? {}),
            openai: {
                ...(options.providerOptions?.openai ?? {}),
                instructions,
            },
        },
    };
}
export function normalizeResponsesOptions(options, instructionOptions) {
    const normalized = withResponsesInstructions(options, instructionOptions);
    if ("maxOutputTokens" in normalized) {
        delete normalized.maxOutputTokens;
    }
    normalized.providerOptions = {
        ...(normalized.providerOptions ?? {}),
        openai: {
            ...(normalized.providerOptions?.openai ?? {}),
            store: true,
        },
    };
    return normalized;
}
async function collectStreamResult(stream) {
    const reader = stream.getReader();
    const content = [];
    const textById = new Map();
    const reasoningById = new Map();
    let finishReason = "unknown";
    let usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
    let providerMetadata = undefined;
    let warnings = [];
    let responseMetadata = undefined;
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        if (!value || typeof value !== "object")
            continue;
        switch (value.type) {
            case "stream-start":
                warnings = value.warnings ?? [];
                break;
            case "text-start":
                textById.set(value.id, "");
                break;
            case "text-delta":
                textById.set(value.id, (textById.get(value.id) ?? "") + (value.delta ?? ""));
                break;
            case "text-end": {
                const text = textById.get(value.id) ?? "";
                content.push({ type: "text", text });
                textById.delete(value.id);
                break;
            }
            case "reasoning-start":
                reasoningById.set(value.id, "");
                break;
            case "reasoning-delta":
                reasoningById.set(value.id, (reasoningById.get(value.id) ?? "") + (value.delta ?? ""));
                break;
            case "reasoning-end": {
                const text = reasoningById.get(value.id) ?? "";
                content.push({ type: "reasoning", text });
                reasoningById.delete(value.id);
                break;
            }
            case "tool-call":
            case "tool-result":
            case "file":
            case "source":
                content.push(value);
                break;
            case "response-metadata":
                responseMetadata = { ...value };
                delete responseMetadata.type;
                break;
            case "finish":
                finishReason = value.finishReason ?? finishReason;
                usage = value.usage ?? usage;
                providerMetadata = value.providerMetadata ?? providerMetadata;
                break;
            case "error":
                throw value.error;
            default:
                break;
        }
    }
    return { content, finishReason, usage, providerMetadata, warnings, responseMetadata };
}
function wrapResponsesModel(model, instructionOptions) {
    const wrapped = Object.create(model);
    wrapped.doGenerate = async (options) => {
        const normalized = normalizeResponsesOptions(options, instructionOptions);
        const { stream, request, response } = await model.doStream(normalized);
        const collected = await collectStreamResult(stream);
        return {
            content: collected.content,
            finishReason: collected.finishReason,
            usage: collected.usage,
            providerMetadata: collected.providerMetadata,
            request,
            response: {
                ...collected.responseMetadata,
                headers: response?.headers,
            },
            warnings: collected.warnings,
        };
    };
    wrapped.doStream = (options) => model.doStream(normalizeResponsesOptions(options, instructionOptions));
    return wrapped;
}
export function createLanguageModel(provider, modelId, options, overrideWireApi) {
    const config = loadCodexConfig(options);
    const resolvedModel = resolveModel(config.model, modelId, options.useCodexConfigModel);
    if (!resolvedModel) {
        throw new Error("No model configured (set model in ~/.codex/config.toml or OpenCode config)");
    }
    if (!config.baseUrl) {
        throw new Error("No base_url configured for the selected model provider");
    }
    const baseURL = applyQueryParams(config.baseUrl, config.queryParams);
    const client = createOpenAI({
        apiKey: config.apiKey ?? undefined,
        baseURL,
        headers: config.headers,
    });
    const wireApi = overrideWireApi ?? config.wireApi;
    const model = selectModel(client, wireApi, resolvedModel);
    if (wireApi === "responses") {
        return wrapResponsesModel(model, {
            codexHome: config.codexHome,
            modelId: resolvedModel,
            instructions: options.instructions,
            instructionsFile: options.instructionsFile,
            userInstructionsFile: options.userInstructionsFile,
            includeUserInstructions: options.includeUserInstructions,
        });
    }
    return model;
}
