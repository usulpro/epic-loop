import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, runNodeScript } from "./test-utils.mjs";

// D40: the epic's second language is one line in state-of-epic.md, written only by this script.
test("set-second-language writes, replaces and clears one state line and rejects English or bad codes", () => {
  const root = makeTempRoot("second-language");
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Demo", "--slug", "demo", "--no-gitignore"]));
  const statePath = path.join(root, ".epic-loop", "epics", "demo", "state-of-epic.md");
  const before = fs.readFileSync(statePath, "utf8");
  const set = (lang) => runNodeScript("set-second-language.mjs", ["--root", root, "--slug", "demo", "--lang", lang]);

  assertSuccess(set("ru"));
  const once = fs.readFileSync(statePath, "utf8");
  assert.equal(once.match(/^Second language: ru$/gmu)?.length, 1);
  assert.equal(once.replace("Second language: ru\n", ""), before, "no other line changes");
  assert.ok(once.indexOf("Second language: ru") < once.indexOf("\n## "), "the line sits in the header block");

  assertSuccess(set("ru"));
  assert.equal(fs.readFileSync(statePath, "utf8"), once, "idempotent");

  assertSuccess(set("pt-BR"));
  assert.match(fs.readFileSync(statePath, "utf8"), /^Second language: pt-BR$/mu);
  assertSuccess(set("none"));
  const cleared = fs.readFileSync(statePath, "utf8");
  assert.equal(cleared.match(/^Second language:/gmu)?.length, 1);
  assert.match(cleared, /^Second language: none$/mu);

  for (const bad of ["en", "en-US", "EN", "russian", "r", "ru_RU"]) {
    const result = set(bad);
    assert.notEqual(result.status, 0, bad);
    assert.match(result.stderr, /Invalid --lang/u, bad);
  }
  assert.equal(fs.readFileSync(statePath, "utf8"), cleared, "a rejected code changes nothing");
});
