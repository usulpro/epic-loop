import assert from "node:assert/strict";
import test from "node:test";

import { createAnswerStore } from "../../packages/cli/src/review/runtime/answer-store.mjs";
import { isTranslatableSegment, normalizeSegment, translateText } from "../../packages/cli/src/review/runtime/i18n.mjs";
import { computeProgress, isAnswered } from "../../packages/cli/src/review/runtime/progress.mjs";

// A manual clock: timers run only when the test advances them.
function manualTimers() {
  let nextId = 0;
  const timers = new Map();
  return {
    setTimer(fn, ms) {
      const id = ++nextId;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    pending: () => [...timers.values()].map((timer) => timer.ms),
    async fire() {
      const due = [...timers.entries()];
      timers.clear();
      for (const [, timer] of due) timer.fn();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("the answer store debounces changes into one save of only the changed controls", async () => {
  const timers = manualTimers();
  const saves = [];
  const store = createAnswerStore({ save: async (batch) => saves.push(batch), ...timers });
  store.applyRemote({ untouched: "x" });
  store.set("a", 1);
  store.set("b", "two");
  store.set("a", 3);
  assert.deepEqual(timers.pending(), [400], "one debounce timer");
  assert.equal(saves.length, 0);
  await timers.fire();
  assert.deepEqual(saves, [{ a: 3, b: "two" }]);
  assert.equal(store.status().state, "saved");
  assert.equal(store.hasPending(), false);
});

test("flush saves immediately and a failed save keeps the values and retries with backoff", async () => {
  const timers = manualTimers();
  let fail = true;
  const saves = [];
  const store = createAnswerStore({
    save: async (batch) => {
      if (fail) throw new Error("offline");
      saves.push(batch);
    },
    ...timers,
  });
  store.set("q", "yes");
  await assert.rejects(store.flush(), /offline/u);
  assert.equal(store.status().state, "error");
  assert.equal(store.hasPending(), true);
  assert.deepEqual(timers.pending(), [1000], "first retry after 1 s");
  fail = false;
  await timers.fire();
  assert.deepEqual(saves, [{ q: "yes" }]);
  assert.equal(store.status().state, "saved");
});

test("a value changed while a save is in flight is saved again afterwards", async () => {
  const timers = manualTimers();
  const saves = [];
  let release;
  const store = createAnswerStore({ save: (batch) => new Promise((resolve) => ((release = resolve), saves.push(batch))), ...timers });
  store.set("c", "first");
  const flushing = store.flush();
  store.set("c", "second");
  release();
  await flushing;
  assert.equal(store.hasPending(), true);
  await timers.fire();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(saves, [{ c: "first" }, { c: "second" }]);
});

test("remote values never overwrite a pending local edit", () => {
  const store = createAnswerStore({ save: async () => {}, ...manualTimers() });
  const changes = [];
  store.onChange((event) => event.type === "change" && changes.push([event.name, event.value, event.local]));
  store.set("mine", "local");
  store.applyRemote({ mine: "remote", theirs: "remote" });
  assert.equal(store.get("mine"), "local");
  assert.equal(store.get("theirs"), "remote");
  assert.deepEqual(changes, [
    ["mine", "local", true],
    ["theirs", "remote", false],
  ]);
});

test("progress counts required controls; a confirmation counts only when checked", () => {
  const controls = [
    { name: "choice", kind: "choice" },
    { name: "confirm", kind: "check" },
    { name: "why", kind: "comment", optional: true },
    { name: "note", kind: "comment" },
  ];
  const values = { choice: "a", confirm: false, why: "", note: "  " };
  assert.deepEqual(
    computeProgress(controls, (name) => values[name]),
    { answered: 1, total: 3, complete: false },
  );
  values.confirm = true;
  values.note = "ok";
  assert.deepEqual(
    computeProgress(controls, (name) => values[name]),
    { answered: 3, total: 3, complete: true },
  );
  assert.deepEqual(
    computeProgress([], () => undefined),
    { answered: 0, total: 0, complete: true },
  );
  assert.equal(isAnswered("select", ""), false);
  assert.equal(isAnswered("custom", 0), true);
});

test("segments normalize whitespace and translations keep the surrounding whitespace", () => {
  assert.equal(normalizeSegment("  Which doorbell\n   should we use?  "), "Which doorbell should we use?");
  const segments = { "Which doorbell should we use?": "Какой звонок использовать?" };
  assert.equal(translateText("\n  Which doorbell\n should we use?\n", segments), "\n  Какой звонок использовать?\n");
  assert.equal(translateText("Untranslated", segments), null);
  assert.equal(translateText("toString", segments), null, "no prototype keys");
  assert.equal(isTranslatableSegment("  \n "), false);
  assert.equal(isTranslatableSegment("3 / 5"), false);
  assert.equal(isTranslatableSegment("Evidence"), true);
});

test("shots page within their group, ungrouped shots page together, and paging wraps around", async () => {
  const { groupMembers, stepIndex } = await import("../../packages/cli/src/review/runtime/gallery.mjs");
  const shots = [{ g: "home" }, { g: "" }, { g: "home" }, { g: null }];
  const groupOf = (shot) => shot.g;
  assert.deepEqual(groupMembers(shots, shots[2], groupOf), [shots[0], shots[2]]);
  assert.deepEqual(groupMembers(shots, shots[1], groupOf), [shots[1], shots[3]]);
  assert.equal(stepIndex(1, 1, 2), 0);
  assert.equal(stepIndex(0, -1, 3), 2);
  assert.equal(stepIndex(4, 0, 3), 1);
  assert.equal(stepIndex(0, 1, 0), -1);
});

test("compare modes and width presets parse leniently", async () => {
  const { parseMode, parseWidths } = await import("../../packages/cli/src/review/runtime/gallery.mjs");
  assert.equal(parseMode("Overlay"), "overlay");
  assert.equal(parseMode("flip"), "flip");
  assert.equal(parseMode("zoom"), "side");
  assert.equal(parseMode(undefined), "side");
  assert.deepEqual(parseWidths("375, 768,1280"), [375, 768, 1280]);
  assert.deepEqual(parseWidths("wide, 50, 99999, 1024.5, 640"), [640]);
  assert.deepEqual(parseWidths(null), []);
});
