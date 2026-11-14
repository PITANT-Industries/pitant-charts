import type { ChartData, ChartSeries } from "../../types";
import type { CartesianData } from "./data";

export const detailedAreas = {
  "area-forecast": { maximum: 90_000, step: 20_000, ticks: [0, 3, 6, 9, 11] },
  "area-reference-band": { maximum: 350, step: 50, ticks: [0, 10, 20, 30] },
  "area-reference-range": { maximum: 4000, step: 1000, ticks: [0, 10, 20, 30] },
  "area-trend": { maximum: 450, step: 100, ticks: [0, 3, 6, 9] },
} as const;
export type AreaOverlayVariant = keyof typeof detailedAreas;
export type OverlayModel = {
  categories: readonly string[];
  series: readonly ChartSeries[];
  dates?: readonly (string | undefined)[];
  times?: readonly number[];
  minimum: number;
  maximum: number;
  step: number;
  forecastSplit: number;
  band: readonly [number, number];
  range?: readonly [number, number];
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function callerDate(value: unknown) {
  if (validDate(value)) return { date: value, time: Date.parse(`${value}T00:00:00Z`) };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !validDate(value.slice(0, 10))) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? { date: new Date(time).toISOString().slice(0, 10), time } : undefined;
}

export function areaCalendarTime(date: string) {
  const utc = new Date(date);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()).valueOf();
}

function numericExtent(values: readonly number[]) {
  let minimum = 0, maximum = 0;
  for (const value of values) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
  if (minimum === maximum) return { minimum: 0, maximum: 1, step: .25 };
  const unit = Math.max(Math.abs(minimum), Math.abs(maximum));
  const rawStep = Math.max(Number.MIN_VALUE, (maximum / unit - minimum / unit) / 4 * unit);
  const magnitude = Math.max(Number.MIN_VALUE, 10 ** Math.floor(Math.log10(rawStep)));
  const ratio = rawStep / magnitude;
  const step = Math.min(Number.MAX_VALUE, (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * magnitude);
  const low = Math.floor(minimum / step) * step, high = Math.ceil(maximum / step) * step;
  return { minimum: Number.isFinite(low) ? low : minimum, maximum: Number.isFinite(high) ? high : maximum, step };
}

export function overlayPosition(value: number, minimum: number, maximum: number, from: number, to: number) {
  const unit = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  return from + (value / unit - minimum / unit) / (maximum / unit - minimum / unit) * (to - from);
}

export function overlayTicks(model: OverlayModel) {
  const first = Math.ceil(model.minimum / model.step);
  const count = Math.min(100, Math.max(0, Math.floor(model.maximum / model.step) - first + 1));
  return Array.from({ length: count }, (_, index) => (first + index) * model.step);
}

export function areaOverlayModel(variant: AreaOverlayVariant, fixture: CartesianData, input?: ChartData): OverlayModel {
  if (!input) {
    const dates = fixture.rows!.map(row => String(row.date));
    return { categories: fixture.categories, series: fixture.series, dates, times: dates.map(areaCalendarTime),
      minimum: 0, maximum: detailedAreas[variant].maximum, step: detailedAreas[variant].step,
      forecastSplit: 8, band: [180, 240], range: [11, 17] };
  }
  const rows = (input.rows ?? []).map(row => row && typeof row === "object" ? row : {});
  const rawSeries = input.series ?? (rows.some(row => finite(row.value)) ? [{ name: "Value", values: rows.map(row => finite(row.value) ? row.value : null) }] : []);
  const count = input.categories?.length ?? Math.max(rows.length, 0, ...rawSeries.map(series => series.values.length));
  const categories = input.categories ? [...input.categories] : Array.from({ length: count }, (_, index) => String(rows[index]?.category ?? rows[index]?.label ?? rows[index]?.date ?? index + 1));
  const series = rawSeries.map(item => ({ ...item, values: categories.map((_, index) => finite(item.values[index]) ? item.values[index] : null) }));
  const parsedDates = categories.map((category, index) => callerDate(rows[index]?.date) ?? callerDate(category));
  const dates = parsedDates.map(value => value?.date);
  const times = parsedDates.every(value => value !== undefined) ? parsedDates.map(value => value.time) : undefined;
  const dated = times?.every((time, index) => index === 0 || time > times[index - 1]);
  const bandRow = rows.find(row => finite(row.referenceLow) && finite(row.referenceHigh));
  const band: [number, number] = bandRow ? [Math.min(Number(bandRow.referenceLow), Number(bandRow.referenceHigh)), Math.max(Number(bandRow.referenceLow), Number(bandRow.referenceHigh))] : [180, 240];
  const extent = numericExtent([...series.flatMap(item => item.values.filter(finite)), ...(variant === "area-reference-band" ? [...band, ...(bandRow ? [] : [350])] : [])]);
  const forecastIndex = rows.findIndex(row => row.forecast === true);
  const marked = rows.flatMap((row, index) => row.highlight === true && index < count ? [index] : []);
  const start = marked[0] ?? dates.indexOf("2026-10-12");
  const end = marked.at(-1) ?? dates.indexOf("2026-10-18");
  return { categories, series, dates, ...extent, ...(dated ? { times } : {}),
    forecastSplit: forecastIndex >= 0 ? Math.min(count - 1, Math.max(0, forecastIndex - 1)) : Math.max(0, count - 4),
    band, range: start >= 0 && end > start ? [start, end] : undefined };
}
