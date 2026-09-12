import assert from "node:assert/strict";
import test from "node:test";
import { getConfig } from "./config.js";

const KEYS = [
  "WORKER_RUNTIME",
  "WORKER_CONTROL_PLANE_URL",
  "WORKER_LLM_GATEWAY_URL",
  "CONTROL_PLANE_URL",
  "CONTROL_PLANE_PORT",
  "LLM_GATEWAY_URL",
  "LLM_GATEWAY_PORT",
] as const;

function withEnv(overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>, fn: () => void): void {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) {
      if (!(key in overrides)) continue;
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("blank WORKER_*_URL is treated as unset for local runtime", () => {
  withEnv(
    {
      WORKER_RUNTIME: "local",
      CONTROL_PLANE_URL: "http://127.0.0.1:18080",
      LLM_GATEWAY_URL: "http://127.0.0.1:18081",
      WORKER_CONTROL_PLANE_URL: "",
      WORKER_LLM_GATEWAY_URL: "   ",
    },
    () => {
      const config = getConfig();
      assert.equal(config.workerRuntime, "local");
      assert.equal(config.workerControlPlaneUrl, "http://127.0.0.1:18080");
      assert.equal(config.workerLlmGatewayUrl, "http://127.0.0.1:18081");
      assert.notEqual(config.workerControlPlaneUrl, "");
      assert.notEqual(config.workerLlmGatewayUrl, "");
    },
  );
});

test("explicit WORKER_*_URL wins when non-empty", () => {
  withEnv(
    {
      WORKER_RUNTIME: "local",
      CONTROL_PLANE_URL: "http://127.0.0.1:18080",
      LLM_GATEWAY_URL: "http://127.0.0.1:18081",
      WORKER_CONTROL_PLANE_URL: "http://worker-cp.example:8080/",
      WORKER_LLM_GATEWAY_URL: "http://worker-llm.example:8081/",
    },
    () => {
      const config = getConfig();
      assert.equal(config.workerControlPlaneUrl, "http://worker-cp.example:8080");
      assert.equal(config.workerLlmGatewayUrl, "http://worker-llm.example:8081");
    },
  );
});

test("blank WORKER_*_URL uses docker host defaults, not an empty remote", () => {
  withEnv(
    {
      WORKER_RUNTIME: "docker",
      CONTROL_PLANE_PORT: "18080",
      LLM_GATEWAY_PORT: "18081",
      CONTROL_PLANE_URL: "http://127.0.0.1:18080",
      LLM_GATEWAY_URL: "http://127.0.0.1:18081",
      WORKER_CONTROL_PLANE_URL: "",
      WORKER_LLM_GATEWAY_URL: "",
    },
    () => {
      const config = getConfig();
      assert.equal(config.workerControlPlaneUrl, "http://host.docker.internal:18080");
      assert.equal(config.workerLlmGatewayUrl, "http://host.docker.internal:18081");
    },
  );
});
