import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeResponsesOptions, selectModel, withResponsesInstructions } from "../src/provider";

test("selectModel uses chat when wire_api is chat", () => {
  const calls: string[] = [];
  const client = {
    chat: (id: string) => {
      calls.push(`chat:${id}`);
      return { kind: "chat", id };
    },
    responses: (id: string) => {
      calls.push(`responses:${id}`);
      return { kind: "responses", id };
    },
  };

  const model = selectModel(client, "chat", "gpt-5.2-codex");
  assert.equal(calls[0], "chat:gpt-5.2-codex");
  assert.equal((model as any).kind, "chat");
});

test("selectModel uses responses when wire_api is responses", () => {
  const calls: string[] = [];
  const client = {
    chat: (id: string) => {
      calls.push(`chat:${id}`);
      return { kind: "chat", id };
    },
    responses: (id: string) => {
      calls.push(`responses:${id}`);
      return { kind: "responses", id };
    },
  };

  const model = selectModel(client, "responses", "gpt-5.2-codex");
  assert.equal(calls[0], "responses:gpt-5.2-codex");
  assert.equal((model as any).kind, "responses");
});

test("withResponsesInstructions preserves existing instructions", () => {
  const options = {
    providerOptions: {
      openai: {
        instructions: "Keep this.",
      },
    },
  };

  const next = withResponsesInstructions(options as any, {
    codexHome: os.tmpdir(),
    modelId: "gpt-5.2-codex",
  });
  assert.equal((next.providerOptions as any).openai.instructions, "Keep this.");
});

test("withResponsesInstructions uses override when provided", () => {
  const options = {
    prompt: [{ role: "user", content: "hi" }],
  };

  const next = withResponsesInstructions(options as any, {
    codexHome: os.tmpdir(),
    modelId: "gpt-5.2-codex",
    instructions: "Override instructions.",
  });
  const instr = (next.providerOptions as any).openai.instructions as string;
  assert.equal(instr, "Override instructions.");
});

test("withResponsesInstructions loads instructions from file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-instructions-"));
  const file = path.join(dir, "base.md");
  fs.writeFileSync(file, "Base instructions from file.");

  const next = withResponsesInstructions({ prompt: [] } as any, {
    codexHome: dir,
    modelId: "gpt-5.2-codex",
    instructionsFile: file,
  });
  const instr = (next.providerOptions as any).openai.instructions as string;
  assert.equal(instr, "Base instructions from file.");
});

test("withResponsesInstructions injects user instructions from AGENTS", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agents-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "Use these rules.");

  const next = withResponsesInstructions({ prompt: [{ role: "user", content: "hi" }] } as any, {
    codexHome: dir,
    modelId: "gpt-5.2-codex",
  });
  const prompt = next.prompt as any[];
  assert.equal(prompt[0].role, "user");
  assert.ok(prompt[0].content[0].text.includes("<user_instructions>"));
});

test("withResponsesInstructions uses bundled codex prompt for codex models", () => {
  const next = withResponsesInstructions({ prompt: [] } as any, {
    codexHome: os.tmpdir(),
    modelId: "gpt-5.2-codex",
  });
  const instr = (next.providerOptions as any).openai.instructions as string;
  assert.ok(instr.startsWith("You are Codex, based on GPT-5."));
});

test("normalizeResponsesOptions drops maxOutputTokens", () => {
  const normalized = normalizeResponsesOptions(
    { prompt: [], maxOutputTokens: 123 } as any,
    { codexHome: os.tmpdir(), modelId: "gpt-5.2-codex" },
  );
  assert.equal((normalized as any).maxOutputTokens, undefined);
});

test("normalizeResponsesOptions forces store true", () => {
  const normalized = normalizeResponsesOptions(
    { prompt: [], providerOptions: { openai: { store: false } } } as any,
    { codexHome: os.tmpdir(), modelId: "gpt-5.2-codex" },
  );
  assert.equal((normalized as any).providerOptions.openai.store, true);
});
