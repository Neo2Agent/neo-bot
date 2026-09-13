import type { Run } from "@neo-bot/contracts/run";

export type DiffStat = {
  files: number;
  added: number;
  deleted: number;
};

export type TimeGroup<T> = {
  key: string;
  label: string;
  runs: T[];
};

const WEEK_MS = 7 * 86_400_000;
const MONTH_MS = 30 * 86_400_000;

/** Parse `git diff --stat` text from GET /v1/runs/:id/diff. */
export function parseDiffStat(stat: string): DiffStat {
  const text = stat.trim();
  if (!text) return { files: 0, added: 0, deleted: 0 };
  const files = Number(/(\d+)\s+files?\s+changed/.exec(text)?.[1] ?? 0);
  const added = Number(/(\d+)\s+insertions?\(\+\)/.exec(text)?.[1] ?? 0);
  const deleted = Number(/(\d+)\s+deletions?\(-\)/.exec(text)?.[1] ?? 0);
  if (files || added || deleted) return { files, added, deleted };
  const fileLines = text.split("\n").filter((line) => /\|/.test(line));
  return { files: fileLines.length, added: 0, deleted: 0 };
}

export function hasDiffStat(stat?: DiffStat | null): boolean {
  return Boolean(stat && (stat.files > 0 || stat.added > 0 || stat.deleted > 0));
}

export function formatFilesLabel(files: number): string {
  return `${files} ${files === 1 ? "file" : "files"}`;
}

export function formatRelativeAge(value: string, now = new Date()): string {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "";
  const sec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (sec < 45) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h`;
  if (sec < WEEK_MS / 1000 * 2) return `${Math.floor(sec / 86_400)}d`;
  const days = Math.floor(sec / 86_400);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo` : `${Math.floor(months / 12)}y`;
}

export function runTimestamp(run: { createdAt: string; updatedAt?: string | null }): string {
  return run.updatedAt || run.createdAt;
}

export function groupRunsByTime<T extends { createdAt: string; updatedAt?: string | null }>(
  runs: T[],
  now = new Date(),
): TimeGroup<T>[] {
  const last7: T[] = [];
  const last30: T[] = [];
  const older: T[] = [];
  for (const run of runs) {
    const at = Date.parse(runTimestamp(run));
    const age = Number.isFinite(at) ? now.getTime() - at : 0;
    if (age <= WEEK_MS) last7.push(run);
    else if (age <= MONTH_MS) last30.push(run);
    else older.push(run);
  }
  return [
    { key: "7d", label: "Last 7 days", runs: last7 },
    { key: "30d", label: "Last 30 days", runs: last30 },
    { key: "older", label: "Older", runs: older },
  ].filter((group) => group.runs.length > 0);
}

export function runPrBadge(run: Pick<Run, "status" | "pullRequests">): "Open" | "Merged" | null {
  const hasPr = (run.pullRequests ?? []).some((item) => Boolean(item.url));
  if (run.status === "ARCHIVED" || run.status === "EXPIRED") {
    return hasPr ? "Merged" : null;
  }
  return "Open";
}

export function runWorkspaceLabel(run: Pick<Run, "repoUrls">): string {
  const url = run.repoUrls?.[0]?.trim() ?? "";
  if (!url) return "local";
  const cleaned = url.replace(/\/+$/, "").replace(/\.git$/i, "");
  const parts = cleaned.split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] || "local";
}

export function accountName(email: string): string {
  const raw = email.trim();
  if (!raw) return "Account";
  const local = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
  return local || raw;
}

export function accountInitials(email: string): string {
  const name = accountName(email);
  const parts = name.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return name.slice(0, 1).toUpperCase() || "N";
}

export function chatStatusTone(status: string): "run" | "ok" | "err" | "idle" {
  if (status === "ERROR") return "err";
  if (
    status === "RUNNING" ||
    status === "PROVISIONING" ||
    status === "INSTALLING" ||
    status === "NOT_YET_STARTED" ||
    status === "WAITING_FOR_BACKGROUND_WORK"
  ) {
    return "run";
  }
  if (status === "IDLE") return "ok";
  return "idle";
}

export function recentAgentRuns(runs: Run[], limit = 8): Run[] {
  return [...runs]
    .filter((run) => run.status !== "ARCHIVED" && run.status !== "EXPIRED")
    .sort((left, right) => runTimestamp(right).localeCompare(runTimestamp(left)) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
