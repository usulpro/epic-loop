// Visual review components v1: el-shot (with the lightbox), el-iframe, el-diagram (bundled
// Mermaid, loaded only when a page has a diagram) and el-compare. None is an answer control.
import { Base, el, nextId, safe } from "./components.mjs";
import { COMPARE_MODES, parseMode, parseWidths } from "./gallery.mjs";
import { openLightbox } from "./lightbox.mjs";

// ---------- el-shot ----------

class Shot extends Base {
  shotData() {
    return { src: this._img.currentSrc || this._img.src, alt: this._img.alt, caption: this._caption, card: this.closest("el-card") };
  }
}
Shot.prototype.upgrade = safe(function () {
  let img = this.querySelector("img");
  if (!img && this.getAttribute("src")) img = el("img", { src: this.getAttribute("src"), alt: this.getAttribute("alt") ?? "" });
  if (!img) throw new Error("el-shot needs an <img> child or a src attribute");
  img.loading = "lazy";
  const width = Number(this.getAttribute("width"));
  if (width > 0) img.style.maxWidth = `${width}px`;
  this._img = img;
  this._caption = this.getAttribute("caption") ?? img.getAttribute("alt") ?? "";
  const open = el("button", { type: "button", class: "el-shot__open", "aria-label": `Open ${this._caption || "screenshot"} full size` }, [img]);
  const figure = el("figure", { class: "el-shot" }, [open]);
  if (this._caption) figure.append(el("figcaption", { class: "el-shot__caption" }, [this._caption]));
  this.replaceChildren(figure);
  open.addEventListener("click", () => openLightbox(this));
});

// ---------- el-iframe ----------

class Frame extends Base {}
Frame.prototype.upgrade = safe(function () {
  const template = this.querySelector("template");
  const inline = template ? template.innerHTML : this.getAttribute("srcdoc");
  const src = this.getAttribute("src");
  const title = this.getAttribute("title") ?? (src || "Inline page");
  const height = Number(this.getAttribute("height")) || 480;
  const frame = el("iframe", { class: "el-iframe__frame", title, loading: "lazy" });
  frame.style.height = `${height}px`;
  const bar = el("div", { class: "el-iframe__bar" }, [el("span", { class: "el-label" }, [title])]);
  if (inline !== null) {
    // Inline content runs scripts but gets an opaque origin: no access to window.epicLoop or the API.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.srcdoc = inline;
  } else if (src) {
    const url = new URL(src, document.baseURI);
    // A same-origin page could reach the answers API, so it is sandboxed like inline content.
    frame.setAttribute("sandbox", url.origin === location.origin ? "allow-scripts" : "allow-scripts allow-same-origin allow-forms allow-popups");
    frame.src = url.href;
    bar.append(el("a", { class: "el-meta", href: url.href, target: "_blank", rel: "noopener noreferrer" }, ["open ↗"]));
  } else throw new Error("el-iframe needs src, srcdoc or a <template> child");
  const reload = el("button", { type: "button", class: "el-btn el-btn--ghost" }, ["reload"]);
  reload.addEventListener("click", () => (inline !== null ? (frame.srcdoc = inline) : (frame.src = frame.getAttribute("src"))));
  bar.append(reload);
  this.replaceChildren(el("div", { class: "el-iframe" }, [bar, frame]));
});

// ---------- el-diagram ----------

let mermaidReady = null;
const diagrams = new Set();

function loadMermaid() {
  mermaidReady ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/_runtime/vendor/mermaid.min.js";
    script.onload = () => (window.mermaid ? resolve(window.mermaid) : reject(new Error("Mermaid did not load")));
    script.onerror = () => reject(new Error("Mermaid failed to load"));
    document.head.append(script);
  });
  return mermaidReady;
}

function darkTheme() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function dedent(source) {
  const lines = source.replace(/^\n+|\s+$/gu, "").split("\n");
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => /^\s*/u.exec(line)[0].length));
  return lines.map((line) => line.slice(indent)).join("\n");
}

async function renderDiagram(host) {
  try {
    const mermaid = await loadMermaid();
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: darkTheme() ? "dark" : "neutral", fontFamily: getComputedStyle(document.body).fontFamily });
    const { svg } = await mermaid.render(nextId("el-mermaid"), host._source);
    host._canvas.innerHTML = svg;
    host.dataset.rendered = darkTheme() ? "dark" : "light";
    host.dataset.renders = String(Number(host.dataset.renders ?? 0) + 1);
  } catch (error) {
    host._canvas.replaceChildren(el("p", { class: "el-field__error" }, [`The diagram could not be rendered: ${error?.message ?? error}`]), el("pre", {}, [host._source]));
    host.dataset.rendered = "error";
  }
}

class Diagram extends Base {}
Diagram.prototype.upgrade = safe(function () {
  this._source = dedent(this.textContent);
  this._canvas = el("div", { class: "el-diagram__canvas", "data-i18n-skip": "" }, [el("pre", {}, [this._source])]);
  const figure = el("figure", { class: "el-diagram" }, [this._canvas]);
  if (this.getAttribute("caption")) figure.append(el("figcaption", { class: "el-shot__caption" }, [this.getAttribute("caption")]));
  this.replaceChildren(figure);
  diagrams.add(this);
  renderDiagram(this);
});

let rerender = null;
function rerenderDiagrams() {
  clearTimeout(rerender);
  rerender = setTimeout(() => {
    for (const host of diagrams) if (host.isConnected && host.dataset.rendered !== (darkTheme() ? "dark" : "light")) renderDiagram(host);
  }, 50);
}

// ---------- el-compare ----------

function segment(label, values, onPick) {
  const group = el("div", { class: "el-seg", role: "group", "aria-label": label });
  for (const value of values) {
    const button = el("button", { type: "button", "data-value": value }, [String(value)]);
    button.addEventListener("click", () => onPick(value));
    group.append(button);
  }
  group.press = (value) => {
    for (const button of group.children) button.setAttribute("aria-pressed", String(button.dataset.value === String(value)));
  };
  return group;
}

class Compare extends Base {}
Compare.prototype.upgrade = safe(function () {
  const items = [...this.children].filter((child) => child.matches("el-shot, img, figure"));
  if (items.length < 2) throw new Error("el-compare needs two or more el-shot or img children");
  const panes = el("div", { class: "el-compare__panes" });
  for (const item of items)
    panes.append(el("div", { class: "el-compare__pane" }, [el("span", { class: "el-compare__caption" }, [item.getAttribute("label") ?? item.getAttribute("alt") ?? ""]), item]));
  const frame = el("div", { class: "el-compare", tabindex: "0" });
  const opacity = el("input", { type: "range", min: "0", max: "100", value: "50", class: "el-compare__opacity", "aria-label": "Overlay opacity" });
  const flip = el("button", { type: "button", class: "el-btn el-btn--ghost el-compare__flip" }, ["flip ", el("span", { class: "el-kbd" }, ["space"])]);
  let front = 0;
  const setFront = (index) => {
    front = index % items.length;
    [...panes.children].forEach((pane, i) => pane.classList.toggle("is-front", i === front));
  };
  const modes = segment("Mode", COMPARE_MODES, (mode) => setMode(mode));
  const setMode = (mode) => {
    frame.dataset.mode = mode;
    frame.classList.toggle("el-compare--overlay", mode === "overlay");
    frame.classList.toggle("el-compare--flip", mode === "flip");
    opacity.hidden = mode !== "overlay";
    flip.hidden = mode !== "flip";
    modes.press(mode);
    setFront(0);
  };
  const bar = el("div", { class: "el-compare__bar" }, [el("span", { class: "el-label" }, [this.getAttribute("caption") ?? "compare"]), modes, opacity, flip]);
  const widths = parseWidths(this.getAttribute("widths"));
  if (widths.length) {
    const sizes = segment("Width", ["fit", ...widths], (width) => {
      panes.style.maxWidth = width === "fit" ? "" : `${width}px`;
      sizes.press(width);
    });
    sizes.press("fit");
    bar.append(sizes);
  }
  opacity.addEventListener("input", () => frame.style.setProperty("--overlay-opacity", String(opacity.value / 100)));
  flip.addEventListener("click", () => setFront(front + 1));
  frame.addEventListener("keydown", (event) => {
    if (event.key === " " && frame.dataset.mode === "flip" && event.target === frame) {
      event.preventDefault();
      setFront(front + 1);
    }
  });
  frame.append(bar, panes);
  this.replaceChildren(frame);
  setMode(parseMode(this.getAttribute("mode")));
});

export function defineVisualComponents() {
  const elements = { "el-shot": Shot, "el-iframe": Frame, "el-diagram": Diagram, "el-compare": Compare };
  for (const [tag, ctor] of Object.entries(elements)) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
  new MutationObserver(rerenderDiagrams).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rerenderDiagrams);
}
