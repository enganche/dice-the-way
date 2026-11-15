// Analytics stub (GDD 12). Events are kept in memory and logged; swap `sink`
// for a real SDK call when a platform build needs one.

const buffer = [];
let sink = (name, params) => { if (import.meta.env?.DEV) console.debug('[analytics]', name, params); };

export function track(name, params = {}) {
  buffer.push({ name, params, t: Date.now() });
  if (buffer.length > 500) buffer.shift();
  sink(name, params);
}

export function setAnalyticsSink(fn) { sink = fn; }
export function recentEvents() { return buffer.slice(); }
