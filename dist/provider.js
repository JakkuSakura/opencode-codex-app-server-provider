import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel } from "./config";
export function ensureMode(options) {
    if (options.mode && typeof options.mode === "object" && "type" in options.mode) {
        return options;
    }
    return {
        ...options,
        mode: { type: "regular" },
    };
}
export function createLanguageModel(provider, modelId, options) {
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
    const model = config.wireApi === "chat" ? client.chat(resolvedModel) : client.responses(resolvedModel);
    return {
        specificationVersion: "v3",
        provider,
        modelId: resolvedModel,
        supportedUrls: {},
        doGenerate: (options) => model.doGenerate(ensureMode(options)),
        doStream: (options) => model.doStream(ensureMode(options)),
    };
}
