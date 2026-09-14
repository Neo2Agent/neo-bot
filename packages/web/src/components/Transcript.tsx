import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { readSubagentSteps, type SubagentTask } from "@neo-bot/contracts/subagent";
import { transcriptGroups } from "@neo-bot/contracts/transcript";
import type { TranscriptMessage, TranscriptTool } from "@neo-bot/contracts/events";
import type { Recipe } from "@neo-bot/contracts/recipe";
import { BUNDLED_RECIPES } from "@neo-bot/contracts/recipe";
import {
  fileToolDiff,
  formatDuration,
  formatMessageTime,
  formatWhen,
  toolArgPreview,
  toolRowPresentation,
} from "../format";
import { fileBaseName, IconCheck, IconChevronDown, IconError, IconPath, IconSpinner, IconTool } from "../icons";
import { MarkdownBody } from "../markdown";
import { formatChangeCounts, hasDiffStat, type DiffStat } from "../agents-home";
import { isSameUserPrompt, type DiffFile } from "../run-chrome";
import { shouldShowThinking } from "../turn";
import { transcriptUserImageSrc } from "../user-image";
import { withApiBase } from "../desk";
import { DiffPanel } from "./DiffPanel";

type Props = {
  token?: string;
  messages: TranscriptMessage[];
  remaining: number;
  empty: boolean;
  loading?: boolean;
  loadingOlder?: boolean;
  busy?: boolean;
  activity?: string;
  highlightId?: string | null;
  title?: string;
  repo?: string;
  environment?: string | null;
  workedFor?: string | null;
  files?: DiffFile[];
  diffStat?: DiffStat | null;
  diffLoading?: boolean;
  diffError?: string;
  diffText?: string;
  diffPatch?: string;
  onLoadOlder: () => void;
  onOpenDiagnostics?: () => void;
  onPickRecipe?: (recipe: Recipe) => void;
};

function ToolStatus({ tool }: { tool: TranscriptTool }) {
  if (tool.status === "running") return <IconSpinner size={14} />;
  if (tool.isError) return <IconError size={14} />;
  return <IconCheck size={14} />;
}

function readSubagentTasks(details?: Record<string, unknown>): SubagentTask[] {
  const raw = details?.tasks;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is SubagentTask => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const record = item as { agent?: unknown; task?: unknown };
    return typeof record.agent === "string" && typeof record.task === "string";
  });
}

function ToolCard({ tool, compact = false }: { tool: TranscriptTool; compact?: boolean }) {
  const preview = toolArgPreview(tool.args);
  const diff = fileToolDiff(tool);
  const { kind, label, className, open } = toolRowPresentation(tool, compact);
  const card = compact || kind === "shell";
  const inline = compact && (kind === "explore" || kind === "default");
  const preRef = useRef<HTMLPreElement>(null);
  const parentSubagent = tool.name === "neo_subagent";
  const steps = parentSubagent ? readSubagentSteps(tool.details) : [];
  const tasks = parentSubagent ? readSubagentTasks(tool.details) : [];
  const omitted = parentSubagent ? Number(tool.details?.omittedSteps ?? 0) : 0;

  useLayoutEffect(() => {
    if (!open || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [open, tool.output]);

  return (
    <details className={className} data-tool={tool.name} {...(open ? { open: true } : {})}>
      <summary>
        {inline ? null : <span className="tool-chevron" aria-hidden="true" />}
        <span className="tool-name">
          {open ? <IconSpinner size={12} /> : tool.isError ? <IconError size={12} /> : card ? null : <ToolStatus tool={tool} />}
          {card && kind !== "file" ? null : <IconTool name={tool.name} size={14} />}
          {label}
        </span>
        {!card && preview ? <span className="cmd">{preview}</span> : null}
      </summary>
      {tasks.length > 0 ? (
        <ul className="subagent-tasks">
          {tasks.map((task, index) => (
            <li key={`${task.agent}-${index}`}>
              <b>{task.agent}</b> {task.task.replace(/\s+/g, " ").trim()}
            </li>
          ))}
        </ul>
      ) : null}
      {steps.length > 0 ? (
        <ol className="subagent-steps">
          {steps.map((step) => (
            <li
              key={step.id}
              className={step.status === "running" ? "run" : step.isError ? "err" : undefined}
            >
              <span>
                {step.status === "running" ? <IconSpinner size={12} /> : step.isError ? <IconError size={12} /> : <IconCheck size={12} />}{" "}
                {step.agent} / {step.name}
              </span>
              {toolArgPreview(step.args) ? <span className="cmd">{toolArgPreview(step.args)}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {omitted > 0 ? <p className="subagent-more">已折叠 {omitted} 步</p> : null}
      {diff ? (
        <pre className="tool-diff">
          {diff.lines.map((line, index) => (
            <span key={index} className={`diff-${line.type}`}>
              {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              {line.text}
              {"\n"}
            </span>
          ))}
        </pre>
      ) : null}
      {tool.output ? (
        <pre ref={preRef}>{tool.output}</pre>
      ) : open && !diff && steps.length === 0 ? (
        <pre ref={preRef}>执行中…</pre>
      ) : null}
    </details>
  );
}

function MessageTime({ message, className = "" }: { message: TranscriptMessage; className?: string }) {
  const duration =
    message.role === "assistant" && !message.streaming
      ? formatDuration(message.createdAt, message.updatedAt)
      : "";
  return (
    <time className={`bubble-time ${className}`.trim()} dateTime={message.updatedAt || message.createdAt}>
      {formatMessageTime(message.createdAt, message.updatedAt, Boolean(message.streaming))}
      {duration ? ` · ${duration}` : ""}
    </time>
  );
}

function setupFailed(message: TranscriptMessage): boolean {
  return message.level === "error" || String(message.kind).endsWith("_failed") || message.kind === "run.error";
}

function SetupLine({
  message,
  highlightId,
  onOpenDiagnostics,
}: {
  message: TranscriptMessage;
  highlightId?: string | null;
  onOpenDiagnostics?: () => void;
}) {
  const failed = setupFailed(message);
  return (
    <p
      id={`msg-${message.id}`}
      className={failed ? "setup err" : "setup"}
      data-highlight={highlightId === message.id ? "true" : undefined}
    >
      <span>{message.text}</span>
      {failed && onOpenDiagnostics ? (
        <button type="button" className="ghost diag-link" onClick={onOpenDiagnostics}>
          查看诊断
        </button>
      ) : null}
      <time className="bubble-time setup-time" dateTime={message.createdAt}>
        {formatWhen(message.createdAt)}
      </time>
    </p>
  );
}

function SetupFold({
  messages,
  highlightId,
  onOpenDiagnostics,
}: {
  messages: TranscriptMessage[];
  highlightId?: string | null;
  onOpenDiagnostics?: () => void;
}) {
  const failed = messages.some(setupFailed);
  return (
    <details className={failed ? "setup-fold is-fail" : "setup-fold"} open={failed}>
      <summary>
        {failed ? <IconError size={12} /> : <IconCheck size={12} />}
        <span>{failed ? "Setup failed" : "Setup"}</span>
        <span className="setup-fold-count">{messages.length}</span>
      </summary>
      {messages.map((message) => (
        <SetupLine key={message.id} message={message} highlightId={highlightId} onOpenDiagnostics={onOpenDiagnostics} />
      ))}
    </details>
  );
}

function ArtifactCard({ message }: { message: TranscriptMessage }) {
  const href = message.href;
  const image = Boolean(href && message.mediaType?.startsWith("image/"));
  return (
    <article className="artifact">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {message.text}
        </a>
      ) : (
        <span>{message.text}</span>
      )}
      {image && href ? <img src={href} alt="" /> : null}
    </article>
  );
}

export function Transcript({
  token = "",
  messages,
  remaining,
  empty,
  loading = false,
  loadingOlder = false,
  busy = false,
  activity,
  highlightId,
  title = "",
  repo = "",
  environment,
  workedFor,
  files = [],
  diffStat,
  diffLoading = false,
  diffError = "",
  diffText = "",
  diffPatch = "",
  onLoadOlder,
  onOpenDiagnostics,
  onPickRecipe,
}: Props) {
  const scroller = useRef<HTMLElement>(null);
  const stick = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const pending = restore.current;
    if (pending) {
      node.scrollTop = pending.top + (node.scrollHeight - pending.height);
      restore.current = null;
      return;
    }
    if (stick.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, remaining, busy, activity, loading]);

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`msg-${highlightId}`)?.scrollIntoView({ block: "center" });
  }, [highlightId]);

  const loadOlder = () => {
    if (remaining <= 0 || loadingOlder || restore.current) return;
    const node = scroller.current;
    if (node) restore.current = { height: node.scrollHeight, top: node.scrollTop };
    onLoadOlder();
  };

  const fileCount = files.length || diffStat?.files || 1;
  return (
    <div className={`transcript-shell${title ? " has-run-head" : ""}`}>
      {title ? (
        <header className="run-head">
          <h1 id="run-conversation-title">{title}</h1>
          {repo ? <p className="run-head-repo">{repo}</p> : null}
          {environment === "Environment ready" || workedFor ? (
            <div className="run-meta">
              {environment === "Environment ready" ? (
                <p className="run-env is-ready">
                  <IconCheck size={12} />
                  Environment ready
                </p>
              ) : null}
              {workedFor ? (
                <details className="run-worked">
                  <summary>{workedFor}</summary>
                </details>
              ) : null}
            </div>
          ) : null}
        </header>
      ) : null}
    <section
      className="transcript"
      id="transcript"
      aria-live={busy ? "off" : "polite"}
      aria-busy={busy || loading}
      ref={scroller}
      onScroll={() => {
        const node = scroller.current;
        if (!node) return;
        stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
        if (node.scrollTop < 48) loadOlder();
      }}
    >
      <div className="transcript-col">
        {remaining > 0 ? (
          <div className="history-more" id="history-more">
            <button type="button" id="load-older" disabled={loadingOlder} onClick={loadOlder}>
              {loadingOlder ? "正在加载…" : `加载更早的消息（还有 ${remaining} 条）`}
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="transcript-skel" aria-hidden="true">
            <div className="skel skel-user" />
            <div className="skel skel-ai" />
            <div className="skel skel-ai short" />
          </div>
        ) : null}
        {empty ? (
          <div className="empty">
            <h2>有什么可以帮你的？</h2>
            <p>发送后会占用一台云端电脑。也可以先点一张做法再改。仓库和 API Key 在「设置」里。</p>
            {onPickRecipe ? (
              <ul className="recipe-grid">
                {BUNDLED_RECIPES.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="recipe-card" onClick={() => onPickRecipe(item)}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          messages.map((message, messageIndex) => {
            if (message.kind === "artifact.uploaded") {
              return <ArtifactCard key={message.id} message={message} />;
            }
            if (message.role === "setup") {
              if (title) {
                const prev = messages[messageIndex - 1];
                if (prev?.role === "setup" && prev.kind !== "artifact.uploaded") {
                  return null;
                }
                const group = [message];
                for (let index = messageIndex + 1; index < messages.length; index += 1) {
                  const next = messages[index];
                  if (next.role !== "setup" || next.kind === "artifact.uploaded") break;
                  group.push(next);
                }
                if (!group.some(setupFailed)) {
                  return null;
                }
                return (
                  <SetupFold
                    key={group[0]?.id}
                    messages={group}
                    highlightId={highlightId}
                    onOpenDiagnostics={onOpenDiagnostics}
                  />
                );
              }
              return (
                <SetupLine
                  key={message.id}
                  message={message}
                  highlightId={highlightId}
                  onOpenDiagnostics={onOpenDiagnostics}
                />
              );
            }
            if (message.role === "user") {
              const firstUser = !messages.slice(0, messageIndex).some((item) => item.role === "user");
              if (title && firstUser && isSameUserPrompt(message.text ?? "", title)) {
                return null;
              }
              return (
                <article
                  key={message.id}
                  id={`msg-${message.id}`}
                  className="bubble user"
                  data-highlight={highlightId === message.id ? "true" : undefined}
                >
                  {message.text ? <div className="body">{message.text}</div> : null}
                  {message.images?.length ? (
                    <div className="image-row">
                      {message.images.map((image, index) => {
                        const src = transcriptUserImageSrc(image, token, withApiBase);
                        return src ? (
                          <img
                            key={`${message.id}-${index}`}
                            className="user-image"
                            src={src}
                            alt=""
                            decoding="async"
                          />
                        ) : null;
                      })}
                    </div>
                  ) : null}
                  <MessageTime message={message} />
                </article>
              );
            }
            const groups = transcriptGroups(message);
            if (groups.length === 0) {
              return null;
            }
            return (
              <Fragment key={message.id}>
                {groups.map((group, index) => {
                  const last = index === groups.length - 1;
                  if (group.type === "tools") {
                    return (
                      <Fragment key={`${message.id}-tools-${index}`}>
                        <div className="tool-stack">
                          {group.tools.map((tool, toolIndex) => (
                            <ToolCard
                              key={tool.id ?? `${tool.name}-${toolIndex}`}
                              tool={tool}
                              compact={Boolean(title)}
                            />
                          ))}
                        </div>
                        {last ? <MessageTime message={message} className="assistant-time" /> : null}
                      </Fragment>
                    );
                  }
                  const lastText = !groups.slice(index + 1).some((item) => item.type === "text");
                  return (
                    <article
                      key={`${message.id}-text-${index}`}
                      id={last ? `msg-${message.id}` : undefined}
                      className="bubble assistant"
                      data-highlight={highlightId === message.id ? "true" : undefined}
                    >
                      <MarkdownBody
                        text={group.text}
                        className="body"
                        streaming={Boolean(message.streaming && lastText)}
                      />
                      {last ? <MessageTime message={message} /> : null}
                    </article>
                  );
                })}
              </Fragment>
            );
          })
        )}
        {!empty && !loading && (files.length > 0 || hasDiffStat(diffStat) || Boolean(diffPatch.trim())) ? (
          <details className="files-changed" open>
            <summary>
              <span className="files-changed-label">
                <IconChevronDown size={14} />
                <span>
                  {fileCount} {fileCount === 1 ? "File" : "Files"} Changed
                </span>
              </span>
              {hasDiffStat(diffStat) && diffStat ? (
                <span className="change-counts">
                  <span className="change-add">{formatChangeCounts(diffStat).added}</span>
                  <span className="change-del">{formatChangeCounts(diffStat).deleted}</span>
                </span>
              ) : null}
            </summary>
            {files.length > 0 ? (
              <ul className="files-changed-list">
                {files.map((file) => (
                  <li key={file.path} title={file.path}>
                    <span className="files-changed-file">
                      <IconPath path={file.path} size={14} />
                      <span className="files-changed-path">{fileBaseName(file.path)}</span>
                    </span>
                    <span className="change-counts">
                      <span className="change-add">{formatChangeCounts(file).added}</span>
                      <span className="change-del">{formatChangeCounts(file).deleted}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <DiffPanel
                open
                chrome="git"
                loading={diffLoading}
                error={diffError}
                stat={diffText}
                patch={diffPatch}
              />
            )}
          </details>
        ) : null}
        {shouldShowThinking(busy, messages) && !empty && !loading ? (
          <div className="turn-progress" id="turn-progress">
            <div className="think-line">
              <span className="think-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{activity || "正在思考…"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
    </div>
  );
}
