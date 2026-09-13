import { useEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@neo-bot/contracts/run";
import { api, readJson } from "./api";
import { parseDiffStat, runTimestamp, type DiffStat } from "./agents-home";
import { isShelvedRun } from "./pins";

const MAX_RUNS = 20;

export function useRunDiffStats(token: string, runs: Run[], enabled: boolean): Record<string, DiffStat> {
  const [stats, setStats] = useState<Record<string, DiffStat>>({});
  const cacheRef = useRef<Record<string, { stamp: string; stat: DiffStat }>>({});
  const signature = useMemo(
    () =>
      runs
        .filter((run) => !isShelvedRun(run.status))
        .slice(0, MAX_RUNS)
        .map((run) => `${run.id}:${runTimestamp(run)}`)
        .join("|"),
    [runs],
  );

  useEffect(() => {
    if (!enabled || !token || !signature) return;
    const targets = runs.filter((run) => !isShelvedRun(run.status)).slice(0, MAX_RUNS);
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
              cacheRef.current[run.id] = { stamp, stat };
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
  }, [enabled, signature, token, runs]);

  return stats;
}
