// Adapted from Bklit UI's profit-loss-segments.ts (MIT, LICENSE-BKLIT.md).
// Split each contiguous run of finite points, retaining the fractional zero crossing.
export interface SignedSegment {
  points: [number, number][];
  positive: boolean;
}

export function splitProfitLossSegments(values: readonly (number | null)[]) {
  const result: SignedSegment[] = [];
  let points: [number, number][] = [];
  let positive = true;
  const flush = () => {
    if (points.length > 1) result.push({ points, positive });
    points = [];
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null || !Number.isFinite(value)) {
      flush();
      continue;
    }
    const previous = points.at(-1);
    if (!previous) {
      positive = value >= 0;
      points = [[index, value]];
      continue;
    }
    if (value !== 0 && (value > 0) !== positive) {
      const [start, prior] = previous;
      const fraction = prior / (prior - value);
      const crossing: [number, number] = [start + fraction * (index - start), 0];
      points.push(crossing);
      flush();
      positive = value > 0;
      points = [crossing];
    }
    points.push([index, value]);
  }
  flush();
  return result;
}

// Adapted from Simplify Charts' waterfall-chart.tsx (MIT, LICENSE-SIMPLIFY.md).
// Calculate on the full dataset so subtotals retain their baselines in any view.
export function accumulateWaterfall(values: readonly (number | null)[], isTotal: (index: number) => boolean) {
  let runningTotal = 0;
  return values.flatMap((value, index) => {
    if (value === null || !Number.isFinite(value)) return [];
    const total = isTotal(index);
    const start = total ? 0 : runningTotal;
    const end = total ? value : runningTotal + value;
    runningTotal = end;
    return [[index, start, end, value, total ? 1 : 0]];
  });
}

// Adapted from EvilCharts' echarts-chart.tsx withAlpha (MIT, LICENSE-EVILCHARTS.md).
// Alpha multiplies the source opacity, including colors with an existing alpha channel.
export function withAlpha(color: string, alpha: number) {
  const hex = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hex) return `rgba(${parseInt(hex[1], 16)},${parseInt(hex[2], 16)},${parseInt(hex[3], 16)},${alpha})`;
  const match = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*(?:\.\d+)?))?/i);
  if (!match) return color;
  const [, r, g, b, existing] = match;
  const multiplier = existing === undefined || existing === "" ? 1 : Number(existing);
  return `rgba(${r},${g},${b},${(multiplier * alpha).toFixed(3)})`;
}
