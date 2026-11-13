export function selectLineSamples(count: number, width: number, valueAt: (index: number) => number) {
  const limit = Math.max(64, Math.ceil(width * 1.5));
  if (count <= limit) return Array.from({ length: count }, (_, index) => index);

  const stride = (count - 2) / (limit - 2);
  const selected = [0];
  let previous = 0;
  for (let bucket = 0; bucket < limit - 2; bucket++) {
    const start = Math.floor((bucket + 1) * stride) + 1;
    const end = Math.min(count - 1, Math.floor((bucket + 2) * stride) + 1);
    const nextEnd = Math.min(count, Math.floor((bucket + 3) * stride) + 1);
    const center = (start + nextEnd - 1) / 2;
    let sum = 0;
    for (let i = start; i < nextEnd; i++) sum += valueAt(i);
    const mean = nextEnd > start ? sum / (nextEnd - start) : valueAt(count - 1);
    let maxArea = -1;
    let chosen = start;
    const base = valueAt(previous);
    for (let i = start; i < end; i++) {
      const area = Math.abs((previous - center) * (valueAt(i) - base) - (previous - i) * (mean - base));
      if (area > maxArea) {
        maxArea = area;
        chosen = i;
      }
    }
    selected.push(chosen);
    previous = chosen;
  }
  selected.push(count - 1);
  return selected;
}
