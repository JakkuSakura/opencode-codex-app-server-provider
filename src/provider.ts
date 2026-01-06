import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel, CodexProviderOptions } from "./config";

type ModeLike = { type: string; [key: string]: unknown };
type MaybeModeCallOptions = Record<string, unknown> & { mode?: ModeLike };

export function ensureMode(options: MaybeModeCallOptions): MaybeModeCallOptions & { mode: ModeLike } {
  if (options.mode && typeof options.mode === "object" && "type" in options.mode) {
    return options as MaybeModeCallOptions & { mode: ModeLike };
  }
  return {
    ...options,
    mode: { type: "regular" },
  };
}

export function createLanguageModel(
  provider: string,
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

  const model: any =
    config.wireApi === "chat" ? client.chat(resolvedModel) : client.responses(resolvedModel);

  return {
    specificationVersion: "v3",
    provider,
    modelId: resolvedModel,
    supportedUrls: {},
    doGenerate: (options: MaybeModeCallOptions) => model.doGenerate(ensureMode(options)),
    doStream: (options: MaybeModeCallOptions) => model.doStream(ensureMode(options)),
  };
}
