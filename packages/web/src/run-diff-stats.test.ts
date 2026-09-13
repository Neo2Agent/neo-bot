import assert from "node:assert/strict";
import test from "node:test";
import {
  decideDiffRetry,
  EMPTY_DIFF_CONFIRMATIONS,
  isRunSettled,
  isWorkspaceReady,
  loadRunDiffStat,
} from "./run-diff-stats.js";

test("workspace ready waits for start to finish", () => {
  assert.equal(isWorkspaceReady({ status: "INSTALLING", setupStatus: "INSTALL_STARTED" }), false);
  assert.equal(isWorkspaceReady({ status: "RUNNING", setupStatus: "START_STARTED" }), false);
  assert.equal(isWorkspaceReady({ status: "RUNNING", setupStatus: "INSTALL_SUCCEEDED" }), false);
  assert.equal(isWorkspaceReady({ status: "IDLE", setupStatus: "INSTALL_SUCCEEDED" }), true);
  assert.equal(isWorkspaceReady({ status: "IDLE", setupStatus: "START_SUCCEEDED" }), true);
  assert.equal(isWorkspaceReady({ status: "RUNNING", setupStatus: "START_SUCCEEDED" }), true);
  assert.equal(isWorkspaceReady({ status: "PROVISIONING", setupStatus: null }), false);
  assert.equal(isWorkspaceReady({ status: "IDLE", setupStatus: null }), true);
  assert.equal(isRunSettled({ status: "RUNNING" }), false);
  assert.equal(isRunSettled({ status: "IDLE" }), true);
});

test("decideDiffRetry keeps empty first-login fetches from going final", () => {
  assert.equal(
    decideDiffRetry({
      attempts: 1,
      emptyReadySettled: 1,
      hasStat: false,
      ready: true,
      settled: true,
      fetchFailed: false,
    }),
    "retry",
  );
  assert.equal(
    decideDiffRetry({
      attempts: 2,
      emptyReadySettled: 2,
      hasStat: false,
      ready: true,
      settled: true,
      fetchFailed: false,
    }),
    "retry",
  );
  assert.equal(
    decideDiffRetry({
      attempts: EMPTY_DIFF_CONFIRMATIONS,
      emptyReadySettled: EMPTY_DIFF_CONFIRMATIONS,
      hasStat: false,
      ready: true,
      settled: true,
      fetchFailed: false,
    }),
    "no-diff",
  );
  assert.equal(
    decideDiffRetry({
      attempts: 2,
      emptyReadySettled: 0,
      hasStat: false,
      ready: false,
      settled: false,
      fetchFailed: false,
    }),
    "retry",
  );
  assert.equal(
    decideDiffRetry({
      attempts: 1,
      emptyReadySettled: 0,
      hasStat: true,
      ready: true,
      settled: true,
      fetchFailed: false,
    }),
    "use-stat",
  );
});

test("loadRunDiffStat retries empty until a real git stat appears", async () => {
  const stats = ["", "", "1 file changed, 2 insertions(+)"];
  let calls = 0;
  const delays: number[] = [];
  const got = await loadRunDiffStat(
    { id: "run-1", status: "IDLE", setupStatus: "START_SUCCEEDED" },
    {
      fetchDiff: async () => {
        const stat = stats[calls] ?? "";
        calls += 1;
        return { ok: true, stat };
      },
      delay: async (ms) => {
        delays.push(ms);
      },
    },
  );
  assert.equal(calls, 3);
  assert.deepEqual(got, { files: 1, added: 2, deleted: 0 });
  assert.deepEqual(delays, [400, 800]);
});

test("loadRunDiffStat waits until setup is ready before fetching", async () => {
  let ticks = 0;
  let calls = 0;
  const got = await loadRunDiffStat(
    { id: "run-2", status: "RUNNING", setupStatus: "START_STARTED" },
    {
      readRun: () => {
        ticks += 1;
        return ticks === 1
          ? { id: "run-2", status: "RUNNING", setupStatus: "START_STARTED" as const }
          : { id: "run-2", status: "IDLE", setupStatus: "START_SUCCEEDED" as const };
      },
      fetchDiff: async () => {
        calls += 1;
        return { ok: true, stat: "2 files changed, 3 insertions(+), 4 deletions(-)" };
      },
      delay: async () => undefined,
    },
  );
  assert.equal(calls, 1);
  assert.ok(ticks >= 2);
  assert.deepEqual(got, { files: 2, added: 3, deleted: 4 });
});

test("loadRunDiffStat confirms no diff after three empty ready+settled reads", async () => {
  let calls = 0;
  const got = await loadRunDiffStat(
    { id: "pong", status: "IDLE", setupStatus: "START_SUCCEEDED" },
    {
      fetchDiff: async () => {
        calls += 1;
        return { ok: true, stat: "" };
      },
      delay: async () => undefined,
    },
  );
  assert.equal(calls, EMPTY_DIFF_CONFIRMATIONS);
  assert.deepEqual(got, { files: 0, added: 0, deleted: 0 });
});

test("loadRunDiffStat retries a failed GET then uses the stat", async () => {
  let calls = 0;
  const got = await loadRunDiffStat(
    { id: "run-3", status: "IDLE", setupStatus: "START_SUCCEEDED" },
    {
      fetchDiff: async () => {
        calls += 1;
        if (calls === 1) return { ok: false };
        return { ok: true, stat: "1 file changed, 8 insertions(+)" };
      },
      delay: async () => undefined,
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(got, { files: 1, added: 8, deleted: 0 });
});
