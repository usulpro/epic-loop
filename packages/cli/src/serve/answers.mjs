import fs from "node:fs";
import path from "node:path";

// Per-review write queue: every write for one review runs after the previous one, so concurrent
// PATCHes from two tabs merge instead of overwriting each other.
const queues = new Map();

function enqueue(key, task) {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    key,
    next.catch(() => {}),
  );
  return next;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeAtomic(file, content) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

export function readAnswers(reviewDir) {
  const answers = readJson(path.join(reviewDir, "answers.json"), {});
  return { ...answers, controls: answers.controls && typeof answers.controls === "object" ? answers.controls : {} };
}

export function patchAnswers(reviewDir, controls) {
  return enqueue(reviewDir, () => {
    const answers = readAnswers(reviewDir);
    answers.controls = { ...answers.controls, ...controls };
    answers.savedAt = new Date().toISOString();
    writeAtomic(path.join(reviewDir, "answers.json"), `${JSON.stringify(answers, null, 2)}\n`);
    return answers;
  });
}

export function submitAnswers(reviewDir, { resubmit = false } = {}) {
  return enqueue(reviewDir, () => {
    const answers = readAnswers(reviewDir);
    if (!answers.submittedAt || resubmit) {
      answers.submittedAt = new Date().toISOString();
      writeAtomic(path.join(reviewDir, "answers.json"), `${JSON.stringify(answers, null, 2)}\n`);
    }
    return answers;
  });
}

export function appendProblem(reviewDir, problem) {
  return enqueue(reviewDir, () => {
    const entry = { at: new Date().toISOString(), ...problem };
    fs.appendFileSync(path.join(reviewDir, "problems.jsonl"), `${JSON.stringify(entry)}\n`);
    return entry;
  });
}
