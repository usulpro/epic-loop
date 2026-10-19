// epic-loop review page runtime (ES module, injected by `epic-loop serve`). It owns answer state,
// autosave, the submit bar, theme, language, navigation, and the public window.epicLoop API.
// It never depends on the page's own scripts.
import { createAnswerStore } from "./answer-store.mjs";
import { defineComponents } from "./components.mjs";
import { TRANSLATABLE_ATTRIBUTES, isTranslatableSegment, translateText } from "./i18n.mjs";
import { computeProgress, isAnswered } from "./progress.mjs";

const meta = document.querySelector('meta[name="epic-loop-review"]');
const reviewKey = meta?.getAttribute("content") ?? "";
const [slug, id] = reviewKey.split("/");
const apiBase = `/api/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}`;
const pageBase = `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/`;

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
};

async function api(path, { method = "GET", body } = {}) {
  const options = body === undefined ? { method } : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(`${apiBase}/${path}`, options);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return response.json();
}

// ---------- Answers ----------

const controls = new Map(); // name -> { kind, optional, element, render, pick? }
const store = createAnswerStore({ save: (changed) => api("answers", { method: "PATCH", body: { controls: changed } }) });
let submittedAt = null;

const registry = {
  register(name, control) {
    if (!name) {
      console.error("epic-loop: an answer control has no name", control.element);
      return;
    }
    if (controls.has(name)) console.warn(`epic-loop: duplicate control name "${name}"`);
    controls.set(name, control);
    control.render?.(store.get(name));
    updateProgress();
  },
  set: (name, value) => store.set(name, value),
};

store.onChange((event) => {
  if (event.type === "change") {
    controls.get(event.name)?.render?.(event.value);
    updateProgress();
  }
  if (event.type === "status") renderSave(event.status);
});

window.epicLoop = Object.freeze({
  get: (name) => store.get(name),
  set: (name, value) => store.set(name, value),
  onChange(callback) {
    return store.onChange((event) => event.type === "change" && callback(event.name, event.value, { local: event.local }));
  },
  // Custom blocks register their control so progress and the schema include it.
  registerControl(name, { optional = false, kind = "custom" } = {}) {
    registry.register(name, { kind, optional, element: document.currentScript ?? document.body, render() {} });
  },
  review: Object.freeze({ slug, id, apiBase, pageBase }),
});

// ---------- Submit bar ----------

const bar = document.createElement("footer");
bar.className = "el-submitbar";
bar.dataset.i18nSkip = "";
bar.innerHTML = `
  <div class="el-submitbar__progress">
    <details class="el-toc" hidden><summary class="el-btn el-btn--ghost">cards</summary><ol class="el-toc__list"></ol></details>
    <span class="el-progress-text">0 / 0 answered</span><span class="el-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Answered"></span>
  </div>
  <div class="el-submitbar__end">
    <span class="el-save" data-state="idle" aria-live="polite"></span>
    <div class="el-seg el-lang" role="group" aria-label="Language" hidden></div>
    <div class="el-seg el-theme" role="group" aria-label="Theme">
      <button type="button" data-theme-set="auto">auto</button><button type="button" data-theme-set="light">light</button><button type="button" data-theme-set="dark">dark</button>
    </div>
    <span class="el-submitted el-meta" hidden></span>
    <button class="el-btn el-btn--primary el-submit" type="button">Submit answers</button>
  </div>`;
const $ = (selector) => bar.querySelector(selector);

function renderSave(status) {
  const node = $(".el-save");
  node.dataset.state = status.state;
  const time = status.at ? status.at.toTimeString().slice(0, 5) : "";
  node.textContent = status.state === "saving" ? "saving…" : status.state === "saved" ? `saved ${time}` : status.state === "error" ? "not saved, retrying" : "";
}

function cardOf(control) {
  return control.element.closest?.("el-card, el-section");
}

function updateProgress() {
  const list = [...controls.entries()].map(([name, control]) => ({ name, kind: control.kind, optional: control.optional }));
  const { answered, total } = computeProgress(list, (name) => store.get(name));
  $(".el-progress-text").textContent = `${answered} / ${total} answered`;
  const progress = $(".el-progress");
  progress.style.setProperty("--value", total ? String(answered / total) : "1");
  progress.setAttribute("aria-valuenow", String(total ? Math.round((answered / total) * 100) : 100));
  for (const item of bar.querySelectorAll(".el-toc__list li")) {
    const card = item._card;
    const own = [...controls.entries()].filter(([, control]) => cardOf(control) === card && !control.optional);
    const done = own.every(([name, control]) => isAnswered(control.kind, store.get(name)));
    item.dataset.answered = String(done);
    item.querySelector(".el-toc__mark").textContent = done ? "✓" : "○";
  }
}

function renderSubmitted() {
  const label = $(".el-submitted");
  const button = $(".el-submit");
  if (submittedAt) {
    label.hidden = false;
    label.textContent = `submitted ${new Date(submittedAt).toLocaleString()}`;
    button.textContent = "Submit again";
  } else {
    label.hidden = true;
    button.textContent = "Submit answers";
  }
}

$(".el-submit").addEventListener("click", async () => {
  const button = $(".el-submit");
  button.disabled = true;
  try {
    await store.flush();
    const answers = await api("submit", { method: "POST", body: submittedAt ? { resubmit: true } : {} });
    submittedAt = answers.submittedAt ?? null;
    renderSubmitted();
  } catch (error) {
    renderSave({ state: "error", at: null, error: String(error) });
  } finally {
    button.disabled = false;
  }
});

// ---------- Theme ----------

function applyTheme(choice) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const button of bar.querySelectorAll("[data-theme-set]")) button.setAttribute("aria-pressed", String(button.dataset.themeSet === (choice || "auto")));
}
const THEME_KEY = "epic-loop:theme";
applyTheme(storage.get(THEME_KEY) ?? "auto");
bar.querySelector(".el-theme").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-theme-set]")?.dataset.themeSet;
  if (!choice) return;
  storage.set(THEME_KEY, choice === "auto" ? null : choice);
  applyTheme(choice);
});

// ---------- Language ----------

const LANG_KEY = `epic-loop:lang:${reviewKey}`;
const originalText = new WeakMap(); // Text node -> English text
const originalAttrs = new WeakMap(); // Element -> { attr: English value }
const touched = new Set();
const translations = new Map(); // lang -> segments

// Text inside fields, code and runtime UI is never translated; a field's own attributes
// (placeholder, aria-label) are.
function skip(node) {
  if (node.nodeType === Node.TEXT_NODE) return !node.parentElement || node.parentElement.closest("script, style, textarea, code, pre, [data-i18n-skip], #el-problem") !== null;
  return node.closest("script, style, code, pre, [data-i18n-skip], #el-problem") !== null;
}

function* textNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) yield walker.currentNode;
}

function restoreEnglish() {
  for (const node of touched) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (originalText.has(node)) node.nodeValue = originalText.get(node);
    } else {
      for (const [attr, value] of Object.entries(originalAttrs.get(node) ?? {})) node.setAttribute(attr, value);
    }
  }
}

function applySegments(segments) {
  for (const node of textNodes()) {
    if (skip(node) || !isTranslatableSegment(node.nodeValue)) continue;
    const source = originalText.get(node) ?? node.nodeValue;
    const translated = translateText(source, segments);
    if (translated === null) continue;
    originalText.set(node, source);
    touched.add(node);
    node.nodeValue = translated;
  }
  const selector = TRANSLATABLE_ATTRIBUTES.map((attr) => `[${attr}]`).join(",");
  for (const element of document.body.querySelectorAll(selector)) {
    if (skip(element)) continue;
    const saved = originalAttrs.get(element) ?? {};
    for (const attr of TRANSLATABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attr)) continue;
      const source = saved[attr] ?? element.getAttribute(attr);
      const translated = translateText(source, segments);
      if (translated === null) continue;
      saved[attr] = source;
      element.setAttribute(attr, translated);
    }
    if (Object.keys(saved).length) {
      originalAttrs.set(element, saved);
      touched.add(element);
    }
  }
}

async function setLanguage(lang) {
  restoreEnglish();
  if (lang && lang !== "en") {
    if (!translations.has(lang)) {
      const response = await fetch(`${pageBase}i18n/${encodeURIComponent(lang)}.json`);
      translations.set(lang, response.ok ? ((await response.json()).segments ?? {}) : {});
    }
    applySegments(translations.get(lang));
  }
  document.documentElement.lang = lang || "en";
  storage.set(LANG_KEY, lang && lang !== "en" ? lang : null);
  for (const button of bar.querySelectorAll("[data-lang]")) button.setAttribute("aria-pressed", String(button.dataset.lang === (lang || "en")));
}

async function setupLanguages() {
  let languages = [];
  try {
    const response = await fetch(`${pageBase}review.json`);
    if (response.ok) languages = ((await response.json()).languages ?? []).filter((lang) => typeof lang === "string" && lang !== "en");
  } catch {}
  if (!languages.length) return;
  const group = $(".el-lang");
  group.hidden = false;
  for (const lang of ["en", ...languages]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lang = lang;
    button.textContent = lang;
    button.addEventListener("click", () => setLanguage(lang));
    group.append(button);
  }
  await setLanguage(storage.get(LANG_KEY) ?? "en");
}

// ---------- Navigation ----------

function cards() {
  return [...document.querySelectorAll("el-card")].length > 1 ? [...document.querySelectorAll("el-card")] : [...document.querySelectorAll("el-card, el-section")];
}

function setupToc() {
  const list = cards();
  if (list.length < 2) return;
  const toc = $(".el-toc");
  toc.hidden = false;
  toc.open = false;
  for (const card of list) {
    const label = card.getAttribute("aria-label") ?? card.id ?? "card";
    const item = document.createElement("li");
    item._card = card;
    const link = document.createElement("a");
    link.href = card.id ? `#${card.id}` : "#";
    link.innerHTML = `<span class="el-toc__mark" aria-hidden="true">○</span> `;
    link.append(document.createTextNode(label));
    link.addEventListener("click", (event) => {
      event.preventDefault();
      card.scrollIntoView({ block: "start" });
      card.focus({ preventScroll: true });
      toc.open = false;
    });
    item.append(link);
    toc.querySelector(".el-toc__list").append(item);
  }
}

function typingIn(target) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input:not([type=radio]):not([type=checkbox]), textarea, select"));
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || typingIn(event.target)) return;
  const list = cards();
  const current = document.activeElement?.closest?.("el-card, el-section");
  if (event.key === "j" || event.key === "k") {
    if (!list.length) return;
    const index = list.indexOf(current);
    const next = list[Math.max(0, Math.min(list.length - 1, index + (event.key === "j" ? 1 : -1)))] ?? list[0];
    next.scrollIntoView({ block: "start" });
    next.focus({ preventScroll: true });
    event.preventDefault();
  } else if (/^[1-9]$/u.test(event.key)) {
    const scope = document.activeElement?.closest?.("el-choice") ?? current?.querySelector("el-choice");
    const control = scope && controls.get(scope.getAttribute("name"));
    if (control?.pick) {
      control.pick(Number(event.key) - 1);
      event.preventDefault();
    }
  }
});

// ---------- Start ----------

async function refresh() {
  const answers = await api("answers");
  store.applyRemote(answers.controls ?? {});
  submittedAt = answers.submittedAt ?? null;
  renderSubmitted();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !store.hasPending()) refresh().catch(() => {});
});

window.addEventListener("beforeunload", (event) => {
  if (store.hasPending()) {
    store.flush().catch(() => {});
    event.preventDefault();
    event.returnValue = "";
  }
});

document.body.append(bar);
document.body.classList.add("el-has-submitbar");
defineComponents(registry);
setupToc();
updateProgress();
refresh()
  .catch((error) => renderSave({ state: "error", at: null, error: String(error) }))
  .finally(() => setupLanguages().catch(() => {}));
