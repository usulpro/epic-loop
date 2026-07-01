import assert from "node:assert/strict";
import { test } from "node:test";

import { epicLoopRoot, epicSlugify, parseArgs, slugify } from "../../plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs";

test("common helpers can be imported and used from the unit harness", () => {
  assert.equal(slugify("Deterministic Unit Tests!"), "deterministic-unit-tests");
  assert.equal(epicSlugify("Deterministic Unit Test Harness"), "deterministic-unit");
  assert.equal(epicLoopRoot("/tmp/example-project"), "/tmp/example-project/.epic-loop");

  assert.deepEqual(parseArgs(["--slug", "test-coverage", "status", "--json"]), {
    flags: {
      json: true,
      slug: "test-coverage",
    },
    positionals: ["status"],
  });
});
