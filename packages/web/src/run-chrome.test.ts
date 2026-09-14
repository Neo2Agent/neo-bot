import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationPrBadge,
  conversationPrTitle,
  environmentLine,
  isSameUserPrompt,
  parseDiffFiles,
  workedForLine,
} from "./run-chrome.js";

test("parseDiffFiles prefers unified patch paths and counts", () => {
  const patch = [
    "diff --git a/packages/web/src/badge.tsx b/packages/web/src/badge.tsx",
    "--- a/packages/web/src/badge.tsx",
    "+++ b/packages/web/src/badge.tsx",
    "@@ -1,3 +1,4 @@",
    " keep",
    "-old",
    "+new",
    "+also",
    "diff --git a/mock-w1-api.mjs b/mock-w1-api.mjs",
    "+++ b/mock-w1-api.mjs",
    "+one",
  ].join("\n");
  assert.deepEqual(parseDiffFiles("ignored | 9 +++++----", patch), [
    { path: "packages/web/src/badge.tsx", added: 2, deleted: 1 },
    { path: "mock-w1-api.mjs", added: 1, deleted: 0 },
  ]);
});

test("parseDiffFiles falls back to git --stat bars when there is no patch", () => {
  assert.deepEqual(
    parseDiffFiles(" mock-w1-api.mjs | 53 +++++++++++++++++++++++++++++++++\n badge.tsx | 17 ++++++++++-------\n 2 files changed, 63 insertions(+), 7 deletions(-)\n"),
    [
      { path: "mock-w1-api.mjs", added: 33, deleted: 0 },
      { path: "badge.tsx", added: 10, deleted: 7 },
    ],
  );
  assert.deepEqual(parseDiffFiles(""), []);
});

test("environmentLine is derived from setupStatus, not SSE", () => {
  assert.equal(environmentLine({ status: "IDLE", setupStatus: "START_SUCCEEDED" }), "Environment ready");
  assert.equal(environmentLine({ status: "IDLE", setupStatus: "INSTALL_SUCCEEDED" }), "Environment ready");
  assert.equal(environmentLine({ status: "RUNNING", setupStatus: "START_SUCCEEDED" }), "Environment ready");
  assert.equal(environmentLine({ status: "RUNNING", setupStatus: "INSTALL_SUCCEEDED" }), null);
  assert.equal(environmentLine({ status: "RUNNING", setupStatus: "START_STARTED" }), null);
  assert.equal(environmentLine({ status: "INSTALLING", setupStatus: "INSTALL_STARTED" }), null);
  assert.equal(environmentLine({ status: "IDLE", setupStatus: null }), null);
  assert.equal(environmentLine({ status: "ERROR", setupStatus: "INSTALL_FAILED" }), null);
  assert.equal(environmentLine({ status: "ERROR", setupStatus: "START_FAILED" }), null);
});

test("workedForLine uses createdAt and idleAt only", () => {
  const now = new Date("2026-09-13T12:00:40.000Z");
  assert.equal(
    workedForLine({ createdAt: "2026-09-13T12:00:00.000Z", idleAt: "2026-09-13T12:00:40.000Z", status: "IDLE" }, now),
    "Worked for 40s",
  );
  assert.equal(
    workedForLine({ createdAt: "2026-09-13T12:00:00.000Z", idleAt: null, status: "RUNNING" }, now),
    "Worked for 40s",
  );
  assert.equal(
    workedForLine({ createdAt: "2026-09-13T12:00:00.000Z", idleAt: "2026-09-13T12:05:58.000Z", status: "IDLE" }, now),
    "Worked for 5m 58s",
  );
  assert.equal(workedForLine({ createdAt: "2026-09-13T12:00:00.000Z", idleAt: null, status: "IDLE" }, now), null);
  assert.equal(workedForLine({ createdAt: "bad", idleAt: "2026-09-13T12:00:40.000Z", status: "IDLE" }, now), null);
});

test("conversationPrBadge hides when no PR and maps Open / Draft / Merged", () => {
  assert.equal(conversationPrBadge({ status: "IDLE" }, null), null);
  assert.equal(conversationPrBadge({ status: "IDLE" }, { draft: false }), null);
  assert.equal(conversationPrBadge({ status: "IDLE" }, { url: "https://example.com/pr/1", draft: false }), "Open");
  assert.equal(conversationPrBadge({ status: "RUNNING" }, { url: "https://example.com/pr/1", draft: true }), "Draft");
  assert.equal(conversationPrBadge({ status: "ARCHIVED" }, { url: "https://example.com/pr/1", draft: false }), "Merged");
});

test("conversationPrTitle truncates to the PR title and never invents a PR", () => {
  assert.equal(conversationPrTitle({ title: "feat: observe rollback", number: 29 }), "feat: observe rollback");
  assert.equal(conversationPrTitle({ title: "  ", number: 29 }), "#29");
  assert.equal(conversationPrTitle({ title: "", number: null }, "Edit hello.txt"), "Edit hello.txt");
  assert.equal(conversationPrTitle(null), "Pull request");
});

test("first user bubble matches the run title", () => {
  assert.equal(isSameUserPrompt("  Open a PR  ", "Open a PR"), true);
  assert.equal(isSameUserPrompt("follow up", "Open a PR"), false);
});
