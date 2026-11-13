import type { CartesianData } from "./data";
import { lineDate } from "./line-format";

type LineDesign = {
  domain: [number, number];
  step: number;
  ticks?: number;
  narrowTicks?: number;
  axis?: "percent" | "number" | "dual";
  stroke?: number;
  curve?: "linear" | "catmull";
  colors?: number[];
};

const signupBand: LineDesign = { domain: [0, 280], step: 50, ticks: 4 };
const issueDesign: LineDesign = { domain: [0, 60], step: 10, ticks: 4, colors: [3, 1, 0], curve: "catmull" };
const profitDesign: LineDesign = { domain: [-1500, 3000], step: 1000, curve: "linear" };

export const detailedLines = {
  "line-grid": { domain: [0, 5000], step: 1000, axis: "number" },
  "line-dual-axis": { domain: [0, 26000], step: 5000, axis: "dual", narrowTicks: 4 },
  "line-points": { domain: [0, 350], step: 50 },
  "line-dashed": { domain: [0, 800], step: 200 },
  "line-legend": { domain: [0, 4500], step: 1000 },
  "line-time-range": { domain: [0, 4000], step: 1000 },
  "line-markers": { domain: [0, 11000], step: 2000 },
  "line-segment": { domain: [0, 4000], step: 1000 },
  "line-projection": { domain: [0, 3080], step: 500 },
  "line-projection-manual": { domain: [0, 176000], step: 50000 },
  "line-profit-loss": profitDesign,
  "line-profit-loss-legend": { ...profitDesign, domain: [-5000, 9000], step: 2000, ticks: 6, narrowTicks: 4 },
  "line-band": signupBand,
  "line-band-bollinger": { ...signupBand, ticks: 5, stroke: 2 },
  "line-band-range": { domain: [0, 30], step: 5 },
  "line-band-ranges": { domain: [0, 100], step: 20, ticks: 4, stroke: 2, colors: [0, 2] },
  "line-band-fill": signupBand,
  "line-band-fade": signupBand,
  "line-band-edges": signupBand,
  "line-weekends": issueDesign,
  "line-deadline": issueDesign,
  "line-deadline-fills": { ...issueDesign, domain: [0, 45], ticks: 2, colors: [0] },
  "line-fixed-scale": { domain: [0, 120], step: 20, axis: "percent", narrowTicks: 4 },
  "line-crosshair-point": { domain: [0, 4500], step: 1000 },
  "line-glow": { domain: [0, 110], step: 0 },
  "line-bollinger": { domain: [175, 220], step: 10, ticks: 4 },
  "line-trend": { domain: [0, 900], step: 200, stroke: 2, colors: [1] },
  "line-straight": { domain: [0, 2600], step: 500, curve: "linear", narrowTicks: 3 },
  "line-loading": { domain: [0, 9600], step: 2000 },
  "line-loading-placeholder": { domain: [0, 16], step: 5 },
} satisfies Record<string, LineDesign>;

export type LineVariant = keyof typeof detailedLines;
export const designForLine = (variant: LineVariant): LineDesign => detailedLines[variant];

export type LineBounds = { name: string; low: (number | null)[]; high: (number | null)[]; color: number };

function boundsForRows(data: CartesianData, name: string, color: number, field?: string): LineBounds {
  const range = (index: number, side: "low" | "high") => {
    const row = data.rows?.[index];
    const source = field ? row?.[field] : row;
    if (!source || typeof source !== "object" || !(side in source)) return null;
    const value = (source as Record<string, unknown>)[side];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  return { name, color, low: data.categories.map((_, i) => range(i, "low")), high: data.categories.map((_, i) => range(i, "high")) };
}

function movingAverage(values: readonly (number | null)[]) {
  const low: (number | null)[] = [];
  const high: (number | null)[] = [];
  const average = values.map((_, index) => {
    const subset = values.slice(index - 9, index + 1);
    const samples = subset.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (index < 9 || samples.length < 10) {
      low.push(null);
      high.push(null);
      return null;
    }
    const mean = samples.reduce((sum, value) => sum + value, 0) / 10;
    const offset = 2 * Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 10);
    low.push(mean - offset);
    high.push(mean + offset);
    return mean;
  });
  return { average, low, high };
}

export function lineOverlays(variant: LineVariant, data: CartesianData) {
  const values = data.series[0]?.values ?? [];
  if (variant === "line-bollinger" || variant === "line-band-bollinger") {
    const { average, low, high } = movingAverage(values);
    const band = { name: "Bollinger", low, high, color: 0 };
    return { bands: [band], average };
  }
  if (variant === "line-band-range") return { bands: [boundsForRows(data, "Temperature", 0)] };
  if (variant === "line-band-ranges") {
    return { bands: data.series.map(({ name }, index) => boundsForRows(data, `${name} range`, index === 1 ? 2 : index, name)) };
  }
  if (variant.startsWith("line-band")) return { bands: [boundsForRows(data, "Forecast", variant === "line-band-fade" ? 2 : 0)] };
  return { bands: [] };
}

export function toLocalTime(category: string) {
  const date = lineDate(category);
  return date ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).valueOf() : undefined;
}

export function lineDynamicDomain(series: CartesianData["series"], bands: LineBounds[], step: number) {
  let minimum = 0;
  let maximum = 0;
  for (const values of [...series.map(item => item.values), ...bands.flatMap(item => [item.low, item.high])]) {
    for (const value of values) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  const rawStep = (maximum - minimum) / 5 || step || 1;
  const unit = 10 ** Math.floor(Math.log10(rawStep));
  const factor = [1, 2, 5, 10].find(value => value >= rawStep / unit) ?? 10;
  const tick = unit * factor;
  return { domain: [Math.floor(minimum / tick) * tick, Math.max(tick, Math.ceil(maximum / tick) * tick)], tick } as const;
}
