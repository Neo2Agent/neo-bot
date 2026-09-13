import type { ReactNode } from "react";
import type { Run } from "@neo-bot/contracts/run";
import {
  formatFilesLabel,
  formatRelativeAge,
  hasDiffStat,
  recentAgentRuns,
  runPrBadge,
  runTimestamp,
  runWorkspaceLabel,
  type DiffStat,
} from "../agents-home";
import { modelLabel, runListTitle } from "../format";
import { IconMark } from "../icons";

type Props = {
  runs: Run[];
  stats: Record<string, DiffStat>;
  onOpenRun: (id: string) => void;
  children: ReactNode;
};

function ChangeCounts({ stat }: { stat?: DiffStat }) {
  if (!hasDiffStat(stat)) return null;
  return (
    <span className="change-counts">
      {stat && stat.added > 0 ? <span className="change-add">+{stat.added}</span> : null}
      {stat && stat.deleted > 0 ? <span className="change-del">-{stat.deleted}</span> : null}
    </span>
  );
}

export function AgentsHome({ runs, stats, onOpenRun, children }: Props) {
  const cards = recentAgentRuns(runs);
  return (
    <section className={`agents-landing${cards.length ? " has-cards" : " is-empty"}`} id="agents-home">
      <div className="agents-stack">
        <p className="agents-context">Start from scratch</p>
        {children}
        {cards.length > 0 ? (
          <ul className="agent-cards">
            {cards.map((run) => {
              const stat = stats[run.id];
              const badge = runPrBadge(run);
              return (
                <li key={run.id}>
                  <button type="button" className="agent-card" onClick={() => onOpenRun(run.id)}>
                    <div className="agent-card-rail">
                      {hasDiffStat(stat) ? <span className="agent-card-files">{formatFilesLabel(stat.files)}</span> : null}
                      <ChangeCounts stat={stat} />
                      {badge ? (
                        <span className={`agent-badge is-${badge.toLowerCase()}`}>{badge}</span>
                      ) : null}
                    </div>
                    <div className="agent-card-body">
                      <strong className="agent-card-title">{runListTitle(run)}</strong>
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
