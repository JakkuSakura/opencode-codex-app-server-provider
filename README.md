# opencode-codex-app-server-provider

Custom AI SDK provider that forwards OpenCode requests to `codex app-server` over stdio.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Clone this repo:

```bash
git clone https://github.com/JakkuSakura/opencode-codex-app-server-provider
```

3) Configure OpenCode to use the provider.
Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "codex-app-server/gpt-5.1-codex-max",
  "provider": {
    "codex-app-server": {
      "npm": "file:///Users/jakku/Dev/opencode-codex-app-server-provider",
      "name": "Codex App Server",
      "options": {
        "codexPath": "codex",
        "includeReasoning": false,
        "sandboxMode": "danger-full-access",
        "approvalPolicy": "never",
        "approvalDecision": "accept",
        "emptyPromptFallback": "placeholder"
      },
      "models": {
        "gpt-5.1-codex-max": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT 5.1 Codex Max (codex app-server)",
          "family": "gpt-5.1-codex",
          "reasoning": true,
          "limit": { "context": 272000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": {
            "reasoningEffort": "medium",
            "reasoningSummary": "auto",
            "textVerbosity": "medium"
          }
        }
      }
    }
  }
}
```

4) Restart OpenCode.

5) In the TUI, run `/models` and select `codex-app-server/gpt-5.1-codex-max`.

## Setup for LLM Agents

If you are an LLM agent configuring this on a user's machine, follow this checklist:

Step 0: Confirm prerequisites
- `codex` CLI is installed and on PATH.
- User has authenticated with `codex login` if required.

Step 1: Install the provider
```bash
git clone https://github.com/JakkuSakura/opencode-codex-app-server-provider
```

Step 2: Configure OpenCode
- Add the provider config in `~/.config/opencode/opencode.json` (see Setup section above).
- Use a `file://` path for the local repo.

Step 3: Verify
```bash
opencode --version
```
Then in the OpenCode TUI:
- Run `/models`
- Select `codex-app-server/gpt-5.1-codex-max`
- Run a small prompt and confirm streaming output

## Notes

- This provider uses a persistent `codex app-server` process and sends JSON-RPC messages over stdio.
- Images and files are represented as placeholders in the prompt.
- Tool calls are not bridged; they are stringified into the prompt.

## Approvals

Codex app-server may request approvals for command execution or file changes. This provider auto-responds using `approvalDecision` (new API) and `legacyApprovalDecision` (legacy API). Set them in the provider `options` to avoid stalled requests.

## Available models

From `codex app-server` `model/list` (Codex CLI 0.77.0):

- `gpt-5.1-codex-max` (default)
- `gpt-5.1-codex-mini`
- `gpt-5.2`

## Options

- `codexPath`: path to the Codex CLI (default: `codex`)
- `args`: extra args for `codex app-server`
- `env`: extra environment variables for the child process
- `includeReasoning`: include reasoning deltas in the stream
- `emptyPromptFallback`: behavior when the prompt is empty (`placeholder`, `json`, `error`, `skip`)
- `approvalPolicy`: approval policy for thread/turn (`untrusted`, `on-failure`, `on-request`, `never`)
- `approvalDecision`: auto-response for approval requests (`accept`, `decline`, `cancel`, `acceptForSession`, `acceptWithExecpolicyAmendment`)
- `legacyApprovalDecision`: auto-response for legacy approval requests (`approved`, `approved_for_session`, `denied`, `abort`)
- `sandboxMode`: sandbox mode (`read-only`, `workspace-write`, `danger-full-access`)
- `cwd`: working directory for the thread/turn
- `modelOverride`: override model sent to app-server
- `reasoningEffort`: reasoning effort override (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`)
- `reasoningSummary`: reasoning summary override (`auto`, `concise`, `detailed`, `none`)
