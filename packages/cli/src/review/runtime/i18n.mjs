// Translation segments for review pages. The static check extracts segments into
// i18n/source.json with normalizeSegment; translations live in i18n/<lang>.json as
// { lang, segments: { "<normalized English source>": "<translation>" } }.

export const TRANSLATABLE_ATTRIBUTES = ["title", "placeholder", "aria-label", "note", "alt"];

export function normalizeSegment(text) {
  return String(text ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

// Returns the translated text keeping the original's leading and trailing whitespace, or null.
export function translateText(text, segments) {
  const key = normalizeSegment(text);
  if (!key || !segments || !Object.hasOwn(segments, key)) return null;
  const lead = /^\s*/u.exec(text)[0];
  const trail = /\s*$/u.exec(text)[0];
  return `${lead}${segments[key]}${trail}`;
}

export function isTranslatableSegment(text) {
  const key = normalizeSegment(text);
  return key !== "" && /\p{L}/u.test(key);
}
