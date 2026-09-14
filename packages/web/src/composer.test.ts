import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const composer = readFileSync(path.join(here, "components/Composer.tsx"), "utf8");

test("agents home mic is a decorative black circle, not a voice control", () => {
  assert.match(composer, /empty && !followup \? \(/);
  assert.match(composer, /<span className="composer-voice" aria-hidden="true">/);
  assert.doesNotMatch(composer, /className="composer-voice"[^>]*onClick/);
  assert.doesNotMatch(composer, /className="composer-voice"[^>]*aria-label="Voice"/);
  assert.doesNotMatch(composer, /<button[^>]*className="composer-voice"/);
});
