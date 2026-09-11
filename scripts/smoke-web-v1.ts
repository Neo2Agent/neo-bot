import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { archiveRun, close, listen } from "../packages/control-plane/src/e2e/helpers.ts";

type EventLite = { kind: string };

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function login(base: string): Promise<string> {
  const response = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "123456" }),
  });
  const raw = await response.text();
  assert.equal(response.status, 200, raw);
  const body = JSON.parse(raw) as { token?: string };
  assert.ok(body.token, "login must return a token");
  return body.token;
}

async function waitForIdle(base: string, token: string, runId: string, minEnds: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let kinds: string[] = [];
  let status = "RUNNING";
  let errorMessage: string | null = null;
  while (Date.now() < deadline) {
    const transcript = (await (
      await fetch(`${base}/v1/runs/${runId}/transcript?includeEvents=1`, { headers: authHeaders(token) })
    ).json()) as { events?: EventLite[] };
    kinds = (transcript.events ?? []).map((item) => item.kind);
    const latest = (await (await fetch(`${base}/v1/runs/${runId}`, { headers: authHeaders(token) })).json()) as {
      status: string;
      errorMessage: string | null;
    };
    status = latest.status;
    errorMessage = latest.errorMessage;
    if (status === "ERROR" || kinds.filter((kind) => kind === "agent.end").length >= minEnds) {
      return { kinds, status, errorMessage };
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { kinds, status, errorMessage };
}

function attachSse(base: string, runId: string, token: string) {
  const events: EventLite[] = [];
  let buffer = "";
  const url = new URL(`/v1/runs/${runId}/events`, base);
  const request = http.get(
    url,
    { headers: { accept: "text/event-stream", authorization: `Bearer ${token}` } },
    (response) => {
      response.on("data", (chunk) => {
        buffer += String(chunk);
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((item) => item.startsWith("data: "));
          if (!line) continue;
          try {
            events.push(JSON.parse(line.slice(6)) as EventLite);
          } catch {
            // ignore a bad frame
          }
        }
      });
    },
  );
  request.on("error", () => undefined);
  return {
    events,
    close() {
      request.destroy();
    },
  };
}

async function main(): Promise<void> {
  const external = (process.env.SMOKE_BASE ?? process.env.CONTROL_PLANE_URL ?? "").replace(/\/$/, "");
  let apiBase = external;
  let stop: (() => Promise<void>) | undefined;
  let token = "";

  if (external) {
    const health = await fetch(`${external}/health`);
    assert.equal(health.ok, true, `health failed at ${external}`);
    token = await login(external);
  } else {
    const runsDir = mkdtempSync(path.join(tmpdir(), "neo-bot-smoke-"));
    process.env.WORKER_RUNTIME = "local";
    process.env.SPAWN_LOCAL_WORKER = "1";
    process.env.AGENT_KERNEL = "pi";
    process.env.LLM_SETTINGS_DIR = mkdtempSync(path.join(tmpdir(), "neo-bot-smoke-llm-"));
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_UPSTREAM_API_KEY;
    process.env.LLM_UPSTREAM = "mock";
    process.env.LLM_GATEWAY_JWT_SECRET = "smoke-secret";
    process.env.RUNS_DIR = runsDir;
    process.env.HOST_RUNS_DIR = runsDir;
    process.env.ACCOUNTS_REQUIRED = "1";
    process.env.WORKER_IDLE_RELEASE_MS = "0";
    delete process.env.WORKER_CONTROL_PLANE_URL;
    delete process.env.WORKER_LLM_GATEWAY_URL;

    const { createGatewayServer } = await import("../packages/llm-gateway/src/server.ts");
    const { createApiServer } = await import("../packages/control-plane/src/api/server.ts");
    const { startPlatform } = await import("../packages/control-plane/src/platform.ts");

    const gateway = createGatewayServer();
    const gatewayPort = await listen(gateway);
    process.env.LLM_GATEWAY_URL = `http://127.0.0.1:${gatewayPort}`;
    process.env.LLM_GATEWAY_PORT = String(gatewayPort);

    await startPlatform();
    const api = createApiServer();
    const apiPort = await listen(api);
    process.env.CONTROL_PLANE_URL = `http://127.0.0.1:${apiPort}`;
    apiBase = `http://127.0.0.1:${apiPort}`;
    stop = async () => {
      await close(api);
      await close(gateway);
    };
    token = await login(apiBase);
  }

  assert.ok(apiBase);
  let runId = "";
  let live: ReturnType<typeof attachSse> | undefined;
  try {
    const created = await fetch(`${apiBase}/v1/runs`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        prompt: "第一轮：只回复一个词 pong。不要调用工具。",
        repoUrls: ["fixtures/toy-repo"],
        source: "web",
      }),
    });
    const createdRaw = await created.text();
    assert.equal(created.status, 201, createdRaw);
    const run = JSON.parse(createdRaw) as { id: string; status: string; errorMessage: string | null };
    runId = run.id;
    assert.equal(run.status, "RUNNING", run.errorMessage ?? "");

    live = attachSse(apiBase, run.id, token);
    const first = await waitForIdle(apiBase, token, run.id, 1, 60_000);
    assert.notEqual(first.status, "ERROR", first.errorMessage ?? first.kinds.join(","));
    assert.equal(first.status, "IDLE");
    assert.ok(first.kinds.includes("agent.end"), first.kinds.join(","));
    assert.ok(
      live.events.some((item) => item.kind === "message.delta" || item.kind === "agent.end"),
      `SSE saw ${live.events.map((item) => item.kind).join(",")}`,
    );

    const follow = await fetch(`${apiBase}/v1/runs/${run.id}/follow-ups`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ text: "第二轮：只回复一个词 ok。不要调用工具。" }),
    });
    const followRaw = await follow.text();
    assert.equal(follow.status, 201, followRaw);
    const second = await waitForIdle(apiBase, token, run.id, 2, 60_000);
    assert.notEqual(second.status, "ERROR", second.errorMessage ?? second.kinds.join(","));
    assert.equal(second.status, "IDLE");
    assert.ok(second.kinds.filter((kind) => kind === "agent.end").length >= 2, second.kinds.join(","));
    console.log(`smoke ok run=${run.id} events=${first.kinds.length}+ follow-up idle`);
  } finally {
    live?.close();
    if (runId && apiBase) {
      await archiveRun(apiBase, runId);
    }
    if (stop) {
      await stop();
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
