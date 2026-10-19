// Review page components v1 (light DOM custom elements). Answer controls register with the runtime
// through the `registry` passed to defineComponents; layout elements only restyle their children.
// Authoring contract: references/review-design.md and docs/review-engine.md.

const OPTION_TAG = "EL-OPTION";

function text(value) {
  return document.createTextNode(value);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) node.append(typeof child === "string" ? text(child) : child);
  return node;
}

function readOptions(host) {
  return [...host.children]
    .filter((child) => child.tagName === OPTION_TAG)
    .map((option) => ({ value: option.getAttribute("value") ?? option.textContent.trim(), label: option.textContent.trim(), note: option.getAttribute("note"), node: option }));
}

let uid = 0;
const nextId = (prefix) => `${prefix}-${++uid}`;

// Set by defineComponents: the runtime's control registry ({ register, set }).
let registry = null;

// Every upgrade is isolated: one broken element never stops the others.
const safe = (fn) =>
  function upgrade() {
    if (this.dataset.upgraded) return;
    this.dataset.upgraded = "true";
    this.classList.add("is-upgraded");
    try {
      fn.call(this);
    } catch (error) {
      console.error(`epic-loop: <${this.localName}> failed to render`, error);
      this.dataset.upgradeError = String(error?.message ?? error);
    }
  };

class Base extends HTMLElement {
  connectedCallback() {
    // Children may not be parsed yet when the element connects during parsing.
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => this.upgrade(), { once: true });
    else this.upgrade();
  }
  get controlName() {
    return this.getAttribute("name");
  }
  get optional() {
    return this.hasAttribute("optional");
  }
}

class Choice extends Base {}
Choice.prototype.upgrade = safe(function () {
  const name = this.controlName;
  const options = readOptions(this);
  const recommended = this.getAttribute("recommended");
  const rule = this.getAttribute("rule");
  const group = `el-${name}-${nextId("g")}`;
  const fieldset = el("fieldset", { class: "el-choice-group" });
  if (this.getAttribute("label")) fieldset.append(el("legend", {}, [this.getAttribute("label")]));
  const inputs = options.map((option, index) => {
    const input = el("input", { type: "radio", name: group, value: option.value });
    const title = el("span", { class: "el-choice__title" }, [option.label]);
    if (option.value === recommended) {
      title.append(" ", el("span", { class: "el-tag el-tag--recommended", title: rule ? `Recommended by ${rule}` : "Recommended" }, ["recommended"]));
      if (rule) title.append(" ", el("span", { class: "el-meta" }, [rule]));
    }
    const body = el("span", { class: "el-choice__body" }, [title]);
    if (option.note) body.append(el("span", { class: "el-choice__note" }, [option.note]));
    const row = el("label", { class: `el-choice${option.value === recommended ? " el-choice--recommended" : ""}` }, [
      input,
      body,
      el("span", { class: "el-kbd", "aria-hidden": "true" }, [String(index + 1)]),
    ]);
    option.node.hidden = true;
    fieldset.append(row);
    input.addEventListener("change", () => input.checked && registry.set(name, option.value));
    return input;
  });
  this.append(fieldset);
  registry.register(name, {
    kind: "choice",
    optional: this.optional,
    element: this,
    render(value) {
      for (const input of inputs) input.checked = input.value === value;
    },
    pick(index) {
      const input = inputs[index];
      if (input) {
        input.checked = true;
        input.focus();
        registry.set(name, input.value);
      }
    },
  });
});

class Check extends Base {}
Check.prototype.upgrade = safe(function () {
  const name = this.controlName;
  const input = el("input", { type: "checkbox" });
  const body = el("span", { class: "el-choice__body" }, [el("span", { class: "el-choice__title" }, [...this.childNodes])]);
  this.append(el("label", { class: "el-check" }, [input, body, el("span")]));
  input.addEventListener("change", () => registry.set(name, input.checked));
  registry.register(name, { kind: "check", optional: this.optional, element: this, render: (value) => (input.checked = value === true) });
});

class Select extends Base {}
Select.prototype.upgrade = safe(function () {
  const name = this.controlName;
  const id = nextId("el-select");
  const options = readOptions(this);
  const select = el("select", { class: "el-select", id }, [
    el("option", { value: "" }, [this.getAttribute("placeholder") ?? "Choose…"]),
    ...options.map((option) => el("option", { value: option.value }, [option.label])),
  ]);
  for (const option of options) option.node.hidden = true;
  const field = el("div", { class: "el-field" });
  if (this.getAttribute("label")) field.append(el("label", { class: "el-field__label", for: id }, [this.getAttribute("label")]));
  field.append(select);
  this.append(field);
  select.addEventListener("change", () => registry.set(name, select.value));
  registry.register(name, { kind: "select", optional: this.optional, element: this, render: (value) => (select.value = value ?? "") });
});

class Comment extends Base {}
Comment.prototype.upgrade = safe(function () {
  const name = this.controlName;
  const id = nextId("el-comment");
  const area = el("textarea", { class: "el-comment", id, rows: this.getAttribute("rows") ?? 4, placeholder: this.getAttribute("placeholder") });
  const field = el("div", { class: "el-field" });
  if (this.getAttribute("label")) field.append(el("label", { class: "el-field__label", for: id }, [this.getAttribute("label")]));
  field.append(area);
  if (this.optional) field.append(el("span", { class: "el-field__hint" }, ["Optional."]));
  this.append(field);
  area.addEventListener("input", () => registry.set(name, area.value));
  registry.register(name, { kind: "comment", optional: this.optional, element: this, render: (value) => document.activeElement !== area && (area.value = value ?? "") });
});

class Card extends Base {}
Card.prototype.upgrade = safe(function () {
  this.classList.add("el-card");
  this.tabIndex = -1;
  const title = this.getAttribute("title");
  if (title) {
    this.setAttribute("aria-label", title);
    this.removeAttribute("title");
    const head = el("div", { class: "el-card__head" });
    if (this.id) head.append(el("span", { class: "el-id" }, [this.id]));
    head.append(el("h3", {}, [title]));
    this.prepend(head);
  }
});

class Section extends Base {}
Section.prototype.upgrade = safe(function () {
  this.classList.add("el-section");
  this.tabIndex = -1;
  const title = this.getAttribute("title");
  if (title) {
    this.setAttribute("aria-label", title);
    this.removeAttribute("title");
    this.prepend(el("div", { class: "el-section__head" }, [el("h2", {}, [title])]));
  }
});

class Links extends Base {}
Links.prototype.upgrade = safe(function () {
  const list = el("ul", { class: "el-links__list" });
  for (const link of this.querySelectorAll("a")) list.append(el("li", {}, [link]));
  this.replaceChildren(list);
});

class Table extends Base {}
Table.prototype.upgrade = safe(function () {
  const table = this.querySelector("table");
  if (!table) return;
  table.classList.add("el-table");
  const wrap = el("div", { class: "el-table-wrap" });
  table.replaceWith(wrap);
  wrap.append(table);
});

export function defineComponents(controlRegistry) {
  registry = controlRegistry;
  const elements = {
    "el-choice": Choice,
    "el-check": Check,
    "el-select": Select,
    "el-comment": Comment,
    "el-card": Card,
    "el-section": Section,
    "el-links": Links,
    "el-table": Table,
  };
  for (const [tag, ctor] of Object.entries(elements)) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
  if (!customElements.get("el-option")) customElements.define("el-option", class extends HTMLElement {});
}
