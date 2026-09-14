import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AGENTS_HREF,
  LOGIN_HREF,
  applyAuthLocation,
  parseAppHash,
  resolveAuthLocation,
  runHref,
  runIdToOpen,
  shouldResetRunChrome,
} from "./app-route.js";

const app = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "App.tsx"), "utf8");

test("hash map splits login wall from agents shell and keeps run deep links", () => {
  assert.deepEqual(parseAppHash(""), { kind: "home", hash: "", runId: null });
  assert.deepEqual(parseAppHash("#/"), { kind: "home", hash: "", runId: null });
  assert.deepEqual(parseAppHash("/#/login"), { kind: "login", hash: "#/login", runId: null });
  assert.deepEqual(parseAppHash("#/agents"), { kind: "agents", hash: "#/agents", runId: null });
  assert.deepEqual(parseAppHash("#/runs/run_1"), { kind: "run", hash: "#/runs/run_1", runId: "run_1" });
  assert.equal(parseAppHash("#/projects").kind, "catalog");
  assert.equal(parseAppHash("#/projects/p1/assets/a1").kind, "catalog");
  assert.equal(parseAppHash("#/invite/tok").kind, "catalog");
  assert.equal(runHref("run_1"), "/#/runs/run_1");
});

test("logged-out visitors get #/login unless a run or catalog dest is already in the hash", () => {
  assert.equal(resolveAuthLocation(false, ""), LOGIN_HREF);
  assert.equal(resolveAuthLocation(false, "#/"), LOGIN_HREF);
  assert.equal(resolveAuthLocation(false, "#/agents"), LOGIN_HREF);
  assert.equal(resolveAuthLocation(false, "#/login"), LOGIN_HREF);
  assert.equal(resolveAuthLocation(false, "#/runs/run_9"), "/#/runs/run_9");
  assert.equal(resolveAuthLocation(false, "#/projects"), "/#/projects");
  assert.equal(resolveAuthLocation(false, "#/settings"), "/#/settings");
  assert.equal(resolveAuthLocation(false, "#/nope"), LOGIN_HREF);
});

test("logged-in visitors leave #/login and empty home for #/agents", () => {
  assert.equal(resolveAuthLocation(true, ""), AGENTS_HREF);
  assert.equal(resolveAuthLocation(true, "#/login"), AGENTS_HREF);
  assert.equal(resolveAuthLocation(true, "#/agents"), AGENTS_HREF);
  assert.equal(resolveAuthLocation(true, "#/runs/run_9"), "/#/runs/run_9");
  assert.equal(resolveAuthLocation(true, "#/experts/exp_1"), "/#/experts/exp_1");
  assert.equal(resolveAuthLocation(true, "#/nope"), "/#/nope");
});

test("applyAuthLocation replaces only when the hash must move", () => {
  const seen: string[] = [];
  assert.equal(applyAuthLocation(false, "#/agents", (url) => seen.push(url)), LOGIN_HREF);
  assert.deepEqual(seen, [LOGIN_HREF]);
  seen.length = 0;
  assert.equal(applyAuthLocation(false, "#/login", (url) => seen.push(url)), LOGIN_HREF);
  assert.deepEqual(seen, []);
  assert.equal(applyAuthLocation(true, "#/login", (url) => seen.push(url)), AGENTS_HREF);
  assert.deepEqual(seen, [AGENTS_HREF]);
  seen.length = 0;
  assert.equal(applyAuthLocation(false, "#/runs/run_1", (url) => seen.push(url)), "/#/runs/run_1");
  assert.deepEqual(seen, []);
});

test("logged-in #/login and #/agents reset run-detail chrome; run deep links do not", () => {
  assert.equal(shouldResetRunChrome(true, "#/login"), true);
  assert.equal(shouldResetRunChrome(true, "#/agents"), true);
  assert.equal(shouldResetRunChrome(true, ""), true);
  assert.equal(shouldResetRunChrome(true, "#/runs/run_9"), false);
  assert.equal(shouldResetRunChrome(true, "#/projects"), false);
  assert.equal(shouldResetRunChrome(false, "#/login"), false);
  assert.equal(shouldResetRunChrome(false, "#/agents"), false);
  assert.match(app, /shouldResetRunChrome\(authed, location\.hash\)/);
  assert.match(app, /runIdToOpen\(authed, location\.hash\)/);
  assert.match(app, /resetComposer\(\)/);
  assert.equal(runIdToOpen(true, "#/runs/run_9"), "run_9");
  assert.equal(runIdToOpen(true, "#/login"), null);
  assert.equal(runIdToOpen(false, "#/runs/run_9"), null);
});
