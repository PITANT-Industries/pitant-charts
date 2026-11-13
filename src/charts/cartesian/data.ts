import { comparisonFixture } from "./comparison-fixtures";
import { barFixture } from "./bar-fixtures";
import { lineFixture } from "./line-fixtures";
import type { ChartData, ChartExample, ChartSeries } from "../../types";
import { sparklineFixture } from "./sparkline-fixtures";

import { makeAreaFixture } from "./area-fixtures";

export interface CartesianData {
  categories: string[];
  series: ChartSeries[];
  rows?: ChartData["rows"];
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

interface LivePreset {
  name: string;
  period: number;
  window: number;
  base: number;
  swing: number;
  digits: number;
  unit: "number" | "usd" | "ms";
}

const livePrice: LivePreset = { name: "Price", period: 600, window: 30_000, base: 141.45, swing: 2.8, digits: 2, unit: "usd" };
const livePresets: Partial<Record<string, LivePreset>> = {
  "live-line-momentum": { name: "Index", period: 600, window: 30_000, base: 4820, swing: 27, digits: 2, unit: "number" },
  "live-line-paused": { name: "Viewers", period: 1000, window: 60_000, base: 1280, swing: 44, digits: 0, unit: "number" },
  "live-line-right-axis": { name: "p95 latency", period: 800, window: 40_000, base: 140, swing: 21, digits: 0, unit: "ms" },
};

export function livePreset(id: string) {
  return livePresets[id] ?? livePrice;
}

export function liveValue(index: number, preset: LivePreset) {
  const scale = 10 ** preset.digits;
  const wave = Math.sin(index * .17) * .65 + Math.cos(index * .72) * .25 + Math.sin(index * 1.32) * .1;
  return Math.round((preset.base + wave * preset.swing) * scale) / scale;
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

export const initialLargeCount = 50_000;

export function minuteLatency(count: number): CartesianData {
  const start = Date.UTC(2026, 6, 1);
  const format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  const p50: number[] = [], p95: number[] = [];
  const categories = Array.from({ length: count }, (_, index) => {
    const daily = Math.sin(index / 1440 * Math.PI * 2);
    const noise = ((Math.imul(index + 523, 0x45d9f3b) >>> 14) % 101) / 100;
    const spike = noise > 0.988 && index % 17 === 0 ? 110 + index % 77 : 0;
    p50.push(Math.round(28 + daily * 8 + noise * 4));
    p95.push(Math.round(97 + daily * 23 + noise * 26 + spike));
    return format.format(start + index * 60_000);
  });
  return { categories, series: [{ name: "p50 latency", values: p50 }, { name: "p95 latency", values: p95 }] };
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
  const series = data.series ? [...data.series] : fixture.series;
  const count = Math.max(0, ...series.map(item => item.values.length));
  const categories = data.categories ? [...data.categories] : data.series && !data.rows
    ? Array.from({ length: count }, (_, index) => String(index + 1))
    : fixture.categories;
  const usesCustomRows = example.family === "line" || (example.family === "sparkline" && Boolean(data.series));
  return { categories, series, rows: data.rows ?? (usesCustomRows ? undefined : fixture.rows) };
}

function makeFixture(example: ChartExample): CartesianData {
  const { family, id } = example;
  if (family === "line") {
    if (id === "line-large-data") return minuteLatency(initialLargeCount);
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
  if (family === "composed") {
    const october = dates(30, Date.UTC(2026, 9, 1));
    const series = (name: string, count: number, seed: number, base: number, swing: number, growth = 0) => ({ name, values: curve(count, seed, base, swing, growth) });
    if (id === "composed-stacked") return { categories: october.slice(11, 25), series: [series("Organic", 14, 4, 400, 125, 4), series("Paid", 14, 9, 205, 72, 2)] };
    if (id === "composed-target" || id === "composed-grouped") {
      const target = id === "composed-target";
      const categories = dates(78, Date.UTC(2026, 7, target ? 3 : 17)).filter((_, index) => index % 7 === 0);
      const n = categories.length;
      if (target) return { categories, series: [series("Revenue", n, 2, 112, 13, 4), { name: "Target", values: categories.map((_, index) => 117 + 4 * index) }] };
      return { categories, series: [series("Signups", n, 2, 1760, 320, 40), series("Activations", n, 7, 1320, 210, 34), { name: "Goal", values: categories.map(() => 1900) }] };
    }
    if (id === "composed-signal") return { categories: october, series: [series("Signups", 30, 2, 129, 36, 1.5)] };
    if (id === "composed-profit-loss") return { categories: october, series: [series("P&L", 30, 2, -2100, 1800, 211), series("Trades", 30, 7, 39, 19, 0.8)] };
    if (id === "composed-price-volume") {
      const close = curve(30, 1, 17_200, 1_740, 133).map(value => value / 100);
      return { categories: october, series: [{ name: "Close", values: close }, series("Volume (M)", 30, 6, 59, 27, .55)], rows: close.map((value, index) => {
        const open = close[index - 1] ?? value - 2.1;
        return { open, close: value, low: Math.min(open, value) - 1.12 - index % 3, high: Math.max(open, value) + 1.23 + index % 4 };
      }) };
    }
    return { categories: october, series: [series("Revenue", 30, 4, 72, 29, 1.26), series("Units", 30, 9, 38, 13, .48)] };
  }
  if (family === "live-line") {
    const preset = livePreset(id);
    const count = Math.round(preset.window / preset.period) + 1;
    return { categories: Array.from({ length: count }, (_, index) => String(index + 1)), series: [{ name: preset.name, values: Array.from({ length: count }, (_, index) => liveValue(index, preset)) }] };
  }
  if (family === "sparkline") return sparklineFixture(id);
  if (family === "bar") return barFixture(id);
  if (family === "candlestick") {
    const weekly = id === "candlestick-colors";
    const count = id === "candlestick-range" ? 92 : id === "candlestick-minimal" ? 20 : weekly ? 16 : id === "candlestick-pattern" ? 24 : 31;
    const start = id === "candlestick-range" ? Date.UTC(2026, 7, 1) : id === "candlestick-minimal" ? Date.UTC(2026, 8, 1) : weekly ? Date.UTC(2026, 6, 6) : Date.UTC(2026, 9, id === "candlestick-pattern" ? 8 : 1);
    const categories = weekly ? dates((count - 1) * 7 + 1, start).filter((_, index) => index % 7 === 0) : dates(count, start);
    const base = weekly ? 408 : id === "candlestick-minimal" ? 60 : id === "candlestick-default" ? 194 : 154;
    const prices = curve(count, 2, base * 100, base * 5, base * 0.26).map(value => value / 100);
    const rows = prices.map((value, index) => {
      const open = index ? prices[index - 1] : value - 1.38;
      return { open, close: value, low: Math.min(open, value) - 1.26 - index % 3 * 0.31, high: Math.max(open, value) + 1.64 + index % 4 * 0.39, volume: 25 + (index * 7) % 31 };
    });
    return { categories, series: [], rows };
  }
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
