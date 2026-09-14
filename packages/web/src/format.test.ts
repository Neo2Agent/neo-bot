import assert from "node:assert/strict";
import test from "node:test";
import {
  fileToolDiff,
  formatDuration,
  formatMessageTime,
  formatRunTime,
  formatUsage,
  formatWhen,
  modelLabel,
  parseUnifiedDiff,
  resolveChatModel,
  runListPlaceSuffix,
  humanizeToolName,
  toolActivityKind,
  toolActivityLabel,
  toolArgPreview,
  toolDisplayName,
  toolRowPresentation,
} from "./format.js";

test("runListPlaceSuffix labels Remote separately from This Computer", () => {
  assert.equal(
    runListPlaceSuffix({
      executionTarget: { loop: "cloud", tools: "desk", deskId: "desk_1", remoteControl: true },
    }),
    " · Remote",
  );
  assert.equal(runListPlaceSuffix({ executionTarget: { loop: "desk", tools: "desk", deskId: "desk_1" } }), " · 本机");
  assert.equal(
    runListPlaceSuffix({
      executionTarget: { loop: "desk", tools: "desk", deskId: "desk_1", remoteControl: true },
    }),
    " · 本机",
  );
  assert.equal(runListPlaceSuffix({ executionTarget: { loop: "cloud", tools: "cloud" }, vmSlotId: "slot-0" }), " · VM 1");
});

test("modelLabel distinguishes DeepSeek Flash, Vision, and Pro", () => {
  assert.equal(modelLabel("deepseek", "deepseek-v4-flash"), "DeepSeek Flash");
  assert.equal(modelLabel("deepseek", "deepseek-v4-pro"), "DeepSeek Pro");
  assert.equal(modelLabel("deepseek", "deepseek-v4-flash-vision-exp"), "DeepSeek Flash Vision");
  assert.equal(resolveChatModel("deepseek", "deepseek-v4-flash"), "deepseek-v4-flash");
  assert.equal(resolveChatModel("deepseek", "deepseek-v4-flash", true), "deepseek-v4-flash-vision-exp");
});

test("formatUsage prints total tokens", () => {
  assert.equal(formatUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 15 }), "15 tok");
});

test("formatWhen uses Shanghai time and drops the current year", () => {
  const now = new Date("2026-08-24T00:00:00.000Z");
  assert.equal(formatWhen("2026-08-24T09:30:00.000Z", now), "8/24 17:30");
  assert.match(formatWhen("2025-06-01T00:00:00.000Z", now), /2025/);
});

test("formatRunTime and formatMessageTime show update only when the minute changes", () => {
  const now = new Date("2026-08-24T00:00:00.000Z");
  assert.equal(formatRunTime("2026-08-24T09:30:00.000Z", "2026-08-24T09:30:40.000Z", now), "8/24 17:30");
  assert.equal(
    formatRunTime("2026-08-24T09:30:00.000Z", "2026-08-24T10:05:00.000Z", now),
    "创建 8/24 17:30 · 更新 8/24 18:05",
  );
  assert.equal(formatMessageTime("2026-08-24T09:30:00.000Z", "2026-08-24T10:05:00.000Z", true, now), "8/24 17:30");
  assert.equal(
    formatMessageTime("2026-08-24T09:30:00.000Z", "2026-08-24T10:05:00.000Z", false, now),
    "8/24 17:30 · 完成 8/24 18:05",
  );
});

test("formatDuration prints seconds then minutes", () => {
  assert.equal(formatDuration("2026-08-24T09:30:00.000Z", "2026-08-24T09:30:12.000Z"), "12s");
  assert.equal(formatDuration("2026-08-24T09:30:00.000Z", "2026-08-24T09:33:00.000Z"), "3m");
});

test("toolArgPreview prefers command and path", () => {
  assert.equal(toolArgPreview({ command: "ls -la" }), "ls -la");
  assert.equal(toolArgPreview({ path: "src/app.ts" }), "src/app.ts");
});

test("toolActivityLabel is a gray explore / shell / name row", () => {
  assert.equal(toolActivityKind("read"), "explore");
  assert.equal(toolActivityKind("bash"), "shell");
  assert.equal(toolActivityKind("terminal"), "shell");
  assert.equal(toolActivityKind("exec"), "shell");
  assert.equal(toolActivityKind("edit"), "file");
  assert.equal(toolActivityKind("neo_pr_create"), "default");
  assert.equal(humanizeToolName("neo_artifact_upload"), "uploaded");
  assert.equal(humanizeToolName("neo_pr_create"), "pr create");
  assert.equal(toolDisplayName({ name: "neo_artifact_upload" }), "uploaded");
  assert.equal(toolActivityLabel({ name: "read", args: { path: "src/app.ts" } }, "read"), "explored src/app.ts");
  assert.equal(toolActivityLabel({ name: "grep" }, "grep"), "explored");
  assert.equal(toolActivityLabel({ name: "bash", args: { command: "ls -la" } }, "bash"), "$ ls -la");
  assert.equal(toolActivityLabel({ name: "edit", args: { path: "hello.txt" } }, "edit"), "hello.txt");
  assert.equal(toolActivityLabel({ name: "neo_pr_create", args: { title: "Open" } }, "neo_pr_create"), "pr create Open");
  assert.equal(
    toolActivityLabel({ name: "neo_artifact_upload", args: { path: "hello.txt" } }, "neo_artifact_upload"),
    "uploaded hello.txt",
  );
});

test("toolRowPresentation always paints a collapsed $ mini-card for shell tools", () => {
  const shell = toolRowPresentation(
    { name: "bash", status: "completed", args: { command: "ls -la" }, output: "README.md\n" },
    false,
  );
  assert.equal(shell.kind, "shell");
  assert.equal(shell.label, "$ ls -la");
  assert.equal(shell.className, "tool is-compact is-shell");
  assert.equal(shell.open, false);
  const running = toolRowPresentation({ name: "terminal", status: "running", args: { command: "pwd" } }, true);
  assert.equal(running.label, "$ pwd");
  assert.equal(running.className, "tool run is-compact is-shell");
  assert.equal(running.open, true);
  const explore = toolRowPresentation({ name: "read", status: "completed", args: { path: "src/app.ts" } }, false);
  assert.equal(explore.label, "read");
  assert.doesNotMatch(explore.className, /is-compact/);
});

test("fileToolDiff renders edit old/new text", () => {
  const diff = fileToolDiff({
    name: "edit",
    args: { path: "README.md", edits: [{ oldText: "hello", newText: "world" }] },
  });
  assert.equal(diff?.path, "README.md");
  assert.deepEqual(diff?.lines, [
    { type: "del", text: "hello" },
    { type: "add", text: "world" },
  ]);
});

test("fileToolDiff prefers persisted unified diff details", () => {
  const diff = fileToolDiff({
    name: "edit",
    args: { path: "a.ts" },
    details: { diff: "--- a\n+++ b\n@@\n-old\n+new\n" },
  });
  assert.deepEqual(
    diff?.lines.map((line) => `${line.type}:${line.text}`),
    ["del:old", "add:new"],
  );
  assert.ok(parseUnifiedDiff("+ok\n").length === 1);
});
