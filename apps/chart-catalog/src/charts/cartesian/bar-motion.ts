import { useLayoutEffect, useState } from "react";

// Live Bar frame fits: 1100 ms per category, with 440 ms / category count delays.
const duration = 1100;
const staggerSpan = 440;

export function barEntranceEase(position: number) {
  if (position <= 0) return 0;
  if (position >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 28; i++) {
    const t = (low + high) / 2;
    const inverse = 1 - t;
    const x = 3 * .85 * inverse * inverse * t + 3 * .15 * inverse * t * t + t * t * t;
    if (x < position) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t * t + t * t * t;
}

export function useBarEntrance(count: number, enabled: boolean, loading: boolean, extraStagger = 0) {
  const [elapsed, setElapsed] = useState(() =>
    !enabled || typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? Infinity : 0);
  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    let request = 0;
    let disposed = false;
    const shapesEnd = duration + Math.max(0, count - 1) * staggerSpan / Math.max(1, count) + extraStagger;
    const total = Math.max(shapesEnd, duration + (count > 1 ? staggerSpan : 0));
    const start = performance.now();
    function finish() {
      cancelAnimationFrame(request);
      request = 0;
      setElapsed(Infinity);
    }
    function frame(now: number) {
      if (disposed) return;
      const next = Math.max(0, now - start);
      setElapsed(next >= total ? Infinity : next);
      if (next < total) request = requestAnimationFrame(frame);
      else request = 0;
    }
    function preference() {
      if (query.matches) finish();
    }
    query.addEventListener("change", preference);
    if (!enabled || loading || query.matches) finish();
    else {
      setElapsed(0);
      request = requestAnimationFrame(frame);
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
      query.removeEventListener("change", preference);
    };
  }, [count, enabled, loading, extraStagger]);
  return {
    state: loading ? "idle" : elapsed < duration + Math.max(0, count - 1) * staggerSpan / Math.max(1, count) + extraStagger ? "running" : "finished",
    ready: !loading && elapsed >= duration + (count > 1 ? staggerSpan : 0),
    progress: Array.from({ length: count }, (_, category) => loading ? 0 :
      barEntranceEase((elapsed - category * staggerSpan / Math.max(1, count)) / duration)),
    progressFor: (category: number, additionalDelay = 0, span = duration) => loading ? 0 :
      barEntranceEase((elapsed - category * staggerSpan / Math.max(1, count) - additionalDelay) / span),
  };
}
