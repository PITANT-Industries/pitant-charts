import type { ChartData } from "../../../types";

export const initialLargeCount = 50_000;
export const minutesPerDay = 1440;
const start = Date.UTC(2026, 6, 1);
const minute = 60_000;
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en", {
  weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC",
});

export type DenseLineColumn = Float64Array | readonly (number | null)[];
export type DenseLineRange = readonly [start: number, end: number];
export type DenseLinePoint = [sample: number, value: number | null];

export interface DenseLineData {
  count: number;
  series: readonly { name: string; color?: string; values: DenseLineColumn }[];
  label: (sample: number, detailed?: boolean) => string;
}

export function makeDenseLineData(count: number, data?: ChartData): DenseLineData {
  let series: DenseLineData["series"];
  if (data?.series) {
    series = data.series;
    count = data.categories?.length ?? series.reduce((max, item) => Math.max(max, item.values.length), 0);
  } else {
    count = data?.categories?.length ?? count;
    const p50 = new Float64Array(count);
    const p95 = new Float64Array(count);
    function noise(index: number) {
      const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
      return value - Math.floor(value);
    }
    for (let index = 0; index < count; index++) {
      const daily = Math.sin(index / minutesPerDay * 2 * Math.PI - Math.PI / 2);
      const median = 48 + 9 * daily + 6 * Math.sin(index / 21_000) + 6 * noise(index);
      const spike = noise(index + 7) > .997 ? 90 * noise(index + 13) : 0;
      p50[index] = Math.round(median * 10) / 10;
      p95[index] = Math.round((median * 2.1 + 16 * noise(index + 3) + spike) * 10) / 10;
    }
    series = [{ name: "p50 latency", values: p50 }, { name: "p95 latency", values: p95 }];
  }
  return {
    count,
    series,
    label(sample, detailed = false) {
      const index = Math.min(count - 1, Math.max(0, Math.round(sample)));
      const category = data?.categories?.[index] ?? (data?.series ? String(index + 1) : undefined);
      if (category !== undefined) return detailed ? category : category.split(",")[0];
      return (detailed ? dateTime : date).format(start + index * minute);
    },
  };
}

export function sampleValue(values: DenseLineColumn, index: number): number | null {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
