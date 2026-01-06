import test from "node:test";
import assert from "node:assert/strict";
import { ensureMode } from "../src/provider";

test("ensureMode adds regular mode when missing", () => {
  const options = { inputFormat: "messages" } as any;
  const normalized = ensureMode(options);
  assert.equal(normalized.mode.type, "regular");
});

test("ensureMode preserves existing mode", () => {
  const options = { inputFormat: "messages", mode: { type: "object-json" } } as any;
  const normalized = ensureMode(options);
  assert.equal(normalized.mode.type, "object-json");
});
