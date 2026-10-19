// Pure helpers for shots and compare frames (no DOM), shared by the runtime and unit tests.

export const COMPARE_MODES = ["side", "overlay", "flip"];

// The shots that page together in one lightbox: the same `group`, or every ungrouped shot.
export function groupMembers(items, item, groupOf) {
  const group = groupOf(item) || "";
  return items.filter((candidate) => (groupOf(candidate) || "") === group);
}

// Next or previous index with wraparound.
export function stepIndex(index, delta, length) {
  if (length <= 0) return -1;
  return (((index + delta) % length) + length) % length;
}

export function parseMode(value) {
  const mode = String(value ?? "")
    .trim()
    .toLowerCase();
  return COMPARE_MODES.includes(mode) ? mode : "side";
}

// "375, 768,1280" -> [375, 768, 1280]; invalid entries are dropped.
export function parseWidths(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((width) => Number.isInteger(width) && width >= 120 && width <= 4096);
}
