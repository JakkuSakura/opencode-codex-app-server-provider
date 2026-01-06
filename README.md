# opencode-codex-exec-provider

Custom AI SDK provider that forwards OpenCode requests to `codex exec --json`.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Clone this repo:

```bash
git clone https://github.com/JakkuSakura/opencode-codex-exec-provider
```

3) Configure OpenCode to use the provider.
Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "codex-exec/gpt-5.2-codex-medium",
  "provider": {
    "codex-exec": {
      "npm": "file:///Users/jakku/Dev/opencode-codex-exec-provider",
      "name": "Codex Exec",
      "options": {
        "codexPath": "codex",
        "includeReasoning": false,
        "skipGitRepoCheck": true,
        "emptyPromptFallback": "placeholder"
      },
      "models": {
        "gpt-5.2-codex-medium": {
          "id": "gpt-5.2-codex",
          "name": "GPT 5.2 Codex Medium (codex exec)",
          "family": "gpt-5.2-codex",
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

5) In the TUI, run `/models` and select `codex-exec/gpt-5.2-codex-medium`.

## Setup for LLM Agents

If you are an LLM agent configuring this on a user's machine, follow this checklist:

Step 0: Confirm prerequisites
- `codex` CLI is installed and on PATH.
- User has authenticated with `codex login` if required.

Step 1: Install the provider
```bash
git clone https://github.com/JakkuSakura/opencode-codex-exec-provider
```

Step 2: Configure OpenCode
- Add the provider config in `~/.config/opencode/opencode.json` (see Setup section above).
- Use `file://` path for the local repo.

Step 3: Verify
```bash
opencode --version
```
Then in the OpenCode TUI:
- Run `/models`
- Select `codex-exec/gpt-5.2-codex-medium`
- Run a small prompt and confirm output

Step 4: Debug if needed
- If you see `Reading prompt from stdin...`, set `emptyPromptFallback` to `json` and retry.

## Notes

- This provider is text-only. Images and files are represented as placeholders in the prompt.
- Tool calls are not bridged; they are stringified into the prompt.
- If you see `Reading prompt from stdin...`, enable `emptyPromptFallback: "json"` to inspect what OpenCode is sending.

## Options

- `codexPath`: path to the Codex CLI (default: `codex`)
- `args`: extra args for `codex exec`
- `env`: extra environment variables for the child process
- `includeReasoning`: include Codex reasoning items in the stream
- `skipGitRepoCheck`: set to false to enforce git repo check
- `emptyPromptFallback`: behavior when the prompt is empty (`placeholder`, `json`, `error`, `skip`)
