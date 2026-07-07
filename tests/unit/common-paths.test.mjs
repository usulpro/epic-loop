import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { epicRoot, epicRuntimeRoot, roadmapStatePath, runtimeStatePath, validateEpicSlug } from "../../plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs";

test("epic path helpers preserve valid slug paths inside the epics root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-common-paths-"));
  const slug = "demo-epic";

  try {
    assert.equal(validateEpicSlug(slug), slug);
    assert.equal(epicRoot(root, slug), path.join(root, ".epic-loop", "epics", slug));
    assert.equal(epicRuntimeRoot(root, slug), path.join(root, ".epic-loop", "epics", slug, ".runtime"));
    assert.equal(runtimeStatePath(root, slug), path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(roadmapStatePath(root, slug), path.join(root, ".epic-loop", "epics", slug, ".runtime", "roadmap-state.json"));
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("epic path helpers reject invalid or escaping slugs before returning paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-common-paths-"));
  const invalidSlugs = ["", " ", ".", "..", "../outside", "nested/epic", "nested\\epic", "/absolute", "demo..epic", "Demo", "demo_epic", "demo-"];

  try {
    for (const slug of invalidSlugs) {
      assert.throws(() => validateEpicSlug(slug), /Invalid epic slug/u, slug);
      assert.throws(() => epicRoot(root, slug), /Invalid epic slug/u, slug);
      assert.throws(() => epicRuntimeRoot(root, slug), /Invalid epic slug/u, slug);
      assert.throws(() => runtimeStatePath(root, slug), /Invalid epic slug/u, slug);
      assert.throws(() => roadmapStatePath(root, slug), /Invalid epic slug/u, slug);
    }
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
