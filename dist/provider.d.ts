import { CodexProviderOptions } from "./config";
type WireApi = "chat" | "responses";
export declare function selectModel(client: {
    chat: (id: string) => unknown;
    responses: (id: string) => unknown;
}, wireApi: WireApi, modelId: string): unknown;
type ProviderOptions = {
    [provider: string]: Record<string, unknown>;
};
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
export declare function withResponsesInstructions(options: CallOptions, instructionOptions: InstructionOptions): CallOptions;
export declare function createLanguageModel(provider: string, modelId: string | undefined, options: CodexProviderOptions, overrideWireApi?: WireApi): any;
export {};
