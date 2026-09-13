import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");

test("web shell keeps the original cool-gray chrome", () => {
  assert.match(css, /--bg:\s*#ffffff/);
  assert.match(css, /--accent:\s*#4d6bfe/);
  assert.match(css, /font-family:\s*Inter/);
  assert.doesNotMatch(css, /Geist Sans/);
  assert.match(css, /\.new-chat-plus\s*\{/);
  assert.match(css, /button\.send\s*\{[^}]*padding:\s*8px 16px/);
  assert.match(css, /--ease:\s*140ms ease/);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /\.toast-host/);
  assert.match(css, /\.settings-group/);
  assert.match(css, /\.term-shell\s*\{/);
});

test("agents home uses the locked Cursor /agents tokens", () => {
  assert.match(css, /--stage:\s*#f7f7f7/);
  assert.match(css, /--rail:\s*#f3f3f3/);
  assert.match(css, /--line:\s*#e5e5e5/);
  assert.match(css, /--text:\s*#2b2b2b/);
  assert.match(css, /--muted:\s*#737373/);
  assert.match(css, /--btn-primary:\s*#111111/);
  assert.match(css, /--ok:\s*#1f8a4c/);
  assert.match(css, /--merged:\s*#7c3aed/);
  assert.match(css, /--err:\s*#d92d20/);
  assert.match(css, /grid-template-columns:\s*220px minmax\(0, 1fr\)/);
  assert.match(css, /\.agents-landing/);
  assert.match(css, /\.agents-hero/);
  assert.match(css, /\.composer\.agents-composer/);
  assert.match(css, /max-width:\s*510px/);
  assert.match(css, /min\(600px/);
  assert.match(css, /\.agent-card/);
  assert.match(css, /\.agent-badge\.is-open/);
  assert.match(css, /\.agent-badge\.is-merged/);
  assert.doesNotMatch(css, /Codebase Early Beta/);
  assert.doesNotMatch(css, /Create an Automation/);
  assert.doesNotMatch(css, /Try Commands/);
  assert.doesNotMatch(css, /Grok promo/);
});

test("run conversation uses a three-column Cursor-like chrome", () => {
  assert.match(css, /\.app\.is-run-detail \.main/);
  assert.match(css, /grid-template-areas:\s*"workspace git"/);
  assert.match(css, /minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.git-pane/);
  assert.match(css, /\.run-head/);
  assert.match(css, /\.files-changed/);
  assert.match(css, /\.composer\.followup-composer/);
  assert.match(css, /\.agents-sidebar\.is-collapsed/);
  assert.match(css, /grid-template-columns:\s*48px minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /Subscriptions/);
  assert.doesNotMatch(css, /Desktop tab/);
  assert.match(css, /--stage:\s*#f7f7f7/);
  assert.match(css, /--merged:\s*#7c3aed/);
});

test("welcome cluster fits a 14-inch laptop viewport without a page scroll", () => {
  assert.match(css, /\.transcript\s*\{[^}]*container-name:\s*transcript/);
  assert.match(css, /\.empty h2\s*\{[^}]*margin:\s*0 0 8px/);
  assert.match(css, /\.empty p\s*\{[^}]*margin:\s*0/);
  assert.match(css, /@media \(min-width: 861px\)\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 861px\) and \(max-height: 920px\)/);
  assert.match(css, /@media \(min-width: 861px\) and \(max-height: 760px\)/);
  assert.match(css, /@media \(min-width: 1400px\)/);
  assert.match(css, /@container transcript \(max-height: 560px\)/);
  assert.match(css, /@container transcript \(max-height: 420px\)/);
});
