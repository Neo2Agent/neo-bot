import { useState } from "react";
import { runDisplayTitle, type Run } from "@neo-bot/contracts/run";
import {
  accountInitials,
  accountName,
  chatStatusTone,
  formatRelativeAge,
  groupRunsByTime,
  hasDiffStat,
  runTimestamp,
  type DiffStat,
} from "../agents-home";
import { formatRunTime, runListPlaceSuffix, runListTitle, STATUS_LABELS } from "../format";
import { BuddyMascot } from "@neo-bot/ui";
import {
  IconClose,
  IconExperts,
  IconGear,
  IconMark,
  IconNewChat,
  IconPlus,
  IconProjects,
  IconSidebarClose,
  IconSkills,
  IconStar,
  IconTrash,
} from "../icons";
import { BuddyIcon, BuddyTargetToggle } from "@neo-bot/ui";
import { WEB_V1 } from "../scope";
import { filterRuns, groupRunsByProject, isShelvedRun, splitShelvedRuns } from "../pins";
import { isActiveRunStatus } from "../turn";
import { ChangeCounts } from "./AgentsHome";

export type VmSlotView = {
  id: string;
  status: string;
  runId: string | null;
};

type Props = {
  runs: Run[];
  currentRunId: string | null;
  slots?: VmSlotView[];
  backend?: string;
  userEmail: string;
  authed: boolean;
  authBusy: boolean;
  health: string;
  pinnedIds?: string[];
  projectNames?: Record<string, string>;
  diffStats?: Record<string, DiffStat>;
  home?: boolean;
  onNewChat: () => void;
  onOpenRun: (id: string) => void;
  onPin?: (id: string) => void;
  onArchiveMany?: (ids: string[]) => void;
  onDeleteRun?: (id: string) => void;
  onLogin: () => void;
  onLogout: () => void;
  onClose?: () => void;
  onCollapse?: () => void;
  onOpenSettings?: () => void;
  buddy?: boolean;
  target?: "cloud" | "desk";
  deskDisabled?: boolean;
  onTarget?: (value: "cloud" | "desk") => void;
  onOpenNav?: (id: "automations" | "experts" | "projects" | "skills") => void;
};

export function Sidebar({
  runs,
  currentRunId,
  slots = [],
  backend = "none",
  userEmail,
  authed,
  authBusy,
  health,
  pinnedIds = [],
  projectNames = {},
  diffStats = {},
  home = false,
  onNewChat,
  onOpenRun,
  onPin,
  onArchiveMany,
  onDeleteRun,
  onLogin,
  onLogout,
  onClose,
  onCollapse,
  onOpenSettings,
  buddy = false,
  target = "cloud",
  deskDisabled = false,
  onTarget,
  onOpenNav,
}: Props) {
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const items = [...runs].sort((left, right) => {
    const leftAt = left.updatedAt || left.createdAt;
    const rightAt = right.updatedAt || right.createdAt;
    return rightAt.localeCompare(leftAt) || right.createdAt.localeCompare(left.createdAt);
  });
  const visible = filterRuns(items, query);
  const { live, shelved } = splitShelvedRuns(visible);
  const grouped = groupRunsByProject(live, pinnedIds, projectNames);
  const timed = groupRunsByTime(live);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const renderBuddyRun = (run: Run) => {
    const running = isActiveRunStatus(run.status);
    const pinned = pinnedIds.includes(run.id);
    const canSelect = selecting && !isShelvedRun(run.status);
    return (
      <div
        key={run.id}
        className={`run-item${canSelect ? " is-selecting" : ""}${run.id === currentRunId ? " active" : ""}${running ? " busy" : ""}`}
        data-id={run.id}
        data-busy={running ? "true" : "false"}
        role="button"
        tabIndex={0}
        aria-current={run.id === currentRunId ? "true" : undefined}
        onClick={() => (canSelect ? toggle(run.id) : onOpenRun(run.id))}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (canSelect) toggle(run.id);
            else onOpenRun(run.id);
          }
        }}
      >
        {canSelect ? (
          <input
            type="checkbox"
            className="run-check"
            checked={selected.includes(run.id)}
            onChange={() => toggle(run.id)}
            onClick={(event) => event.stopPropagation()}
            aria-label="选择对话"
          />
        ) : null}
        <div className="run-main">
          <span className="run-title">
            {running ? <span className="pulse-dot" aria-hidden="true" /> : null}
            {runListTitle(run)}
          </span>
          <small>
            {STATUS_LABELS[run.status] ?? run.status}
            {runListPlaceSuffix(run)}
          </small>
          <time className="run-time" dateTime={run.updatedAt || run.createdAt}>
            {formatRunTime(run.createdAt, run.updatedAt)}
          </time>
        </div>
        {onPin && !isShelvedRun(run.status) ? (
          <button
            type="button"
            className={pinned ? "pin is-on" : "pin"}
            aria-label={pinned ? "取消置顶" : "置顶"}
            onClick={(event) => {
              event.stopPropagation();
              onPin(run.id);
            }}
          >
            <IconStar size={14} />
          </button>
        ) : null}
        {onDeleteRun && isShelvedRun(run.status) ? (
          <button
            type="button"
            className="pin run-delete"
            aria-label="删除归档任务"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteRun(run.id);
            }}
          >
            <IconTrash size={14} />
          </button>
        ) : null}
      </div>
    );
  };

  const renderChatRow = (run: Run) => {
    const running = isActiveRunStatus(run.status);
    const tone = chatStatusTone(run.status);
    const stat = diffStats[run.id];
    return (
      <div
        key={run.id}
        className={`run-item chat-row${run.id === currentRunId ? " active" : ""}${running ? " busy" : ""}`}
        data-id={run.id}
        data-busy={running ? "true" : "false"}
        data-tone={tone}
        role="button"
        tabIndex={0}
        aria-current={run.id === currentRunId ? "true" : undefined}
        onClick={() => onOpenRun(run.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenRun(run.id);
          }
        }}
      >
        <span className={`chat-dot is-${tone}${running ? " is-pulse" : ""}`} aria-hidden="true" />
        <span className="run-title">{runDisplayTitle(run)}</span>
        {hasDiffStat(stat) ? <ChangeCounts stat={stat} /> : <span className="chat-age">{formatRelativeAge(runTimestamp(run))}</span>}
      </div>
    );
  };

  if (buddy) {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <span className="mark">
              <BuddyMascot size={30} compact />
            </span>
            <div>
              <strong>Neo</strong>
              <span>Web v1</span>
            </div>
          </div>
          {onClose ? (
            <button className="icon-btn sidebar-close" id="sidebar-close" type="button" aria-label="关闭" onClick={onClose}>
              <IconClose />
            </button>
          ) : null}
        </div>
        {WEB_V1.deskUi && onTarget ? <BuddyTargetToggle value={target} deskDisabled={deskDisabled} wide onChange={onTarget} /> : null}
        <nav className="buddy-nav" aria-label="目录">
          {(
            [
              ["experts", "专家", IconExperts],
              ["projects", "项目", IconProjects],
              ["skills", "技能", IconSkills],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => onOpenNav?.(id)}>
              <Icon size={18} />
              <span>{label}</span>
              <BuddyIcon name="chevron" size={16} />
            </button>
          ))}
        </nav>
        <div className="buddy-task-head">
          <span>任务</span>
          {onArchiveMany ? (
            <button
              type="button"
              onClick={() => {
                setSelecting((value) => !value);
                setSelected([]);
              }}
            >
              {selecting ? "取消" : "编辑"}
            </button>
          ) : null}
        </div>
        <button className="new-chat" id="new-chat" type="button" onClick={onNewChat}>
          <span className="new-chat-plus" aria-hidden="true">
            <IconPlus size={14} />
          </span>
          新建任务
        </button>
        <div className="run-tools">
          <input
            type="search"
            className="run-search"
            placeholder="搜索任务"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="搜索任务"
          />
          {onArchiveMany && selecting ? (
            <div className="run-tools-actions">
              {selected.length > 0 ? (
                <button
                  type="button"
                  className="toolbar-btn is-ready"
                  onClick={() => {
                    onArchiveMany(selected);
                    setSelected([]);
                    setSelecting(false);
                  }}
                >
                  归档 {selected.length} 条
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="run-list" id="run-list">
          {grouped.pinned.length > 0 ? (
            <section className="run-group">
              <p className="eyebrow">置顶</p>
              {grouped.pinned.map(renderBuddyRun)}
            </section>
          ) : null}
          {grouped.sections.map((section) =>
            section.active.length + section.recent.length === 0 ? null : (
              <section key={section.key} className="run-group">
                <p className="eyebrow">{section.label}</p>
                {section.active.map(renderBuddyRun)}
                {section.recent.map(renderBuddyRun)}
              </section>
            ),
          )}
          {shelved.length > 0 ? (
            <details className="run-group run-archived">
              <summary className="eyebrow">已归档 · {shelved.length}</summary>
              {shelved.map(renderBuddyRun)}
            </details>
          ) : null}
        </div>
        <footer className="sidebar-foot">
          <div className="account" id="account">
            <span id="account-email">{userEmail || (authBusy ? "登录中…" : "未登录")}</span>
            <button type="button" id="login" hidden={authed} onClick={onLogin}>
              登录
            </button>
            <button type="button" id="logout" hidden={!authed} onClick={onLogout}>
              退出
            </button>
          </div>
          <span id="health">{health}</span>
        </footer>
      </aside>
    );
  }

  const name = accountName(userEmail || (authBusy ? "…" : "Account"));

  return (
    <aside className="sidebar agents-sidebar">
      <div className="sidebar-head">
        <button type="button" className="brand brand-home" onClick={onNewChat} aria-label="Home">
          <span className="mark">
            <IconMark size={16} />
          </span>
        </button>
        {onCollapse ? (
          <button className="icon-btn sidebar-collapse" type="button" aria-label="Collapse sidebar" onClick={onCollapse}>
            <IconSidebarClose size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button className="icon-btn sidebar-close" id="sidebar-close" type="button" aria-label="关闭" onClick={onClose}>
            <IconClose />
          </button>
        ) : null}
      </div>
      <button
        className={`new-chat${home ? " is-current" : ""}`}
        id="new-chat"
        type="button"
        aria-current={home ? "page" : undefined}
        onClick={onNewChat}
      >
        <span className="new-chat-plus" aria-hidden="true">
          <IconNewChat size={16} />
        </span>
        New Chat
      </button>
      <div className="chats-block">
        <p className="chats-heading">Chats</p>
        <div className="run-list" id="run-list">
          {timed.map((section) => (
            <section key={section.key} className="run-group">
              <p className="eyebrow">{section.label}</p>
              {section.runs.map(renderChatRow)}
            </section>
          ))}
        </div>
      </div>
      <footer className="sidebar-foot">
        <div className="account account-card" id="account" title={health}>
          <span className="account-avatar" aria-hidden="true">
            {accountInitials(userEmail)}
          </span>
          <div className="account-copy">
            <strong id="account-email">{name}</strong>
            <small>Web v1</small>
          </div>
          <details className="account-menu">
            <summary aria-label="Account menu">···</summary>
            <div className="account-menu-pop">
              {onOpenSettings ? (
                <button type="button" onClick={onOpenSettings}>
                  <IconGear size={14} />
                  Settings
                </button>
              ) : null}
              <button type="button" id="login" hidden={authed} onClick={onLogin}>
                登录
              </button>
              <button type="button" id="logout" hidden={!authed} onClick={onLogout}>
                Log out
              </button>
            </div>
          </details>
        </div>
        <span id="health" hidden>
          {health}
        </span>
      </footer>
    </aside>
  );
}
