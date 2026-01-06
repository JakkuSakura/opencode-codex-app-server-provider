export type CodexAppServerProviderOptions = {
  name?: string;
  codexPath?: string;
  args?: string[];
  env?: Record<string, string>;
  includeReasoning?: boolean;
  emptyPromptFallback?: "placeholder" | "json" | "error" | "skip";
  approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never";
  approvalDecision?: "accept" | "decline" | "cancel" | "acceptForSession" | "acceptWithExecpolicyAmendment";
  legacyApprovalDecision?: "approved" | "approved_for_session" | "denied" | "abort";
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  cwd?: string;
  modelOverride?: string | null;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  reasoningSummary?: "auto" | "concise" | "detailed" | "none";
  modelProvider?: string | null;
  config?: Record<string, unknown> | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  experimentalRawEvents?: boolean;
};

export function createCodexAppServer(options?: CodexAppServerProviderOptions): any;
