import { spawn } from "node:child_process";

const DEFAULT_USAGE = Object.freeze({
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
});

function buildPrompt(prompt, options) {
  const lines = [];

  for (const message of prompt) {
    if (message.role === "system") {
      const systemText = extractText(message.content);
      if (systemText) {
        lines.push(`System:\n${systemText}`);
      }
      continue;
    }

    const label = message.role === "user" ? "User" : message.role === "assistant" ? "Assistant" : "Tool";
    const text = extractText(message.content);
    if (!text) continue;
    lines.push(`${label}:\n${text}`);
  }

  const promptText = lines.join("\n\n").trim();
  if (promptText) return promptText;

  const fallback = options?.emptyPromptFallback ?? "placeholder";
  if (fallback === "json") {
    try {
      return JSON.stringify(prompt, null, 2);
    } catch {
      return "User:\n[empty prompt: failed to serialize prompt]";
    }
  }
  if (fallback === "error") return "";
  if (fallback === "skip") return "";
  return "User:\n[empty prompt]";
}

function extractText(content) {
  if (!content) return "";
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) {
    if (typeof content === "object" && content.text) return String(content.text).trim();
    return "";
  }

  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" || part.type === "reasoning") {
      if (part.text) parts.push(part.text);
      continue;
    }
    if (part.type === "tool-result") {
      try {
        parts.push(JSON.stringify(part.output));
      } catch {
        parts.push(String(part.output));
      }
      continue;
    }
    if (part.type === "tool-call") {
      try {
        parts.push(`[tool:${part.toolName}] ${JSON.stringify(part.input)}`);
      } catch {
        parts.push(`[tool:${part.toolName}]`);
      }
      continue;
    }
    if (part.type === "image") {
      parts.push("[image]");
      continue;
    }
    if (part.type === "file") {
      const name = part.filename ? ` ${part.filename}` : "";
      parts.push(`[file${name}]`);
      continue;
    }
    if (typeof part.text === "string") {
      parts.push(part.text);
      continue;
    }
  }

  return parts.join("\n").trim();
}

function parseJsonLine(line) {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch {
    return { type: "parse.error", raw: line };
  }
}

function mapUsageFromTokenUsage(tokenUsage) {
  if (!tokenUsage?.last) return DEFAULT_USAGE;
  const last = tokenUsage.last;
  return {
    inputTokens: {
      total: last.inputTokens ?? undefined,
      noCache: undefined,
      cacheRead: last.cachedInputTokens ?? undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: last.outputTokens ?? undefined,
      text: last.outputTokens ?? undefined,
      reasoning: last.reasoningOutputTokens ?? undefined,
    },
    raw: tokenUsage,
  };
}

function resolveNewApprovalDecision(options, params) {
  const decision = options?.approvalDecision ?? "accept";
  if (decision === "acceptWithExecpolicyAmendment") {
    const amendment = Array.isArray(params?.proposedExecpolicyAmendment)
      ? params.proposedExecpolicyAmendment
      : [];
    return { acceptWithExecpolicyAmendment: { execpolicy_amendment: amendment } };
  }
  return decision;
}

function resolveLegacyApprovalDecision(options) {
  return options?.legacyApprovalDecision ?? "approved";
}

class AppServerClient {
  constructor(options) {
    this.options = options ?? {};
    this.child = null;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.pending = new Map();
    this.listeners = new Set();
    this.nextId = 1;
    this.initialized = null;
    this.queue = Promise.resolve();
  }

  respond(id, result) {
    if (!this.child || this.child.killed) return;
    const payload = { id, result };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  handleServerRequest(message) {
    const method = message.method;
    const params = message.params ?? {};
    if (method === "item/commandExecution/requestApproval") {
      return { decision: resolveNewApprovalDecision(this.options, params) };
    }
    if (method === "item/fileChange/requestApproval") {
      return { decision: resolveNewApprovalDecision(this.options, params) };
    }
    if (method === "execCommandApproval") {
      return { decision: resolveLegacyApprovalDecision(this.options) };
    }
    if (method === "applyPatchApproval") {
      return { decision: resolveLegacyApprovalDecision(this.options) };
    }
    return null;
  }

  enqueue(fn) {
    const run = this.queue.then(() => fn());
    this.queue = run.catch(() => {});
    return run;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message) {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  ensureProcess() {
    if (this.child && !this.child.killed) return;
    const codexPath = this.options.codexPath ?? "codex";
    const args = ["app-server"];
    if (Array.isArray(this.options.args)) args.push(...this.options.args);
    const env = {
      ...process.env,
      ...(this.options.env ?? {}),
    };

    const child = spawn(codexPath, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.initialized = null;

    child.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString("utf8");
      let idx;
      while ((idx = this.stdoutBuffer.indexOf("\n")) !== -1) {
        const line = this.stdoutBuffer.slice(0, idx);
        this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
        const message = parseJsonLine(line);
        if (!message) continue;
        if (message.type === "parse.error") {
          this.emit(message);
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(message, "id")) {
          const pending = this.pending.get(message.id);
          if (pending) {
            this.pending.delete(message.id);
            if (message.error) {
              pending.reject(new Error(JSON.stringify(message.error)));
            } else {
              pending.resolve(message.result);
            }
            continue;
          }
          if (message.method) {
            const response = this.handleServerRequest(message);
            if (response) {
              this.respond(message.id, response);
              continue;
            }
          }
        }
        if (message.method) {
          this.emit(message);
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      this.stderrBuffer += chunk.toString("utf8");
    });

    child.on("close", (code, signal) => {
      const error = new Error(
        this.stderrBuffer.trim() ||
          `codex app-server exited with code ${code ?? "unknown"} (${signal ?? "no signal"})`
      );
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.child = null;
      this.initialized = null;
      this.emit({ type: "process.closed", error });
    });
  }

  request(method, params) {
    this.ensureProcess();
    const id = this.nextId++;
    const payload = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  notify(method, params) {
    this.ensureProcess();
    const payload = { method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  async ensureInitialized() {
    if (this.initialized) return this.initialized;
    const params = {
      clientInfo: {
        name: "opencode-codex-app-server-provider",
        title: "OpenCode Codex App Server Provider",
        version: "0.1.0",
      },
    };
    this.initialized = this.request("initialize", params).then(() => {
      this.notify("initialized");
    });
    return this.initialized;
  }
}

function createLanguageModel({ provider, modelId, options, client }) {
  return {
    specificationVersion: "v3",
    provider,
    modelId,
    supportedUrls: {},
    async doGenerate(callOptions) {
      const promptText = buildPrompt(callOptions.prompt, options);
      let text = "";
      let usage = DEFAULT_USAGE;
      let finishReason = { unified: "other", raw: undefined };
      const warnings = [];

      if (!promptText) {
        warnings.push({ type: "other", message: "Empty prompt; skipping codex app-server." });
        return {
          content: [{ type: "text", text: "" }],
          finishReason: { unified: "other", raw: "empty-prompt" },
          usage,
          warnings,
        };
      }

      try {
        await client.enqueue(async () => {
          await client.ensureInitialized();
          const threadResult = await client.request("thread/start", {
            model: options?.modelOverride ?? modelId ?? null,
            modelProvider: options?.modelProvider ?? null,
            cwd: options?.cwd ?? process.cwd(),
            approvalPolicy: options?.approvalPolicy ?? null,
            sandbox: options?.sandboxMode ?? null,
            config: options?.config ?? null,
            baseInstructions: options?.baseInstructions ?? null,
            developerInstructions: options?.developerInstructions ?? null,
            experimentalRawEvents: options?.experimentalRawEvents ?? false,
          });
          const threadId = threadResult?.thread?.id ?? threadResult?.threadId;
          if (!threadId) {
            throw new Error("codex app-server did not return a thread id");
          }

          let sawTextDelta = false;
          let sawReasoningDelta = false;
          let activeTurnId = null;
          const buffered = [];
          let resolveCompletion;
          let rejectCompletion;
          const completion = new Promise((resolve, reject) => {
            resolveCompletion = resolve;
            rejectCompletion = reject;
          });

          const unsubscribe = client.subscribe((message) => {
            if (message.type === "parse.error") {
              rejectCompletion(new Error("Failed to parse codex app-server JSONL output"));
              return;
            }
            if (!message.method) return;
            const params = message.params;
            if (!params || params.threadId !== threadId) return;
            if (!activeTurnId && params.turnId) {
              activeTurnId = params.turnId;
            }
            if (!activeTurnId) {
              buffered.push(message);
              return;
            }
            if (params.turnId && params.turnId !== activeTurnId) return;

            if (message.method === "item/agentMessage/delta") {
              sawTextDelta = true;
              text += params.delta ?? "";
            }
            if (message.method === "item/reasoning/textDelta" && options?.includeReasoning) {
              sawReasoningDelta = true;
              text += params.delta ?? "";
            }
            if (message.method === "item/completed") {
              const item = params.item;
              if (item?.type === "agentMessage" && item.text && !sawTextDelta) {
                text += item.text;
              }
              if (item?.type === "reasoning" && options?.includeReasoning && item.content?.length) {
                if (!sawReasoningDelta) {
                  text += item.content.join("\n");
                }
              }
            }
            if (message.method === "thread/tokenUsage/updated") {
              usage = mapUsageFromTokenUsage(params.tokenUsage);
            }
            if (message.method === "turn/completed") {
              finishReason = { unified: "stop", raw: message.method };
              resolveCompletion(params.turn);
            }
            if (message.method === "error") {
              finishReason = { unified: "error", raw: "error" };
              rejectCompletion(new Error(params?.message ?? "codex app-server error"));
            }
          });

          const turnResult = await client.request("turn/start", {
            threadId,
            input: [{ type: "text", text: promptText }],
            cwd: options?.cwd ?? null,
            approvalPolicy: options?.approvalPolicy ?? null,
            sandboxPolicy: null,
            model: options?.modelOverride ?? modelId ?? null,
            effort: options?.reasoningEffort ?? null,
            summary: options?.reasoningSummary ?? null,
          });
          activeTurnId = activeTurnId ?? turnResult?.turn?.id ?? null;
          if (activeTurnId) {
            for (const message of buffered) {
              const params = message.params;
              if (params?.turnId && params.turnId !== activeTurnId) continue;
              if (message.method === "item/agentMessage/delta") {
                sawTextDelta = true;
                text += params.delta ?? "";
              }
              if (message.method === "item/reasoning/textDelta" && options?.includeReasoning) {
                sawReasoningDelta = true;
                text += params.delta ?? "";
              }
              if (message.method === "item/completed") {
                const item = params.item;
                if (item?.type === "agentMessage" && item.text && !sawTextDelta) {
                  text += item.text;
                }
                if (item?.type === "reasoning" && options?.includeReasoning && item.content?.length) {
                  if (!sawReasoningDelta) {
                    text += item.content.join("\n");
                  }
                }
              }
              if (message.method === "thread/tokenUsage/updated") {
                usage = mapUsageFromTokenUsage(params.tokenUsage);
              }
              if (message.method === "turn/completed") {
                finishReason = { unified: "stop", raw: message.method };
                resolveCompletion(params.turn);
              }
            }
          }

          if (callOptions.abortSignal) {
            const abortHandler = () => {
              if (threadId && activeTurnId) {
                client.request("turn/interrupt", { threadId, turnId: activeTurnId }).catch(() => {});
              }
            };
            if (callOptions.abortSignal.aborted) {
              abortHandler();
            } else {
              callOptions.abortSignal.addEventListener("abort", abortHandler, { once: true });
            }
          }

          try {
            await completion;
          } finally {
            unsubscribe();
          }
        });
      } catch (error) {
        warnings.push({ type: "other", message: error?.message ?? "codex app-server error" });
        finishReason = { unified: "error", raw: "app-server-error" };
      }

      return {
        content: [{ type: "text", text }],
        finishReason,
        usage,
        warnings,
      };
    },

    async doStream(callOptions) {
      const promptText = buildPrompt(callOptions.prompt, options);
      let usage = DEFAULT_USAGE;
      let finishReason = { unified: "other", raw: undefined };
      const textId = "text-1";
      const reasoningId = "reasoning-1";
      let textStarted = false;
      let reasoningStarted = false;
      let sawTextDelta = false;
      let sawReasoningDelta = false;

      const stream = new ReadableStream({
        start(controller) {
          const warnings = [];
          if (!promptText) {
            warnings.push({ type: "other", message: "Empty prompt; skipping codex app-server." });
          }
          controller.enqueue({ type: "stream-start", warnings });

          if (!promptText) {
            controller.enqueue({
              type: "finish",
              usage,
              finishReason: { unified: "other", raw: "empty-prompt" },
            });
            controller.close();
            return;
          }

          client.enqueue(async () => {
            await client.ensureInitialized();
            const threadResult = await client.request("thread/start", {
              model: options?.modelOverride ?? modelId ?? null,
              modelProvider: options?.modelProvider ?? null,
              cwd: options?.cwd ?? process.cwd(),
              approvalPolicy: options?.approvalPolicy ?? null,
              sandbox: options?.sandboxMode ?? null,
              config: options?.config ?? null,
              baseInstructions: options?.baseInstructions ?? null,
              developerInstructions: options?.developerInstructions ?? null,
              experimentalRawEvents: options?.experimentalRawEvents ?? false,
            });
            const threadId = threadResult?.thread?.id ?? threadResult?.threadId;
            if (!threadId) {
              throw new Error("codex app-server did not return a thread id");
            }

            let activeTurnId = null;
            const buffered = [];
            let resolveCompletion;
            let rejectCompletion;
            const completion = new Promise((resolve, reject) => {
              resolveCompletion = resolve;
              rejectCompletion = reject;
            });

            const unsubscribe = client.subscribe((message) => {
              if (message.type === "parse.error") {
                controller.enqueue({ type: "error", error: new Error("Failed to parse codex app-server JSONL output") });
                rejectCompletion(new Error("Failed to parse codex app-server JSONL output"));
                return;
              }
              if (!message.method) return;
              const params = message.params;
              if (!params || params.threadId !== threadId) return;
              if (!activeTurnId && params.turnId) {
                activeTurnId = params.turnId;
              }
              if (!activeTurnId) {
                buffered.push(message);
                return;
              }
              if (params.turnId && params.turnId !== activeTurnId) return;

              if (message.method === "item/agentMessage/delta") {
                sawTextDelta = true;
                if (!textStarted) {
                  controller.enqueue({ type: "text-start", id: textId });
                  textStarted = true;
                }
                controller.enqueue({ type: "text-delta", id: textId, delta: params.delta ?? "" });
              }
              if (message.method === "item/reasoning/textDelta" && options?.includeReasoning) {
                sawReasoningDelta = true;
                if (!reasoningStarted) {
                  controller.enqueue({ type: "reasoning-start", id: reasoningId });
                  reasoningStarted = true;
                }
                controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: params.delta ?? "" });
              }
              if (message.method === "item/completed") {
                const item = params.item;
                if (item?.type === "agentMessage" && item.text && !sawTextDelta) {
                  if (!textStarted) {
                    controller.enqueue({ type: "text-start", id: textId });
                    textStarted = true;
                  }
                  controller.enqueue({ type: "text-delta", id: textId, delta: item.text });
                }
                if (item?.type === "reasoning" && options?.includeReasoning && item.content?.length) {
                  if (!sawReasoningDelta) {
                    if (!reasoningStarted) {
                      controller.enqueue({ type: "reasoning-start", id: reasoningId });
                      reasoningStarted = true;
                    }
                    controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: item.content.join("\n") });
                  }
                }
              }
              if (message.method === "thread/tokenUsage/updated") {
                usage = mapUsageFromTokenUsage(params.tokenUsage);
              }
              if (message.method === "turn/completed") {
                finishReason = { unified: "stop", raw: message.method };
                resolveCompletion(params.turn);
              }
              if (message.method === "error") {
                finishReason = { unified: "error", raw: "error" };
                controller.enqueue({ type: "error", error: new Error(params?.message ?? "codex app-server error") });
                rejectCompletion(new Error(params?.message ?? "codex app-server error"));
              }
            });

            const turnResult = await client.request("turn/start", {
              threadId,
              input: [{ type: "text", text: promptText }],
              cwd: options?.cwd ?? null,
              approvalPolicy: options?.approvalPolicy ?? null,
              sandboxPolicy: null,
              model: options?.modelOverride ?? modelId ?? null,
              effort: options?.reasoningEffort ?? null,
              summary: options?.reasoningSummary ?? null,
            });
            activeTurnId = activeTurnId ?? turnResult?.turn?.id ?? null;
            if (activeTurnId) {
              for (const message of buffered) {
                const params = message.params;
                if (params?.turnId && params.turnId !== activeTurnId) continue;
                if (message.method === "item/agentMessage/delta") {
                  sawTextDelta = true;
                  if (!textStarted) {
                    controller.enqueue({ type: "text-start", id: textId });
                    textStarted = true;
                  }
                  controller.enqueue({ type: "text-delta", id: textId, delta: params.delta ?? "" });
                }
                if (message.method === "item/reasoning/textDelta" && options?.includeReasoning) {
                  sawReasoningDelta = true;
                  if (!reasoningStarted) {
                    controller.enqueue({ type: "reasoning-start", id: reasoningId });
                    reasoningStarted = true;
                  }
                  controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: params.delta ?? "" });
                }
                if (message.method === "item/completed") {
                  const item = params.item;
                  if (item?.type === "agentMessage" && item.text && !sawTextDelta) {
                    if (!textStarted) {
                      controller.enqueue({ type: "text-start", id: textId });
                      textStarted = true;
                    }
                    controller.enqueue({ type: "text-delta", id: textId, delta: item.text });
                  }
                  if (item?.type === "reasoning" && options?.includeReasoning && item.content?.length) {
                    if (!sawReasoningDelta) {
                      if (!reasoningStarted) {
                        controller.enqueue({ type: "reasoning-start", id: reasoningId });
                        reasoningStarted = true;
                      }
                      controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: item.content.join("\n") });
                    }
                  }
                }
                if (message.method === "thread/tokenUsage/updated") {
                  usage = mapUsageFromTokenUsage(params.tokenUsage);
                }
                if (message.method === "turn/completed") {
                  finishReason = { unified: "stop", raw: message.method };
                  resolveCompletion(params.turn);
                }
              }
            }

            if (callOptions.abortSignal) {
              const abortHandler = () => {
                if (threadId && activeTurnId) {
                  client.request("turn/interrupt", { threadId, turnId: activeTurnId }).catch(() => {});
                }
              };
              if (callOptions.abortSignal.aborted) {
                abortHandler();
              } else {
                callOptions.abortSignal.addEventListener("abort", abortHandler, { once: true });
              }
            }

            try {
              await completion;
            } finally {
              unsubscribe();
            }
          }).then(
            () => {
              if (reasoningStarted) {
                controller.enqueue({ type: "reasoning-end", id: reasoningId });
              }
              if (textStarted) {
                controller.enqueue({ type: "text-end", id: textId });
              }
              controller.enqueue({
                type: "finish",
                usage,
                finishReason,
              });
              controller.close();
            },
            (error) => {
              controller.enqueue({ type: "error", error });
              controller.enqueue({
                type: "finish",
                usage,
                finishReason: { unified: "error", raw: "app-server-error" },
              });
              controller.close();
            }
          );
        },
        cancel() {
          // handled by abort signal if provided
        },
      });

      return { stream };
    },
  };
}

export function createCodexAppServer(options = {}) {
  const providerId = options.name ?? "codex-app-server";
  const client = new AppServerClient(options);

  const provider = {
    specificationVersion: "v3",
    languageModel(modelId) {
      return createLanguageModel({ provider: providerId, modelId, options, client });
    },
    embeddingModel() {
      throw new Error("codex-app-server does not support embeddings");
    },
    imageModel() {
      throw new Error("codex-app-server does not support images");
    },
  };

  const callable = (modelId) => provider.languageModel(modelId);
  return Object.assign(callable, provider);
}
