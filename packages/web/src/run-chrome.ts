import { runDisplayTitle, type Run } from "@neo-bot/contracts/run";
import { isWorkspaceReady } from "./run-diff-stats";
import { formatDuration } from "./format";
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

export function environmentLine(run: Pick<Run, "status" | "setupStatus">): string | null {
  const setup = run.setupStatus;
  if (setup === "INSTALL_FAILED" || setup === "START_FAILED") return "Environment failed";
  if (isWorkspaceReady(run)) return "Environment ready";
  return null;
}

export function workedForLine(
  run: Pick<Run, "createdAt" | "idleAt" | "status">,
  now = new Date(),
): string | null {
  const end = run.idleAt || (isActiveRunStatus(run.status) ? now.toISOString() : null);
  if (!end) return null;
  const duration = formatDuration(run.createdAt, end, now);
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
