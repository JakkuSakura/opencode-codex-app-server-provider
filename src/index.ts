import { createLanguageModel } from "./provider.js";
import type { CodexProviderOptions } from "./config.js";

export type { CodexProviderOptions };

export function createCodexProvider(options: CodexProviderOptions = {}): any {
  const callable = (modelId?: string) => createLanguageModel(modelId, options);
  callable.languageModel = (modelId?: string) => createLanguageModel(modelId, options);
  callable.responses = (modelId?: string) => createLanguageModel(modelId, options);

  return Object.assign(callable, {
    embeddingModel() {
      throw new Error("codex-config does not support embeddings");
    },
    imageModel(modelId?: string) {
      return createLanguageModel(modelId, options);
    },
  });
}
