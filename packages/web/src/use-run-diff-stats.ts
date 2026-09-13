import { useEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@neo-bot/contracts/run";
import { api, readJson } from "./api";
import { hasDiffStat, parseDiffStat, recentAgentRuns, runTimestamp, type DiffStat } from "./agents-home";
import { isShelvedRun } from "./pins";

const MAX_RUNS = 20;

function diffRoster(runs: Run[]): string {
  return runs.map((run) => `${run.id}:${runTimestamp(run)}:${run.status}`).join("|");
}

function pickDiffTargets(runs: Run[]): Run[] {
  const live = runs.filter((run) => !isShelvedRun(run.status));
  const cards = recentAgentRuns(runs, MAX_RUNS);
  const seen = new Set<string>();
  const next: Run[] = [];
  for (const run of [...live, ...cards]) {
    if (seen.has(run.id) || next.length >= MAX_RUNS) continue;
    seen.add(run.id);
    next.push(run);
  }
  return next;
}

export function useRunDiffStats(token: string, runs: Run[], enabled: boolean): Record<string, DiffStat> {
  const [stats, setStats] = useState<Record<string, DiffStat>>({});
  const cacheRef = useRef<Record<string, { stamp: string; stat: DiffStat }>>({});
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const roster = diffRoster(runs);
  const targets = useMemo(() => pickDiffTargets(runsRef.current), [roster]);
  const signature = useMemo(
    () => targets.map((run) => `${run.id}:${runTimestamp(run)}`).join("|"),
    [targets],
  );

  useEffect(() => {
    if (!enabled || !token || !signature) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, DiffStat> = {};
      for (let i = 0; i < targets.length; i += 4) {
        const batch = targets.slice(i, i + 4);
        await Promise.all(
          batch.map(async (run) => {
            const stamp = runTimestamp(run);
            const cached = cacheRef.current[run.id];
            if (cached && cached.stamp === stamp) {
              next[run.id] = cached.stat;
              return;
            }
            try {
              const response = await api(token, `/v1/runs/${run.id}/diff`);
              if (!response.ok) return;
              const body = await readJson<{ stat?: string }>(response);
              const stat = parseDiffStat(body.stat ?? "");
              if (hasDiffStat(stat)) cacheRef.current[run.id] = { stamp, stat };
              next[run.id] = stat;
            } catch {
              // list chrome stays up if a workspace has no diff
            }
          }),
        );
        if (cancelled) return;
      }
      if (!cancelled) {
        setStats((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, signature, token, targets]);

  return stats;
}
