# opencode-codex-provider

OpenCode provider that reads `~/.codex/config.toml` and uses the configured Codex model provider + API key. Branding name: Codex.

## LLM installation help

If you want an LLM to help you install or configure this provider, you can paste the full README into OpenCode and ask it to follow the setup section to install and set you to be the default model. Check if there exists `~/.codex` to configure the config properly.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Configure Codex in `~/.codex/config.toml` and login (`codex login`).

3) Clone this repo:

```bash
git clone https://github.com/JakkuSakura/opencode-codex-provider
```

4) Install dependencies (pnpm) and build if you plan to edit TypeScript:

```bash
pnpm install
pnpm run build
```

5) Configure OpenCode to use the provider.
Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "codex/default",
  "provider": {
    "codex": {
      "npm": "file:///path/to/opencode-codex-provider",
      "name": "Codex",
      "options": {
        "codexHome": "~/.codex",
        "useCodexConfigModel": true
      },
      "models": {
        "default": {
          "id": "default",
          "name": "Codex (from ~/.codex)",
          "family": "codex",
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

6) Restart OpenCode.

7) In the TUI, run `/models` and select `codex/default`.

## Oh-My-OpenCode (default model override)

Oh-My-OpenCode can override agent model choices. To make all agents use Codex, update `~/.config/opencode/oh-my-opencode.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "agents": {
    "Sisyphus": {
      "model": "codex/default"
    },
    "librarian": {
      "model": "codex/default"
    },
    "explore": {
      "model": "codex/default"
    },
    "oracle": {
      "model": "codex/default"
    },
    "frontend-ui-ux-engineer": {
      "model": "codex/default"
    },
    "document-writer": {
      "model": "codex/default"
    },
    "multimodal-looker": {
      "model": "codex/default"
    }
  }
}
```

Reference: https://github.com/code-yeongyu/oh-my-opencode

## Image input

OpenCode uses the Vercel AI SDK. For images, send a message part with `type: "image"` and an `image` value (URL, base64, or file id). It is converted to Responses API `input_image` under the hood.

## Plugin paths (conventional)

OpenCode auto-loads local plugins from:

- `~/.config/opencode/plugin/` (global)
- `.opencode/plugin/` (project)

See https://opencode.ai/docs/plugins/ for details.

## Notes

- The provider reads `~/.codex/config.toml` on each request and uses the selected `model_provider` and `model`.
- API keys are resolved from `~/.codex/auth.json` (same as Codex CLI) or from the env var specified by `env_key`.
- This provider does not support OpenAI's official consumer Codex endpoints; use a platform API base URL or a compatible proxy.

## Available models

- `gpt-5.2`: none/low/medium/high/xhigh
- `gpt-5.2-codex`: low/medium/high/xhigh
- `gpt-5.1-codex-max`: low/medium/high/xhigh
- `gpt-5.1-codex`: low/medium/high
- `gpt-5.1-codex-mini`: medium/high
- `gpt-5.1`: none/low/medium/high

## Options

- `codexHome`: path to Codex home (default: `~/.codex`)
- `useCodexConfigModel`: when true, always use the model from `~/.codex/config.toml`
- `apiKeys`: when `useCodexConfigModel` is false, an optional map of provider id → API key to override `~/.codex/auth.json`

### useCodexConfigModel = false

When `useCodexConfigModel` is false, OpenCode controls the model selection. The provider will use the model passed by OpenCode (or the default `codex/default`), and ignore `model` in `~/.codex/config.toml`.

**Example (use OpenCode model selection):**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "codex/default",
  "provider": {
    "codex": {
      "npm": "file:///path/to/opencode-codex-provider",
      "name": "Codex",
      "options": {
        "codexHome": "~/.codex",
        "useCodexConfigModel": false,
        "apiKeys": {
          "openai": "sk-...",
          "tabcode": "sk-..."
        }
      },
      "models": {
        "default": {
          "id": "default",
          "name": "Codex (from ~/.codex)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 272000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "fast": {
          "id": "gpt-4.1-mini",
          "name": "GPT-4.1 Mini",
          "family": "gpt-4.1",
          "reasoning": false,
          "limit": { "context": 128000, "output": 16384 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        }
      }
    }
  }
}
```

Then pick a model in OpenCode (e.g., `/models` → `codex/fast`).
