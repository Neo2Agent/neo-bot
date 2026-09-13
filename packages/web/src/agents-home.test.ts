import assert from "node:assert/strict";
import test from "node:test";
import {
  accountInitials,
  accountName,
  chatStatusTone,
  formatFilesLabel,
  formatRelativeAge,
  groupRunsByTime,
  parseDiffStat,
  recentAgentRuns,
  runPrBadge,
  runWorkspaceLabel,
} from "./agents-home.js";

test("parseDiffStat reads git --stat summaries", () => {
  assert.deepEqual(parseDiffStat(""), { files: 0, added: 0, deleted: 0 });
  assert.deepEqual(
    parseDiffStat(" hello.txt | 2 ++\n 1 file changed, 2 insertions(+)\n"),
    { files: 1, added: 2, deleted: 0 },
  );
  assert.deepEqual(
    parseDiffStat(" a.ts | 10 +++---\n b.ts | 4 ++--\n 2 files changed, 930 insertions(+), 33 deletions(-)\n"),
    { files: 2, added: 930, deleted: 33 },
  );
});

test("groupRunsByTime buckets Last 7 days then older", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");
  const grouped = groupRunsByTime(
    [
      { id: "a", createdAt: "2026-09-12T12:00:00.000Z" },
      { id: "b", createdAt: "2026-08-20T12:00:00.000Z" },
      { id: "c", createdAt: "2026-07-01T12:00:00.000Z" },
    ],
    now,
  );
  assert.deepEqual(
    grouped.map((item) => [item.label, item.runs.map((run) => run.id)]),
    [
      ["Last 7 days", ["a"]],
      ["Last 30 days", ["b"]],
      ["Older", ["c"]],
    ],
  );
});

test("runPrBadge maps live agents to Open and archived PRs to Merged", () => {
  assert.equal(runPrBadge({ status: "IDLE", pullRequests: [] }), "Open");
  assert.equal(runPrBadge({ status: "RUNNING", pullRequests: [] }), "Open");
  assert.equal(runPrBadge({ status: "ARCHIVED", pullRequests: [] }), null);
  assert.equal(
    runPrBadge({ status: "ARCHIVED", pullRequests: [{ repoUrl: "", branch: "", url: "https://example.com/pr/1", draft: false, number: 1, title: "x" }] }),
    "Merged",
  );
});

test("runWorkspaceLabel uses the repo tail and skips desk labels", () => {
  assert.equal(runWorkspaceLabel({ repoUrls: ["https://github.com/acme/neo-bot.git"] }), "neo-bot");
  assert.equal(runWorkspaceLabel({ repoUrls: [] }), "local");
});

test("formatRelativeAge uses compact Cursor-style units", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");
  assert.equal(formatRelativeAge("2026-09-13T11:59:40.000Z", now), "now");
  assert.equal(formatRelativeAge("2026-09-13T10:00:00.000Z", now), "2h");
  assert.equal(formatRelativeAge("2026-09-10T12:00:00.000Z", now), "3d");
});

test("account helpers and card list stay free of desk copy", () => {
  assert.equal(accountName("admin"), "admin");
  assert.equal(accountName("zhou.yang@example.com"), "zhou.yang");
  assert.equal(accountInitials("zhou.yang@example.com"), "ZY");
  assert.equal(accountInitials("admin"), "A");
  assert.equal(formatFilesLabel(1), "1 file");
  assert.equal(formatFilesLabel(20), "20 files");
  assert.equal(chatStatusTone("RUNNING"), "run");
  assert.equal(chatStatusTone("IDLE"), "ok");
  assert.equal(chatStatusTone("ERROR"), "err");
  const listed = recentAgentRuns([
    { id: "1", status: "IDLE", createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z", pullRequests: [], repoUrls: [] } as never,
    { id: "2", status: "ARCHIVED", createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z", pullRequests: [], repoUrls: [] } as never,
    {
      id: "3",
      status: "ARCHIVED",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
      pullRequests: [{ repoUrl: "", branch: "", url: "https://example.com/pr/9", draft: false, number: 9, title: "x" }],
      repoUrls: [],
    } as never,
  ]);
  assert.deepEqual(listed.map((run) => run.id), ["1", "3"]);
});
