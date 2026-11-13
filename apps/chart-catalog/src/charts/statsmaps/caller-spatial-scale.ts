type Range = readonly [number, number];

/** Keep finite caller coordinates usable even when a raw span would overflow. */
export function callerDomain(values: readonly number[], pad = .07): [number, number] {
  let low = Infinity, high = -Infinity;
  for (const value of values) { low = Math.min(low, value); high = Math.max(high, value); }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
  const unit = Math.max(Math.abs(low), Math.abs(high)) || 1;
  const padding = Math.max(Number.MIN_VALUE, (low === high ? pad : (high / unit - low / unit) * pad) * unit);
  const lower = low - padding, upper = high + padding;
  return [Number.isFinite(lower) ? lower : low, Number.isFinite(upper) ? upper : high];
}

export function callerPosition(value: number, [low, high]: Range, from: number, to: number) {
  const unit = Math.max(Math.abs(low), Math.abs(high)) || 1;
  return from + (value / unit - low / unit) / (high / unit - low / unit) * (to - from);
}

export function callerTicks([low, high]: Range, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const fraction = index / (count - 1);
    return low * (1 - fraction) + high * fraction;
  });
}
