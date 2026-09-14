import type { ReactNode } from "react";
import { runDisplayTitle, type Run } from "@neo-bot/contracts/run";
import {
  formatChangeCounts,
  formatFilesLabel,
  formatRelativeAge,
  hasDiffStat,
  recentAgentRuns,
  runPrBadge,
  runTimestamp,
  runWorkspaceLabel,
  type DiffStat,
} from "../agents-home";
import { modelLabel } from "../format";
import { IconMark } from "../icons";

type Props = {
  runs: Run[];
  stats: Record<string, DiffStat>;
  onOpenRun: (id: string) => void;
  children: ReactNode;
};

function ChangeCounts({ stat }: { stat?: DiffStat }) {
  if (!hasDiffStat(stat) || !stat) return null;
  const pair = formatChangeCounts(stat);
  return (
    <span className="change-counts">
      <span className="change-add">{pair.added}</span>
      <span className="change-del">{pair.deleted}</span>
    </span>
  );
}

export function AgentsHome({ runs, stats, onOpenRun, children }: Props) {
  const cards = recentAgentRuns(runs);
  return (
    <section className={`agents-landing${cards.length ? " has-cards" : " is-empty"}`} id="agents-home">
      <div className="agents-stack">
        <div className="agents-hero">
          <p className="agents-context">
            Start from scratch
            <span className="agents-context-chevron" aria-hidden="true" />
          </p>
          {children}
        </div>
        {cards.length > 0 ? (
          <ul className="agent-cards">
            {cards.map((run) => {
              const stat = stats[run.id];
              const badge = runPrBadge(run);
              const rail = hasDiffStat(stat) ? stat : null;
              return (
                <li key={run.id}>
                  <button type="button" className={`agent-card${rail ? " has-rail" : ""}`} onClick={() => onOpenRun(run.id)}>
                    {rail ? (
                      <div className="agent-card-rail">
                        <span className="agent-card-files">{formatFilesLabel(rail.files)}</span>
                        <ChangeCounts stat={rail} />
                        {badge ? (
                          <span className={`agent-badge is-${badge.toLowerCase()}`}>{badge}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="agent-card-body">
                      <strong className="agent-card-title">{runDisplayTitle(run)}</strong>
                      <p className="agent-card-meta">
                        <IconMark size={12} />
                        <span>{modelLabel(null, run.model)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{runWorkspaceLabel(run)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeAge(runTimestamp(run))}</span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export { ChangeCounts };
