import { useEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@neo-bot/contracts/run";
import { api, readJson } from "./api";
import { recentAgentRuns, runTimestamp, type DiffStat } from "./agents-home";
import { loadRunDiffStat } from "./run-diff-stats";
import { isShelvedRun } from "./pins";

const MAX_RUNS = 20;

function diffRoster(runs: Run[]): string {
  return runs.map((run) => `${run.id}:${runTimestamp(run)}:${run.status}:${run.setupStatus ?? ""}`).join("|");
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
    () => targets.map((run) => `${run.id}:${runTimestamp(run)}:${run.setupStatus ?? ""}`).join("|"),
    [targets],
  );
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useEffect(() => {
    if (!enabled || !token || !signature) return;
    let cancelled = false;
    const listed = targetsRef.current;
    void (async () => {
      for (let i = 0; i < listed.length; i += 4) {
        const batch = listed.slice(i, i + 4);
        await Promise.all(
          batch.map(async (run) => {
            const stamp = `${runTimestamp(run)}:${run.setupStatus ?? ""}`;
            const cached = cacheRef.current[run.id];
            if (cached && cached.stamp === stamp) {
              setStats((prev) => ({ ...prev, [run.id]: cached.stat }));
              return;
            }
            const stat = await loadRunDiffStat(run, {
              fetchDiff: async (id) => {
                const response = await api(token, `/v1/runs/${id}/diff`);
                if (!response.ok) return { ok: false };
                const body = await readJson<{ stat?: string }>(response);
                return { ok: true, stat: body.stat ?? "" };
              },
              readRun: () => runsRef.current.find((item) => item.id === run.id) ?? run,
              isCancelled: () => cancelled,
            });
            if (cancelled) return;
            cacheRef.current[run.id] = { stamp, stat };
            setStats((prev) => ({ ...prev, [run.id]: stat }));
          }),
        );
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, signature, token]);

  return stats;
}
