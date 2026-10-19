// Answer state for one review page: local values, debounced saves of only the changed controls,
// retry with backoff, and remote refresh that never overwrites a pending local edit.
// No DOM here; the browser runtime and the unit tests both use it.

export function createAnswerStore({
  save,
  delay = 400,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => new Date(),
  retryDelays = [1000, 2000, 4000, 8000, 15000, 30000],
}) {
  const values = new Map();
  const dirty = new Map(); // name -> value not yet saved
  const listeners = new Set();
  let timer = null;
  let inflight = null;
  let failures = 0;
  let status = { state: "idle", at: null, error: null };

  const emit = (event) => {
    for (const listener of listeners) listener(event);
  };
  const setStatus = (next) => {
    status = next;
    emit({ type: "status", status });
  };

  function schedule(ms) {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      flush().catch(() => {});
    }, ms);
  }

  async function flush() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (inflight) await inflight.catch(() => {});
    if (dirty.size === 0) return status;
    const batch = Object.fromEntries(dirty);
    setStatus({ state: "saving", at: status.at, error: null });
    inflight = (async () => {
      try {
        await save(batch);
        for (const [name, value] of Object.entries(batch)) {
          if (Object.is(dirty.get(name), value)) dirty.delete(name);
        }
        failures = 0;
        setStatus({ state: "saved", at: now(), error: null });
        if (dirty.size > 0) schedule(delay);
      } catch (error) {
        failures += 1;
        setStatus({ state: "error", at: status.at, error: String(error?.message ?? error) });
        schedule(retryDelays[Math.min(failures - 1, retryDelays.length - 1)]);
        throw error;
      } finally {
        inflight = null;
      }
    })();
    await inflight;
    return status;
  }

  return {
    get: (name) => values.get(name),
    entries: () => Object.fromEntries(values),
    set(name, value, { local = true } = {}) {
      if (Object.is(values.get(name), value)) return;
      values.set(name, value);
      emit({ type: "change", name, value, local });
      if (local) {
        dirty.set(name, value);
        schedule(delay);
      }
    },
    // Values loaded from the server; controls with an unsaved local edit keep the local value.
    applyRemote(controls = {}) {
      for (const [name, value] of Object.entries(controls)) {
        if (dirty.has(name)) continue;
        if (!Object.is(values.get(name), value)) {
          values.set(name, value);
          emit({ type: "change", name, value, local: false });
        }
      }
    },
    hasPending: () => dirty.size > 0 || inflight !== null,
    flush,
    status: () => status,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
