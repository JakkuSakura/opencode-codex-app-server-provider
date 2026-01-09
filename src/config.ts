import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseToml, TomlTable } from "./toml.js";

export type ProviderConfig = {
  name?: string;
  base_url?: string;
  env_key?: string;
  query_params?: Record<string, string | number | boolean>;
  http_headers?: Record<string, string>;
  env_http_headers?: Record<string, string>;
  requires_openai_auth?: boolean;
};

export type CodexConfig = {
  codexHome: string;
  providerId: string;
  model: string;
  baseUrl?: string;
  apiKey?: string | null;
  headers: Record<string, string>;
  queryParams?: Record<string, string | number | boolean> | null;
};

export type CodexProviderOptions = {
  name?: string;
  codexHome?: string;
  useCodexConfigModel?: boolean;
  apiKeys?: Record<string, string>;
  instructions?: string;
  instructionsFile?: string;
  userInstructionsFile?: string;
  includeUserInstructions?: boolean;
};

function isProviderConfig(value: TomlTable | undefined): ProviderConfig {
  return (value ?? {}) as ProviderConfig;
}

function readJsonIfExists(filePath: string): Record<string, string> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}


function resolveBaseUrl(providerId: string, providerConfig: ProviderConfig): string | undefined {
  if (providerConfig.base_url) return providerConfig.base_url;
  if (providerId === "openai") return "https://api.openai.com/v1";
  return undefined;
}

function resolveRequiresOpenaiAuth(providerId: string, providerConfig: ProviderConfig): boolean {
  if (typeof providerConfig.requires_openai_auth === "boolean") return providerConfig.requires_openai_auth;
  return providerId === "openai";
}

function resolveApiKey(
  requiresOpenaiAuth: boolean,
  envKey: string | null,
  auth: Record<string, string>,
): string | null {
  if (envKey) {
    return process.env[envKey] || auth[envKey] || null;
  }
  if (requiresOpenaiAuth) {
    return process.env.OPENAI_API_KEY || auth.OPENAI_API_KEY || auth._OPENAI_API_KEY || null;
  }
  return null;
}

function resolveApiKeyOverride(
  providerId: string,
  options: CodexProviderOptions,
): string | null {
  if (options.useCodexConfigModel !== false) return null;
  if (!options.apiKeys) return null;
  return options.apiKeys[providerId] ?? null;
}

export function loadCodexConfig(options: CodexProviderOptions = {}): CodexConfig {
  const codexHome =
    options.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");

  const configPath = path.join(codexHome, "config.toml");
  const authPath = path.join(codexHome, "auth.json");

  const auth = readJsonIfExists(authPath) ?? {};
  const config: TomlTable = fs.existsSync(configPath)
    ? parseToml(fs.readFileSync(configPath, "utf8"))
    : { model_providers: {} };

  const providerId = (config.model_provider as string | undefined) ?? "openai";
  const model = (config.model as string | undefined) ?? "gpt-5-codex";
  const providerTable = (config.model_providers as TomlTable | undefined) ?? {};
  const providerConfig = isProviderConfig(providerTable[providerId] as TomlTable | undefined);

  const baseUrl = resolveBaseUrl(providerId, providerConfig);
  const requiresOpenaiAuth = resolveRequiresOpenaiAuth(providerId, providerConfig);
  const envKey = providerConfig.env_key ?? (requiresOpenaiAuth ? "OPENAI_API_KEY" : null);
  const apiKey = resolveApiKeyOverride(providerId, options) ?? resolveApiKey(requiresOpenaiAuth, envKey, auth);

  const headers: Record<string, string> = { ...(providerConfig.http_headers ?? {}) };
  const envHeaders = providerConfig.env_http_headers ?? {};
  for (const [header, envVar] of Object.entries(envHeaders)) {
    const value = process.env[envVar];
    if (value && value.trim()) headers[header] = value;
  }

  return {
    codexHome,
    providerId,
    model,
    baseUrl,
    apiKey,
    headers,
    queryParams: providerConfig.query_params ?? null,
  };
}

export function resolveModel(
  configModel: string,
  modelId: string | undefined,
  useCodexConfigModel: boolean | undefined,
): string {
  if (useCodexConfigModel !== false) return configModel;
  if (modelId && modelId !== "default") return modelId;
  return configModel;
}

export function applyQueryParams(
  baseUrl: string,
  queryParams?: Record<string, string | number | boolean> | null,
): string {
  if (!queryParams || Object.keys(queryParams).length === 0) return baseUrl;
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
