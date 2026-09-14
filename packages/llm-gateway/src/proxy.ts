import { MAX_REQUEST_OUTPUT_TOKENS } from "@neo-bot/contracts";
import { getConfig } from "./config.js";
import { messagesHaveImages, resolveUpstreamModel, visionModelFor } from "./routes.js";

export interface ChatCompletionBody {
  model?: string;
  stream?: boolean;
  messages?: unknown[];
  [key: string]: unknown;
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

/** New API pre-deducts wallet against max_tokens. Never forward 384k. */
export function capUpstreamMaxTokens(body: ChatCompletionBody): ChatCompletionBody {
  const requested = asPositiveInt(body.max_tokens) ?? asPositiveInt(body.max_completion_tokens);
  const maxTokens = Math.min(requested ?? MAX_REQUEST_OUTPUT_TOKENS, MAX_REQUEST_OUTPUT_TOKENS);
  const next: ChatCompletionBody = { ...body, max_tokens: maxTokens };
  if (body.max_completion_tokens !== undefined) {
    next.max_completion_tokens = maxTokens;
  }
  return next;
}

export function rewriteBody(body: ChatCompletionBody, fallbackModel: string): ChatCompletionBody {
  const requested = typeof body.model === "string" ? body.model : fallbackModel;
  let model = resolveUpstreamModel(requested, fallbackModel);
  if (messagesHaveImages(body.messages)) {
    model = visionModelFor(model);
  }
  return capUpstreamMaxTokens({ ...body, model });
}

export function explainUpstreamChatError(status: number, body: string): string {
  let raw = body.replace(/\s+/g, " ").trim().slice(0, 240);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown };
    const nested = parsed.error;
    const message =
      (typeof nested === "object" && nested && typeof nested.message === "string" && nested.message) ||
      (typeof nested === "string" && nested) ||
      (typeof parsed.message === "string" && parsed.message);
    if (message) {
      raw = message.replace(/\s+/g, " ").trim().slice(0, 240);
    }
  } catch {
    // keep the clipped body
  }
  if (status === 403 && /预扣费|额度不足|insufficient.?quota/i.test(raw)) {
    return "模型额度预扣失败。单次输出长度已限制，请再试一次；若仍失败，给 New API 钱包充值。";
  }
  if (status === 429) {
    return "模型请求过于频繁，请稍后再试。";
  }
  return raw || `上游返回 ${status}`;
}

export function buildMockSse(model: string, text: string): string {
  const id = `chatcmpl-mock-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const start = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }],
  };
  const stop = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  return `data: ${JSON.stringify(start)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`;
}

export function buildMockCompletion(model: string, text: string) {
  return {
    id: `chatcmpl-mock-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

export type MockToolCall = { name: string; args: Record<string, unknown> };

const REFUSE_TOOLS =
  /不要调用工具|不要修改文件|只阅读和回答|do not (use|call) tools|don't (use|call) tools|only (read|reply)/i;
const WANT_FILE_TOOLS =
  /\b(write|edit|read|bash|grep|diff|file|path|touch|artifact|upload|shell|terminal)\b|hello\.txt|readme|文件|编辑|改|添加|修改|更新|工具|产物|附件/i;
const WANT_SHELL_TOOLS = /\b(bash|shell|terminal)\b|\$\s+\S/i;
const WANT_ARTIFACTS = /artifact|产物|附件|upload/i;
const MOCK_FILE_TOOLS = new Set(["write", "edit"]);

const TOY_HELLO = "hello from the toy repo";
const MOCK_ARTIFACT_PATH = "ARTIFACT.md";
const MOCK_ARTIFACT_CONTENT = "Mock artifact so the Web Artifacts tab has a real file to open.\n";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function collectMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      const record = asRecord(part);
      if (typeof record?.text === "string") {
        return record.text;
      }
      if (typeof record?.content === "string") {
        return record.content;
      }
      return "";
    })
    .join("");
}

function isToolResultMessage(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) {
    return false;
  }
  if (record.role === "tool" || record.role === "function") {
    return true;
  }
  return typeof record.tool_call_id === "string" && Boolean(record.tool_call_id);
}

export function listedToolNames(body: ChatCompletionBody): string[] {
  const names = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      names.add(value.trim());
    }
  };
  if (Array.isArray(body.tools)) {
    for (const tool of body.tools) {
      const record = asRecord(tool);
      if (!record) {
        continue;
      }
      add(record.name);
      add(asRecord(record.function)?.name);
    }
  }
  return [...names];
}

export function lastUserText(messages?: unknown[]): string {
  if (!Array.isArray(messages)) {
    return "";
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const record = asRecord(messages[index]);
    if (record?.role === "user") {
      return collectMessageText(record.content);
    }
  }
  return "";
}

export function lastMessageIsToolResult(messages?: unknown[]): boolean {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }
  return isToolResultMessage(messages.at(-1));
}

function toolResultCount(messages?: unknown[]): number {
  if (!Array.isArray(messages)) {
    return 0;
  }
  return messages.filter(isToolResultMessage).length;
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw)) ?? {};
    } catch {
      return {};
    }
  }
  return asRecord(raw) ?? {};
}

function assistantToolCalls(messages?: unknown[]): Array<{ name: string; args: Record<string, unknown> }> {
  if (!Array.isArray(messages)) {
    return [];
  }
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const message of messages) {
    const record = asRecord(message);
    if (!record) {
      continue;
    }
    const rawCalls = record.tool_calls ?? record.function_call;
    const list = Array.isArray(rawCalls) ? rawCalls : rawCalls ? [rawCalls] : [];
    for (const item of list) {
      const entry = asRecord(item);
      if (!entry) {
        continue;
      }
      const fn = asRecord(entry.function);
      const name =
        (typeof entry.name === "string" && entry.name) || (typeof fn?.name === "string" && fn.name) || "";
      if (!name) {
        continue;
      }
      calls.push({ name, args: parseToolArgs(entry.arguments ?? fn?.arguments ?? entry.args) });
    }
  }
  return calls;
}

function lastWrittenPath(body: ChatCompletionBody): string {
  const calls = assistantToolCalls(body.messages);
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const call = calls[index];
    if (!call || !MOCK_FILE_TOOLS.has(call.name)) {
      continue;
    }
    if (typeof call.args.path === "string" && call.args.path.trim()) {
      return call.args.path.trim();
    }
  }
  const names = listedToolNames(body);
  if (names.includes("write") && !names.includes("edit")) {
    return "TOOLS.md";
  }
  return "hello.txt";
}

function pickMockArtifactUpload(body: ChatCompletionBody): MockToolCall | null {
  if (toolResultCount(body.messages) !== 1) {
    return null;
  }
  const names = listedToolNames(body);
  if (!names.includes("neo_artifact_upload")) {
    return null;
  }
  const text = lastUserText(body.messages);
  if (text && REFUSE_TOOLS.test(text)) {
    return null;
  }
  return {
    name: "neo_artifact_upload",
    args: { path: lastWrittenPath(body) },
  };
}

export function pickMockToolCall(body: ChatCompletionBody): MockToolCall | null {
  if (lastMessageIsToolResult(body.messages)) {
    return pickMockArtifactUpload(body);
  }
  const text = lastUserText(body.messages);
  if (!text || REFUSE_TOOLS.test(text) || !WANT_FILE_TOOLS.test(text)) {
    return null;
  }
  const names = listedToolNames(body);
  if (WANT_SHELL_TOOLS.test(text) && names.includes("bash")) {
    return {
      name: "bash",
      args: { command: "ls -la" },
    };
  }
  if (WANT_ARTIFACTS.test(text) && names.includes("write")) {
    return {
      name: "write",
      args: {
        path: MOCK_ARTIFACT_PATH,
        content: MOCK_ARTIFACT_CONTENT,
      },
    };
  }
  if (names.includes("edit")) {
    return {
      name: "edit",
      args: {
        path: "hello.txt",
        edits: [
          {
            oldText: TOY_HELLO,
            newText: `${TOY_HELLO}\n\nShown in the web transcript: tool card + diff.`,
          },
        ],
      },
    };
  }
  if (names.includes("write")) {
    return {
      name: "write",
      args: {
        path: "TOOLS.md",
        content: "Mock write so the web transcript can show a tool card and diff.\n",
      },
    };
  }
  return null;
}

export function buildMockToolSse(model: string, call: MockToolCall): string {
  const id = `chatcmpl-mock-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const toolCallId = `call_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const start = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              index: 0,
              id: toolCallId,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.args) },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
  const stop = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
  };
  return `data: ${JSON.stringify(start)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`;
}

export function buildMockToolCompletion(model: string, call: MockToolCall) {
  const toolCallId = `call_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  return {
    id: `chatcmpl-mock-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: toolCallId,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.args) },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

const MOCK_TEXT =
  "Mock gateway response. Save a DeepSeek or OpenAI API key on the chat page, or set DEEPSEEK_API_KEY / OPENAI_API_KEY.";

const MOCK_TOOL_FOLLOWUP_TEXT =
  "Mock gateway finished the file tool and uploaded it. Open the Artifacts tab to download the file.";

const MOCK_SLOW_TEXT =
  "这是一段故意拉长的 mock 流式回复，方便两台 Desk 同时订同一条 SSE。你会一个字一个字看到输出。在这段还没结束时，另一位协作者可以发跟进；消息会进 FIFO 队列，不会再开第二个 worker。";

function mockStreamDelayMs(): number {
  const n = Number(process.env.MOCK_STREAM_DELAY_MS ?? "0");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : 0;
}

function buildMockSseStream(model: string, text: string, delayMs: number): ReadableStream<Uint8Array> {
  const id = `chatcmpl-mock-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const parts = /[\u4e00-\u9fff]/.test(text) ? [...text] : text.split(/(\s+)/).filter(Boolean);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const [index, part] of parts.entries()) {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { ...(index === 0 ? { role: "assistant" } : {}), content: part },
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export async function proxyChatCompletions(body: ChatCompletionBody): Promise<{
  status: number;
  headers: Record<string, string>;
  stream: boolean;
  payload: string | ReadableStream<Uint8Array>;
}> {
  const config = getConfig();
  const rewritten = rewriteBody(body, config.upstreamModel);
  const stream = Boolean(rewritten.stream);
  const model = String(rewritten.model);

  if (config.upstream === "mock") {
    const tool = pickMockToolCall(rewritten);
    if (tool) {
      return {
        status: 200,
        headers: {
          "content-type": stream ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8",
        },
        stream,
        payload: stream ? buildMockToolSse(model, tool) : JSON.stringify(buildMockToolCompletion(model, tool)),
      };
    }
    const delayMs = mockStreamDelayMs();
    const text = lastMessageIsToolResult(rewritten.messages)
      ? MOCK_TOOL_FOLLOWUP_TEXT
      : delayMs
        ? MOCK_SLOW_TEXT
        : MOCK_TEXT;
    return {
      status: 200,
      headers: {
        "content-type": stream ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8",
      },
      stream,
      payload: stream
        ? delayMs
          ? buildMockSseStream(model, text, delayMs)
          : buildMockSse(model, text)
        : JSON.stringify(buildMockCompletion(model, text)),
    };
  }

  if (!config.upstreamApiKey) {
    throw new Error(`${config.upstream} upstream is selected but no API key is configured`);
  }

  const response = await fetch(`${config.upstreamBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.upstreamApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(rewritten),
  });

  if (!response.ok) {
    const raw = await response.text();
    const message = explainUpstreamChatError(response.status, raw);
    console.error(`upstream chat status=${response.status} ${message}`);
    return {
      status: response.status,
      headers: { "content-type": "application/json; charset=utf-8" },
      stream: false,
      payload: JSON.stringify({ error: { message, type: "upstream_error", status: response.status } }),
    };
  }

  if (stream) {
    if (!response.body) {
      throw new Error("upstream returned no body");
    }
    return {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
      },
      stream: true,
      payload: response.body,
    };
  }

  const payload = await response.text();
  return {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8" },
    stream: false,
    payload,
  };
}
