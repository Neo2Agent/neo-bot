/** Shared with the mobile artifact list; the logic lives in contracts so RN never imports web. */
export type { ArtifactKind, ArtifactPreviewKind } from "@neo-bot/contracts/artifact";
export { artifactKind, artifactKindLabel, previewKind, prettyBytes } from "@neo-bot/contracts/artifact";

/** Copy for the Artifacts preview pane. Never leave the pane blank. */
export function artifactPreviewEmptyCopy(input: {
  git: boolean;
  selected: boolean;
  hasArtifacts: boolean;
  kindLabel?: string;
}): string {
  if (!input.selected) {
    if (input.git) return input.hasArtifacts ? "Select a file" : "No artifacts yet.";
    return "选择一个文件";
  }
  if (input.git) return "Cannot preview this file";
  const kind = input.kindLabel?.trim();
  return kind ? `${kind} 文件，无法预览` : "无法预览";
}
