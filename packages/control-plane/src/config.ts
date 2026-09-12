import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAgentKernel } from "@neo-bot/contracts";
import { loadRootEnv } from "./env.js";

loadRootEnv();

function repoRoot(): string {
  return fileURLToPath(new URL("../../..", import.meta.url));
}

export type WorkerRuntimeKind = "local" | "docker" | "none" | "firecracker" | "vm" | "desk";

export function workerRuntimeKind(): WorkerRuntimeKind {
  const explicit = process.env.WORKER_RUNTIME;
  if (
    explicit === "local" ||
    explicit === "docker" ||
    explicit === "none" ||
    explicit === "firecracker" ||
    explicit === "vm"
  ) {
    return explicit;
  }
  return process.env.SPAWN_LOCAL_WORKER === "0" ? "docker" : "local";
}

export function defaultWorkerResources(kind = workerRuntimeKind()): { cpu: number; memoryMiB: number; diskGiB: number } {
  const small = kind === "firecracker" || kind === "vm";
  return {
    cpu: Number(process.env.WORKER_CPUS ?? (small ? 1 : 2)),
    memoryMiB: Number(process.env.WORKER_MEMORY_MIB ?? (small ? 512 : 2048)),
    diskGiB: Number(process.env.WORKER_DISK_GIB ?? (small ? 4 : 40)),
  };
}

/** Treat blank env the same as unset so `KEY=` is not a configured URL. */
function envUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return (trimmed || fallback).replace(/\/$/, "");
}

/** Relative RUNS_DIR must not follow `pnpm --filter` cwd or the worker misses files. */
function envDir(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(repoRoot(), raw);
}

export function getConfig() {
  const kind = workerRuntimeKind();
  const port = Number(process.env.CONTROL_PLANE_PORT ?? 8080);
  const gatewayPort = Number(process.env.LLM_GATEWAY_PORT ?? 8081);
  const controlPlaneUrl = (
    process.env.CONTROL_PLANE_URL ?? `http://127.0.0.1:${port}`
  ).replace(/\/$/, "");
  const llmGatewayUrl = (process.env.LLM_GATEWAY_URL ?? `http://127.0.0.1:${gatewayPort}`).replace(/\/$/, "");
  const runsDir = envDir(process.env.RUNS_DIR, path.join(repoRoot(), ".neo/runs"));
  return {
    port,
    orgId: process.env.DEFAULT_ORG_ID ?? "org_local",
    userId: process.env.DEFAULT_USER_ID ?? "user_local",
    workerImage: process.env.WORKER_IMAGE ?? "neo-cloud-agent-worker:dev",
    defaultModel: process.env.DEFAULT_MODEL ?? "neo/deepseek",
    llmUpstream: process.env.LLM_UPSTREAM ?? null,
    jwtSecret: process.env.LLM_GATEWAY_JWT_SECRET ?? "dev-only-change-me",
    llmGatewayUrl,
    controlPlaneUrl,
    workerRuntime: kind,
    spawnLocalWorker: kind === "local" || kind === "vm",
    runsDir,
    hostRunsDir: envDir(process.env.HOST_RUNS_DIR, runsDir),
    workerWorkspaceMount: process.env.WORKER_WORKSPACE_MOUNT ?? "/workspace",
    workerControlPlaneUrl: envUrl(
      process.env.WORKER_CONTROL_PLANE_URL,
      kind === "docker" ? `http://host.docker.internal:${port}` : controlPlaneUrl,
    ),
    workerLlmGatewayUrl: envUrl(
      process.env.WORKER_LLM_GATEWAY_URL,
      kind === "docker" ? `http://host.docker.internal:${gatewayPort}` : llmGatewayUrl,
    ),
    dockerNetwork: process.env.DOCKER_NETWORK || null,
    agentKernel: resolveAgentKernel(undefined, process.env),
    neoLoopUrl: (process.env.NEO_LOOP_URL ?? "http://127.0.0.1:8082").replace(/\/$/, ""),
    neoLoopToken: process.env.NEO_LOOP_TOKEN ?? "",
    objectStore: (process.env.OBJECT_STORE === "s3" || process.env.OBJECT_STORE === "none" || process.env.OBJECT_STORE === "memory"
      ? process.env.OBJECT_STORE
      : "fs") as "fs" | "s3" | "memory" | "none",
    s3: {
      bucket: process.env.S3_BUCKET ?? "",
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: (process.env.S3_ENDPOINT ?? "").replace(/\/$/, ""),
      accessKey: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "",
      secretKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
      prefix: (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, ""),
    },
  };
}
