// The shot lightbox: one dialog per page. While it is open, the answer controls of the shot's card
// are moved (not cloned) into the side panel, so their values, autosave and registration keep
// working; they move back when it closes or pages to a shot from another card.
import { el } from "./components.mjs";
import { groupMembers, stepIndex } from "./gallery.mjs";

const CONTROLS = "el-choice, el-check, el-select, el-comment";
let box = null;
let state = null; // { shots, index, returnFocus, card, moved: [{ node, placeholder }] }

export function isLightboxOpen() {
  return state !== null;
}

function build() {
  const img = el("img", { class: "el-lightbox__img", alt: "" });
  const counter = el("span", { class: "el-lightbox__counter", "aria-live": "polite" });
  const prev = el("button", { type: "button", class: "el-btn el-btn--ghost el-lightbox__nav el-lightbox__prev", "aria-label": "Previous screenshot" }, ["←"]);
  const next = el("button", { type: "button", class: "el-btn el-btn--ghost el-lightbox__nav el-lightbox__next", "aria-label": "Next screenshot" }, ["→"]);
  const close = el("button", { type: "button", class: "el-btn el-btn--ghost el-lightbox__close" }, ["close ", el("span", { class: "el-kbd" }, ["esc"])]);
  const caption = el("p", { class: "el-lightbox__caption" });
  const cardTitle = el("h3", { class: "el-lightbox__card" });
  const controls = el("div", { class: "el-lightbox__controls" });
  const root = el("div", { class: "el-lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Screenshot", hidden: true }, [
    el("div", { class: "el-lightbox__stage" }, [counter, prev, img, next]),
    el("aside", { class: "el-lightbox__panel" }, [close, el("div", { class: "el-label" }, ["caption"]), caption, cardTitle, controls]),
  ]);
  prev.addEventListener("click", () => show(state.index - 1));
  next.addEventListener("click", () => show(state.index + 1));
  close.addEventListener("click", () => closeLightbox());
  root.addEventListener("click", (event) => event.target === root && closeLightbox());
  document.body.append(root);
  return { root, img, counter, prev, next, close, caption, cardTitle, controls };
}

function restoreControls() {
  for (const { node, placeholder } of state?.moved ?? []) placeholder.replaceWith(node);
  if (state) state.moved = [];
}

function moveControls(card) {
  const moved = [];
  for (const node of card ? card.querySelectorAll(CONTROLS) : []) {
    const placeholder = document.createComment("el-lightbox");
    node.replaceWith(placeholder);
    box.controls.append(node);
    moved.push({ node, placeholder });
  }
  return moved;
}

function show(index) {
  const shots = state.shots;
  state.index = stepIndex(index, 0, shots.length);
  const shot = shots[state.index];
  const data = shot.shotData();
  box.img.src = data.src;
  box.img.alt = data.alt;
  box.counter.textContent = `${state.index + 1} / ${shots.length}`;
  box.caption.textContent = data.caption;
  box.prev.hidden = box.next.hidden = shots.length < 2;
  if (data.card !== state.card) {
    restoreControls();
    state.card = data.card;
    state.moved = moveControls(data.card);
  }
  box.cardTitle.textContent = data.card?.getAttribute("aria-label") ?? "";
  box.cardTitle.hidden = !data.card;
}

function focusables() {
  return [...box.root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.disabled && !node.hidden && node.offsetParent !== null,
  );
}

function typing(target) {
  return target instanceof HTMLElement && target.matches("input:not([type=radio]):not([type=checkbox]), textarea, select");
}

// Capture phase: keys the page would use (j/k, digits) never reach it while the dialog is open.
function onKey(event) {
  if (!state) return;
  const key = event.key;
  if (key === "Escape") closeLightbox();
  else if (key === "Tab") {
    const list = focusables();
    const index = list.indexOf(document.activeElement);
    const nextIndex = stepIndex(index === -1 ? 0 : index, event.shiftKey ? -1 : 1, list.length);
    list[nextIndex]?.focus();
  } else if (typing(event.target)) return;
  else if (key === "ArrowLeft" || key === "ArrowRight") show(state.index + (key === "ArrowLeft" ? -1 : 1));
  else if (/^[1-9]$/u.test(key)) box.controls.querySelectorAll("el-choice input[type=radio]")[Number(key) - 1]?.click();
  else if (key !== "j" && key !== "k") return;
  event.preventDefault();
  event.stopPropagation();
}

export function openLightbox(shot) {
  box ??= build();
  if (state) closeLightbox({ refocus: false });
  const all = [...document.querySelectorAll("el-shot")].filter((node) => typeof node.shotData === "function");
  const shots = groupMembers(all, shot, (node) => node.getAttribute("group"));
  state = { shots, index: shots.indexOf(shot), returnFocus: document.activeElement, card: undefined, moved: [] };
  box.root.hidden = false;
  document.body.classList.add("el-lightbox-open");
  document.addEventListener("keydown", onKey, true);
  show(state.index);
  box.close.focus();
}

export function closeLightbox({ refocus = true } = {}) {
  if (!state) return;
  restoreControls();
  const returnFocus = state.returnFocus;
  state = null;
  box.root.hidden = true;
  document.body.classList.remove("el-lightbox-open");
  document.removeEventListener("keydown", onKey, true);
  if (refocus) returnFocus?.focus?.();
}
