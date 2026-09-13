import type { ProjectAsset } from "@neo-bot/contracts/project-asset";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { DiffPanel } from "./DiffPanel";
import type { ConversationPrBadge } from "../run-chrome";

type Artifact = { name: string; url?: string; contentType?: string };

type Props = {
  tab: "diff" | "artifacts";
  onTab: (tab: "diff" | "artifacts") => void;
  pr?: { url?: string; draft?: boolean; number?: number | null; title?: string } | null;
  prBadge?: ConversationPrBadge | null;
  branchName?: string | null;
  baseBranch?: string | null;
  diffLoading: boolean;
  diffError: string;
  diffStat: string;
  diffPatch: string;
  committing?: boolean;
  commitError?: string;
  onCommit?: (message: string) => void;
  artifactsLoading: boolean;
  artifactsError: string;
  artifacts: Artifact[];
  projectId?: string | null;
  token?: string;
  runId?: string | null;
  onSaved?: (asset: ProjectAsset) => void;
  onOpenArtifact?: (item: Artifact) => void;
};

export function GitPane({
  tab,
  onTab,
  pr,
  prBadge,
  branchName,
  baseBranch,
  diffLoading,
  diffError,
  diffStat,
  diffPatch,
  committing,
  commitError,
  onCommit,
  artifactsLoading,
  artifactsError,
  artifacts,
  projectId,
  token,
  runId,
  onSaved,
  onOpenArtifact,
}: Props) {
  const showPr = Boolean(pr?.url);
  return (
    <aside className="inspector git-pane" id="run-git">
      {showPr ? (
        <div className="git-pr">
          {prBadge ? <span className={`agent-badge is-${prBadge.toLowerCase()}`}>{prBadge}</span> : null}
          <a className="git-pr-link" href={pr?.url} target="_blank" rel="noreferrer">
            {pr?.number ? `#${pr.number}` : "PR"}
            {pr?.title ? ` ${pr.title}` : ""}
          </a>
          {branchName ? (
            <p className="git-pr-branch">
              {branchName}
              {baseBranch ? ` → ${baseBranch}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <nav className="session-tabs git-tabs" aria-label="会话标签">
        <button
          type="button"
          className={tab === "diff" ? "active" : ""}
          aria-current={tab === "diff" ? "page" : undefined}
          onClick={() => onTab("diff")}
        >
          Diff
        </button>
        <button
          type="button"
          className={tab === "artifacts" ? "active" : ""}
          aria-current={tab === "artifacts" ? "page" : undefined}
          onClick={() => onTab("artifacts")}
        >
          Artifacts
        </button>
      </nav>
      {tab === "artifacts" ? (
        <ArtifactsPanel
          open
          loading={artifactsLoading}
          error={artifactsError}
          artifacts={artifacts}
          projectId={projectId}
          token={token}
          runId={runId}
          onSaved={onSaved}
          onOpen={onOpenArtifact}
        />
      ) : (
        <DiffPanel
          open
          chrome="git"
          loading={diffLoading}
          error={diffError}
          stat={diffStat}
          patch={diffPatch}
          committing={committing}
          commitError={commitError}
          onCommit={onCommit}
        />
      )}
    </aside>
  );
}
