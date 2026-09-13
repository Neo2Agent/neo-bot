import type { Run } from "@neo-bot/contracts/run";
import { hasDiffStat, parseDiffStat, type DiffStat } from "./agents-home";

/** Backoff between GET /v1/runs/:id/diff attempts. First attempt is immediate. */
export const DIFF_STAT_RETRY_DELAYS_MS = [0, 400, 800, 1600, 2400, 3200] as const;

/** Consecutive empty 200s after the workspace is ready and the run has settled. */
export const EMPTY_DIFF_CONFIRMATIONS = 3;

const SETTLING = new Set(["IDLE", "ERROR", "ARCHIVED", "EXPIRED"]);
const SETUP_NOT_READY = new Set(["INSTALL_STARTED", "START_STARTED"]);
const SETUP_READY = new Set(["START_SUCCEEDED", "START_FAILED", "INSTALL_FAILED"]);
const RUN_NOT_READY = new Set(["NOT_YET_STARTED", "PROVISIONING", "INSTALLING"]);

export function isRunSettled(run: Pick<Run, "status">): boolean {
  return SETTLING.has(run.status);
}

/**
 * Workspace is ready once start/install has finished, or the run has already
 * settled. INSTALL_SUCCEEDED alone is not enough — start may still be pending.
 */
export function isWorkspaceReady(run: Pick<Run, "status" | "setupStatus">): boolean {
  const setup = run.setupStatus;
  if (setup && SETUP_NOT_READY.has(setup)) return false;
  if (setup && SETUP_READY.has(setup)) return true;
  if (setup === "INSTALL_SUCCEEDED") return isRunSettled(run);
  if (RUN_NOT_READY.has(run.status)) return false;
  return true;
}

export function decideDiffRetry(state: {
  attempts: number;
  emptyReadySettled: number;
  hasStat: boolean;
  ready: boolean;
  settled: boolean;
  fetchFailed: boolean;
}): "use-stat" | "no-diff" | "retry" {
  if (state.hasStat) return "use-stat";
  if (state.attempts >= DIFF_STAT_RETRY_DELAYS_MS.length) return "no-diff";
  if (state.fetchFailed || !state.ready) return "retry";
  if (state.settled && state.emptyReadySettled >= EMPTY_DIFF_CONFIRMATIONS) return "no-diff";
  return "retry";
}

export type DiffFetcher = (runId: string) => Promise<{ ok: boolean; stat?: string }>;

export async function loadRunDiffStat(
  run: Pick<Run, "id" | "status" | "setupStatus">,
  options: {
    fetchDiff: DiffFetcher;
    readRun?: () => Pick<Run, "id" | "status" | "setupStatus">;
    delay?: (ms: number) => Promise<void>;
    isCancelled?: () => boolean;
  },
): Promise<DiffStat> {
  const empty: DiffStat = { files: 0, added: 0, deleted: 0 };
  let emptyReadySettled = 0;
  let last = empty;
  for (let attempts = 0; attempts < DIFF_STAT_RETRY_DELAYS_MS.length; attempts++) {
    if (options.isCancelled?.()) return last;
    const wait = DIFF_STAT_RETRY_DELAYS_MS[attempts] ?? 0;
    if (wait) await (options.delay ?? defaultDelay)(wait);
    if (options.isCancelled?.()) return last;
    const current = options.readRun?.() ?? run;
    const ready = isWorkspaceReady(current);
    const settled = isRunSettled(current);
    if (!ready) {
      if (decideDiffRetry({ attempts: attempts + 1, emptyReadySettled, hasStat: false, ready, settled, fetchFailed: false }) === "retry") {
        continue;
      }
      return last;
    }
    let fetchFailed = false;
    try {
      const response = await options.fetchDiff(current.id);
      if (!response.ok) {
        fetchFailed = true;
      } else {
        last = parseDiffStat(response.stat ?? "");
        if (hasDiffStat(last)) return last;
        if (settled) emptyReadySettled += 1;
      }
    } catch {
      fetchFailed = true;
    }
    const decision = decideDiffRetry({
      attempts: attempts + 1,
      emptyReadySettled,
      hasStat: hasDiffStat(last),
      ready,
      settled,
      fetchFailed,
    });
    if (decision === "use-stat") return last;
    if (decision === "no-diff") return empty;
  }
  return last;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
