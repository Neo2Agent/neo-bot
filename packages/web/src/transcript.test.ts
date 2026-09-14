import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const transcript = readFileSync(path.join(here, "components/Transcript.tsx"), "utf8");

test("transcript tool rows use toolRowPresentation and stay collapsed unless running", () => {
  assert.match(transcript, /toolRowPresentation\(tool, compact\)/);
  assert.match(transcript, /const card = compact \|\| kind === "shell"/);
  assert.match(transcript, /\{\.\.\.\(open \? \{ open: true \} : \{\}\)\}/);
});
