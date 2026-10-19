import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { REVIEW_RUNTIME_DIR, reviewVendorFile } from "../paths.mjs";
import { appendProblem, patchAnswers, readAnswers, submitAnswers } from "./answers.mjs";
import { ringDoorbell } from "./doorbell.mjs";
import { contentType, isFile, resolveInside } from "./files.mjs";
import { INBOX_TEXT_LIMIT, appendInbox } from "./inbox.mjs";
import { buildIdIndex } from "../epic/id-index.mjs";
import { streamEpicEvents, watcherCount } from "./events.mjs";
import { docsResponse } from "./docs.mjs";
import { homeHtml } from "./home-route.mjs";
import { activeLanguage, langCookieHeader, langSwitch, readSecondLanguage } from "./i18n.mjs";
import { idMentions, validateTranslatedDoc } from "./markdown.mjs";
import { createTranslator } from "./translator.mjs";
import { injectReview, renderEpicList, renderInboxThanks, renderNotFound, renderProblemThanks } from "./pages.mjs";
import { epicDir, epicExists, listEpicsWithReviews, reviewDir, reviewExists } from "./reviews.mjs";

const MAX_BODY = 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(404, "There is no page at this address.");
  }
}

function send(res, status, body, type = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, `${JSON.stringify(value)}\n`, "application/json; charset=utf-8");
}

function sendFile(res, file) {
  res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store", "x-content-type-options": "nosniff" });
  fs.createReadStream(file).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readPayload(req) {
  const text = await readBody(req);
  const type = String(req.headers["content-type"] ?? "")
    .split(";")[0]
    .trim();
  if (type === "application/x-www-form-urlencoded") return { form: true, data: Object.fromEntries(new URLSearchParams(text)) };
  if (!text.trim()) return { form: false, data: {} };
  try {
    return { form: false, data: JSON.parse(text) };
  } catch {
    throw new HttpError(400, "Body must be JSON or form-encoded.");
  }
}

// GET /api/<slug>/ids: the epic's id index (D27) for the reference popovers.
function sendIds(req, res, root, slug) {
  if (!epicExists(root, slug)) throw new HttpError(404, "There is no such epic in this project.");
  if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed.");
  const index = buildIdIndex(epicDir(root, slug));
  return sendJson(res, 200, { aliases: index.aliases, ids: index.ids });
}

// An epic page's language: `?lang=<en|second>` sets the cookie and redirects back (303) without
// the parameter; otherwise the cookie picks the language. Null when the response is already sent.
function epicPage(req, res, url, root, slug) {
  if (!epicExists(root, slug)) throw new HttpError(404, "There is no such epic in this project.");
  const dir = epicDir(root, slug);
  const second = readSecondLanguage(dir);
  const asked = url.searchParams.get("lang");
  if (asked !== null) {
    if (asked !== "en" && asked !== second) throw new HttpError(400, "This epic has no such language.");
    res.writeHead(303, { "cache-control": "no-store", location: url.pathname, "set-cookie": langCookieHeader(asked) });
    res.end();
    return null;
  }
  const lang = activeLanguage(req, second);
  return { dir, lang, slug, switch: langSwitch(url.pathname, second, lang) };
}

export function createReviewServer({ root, projectName = path.basename(root), onListening }) {
  let origins = [];
  let hosts = [];
  const translator = createTranslator({ root, segmentIds: idMentions, validateDoc: validateTranslatedDoc });

  async function handleApi(req, res, slug, id, action) {
    if (!reviewExists(root, slug, id)) throw new HttpError(404, "Unknown review.");
    const dir = reviewDir(root, slug, id);
    if (action === "answers" && req.method === "GET") return sendJson(res, 200, readAnswers(dir));
    if (action === "answers" && req.method === "PATCH") {
      const { data } = await readPayload(req);
      if (!data || typeof data.controls !== "object" || data.controls === null || Array.isArray(data.controls)) throw new HttpError(400, "Expected { controls: { name: value } }.");
      return sendJson(res, 200, await patchAnswers(dir, data.controls));
    }
    if (action === "submit" && req.method === "POST") {
      const { data } = await readPayload(req);
      const answers = await submitAnswers(dir, { resubmit: data?.resubmit === true });
      // The doorbell field tells the page how the loop learns about this submit.
      return sendJson(res, 200, { ...answers, doorbell: ringDoorbell(root, slug, { reason: "submit", review: id }) });
    }
    if (action === "problem" && req.method === "POST") {
      const { form, data } = await readPayload(req);
      const entry = await appendProblem(dir, {
        text: String(data?.text ?? "").slice(0, 4000),
        url: String(data?.url ?? req.headers.referer ?? ""),
        userAgent: String(req.headers["user-agent"] ?? ""),
      });
      // A problem report rings like a submit: the manager has the page fixed (D21).
      ringDoorbell(root, slug, { reason: "problem", review: id });
      if (form) return send(res, 200, renderProblemThanks(projectName, `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/`), "text/html; charset=utf-8");
      return sendJson(res, 200, { ok: true, at: entry.at });
    }
    throw new HttpError(405, "Method not allowed.");
  }

  async function handleInbox(req, res, slug) {
    if (!epicExists(root, slug)) throw new HttpError(404, "There is no such epic in this project.");
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
    const { form, data } = await readPayload(req);
    const text = String(data?.text ?? "").trim();
    if (!text) throw new HttpError(400, "Write what the loop should know.");
    const entry = await appendInbox(epicDir(root, slug), text.slice(0, INBOX_TEXT_LIMIT));
    ringDoorbell(root, slug, { inbox: entry.id, reason: "inbox" });
    if (form) return send(res, 200, renderInboxThanks(projectName, `/${encodeURIComponent(slug)}`, entry), "text/html; charset=utf-8");
    return sendJson(res, 201, entry);
  }

  function handleReview(req, res, slug, id, rest) {
    if (!reviewExists(root, slug, id)) throw new HttpError(404, "There is no such review.");
    const dir = reviewDir(root, slug, id);
    if (rest === undefined) {
      // Canonical review URL ends with "/", so relative asset paths in page.html resolve inside the review.
      res.writeHead(301, { location: `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/` });
      return res.end();
    }
    if (rest === "" || rest === "page.html") {
      const html = fs.readFileSync(path.join(dir, "page.html"), "utf8");
      const runtimeScript = isFile(path.join(REVIEW_RUNTIME_DIR, "runtime.js"));
      return send(res, 200, injectReview(html, { slug, id, runtimeScript }), "text/html; charset=utf-8");
    }
    const file = resolveInside(dir, rest);
    if (!file || !isFile(file)) throw new HttpError(404, "There is no such file in this review.");
    return sendFile(res, file);
  }

  async function route(req, res) {
    const host = String(req.headers.host ?? "");
    if (!hosts.includes(host)) throw new HttpError(403, "Unexpected Host header.");
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      if (origin !== undefined && !origins.includes(origin)) throw new HttpError(403, "Cross-origin request refused.");
    }

    const url = new URL(req.url ?? "/", `http://${host}`);
    const raw = url.pathname;
    if (raw === "/_health") return sendJson(res, 200, { ok: true, root, pid: process.pid, watchers: watcherCount() });
    if (raw.startsWith("/_runtime/vendor/")) {
      // Only names in the vendor allow-list are served, so no path from the URL reaches the disk.
      const file = reviewVendorFile(raw.slice("/_runtime/vendor/".length));
      if (!file) throw new HttpError(404, "Unknown vendor file.");
      return sendFile(res, file);
    }
    if (raw.startsWith("/_runtime/")) {
      const file = resolveInside(REVIEW_RUNTIME_DIR, raw.slice("/_runtime/".length));
      if (!file || !isFile(file)) throw new HttpError(404, "Unknown runtime file.");
      return sendFile(res, file);
    }

    const events = raw.match(/^\/api\/([^/]+)\/events$/u);
    if (events) {
      const slug = decode(events[1]);
      if (!epicExists(root, slug)) throw new HttpError(404, "There is no such epic in this project.");
      if (req.headers.origin !== undefined && !origins.includes(req.headers.origin)) throw new HttpError(403, "Cross-origin request refused.");
      return streamEpicEvents(req, res, epicDir(root, slug));
    }
    const ids = raw.match(/^\/api\/([^/]+)\/ids$/u);
    if (ids) return sendIds(req, res, root, decode(ids[1]));
    const inbox = raw.match(/^\/api\/([^/]+)\/inbox$/u);
    if (inbox) return handleInbox(req, res, decode(inbox[1]));
    const api = raw.match(/^\/api\/([^/]+)\/reviews\/([^/]+)\/(answers|submit|problem)$/u);
    if (api) return handleApi(req, res, decode(api[1]), decode(api[2]), api[3]);
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed.");

    if (raw === "/") return send(res, 200, renderEpicList(projectName, listEpicsWithReviews(root)), "text/html; charset=utf-8");
    const review = raw.match(/^\/([^/]+)\/reviews\/([^/]+)(?:\/(.*))?$/u);
    if (review) return handleReview(req, res, decode(review[1]), decode(review[2]), review[3]);
    const docs = raw.match(/^\/([^/]+)\/docs(?:\/(.*))?$/u);
    if (docs) {
      const page = epicPage(req, res, url, root, decode(docs[1]));
      if (!page) return undefined;
      const out = docsResponse(projectName, page.dir, page.slug, decode(docs[2] ?? ""), {
        fragment: url.searchParams.get("fragment"),
        lang: page.lang,
        langSwitch: page.switch,
        translator,
      });
      if (!out) throw new HttpError(404, "There is no such doc in this epic.");
      return out.file ? sendFile(res, out.file) : send(res, 200, out.html, "text/html; charset=utf-8", { "content-language": page.lang ?? "en" });
    }
    const home = raw.match(/^\/([^/]+)\/?$/u);
    if (home) {
      const page = epicPage(req, res, url, root, decode(home[1]));
      if (!page) return undefined;
      const html = homeHtml({ fragment: url.searchParams.get("fragment"), lang: page.lang, langSwitch: page.switch, projectName, root, slug: page.slug, translator });
      return send(res, 200, html, "text/html; charset=utf-8", { "content-language": page.lang ?? "en" });
    }
    throw new HttpError(404, "There is no page at this address.");
  }

  const server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "Internal error.";
      if (status === 500) console.error(error);
      if (res.headersSent) return res.end();
      const wantsJson = String(req.url ?? "").startsWith("/api/") || String(req.headers.accept ?? "").includes("application/json");
      if (wantsJson) return sendJson(res, status, { error: message });
      return send(res, status, status === 404 ? renderNotFound(projectName, message) : `${message}\n`, status === 404 ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
    });
  });

  server.on("listening", () => {
    const { port } = server.address();
    hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    origins = hosts.map((value) => `http://${value}`);
    onListening?.(port);
  });
  return server;
}
