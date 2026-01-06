import { CodexProviderOptions } from "./config";
type ModeLike = {
    type: string;
    [key: string]: unknown;
};
type MaybeModeCallOptions = Record<string, unknown> & {
    mode?: ModeLike;
};
export declare function ensureMode(options: MaybeModeCallOptions): MaybeModeCallOptions & {
    mode: ModeLike;
};
export declare function createLanguageModel(provider: string, modelId: string | undefined, options: CodexProviderOptions): any;
export {};
