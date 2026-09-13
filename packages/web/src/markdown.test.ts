import assert from "node:assert/strict";
import test from "node:test";
import { prepareMarkdown, readPipeTable } from "./markdown.js";

test("prepareMarkdown closes an open fence while streaming", () => {
  const fence = "```";
  assert.equal(prepareMarkdown(`${fence}ts\nconst x = 1`, true).endsWith(`${fence}\n`), true);
  assert.equal(prepareMarkdown("hello **world**", true), "hello **world**");
  assert.equal(prepareMarkdown(`${fence}ts\nconst x = 1\n${fence}`, false), `${fence}ts\nconst x = 1\n${fence}`);
});

test("readPipeTable folds EventLog-style tables and ignores a lone pipe", () => {
  const table = [
    "| Event | Time |",
    "| --- | --- |",
    "| tool.start | 1s |",
  ];
  const found = readPipeTable(table, 0);
  assert.equal(found?.rows.length, 2);
  assert.deepEqual(found?.rows[0], ["Event", "Time"]);
  assert.equal(readPipeTable(["a | b only"], 0), null);
});
