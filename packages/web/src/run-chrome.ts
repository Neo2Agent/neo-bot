import { runDisplayTitle, type Run } from "@neo-bot/contracts/run";
import { formatDuration } from "./format";
import { isRunSettled } from "./run-diff-stats";
import { isActiveRunStatus } from "./turn";

export type DiffFile = {
  path: string;
  added: number;
  deleted: number;
};

export type ConversationPrBadge = "Open" | "Merged" | "Draft";

/** Parse file paths and +/- counts from a unified patch, then fall back to --stat. */
export function parseDiffFiles(stat: string, patch = ""): DiffFile[] {
  const fromPatch = parsePatchFiles(patch);
  if (fromPatch.length > 0) return fromPatch;
  return parseStatFiles(stat);
}

function parsePatchFiles(patch: string): DiffFile[] {
  if (!patch.trim()) return [];
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  for (const line of patch.replace(/\r\n/g, "\n").split("\n")) {
    const git = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (git) {
      if (current) files.push(current);
      current = { path: git[2] ?? git[1] ?? "", added: 0, deleted: 0 };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") || line.startsWith("diff ")) {
      continue;
    }
    if (line.startsWith("+")) current.added += 1;
    else if (line.startsWith("-")) current.deleted += 1;
  }
  if (current) files.push(current);
  return files.filter((file) => file.path);
}

function parseStatFiles(stat: string): DiffFile[] {
  const files: DiffFile[] = [];
  for (const raw of stat.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const match = /^\s*(.+?)\s+\|\s+(\d+)\s+([+-]*)/.exec(line);
    if (!match) continue;
    const path = match[1]?.trim() ?? "";
    if (!path || /files? changed/i.test(path)) continue;
    const bar = match[3] ?? "";
    files.push({
      path,
      added: (bar.match(/\+/g) ?? []).length,
      deleted: (bar.match(/-/g) ?? []).length,
    });
  }
  return files;
}

/** Green-check chrome only. Failures and in-progress setup stay hidden. */
export function environmentLine(run: Pick<Run, "status" | "setupStatus">): string | null {
  const setup = run.setupStatus;
  if (setup === "START_SUCCEEDED") return "Environment ready";
  if (setup === "INSTALL_SUCCEEDED" && isRunSettled(run)) return "Environment ready";
  return null;
}

/** `5m 58s` for the title row; leave shared `formatDuration` (`5m58s`) alone. */
function formatWorkedFor(start: string, end: string, now: Date): string {
  const compact = formatDuration(start, end, now);
  if (!compact) return "";
  return compact.replace(/(\d+m)(\d+s)/, "$1 $2");
}

export function workedForLine(
  run: Pick<Run, "createdAt" | "idleAt" | "status">,
  now = new Date(),
): string | null {
  const end = run.idleAt || (isActiveRunStatus(run.status) ? now.toISOString() : null);
  if (!end) return null;
  const duration = formatWorkedFor(run.createdAt, end, now);
  return duration ? `Worked for ${duration}` : null;
}

export function conversationPrBadge(
  run: Pick<Run, "status">,
  pr?: { url?: string; draft?: boolean } | null,
): ConversationPrBadge | null {
  if (!pr?.url) return null;
  if (run.status === "ARCHIVED" || run.status === "EXPIRED") return "Merged";
  if (pr.draft) return "Draft";
  return "Open";
}

export function conversationTitle(run: Pick<Run, "title" | "prompt">): string {
  return runDisplayTitle(run);
}

export function isSameUserPrompt(text: string, title: string): boolean {
  return text.replace(/\s+/g, " ").trim() === title.replace(/\s+/g, " ").trim();
}
