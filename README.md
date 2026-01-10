# opencode-codex-provider

OpenCode provider that reads `~/.codex/config.toml` and uses the configured Codex model provider + API key. Branding name: Codex.

## LLM installation help

If you want an LLM to help you install or configure this provider, you can paste the full README into OpenCode and ask it to follow the setup section to install and set you to be the default model. Check if there exists `~/.codex` to configure the config properly.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Configure Codex in `~/.codex/config.toml` and login (`codex login`).

3) Clone this repo into the OpenCode providers directory:

```bash
mkdir -p ~/.config/opencode/providers

git clone https://github.com/JakkuSakura/opencode-codex-provider ~/.config/opencode/providers/opencode-codex-provider
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
        "//": "codexHome: path to Codex home (default: ~/.codex)",
        "codexHome": "~/.codex",
        "//": "servers: optional map of server name -> { api_key, base_url }",
        "servers": {
          "server-1": {
            "api_key": "sk-...",
            "base_url": "https://api.openai.com/v1"
          },
          "server-2": {
            "api_key": "sk-...",
            "base_url": "https://api.example.com/v1"
          }
        },
        "//": "server: selects which server entry to use from servers (if omitted, defaults to the server from ~/.codex/config.toml)",
        "server": "server-1",
        "//": "modelServers: per-model override of servers/server",
        "modelServers": {
          "gpt-5.2-codex": {
            "server": "server-2"
          }
        },
        "//": "pricing: optional per-million token cost to compute providerMetadata.costUsd",
        "pricing": {
          "input_per_mtoken": 5.0,
          "output_per_mtoken": 15.0
        }
      },
      "models": {
        "default": {
          "id": "default",
          "name": "Codex (from ~/.codex)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": {
            "reasoningEffort": "medium",
            "reasoningSummary": "auto",
            "textVerbosity": "medium"
          }
        },
        "gpt-5.2-none": {
          "id": "gpt-5.2",
          "name": "GPT-5.2 (none)",
          "family": "gpt-5.2",
          "reasoning": false,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "none" }
        },
        "gpt-5.2-low": {
          "id": "gpt-5.2",
          "name": "GPT-5.2 (low)",
          "family": "gpt-5.2",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "low" }
        },
        "gpt-5.2-medium": {
          "id": "gpt-5.2",
          "name": "GPT-5.2 (medium)",
          "family": "gpt-5.2",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.2-high": {
          "id": "gpt-5.2",
          "name": "GPT-5.2 (high)",
          "family": "gpt-5.2",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        },
        "gpt-5.2-xhigh": {
          "id": "gpt-5.2",
          "name": "GPT-5.2 (xhigh)",
          "family": "gpt-5.2",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "xhigh" }
        },
        "gpt-5.2-codex-low": {
          "id": "gpt-5.2-codex",
          "name": "GPT-5.2 Codex (low)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "low" }
        },
        "gpt-5.2-codex-medium": {
          "id": "gpt-5.2-codex",
          "name": "GPT-5.2 Codex (medium)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.2-codex-high": {
          "id": "gpt-5.2-codex",
          "name": "GPT-5.2 Codex (high)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        },
        "gpt-5.2-codex-xhigh": {
          "id": "gpt-5.2-codex",
          "name": "GPT-5.2 Codex (xhigh)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "xhigh" }
        },
        "gpt-5.1-codex-max-low": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT-5.1 Codex Max (low)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "low" }
        },
        "gpt-5.1-codex-max-medium": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT-5.1 Codex Max (medium)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.1-codex-max-high": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT-5.1 Codex Max (high)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        },
        "gpt-5.1-codex-max-xhigh": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT-5.1 Codex Max (xhigh)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "xhigh" }
        },
        "gpt-5.1-codex-low": {
          "id": "gpt-5.1-codex",
          "name": "GPT-5.1 Codex (low)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "low" }
        },
        "gpt-5.1-codex-medium": {
          "id": "gpt-5.1-codex",
          "name": "GPT-5.1 Codex (medium)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.1-codex-high": {
          "id": "gpt-5.1-codex",
          "name": "GPT-5.1 Codex (high)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        },
        "gpt-5.1-codex-mini-medium": {
          "id": "gpt-5.1-codex-mini",
          "name": "GPT-5.1 Codex Mini (medium)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 100000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.1-codex-mini-high": {
          "id": "gpt-5.1-codex-mini",
          "name": "GPT-5.1 Codex Mini (high)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 400000, "output": 100000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        },
        "gpt-5.1-none": {
          "id": "gpt-5.1",
          "name": "GPT-5.1 (none)",
          "family": "gpt-5.1",
          "reasoning": false,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "none" }
        },
        "gpt-5.1-low": {
          "id": "gpt-5.1",
          "name": "GPT-5.1 (low)",
          "family": "gpt-5.1",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "low" }
        },
        "gpt-5.1-medium": {
          "id": "gpt-5.1",
          "name": "GPT-5.1 (medium)",
          "family": "gpt-5.1",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "medium" }
        },
        "gpt-5.1-high": {
          "id": "gpt-5.1",
          "name": "GPT-5.1 (high)",
          "family": "gpt-5.1",
          "reasoning": true,
          "limit": { "context": 400000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": { "reasoningEffort": "high" }
        }
      }
    }
  }
}
```

6) Restart OpenCode.

7) In the TUI, run `/models` and select `codex/default`.

## Upgrade

### LLM-assisted upgrade (OpenCode)

Open OpenCode and send this instruction so the model uses git to update the provider repo:

```
Follow README.md to update opencode-codex-provider. Use git tool. Repo: https://github.com/JakkuSakura/opencode-codex-provider
```

### Manual upgrade

```bash
cd ~/.config/opencode/providers/opencode-codex-provider

git fetch origin
# Prefer fast-forward updates only
git pull --ff-only

pnpm install
pnpm run build
```

Restart OpenCode after upgrading.

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

## Notes

- The provider reads `~/.codex/config.toml` on each request and uses the selected `model_provider` and `model`.
- API keys are resolved from `~/.codex/auth.json` (same as Codex CLI) or from the env var specified by `env_key`.
- This provider does not support OpenAI's official consumer Codex endpoints; use a platform API base URL or a compatible proxy.

