/**
 * Front-end hash map for the login wall vs agents shell.
 *
 *   /#/login   logged-out wall (no dest)
 *   /#/agents  logged-in agents home
 *   /#/runs/:id  run deep link (unchanged)
 *   /#/projects | /#/invite/:id | /#/experts | /#/skills |
 *   /#/memories | /#/settings | /#/automations  catalog (unchanged)
 *
 * Empty `/` or `#/` follows the session: wall or agents home.
 * Logged-out visitors on a run/catalog hash keep that hash so login can restore it.
 */

import { parseProjectHash } from "./project-route.js";

export const LOGIN_HREF = "/#/login";
export const AGENTS_HREF = "/#/agents";

export type AppRouteKind = "home" | "login" | "agents" | "run" | "catalog" | "other";

export type AppRoute = {
  kind: AppRouteKind;
  hash: string;
  runId: string | null;
};

export function normalizeHash(hash: string): string {
  const raw = hash.includes("#") ? hash.slice(hash.indexOf("#")) : hash;
  if (!raw || raw === "#" || raw === "#/") return "";
  return raw.startsWith("#") ? raw : `#${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function isCatalogHash(hash: string): boolean {
  if (
    hash === "#/automations" ||
    hash === "#/memories" ||
    hash === "#/settings" ||
    hash === "#/projects" ||
    hash === "#/experts" ||
    hash === "#/skills"
  ) {
    return true;
  }
  if (/^#\/(?:invite|experts|skills)\/[^/]+$/.test(hash)) return true;
  const project = parseProjectHash(hash);
  return Boolean(project.projectId || project.assets);
}

export function parseAppHash(hash: string): AppRoute {
  const value = normalizeHash(hash);
  if (!value) return { kind: "home", hash: "", runId: null };
  if (value === "#/login") return { kind: "login", hash: value, runId: null };
  if (value === "#/agents") return { kind: "agents", hash: value, runId: null };
  const run = /^#\/runs\/([^/]+)$/.exec(value);
  if (run) return { kind: "run", hash: value, runId: run[1] ?? null };
  if (isCatalogHash(value)) return { kind: "catalog", hash: value, runId: null };
  return { kind: "other", hash: value, runId: null };
}

export function hrefFromHash(hash: string): string {
  const value = normalizeHash(hash);
  return value ? `/${value}` : AGENTS_HREF;
}

export function runHref(id: string): string {
  return `/#/runs/${id}`;
}

export function resolveAuthLocation(authed: boolean, hash: string): string {
  const route = parseAppHash(hash);
  if (!authed) {
    if (route.kind === "run" || route.kind === "catalog") return hrefFromHash(route.hash);
    return LOGIN_HREF;
  }
  if (route.kind === "login" || route.kind === "home") return AGENTS_HREF;
  return hrefFromHash(route.hash);
}

export function applyAuthLocation(
  authed: boolean,
  hash: string = typeof location === "undefined" ? "" : location.hash,
  replace: (url: string) => void = (url) => {
    history.replaceState(null, "", url);
  },
): string {
  const next = resolveAuthLocation(authed, hash);
  const nextHash = next.includes("#") ? next.slice(next.indexOf("#")) : "";
  if (normalizeHash(hash) === normalizeHash(nextHash)) return next;
  replace(next);
  return next;
}

/** Logged-in `#/login` / `#/agents` must drop run-detail chrome. Run deep links stay. */
export function shouldResetRunChrome(authed: boolean, hash: string): boolean {
  if (!authed) return false;
  const route = parseAppHash(resolveAuthLocation(authed, hash));
  return route.kind === "agents" || route.kind === "home";
}
