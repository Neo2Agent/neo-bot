import { useEffect, useState, type ReactNode } from "react";

type Props = { text: string; className?: string; streaming?: boolean };

export function prepareMarkdown(text: string, streaming?: boolean): string {
  if (!streaming) {
    return text;
  }
  const fence = "```";
  const fences = text.match(new RegExp(`^${fence}`, "gm"))?.length ?? 0;
  return fences % 2 === 1 ? `${text}\n${fence}\n` : text;
}

export function MarkdownBody({ text, className, streaming }: Props) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!streaming) {
      setShown(text);
      return;
    }
    // Coalesce to the next frame. A trailing debounce (old 80ms timer) never
    // fired while tokens arrived continuously, so the web transcript looked stuck.
    const frame = window.requestAnimationFrame(() => setShown(text));
    return () => window.cancelAnimationFrame(frame);
  }, [text, streaming]);
  return (
    <div className={className ? `md ${className}` : "md"}>
      {streaming ? (
        <>
          <div className="md-stream">{shown}</div>
          <span className="md-caret" aria-hidden="true" />
        </>
      ) : (
        renderBlocks(shown)
      )}
    </div>
  );
}

function renderBlocks(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre key={key++} className="md-pre">
          <code data-lang={lang || undefined}>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = (`h${heading[1].length}` as "h1" | "h2" | "h3");
      nodes.push(
        <Tag key={key++} className="md-h">
          {renderInline(heading[2] ?? "")}
        </Tag>,
      );
      i += 1;
      continue;
    }
    const table = readPipeTable(lines, i);
    if (table) {
      nodes.push(renderTableFold(table.rows, key++));
      i = table.end;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      nodes.push(
        <ul key={key++} className="md-list">
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^```/.test(lines[i] ?? "") &&
      !/^(#{1,3})\s+/.test(lines[i] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[i] ?? "") &&
      !readPipeTable(lines, i)
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    nodes.push(
      <p key={key++} className="md-p">
        {renderInline(para.join(" "))}
      </p>,
    );
  }
  return nodes;
}

function isPipeRow(line: string): boolean {
  const text = line.trim();
  if (!text.includes("|")) return false;
  return (text.match(/\|/g)?.length ?? 0) >= 2 || text.startsWith("|") || text.endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell.trim());
}

export function readPipeTable(
  lines: string[],
  start: number,
): { rows: string[][]; end: number } | null {
  if (!isPipeRow(lines[start] ?? "")) return null;
  const block: string[] = [];
  let index = start;
  while (index < lines.length && isPipeRow(lines[index] ?? "")) {
    block.push(lines[index] ?? "");
    index += 1;
  }
  if (block.length >= 2 && isSeparatorRow(block[1] ?? "")) {
    return { rows: block.filter((_, row) => row !== 1).map(parseTableRow), end: index };
  }
  if (block.length >= 3) {
    return { rows: block.map(parseTableRow), end: index };
  }
  return null;
}

function renderTableFold(rows: string[][], key: number): ReactNode {
  const header = rows[0] ?? [];
  const eventLog = header.some((cell) => /event/i.test(cell));
  return (
    <details key={key} className="md-table-fold">
      <summary>{eventLog ? "Event log" : "Table"}</summary>
      <div className="md-table-wrap">
        <table className="md-table">
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th key={index}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function renderInline(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > last) {
      nodes.push(source.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      if (/^https?:\/\//i.test(href) || href.startsWith("/")) {
        nodes.push(
          <a key={key++} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
            {link?.[1]}
          </a>,
        );
      } else {
        nodes.push(link?.[1] ?? token);
      }
    }
    last = match.index + token.length;
  }
  if (last < source.length) {
    nodes.push(source.slice(last));
  }
  return nodes;
}
