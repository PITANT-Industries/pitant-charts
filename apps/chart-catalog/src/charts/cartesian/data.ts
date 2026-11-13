import { livePreset, liveValue } from "./live-fixtures";
import { comparisonFixture } from "./comparison-fixtures";
import { barFixture } from "./bar-fixtures";
import { composedFixture } from "./composed-fixtures";
import { candleFixture } from "./candle-fixtures";
import { lineFixture } from "./line-fixtures";
import type { ChartData, ChartExample, ChartSeries } from "../../types";
import { sparklineFixture } from "./sparkline-fixtures";

import { makeAreaFixture } from "./area-fixtures";

export interface CartesianData {
  categories: string[];
  series: ChartSeries[];
  rows?: ChartData["rows"];
  candleDates?: Date[];
}

export type Candle = [open: number, close: number, low: number, high: number];

export function candleRows(data: CartesianData): Candle[] {
  return data.categories.map((_, index) => {
    const row = data.rows?.[index];
    if (row && [row.open, row.close, row.low, row.high].every(value => typeof value === "number" && Number.isFinite(value))) {
      return [Number(row.open), Number(row.close), Number(row.low), Number(row.high)];
    }
    const close = data.series[0]?.values[index] ?? 0;
    const open = data.series[0]?.values[index - 1] ?? close;
    return [open, close, Math.min(open, close) - 1, Math.max(open, close) + 1];
  });
}

export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const channels = ["Desktop", "Mobile", "Tablet", "Referral", "Organic", "Direct"];

export function dates(count: number, start = Date.UTC(2026, 0, 5)) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  });
}

export function curve(count: number, seed: number, base: number, amplitude: number, drift = 0) {
  return Array.from({ length: count }, (_, index) => Math.round(
    base + Math.sin(index * 0.54 + seed) * amplitude * 0.51
      + Math.cos(index * 1.43 + seed * 3) * amplitude * 0.34
      + Math.sin(index * 2.63 - seed) * amplitude * 0.15 + drift * index,
  ));
}

function points(count: number, names: string[], base = 58) {
  return names.map((name, index) => ({
    name,
    values: curve(count, index * 2, base - index * 7, 19 - Math.min(index, 4), index === 0 ? 0.67 : 0.38),
  }));
}

export function resolveData(example: ChartExample, data?: ChartData): CartesianData {
  const fixture = makeFixture(example);
  if (!data) return fixture;
  const suppliedCandles = (example.family === "candlestick" || example.id === "composed-price-volume") && data.rows;
  const suppliedSchedule = example.family === "gantt" && data.rows;
  const rowsOnlyMarket = example.id === "composed-price-volume" && suppliedCandles;
  const series = data.series ? [...data.series] : rowsOnlyMarket ? [
    { name: "Close", values: rowsOnlyMarket.map(row => typeof row.close === "number" ? row.close : null) },
    { name: "Volume (M)", values: rowsOnlyMarket.map(row => typeof row.volume === "number" ? row.volume : null) },
  ] : fixture.series;
  const count = Math.max(0, ...series.map(item => item.values.length));
  const categories = data.categories ? [...data.categories]
    : suppliedCandles ? suppliedCandles.map((row, index) => String(row.category ?? row.date ?? index + 1))
    : suppliedSchedule ? suppliedSchedule.map((row, index) => String(row.name ?? row.category ?? `Task ${index + 1}`))
    : data.series && !data.rows ? Array.from({ length: count }, (_, index) => String(index + 1)) : fixture.categories;
  const usesCustomRows = example.family === "line" || example.family === "composed"
    || (["candlestick", "sparkline"].includes(example.family) && Boolean(data.series));
  return { categories, series, rows: data.rows ?? (usesCustomRows ? undefined : fixture.rows) };
}

function makeFixture(example: ChartExample): CartesianData {
  const { family, id } = example;
  if (family === "line") {
    if (["line-brush", "line-linked-brush", "line-date-highlights-brush"].includes(id)) {
      const categories = dates(90, Date.UTC(2026, 6, 1));
      const visitors = curve(90, 3, 2410, 490, 12).map((value, index) => (index + 3) % 7 >= 5 ? Math.round(value * 0.7) : value);
      const series = [{ name: "Visitors", values: visitors }];
      if (id === "line-linked-brush") series.push({ name: "Signups", values: visitors.map((value, index) => Math.round(value * (0.032 + Math.sin(index) * 0.004))) });
      return { categories, series };
    }
    if (id === "line-synced") {
      const count = 45;
      const spike = (position: number) => Math.exp(-0.4 * (position - 31) ** 2);
      return { categories: dates(count, Date.UTC(2026, 8, 1)), series: [
        { name: "Requests per minute", values: curve(count, 1, 1200, 460, 1) },
        { name: "p95 latency", values: curve(count, 0, 175, 34, 0.2).map((value, index) => Math.round(value + spike(index) * 240)) },
        { name: "Error rate", values: curve(count, 2, 22, 11).map((value, index) => value / 100 + spike(index) * 1.5) },
      ] };
    }
    if (id === "line-band-range") return { categories: dates(30, Date.UTC(2026, 5, 1)), series: [{ name: "Temperature (°C)", values: curve(30, 3, 20, 4, 0.11) }] };
    const variant = lineFixture(id);
    if (variant) return variant;
    const count = id === "line-zoom" ? 365 : 30;
    const categories = dates(count, id === "line-zoom" ? Date.UTC(2026, 0, 1) : undefined);
    return { categories, series: points(count, id === "line-segment" ? ["Sessions"] : channels.slice(0, 2)) };
  }
  if (family === "area") return makeAreaFixture(id);
  if (family === "composed") return composedFixture(id);
  if (family === "live-line") {
    const preset = livePreset(id);
    const count = preset.seed.length;
    return { categories: Array.from({ length: count }, (_, index) => String(index + 1)), series: [{ name: preset.name, values: Array.from({ length: count }, (_, index) => liveValue(index, preset)) }] };
  }
  if (family === "sparkline") return sparklineFixture(id);
  if (family === "bar") return barFixture(id);
  if (family === "candlestick") return candleFixture(id);
  if (["diverging", "lollipop", "dumbbell", "bump", "slope", "waterfall", "stream"].includes(family)) return comparisonFixture(id);
  if (family === "gantt") {
    const task = (name: string, start: number, end: number, progress: number, extra: Record<string, unknown> = {}) => ({ name, start, end, progress, ...extra });
    const rows = id === "gantt-roadmap" ? [
      task("SAML single sign-on", 4, 34, 1, { team: "Platform", owner: "Mina Shah" }),
      task("Audit log export", 34, 63, .84, { team: "Platform", owner: "Nora Lee", dependsOn: 0 }),
      task("EU data residency", 74, 143, .38, { team: "Platform", owner: "Lena Weber" }),
      task("Guided onboarding", 28, 76, .75, { team: "Growth", owner: "Sofia Alvarez" }),
      task("Reverse trials", 75, 109, .5, { team: "Growth", owner: "David Park", dependsOn: 3 }),
      task("Usage-based pricing", 108, 160, 0, { team: "Growth", owner: "Kareem Ali", dependsOn: 4 }),
      task("Offline mode", 8, 92, .63, { team: "Mobile", owner: "Emma Moreau" }),
      task("Home screen widgets", 92, 152, .25, { team: "Mobile", owner: "Paul Jensen", dependsOn: 6 }),
      task("App Store feature", 165, 165, 0, { team: "Mobile", milestone: true, dependsOn: 7 }),
    ] : id === "gantt-milestones" ? [
      task("Feature freeze", 0, 7, 1), task("Public beta", 9, 9, 1, { milestone: true, dependsOn: 0 }),
      task("Bug bash", 16, 26, 1, { dependsOn: 1 }), task("Release candidate", 26, 34, 1, { dependsOn: 2 }),
      task("Docs and changelog", 30, 40, 1, { dependsOn: 3 }), task("General availability", 43, 43, 1, { milestone: true, dependsOn: 4 }),
    ] : id === "gantt-loading" ? [
      task("Content audit", 0, 9, 1, { phase: "Discovery" }), task("Sitemap and wireframes", 9, 23, 1, { dependsOn: 0 }),
      task("Design system", 23, 44, 1, { phase: "Build", dependsOn: 1 }), task("Marketing pages", 39, 59, .64, { dependsOn: 2 }),
      task("CMS migration", 44, 68, .55, { dependsOn: 2 }), task("Launch", 73, 73, 0, { milestone: true, dependsOn: 4 }),
    ] : [
      task("User research", 1, 13, 1, { phase: "Discovery" }), task("Scope and pricing", 13, 22, 1, { dependsOn: 0 }),
      task("Checkout flows", 22, 33, 1, { phase: "Design", dependsOn: 1 }), task("Visual design", 32, 41, .9, { dependsOn: 2 }),
      task("Payments API", 22, 50, .75, { phase: "Build", dependsOn: 1 }), task("Web checkout", 43, 61, .58, { dependsOn: 4 }),
      task("QA and load tests", 57, 68, .22, { dependsOn: 5 }), task("Launch", 71, 71, 0, { milestone: true, dependsOn: 6 }),
    ];
    return { categories: rows.map(row => row.name), series: [], rows };
  }
  return { categories: months, series: points(months.length, ["Value"]) };
}
