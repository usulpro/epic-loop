// "N of M answered": counts required controls only. A choice, select or comment is answered when
// it has a non-empty value; a checkbox (a confirmation) is answered when it is checked.

export function isAnswered(kind, value) {
  if (kind === "check") return value === true;
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function computeProgress(controls, getValue) {
  const required = controls.filter((control) => !control.optional);
  const answered = required.filter((control) => isAnswered(control.kind, getValue(control.name))).length;
  return { answered, total: required.length, complete: answered === required.length };
}
