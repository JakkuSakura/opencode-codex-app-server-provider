import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel, CodexProviderOptions } from "./config.js";

export function selectModel(
  client: { responses: (id: string) => unknown },
  modelId: string,
): unknown {
  return client.responses(modelId);
}

const DEFAULT_CODEX_INSTRUCTIONS =
  "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";

const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");
const BUNDLED_PROMPT = path.join(ASSETS_DIR, "prompt.md");
const BUNDLED_CODEX_PROMPT = path.join(ASSETS_DIR, "gpt_5_codex_prompt.md");
const BUNDLED_APPLY_PATCH = path.join(ASSETS_DIR, "apply_patch_tool_instructions.md");

type ProviderOptions = Record<string, Record<string, unknown>>;

type CallOptions = {
  prompt?: unknown;
  providerOptions?: ProviderOptions;
  [key: string]: unknown;
};

type InstructionOptions = {
  codexHome: string;
  modelId: string;
  instructions?: string;
  instructionsFile?: string;
  userInstructionsFile?: string;
  includeUserInstructions?: boolean;
  tools?: unknown;
};

function readFileTrimmed(filePath: string): string | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function readBundled(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function isCodexModel(modelId: string): boolean {
  return modelId.includes("codex");
}

function needsSpecialApplyPatchInstructions(modelId: string): boolean {
  if (isCodexModel(modelId)) return false;
  return (
    modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini") ||
    modelId.startsWith("gpt-4.1") ||
    modelId.startsWith("gpt-4o") ||
    modelId.startsWith("gpt-3.5") ||
    modelId.startsWith("gpt-5")
  );
}

function hasApplyPatchTool(tools: unknown): boolean {
  if (!Array.isArray(tools)) return false;
  return tools.some((tool: any) => tool?.name === "apply_patch");
}

function resolveBaseInstructions(opts: InstructionOptions): string {
  const fromFile =
    opts.instructionsFile && path.isAbsolute(opts.instructionsFile)
      ? readFileTrimmed(opts.instructionsFile)
      : opts.instructionsFile
        ? readFileTrimmed(path.join(opts.codexHome, opts.instructionsFile))
        : undefined;
  const fromInline = opts.instructions?.trim();
  if (fromFile ?? fromInline) return fromFile ?? fromInline ?? DEFAULT_CODEX_INSTRUCTIONS;

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

function resolveUserInstructions(opts: InstructionOptions): string | undefined {
  if (opts.includeUserInstructions === false) return undefined;
  const fromFile =
    opts.userInstructionsFile && path.isAbsolute(opts.userInstructionsFile)
      ? readFileTrimmed(opts.userInstructionsFile)
      : opts.userInstructionsFile
        ? readFileTrimmed(path.join(opts.codexHome, opts.userInstructionsFile))
        : undefined;
  if (fromFile) return fromFile;
  return readFileTrimmed(path.join(opts.codexHome, "AGENTS.md"));
}

function hasUserInstructionsTag(prompt: unknown): boolean {
  if (!Array.isArray(prompt)) return false;
  return prompt.some((msg: any) => {
    if (msg?.role !== "user") return false;
    const content = msg?.content;
    if (typeof content === "string") return content.includes("<user_instructions>");
    if (Array.isArray(content)) {
      return content.some((part: any) => part?.type === "text" && String(part.text).includes("<user_instructions>"));
    }
    return false;
  });
}

function injectUserInstructions(prompt: unknown, userInstructions: string): unknown {
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

function stripOpenAIItemIds(prompt: unknown): unknown {
  if (!Array.isArray(prompt)) return prompt;
  return prompt.map((msg: any) => {
    if (!msg || typeof msg !== "object") return msg;
    const nextMsg = { ...msg };
    if (nextMsg.providerOptions && typeof nextMsg.providerOptions === "object") {
      const providerOptions = { ...nextMsg.providerOptions };
      if (providerOptions.openai && typeof providerOptions.openai === "object") {
        const openai = { ...providerOptions.openai };
        delete openai.itemId;
        providerOptions.openai = openai;
      }
      nextMsg.providerOptions = providerOptions;
    }
    if (Array.isArray(nextMsg.content)) {
      nextMsg.content = nextMsg.content.map((part: any) => {
        if (!part || typeof part !== "object") return part;
        const nextPart = { ...part };
        if (nextPart.providerOptions && typeof nextPart.providerOptions === "object") {
          const providerOptions = { ...nextPart.providerOptions };
          if (providerOptions.openai && typeof providerOptions.openai === "object") {
            const openai = { ...providerOptions.openai };
            delete openai.itemId;
            providerOptions.openai = openai;
          }
          nextPart.providerOptions = providerOptions;
        }
        return nextPart;
      });
    }
    return nextMsg;
  });
}

function normalizeOpenAIResponsesPrompt(prompt: unknown): unknown {
  if (!Array.isArray(prompt)) return prompt;
  return prompt.map((msg: any) => {
    if (!msg || typeof msg !== "object") return msg;
    if (!Array.isArray(msg.content)) return msg;
    const nextMsg = { ...msg };
    nextMsg.content = msg.content.map((part: any) => {
      if (!part || typeof part !== "object") return part;
      if (part.type === "input_text" && typeof part.text === "string") {
        return { ...part, type: "text" };
      }
      if (part.type === "input_image") {
        const { image_url, file_id, ...rest } = part as any;
        const image = image_url ?? file_id;
        if (!image) return part;
        return { ...rest, type: "image", image };
      }
      return part;
    });
    return nextMsg;
  });
}

export function withResponsesInstructions(
  options: CallOptions,
  instructionOptions: InstructionOptions,
): CallOptions {
  const existing = options.providerOptions?.openai?.instructions;
  if (typeof existing === "string" && existing.length > 0) return options;

  const instructions = resolveBaseInstructions({
    ...instructionOptions,
    tools: options.tools,
  });
  const userInstructions = resolveUserInstructions(instructionOptions);
  const nextPrompt =
    userInstructions && !hasUserInstructionsTag(options.prompt)
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

export function normalizeResponsesOptions(
  options: CallOptions,
  instructionOptions: InstructionOptions,
): CallOptions {
  const normalized = withResponsesInstructions(options, instructionOptions);
  normalized.prompt = normalizeOpenAIResponsesPrompt(stripOpenAIItemIds(normalized.prompt));
  if ("maxOutputTokens" in normalized) {
    delete (normalized as any).maxOutputTokens;
  }
  const openaiOptions = {
    ...(normalized.providerOptions?.openai ?? {}),
    store: true,
  };
  delete (openaiOptions as any).previousResponseId;
  delete (openaiOptions as any).conversation;
  normalized.providerOptions = {
    ...(normalized.providerOptions ?? {}),
    openai: openaiOptions,
  };
  return normalized;
}

async function collectStreamResult(stream: ReadableStream<any>) {
  const reader = stream.getReader();
  const content: any[] = [];
  const textById = new Map<string, string>();
  const reasoningById = new Map<string, string>();
  let finishReason: any = "unknown";
  let usage: any = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  let providerMetadata: any = undefined;
  let warnings: any[] = [];
  let responseMetadata: any = undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value || typeof value !== "object") continue;

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

function wrapResponsesModel(model: any, instructionOptions: InstructionOptions): any {
  const wrapped = Object.create(model);
  wrapped.doGenerate = async (options: CallOptions) => {
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
  wrapped.doStream = (options: CallOptions) =>
    model.doStream(normalizeResponsesOptions(options, instructionOptions));
  return wrapped;
}

export function createLanguageModel(
  modelId: string | undefined,
  options: CodexProviderOptions,
): any {
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

  const model = selectModel(client, resolvedModel);
  return wrapResponsesModel(model, {
    codexHome: config.codexHome,
    modelId: resolvedModel,
    instructions: options.instructions,
    instructionsFile: options.instructionsFile,
    userInstructionsFile: options.userInstructionsFile,
    includeUserInstructions: options.includeUserInstructions,
  });
}
