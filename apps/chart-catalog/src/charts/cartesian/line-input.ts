import type { ChartData, ChartExample } from "../../types";
import type { CartesianData } from "./data";
import { resolveData } from "./data";
import { formatBarQuantity, formatBarTotal, formatBarValue } from "./bar-geometry";
import { lineDate } from "./line-format";
import { finiteLineValue, lineCallerInput } from "./line-caller-input";

export { finiteLineValue, lineCallerInput } from "./line-caller-input";
export const lineFormatValue = formatBarValue;
export const lineFormatQuantity = formatBarQuantity;
export const lineFormatTotal = formatBarTotal;
type Numbers = readonly (number | null | undefined)[];

/** Supplied Line input never inherits fixture observations, labels or metadata. */
export function resolveLineInput(example: ChartExample, input?: ChartData): CartesianData {
  return input === undefined ? resolveData(example) : lineCallerInput(input);
}

function isoTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return undefined;
  const day = value.slice(0, 10);
  const midnight = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return undefined;
  const timestamp = value.length === 10 ? midnight
    : Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export type LineCalendar = { dates: (string | undefined)[]; times?: number[] };

/** ISO category dates are authoritative; aligned row dates can date custom labels. */
export function lineCalendar(data: CartesianData, demo = false): LineCalendar {
  const parsed = data.categories.map((category, index) => {
    if (demo) {
      const date = lineDate(category);
      return date ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).valueOf() : undefined;
    }
    const own = isoTime(category);
    if (own !== undefined) return own;
    const row = data.rows?.[index];
    const aligned = row?.category === undefined || String(row.category) === category;
    return aligned ? isoTime(row?.date) : undefined;
  });
  const chronological = parsed.length > 0 && parsed.every((time, index) => time !== undefined && (index === 0 || time > parsed[index - 1]!));
  return { dates: parsed.map((time, index) => demo ? lineDate(data.categories[index])?.toISOString().slice(0, 10)
    : time === undefined ? undefined : new Date(time).toISOString().slice(0, 10)),
    ...(chronological ? { times: parsed as number[] } : {}) };
}

export interface LineScaleOptions {
  /** Raw quantities for lineValueScale; normalized quantities for lineUnitScale. */
  domain?: readonly [number, number];
  step?: number;
  includeZero?: boolean;
  tickCount?: number;
}

export interface LineValueScale {
  magnitude: number;
  minimum: number;
  maximum: number;
  domain: readonly [number, number];
  step: number;
  ticks: number[];
  unit: (value: number) => number;
  position: (value: number, from: number, to: number) => number;
  positionUnit: (value: number, from: number, to: number) => number;
  format: (unit: number) => string;
}

export function lineMagnitude(groups: readonly Numbers[]) {
  let magnitude = 0;
  for (const values of groups) for (const value of values) if (finiteLineValue(value)) magnitude = Math.max(magnitude, Math.abs(value));
  return magnitude || 1;
}

/** Derived means, bands and regressions can stay in units even beyond a double's raw range. */
export function lineUnitScale(groups: readonly Numbers[], magnitude: number, options: LineScaleOptions = {}): LineValueScale {
  magnitude = finiteLineValue(magnitude) && magnitude > 0 ? magnitude : 1;
  let minimum = options.includeZero === false ? Infinity : 0;
  let maximum = options.includeZero === false ? -Infinity : 0;
  for (const values of groups) for (const value of values) if (finiteLineValue(value)) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const fixed = options.domain && options.domain.every(finiteLineValue) && options.domain[1] > options.domain[0];
  if (fixed) [minimum, maximum] = options.domain!;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) { minimum = 0; maximum = 1; }
  if (minimum === maximum) {
    minimum = Math.min(0, minimum);
    maximum = maximum > 0 ? maximum : 1;
  }
  const ruler = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  const low = minimum / ruler, high = maximum / ruler;
  const count = Math.max(1, Math.min(20, Math.floor(options.tickCount ?? 5)));
  const rawStep = (high - low) / count || 1;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const factor = [1, 2, 5, 10].find(value => value >= rawStep / power) ?? 10;
  const normalizedStep = finiteLineValue(options.step) && options.step > 0 ? options.step / ruler : power * factor;
  const step = Math.max(Number.MIN_VALUE, Math.min(Number.MAX_VALUE, normalizedStep * ruler));
  const stepUnit = step / ruler || normalizedStep;
  if (!fixed) {
    const start = Math.floor(low / stepUnit) * stepUnit * ruler;
    const end = Math.ceil(high / stepUnit) * stepUnit * ruler;
    if (Number.isFinite(start)) minimum = start;
    if (Number.isFinite(end)) maximum = end;
  }
  const first = Math.ceil((minimum / ruler) / stepUnit);
  const last = Math.floor((maximum / ruler) / stepUnit + 1e-10);
  const ticks = Array.from({ length: Math.max(0, Math.min(64, last - first + 1)) }, (_, index) => {
    const value = (first + index) * stepUnit * ruler;
    return value === 0 ? 0 : value;
  }).filter(Number.isFinite);
  const coordinateUnit = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  const start = minimum / coordinateUnit, span = maximum / coordinateUnit - start;
  const positionUnit = (value: number, from: number, to: number) => {
    if (!Number.isFinite(value)) return NaN;
    const portion = (value / coordinateUnit - start) / (span || 1);
    // Very distant fixed-domain observations remain offscreen without overflowing SVG coordinates.
    const bounded = Math.max(-1e6, Math.min(1e6, portion));
    return from + bounded * (to - from);
  };
  return { magnitude, minimum, maximum, domain: [minimum, maximum], step, ticks,
    unit: value => value / magnitude,
    position: (value, from, to) => positionUnit(value / magnitude, from, to), positionUnit,
    format: value => lineFormatQuantity(value, magnitude) };
}

export function lineValueScale(groups: readonly Numbers[], options: LineScaleOptions = {}) {
  const magnitude = lineMagnitude(options.domain ? [...groups, options.domain] : groups);
  const units = groups.map(values => values.map(value => finiteLineValue(value) ? value / magnitude : null));
  return lineUnitScale(units, magnitude, { ...options,
    domain: options.domain ? [options.domain[0] / magnitude, options.domain[1] / magnitude] : undefined,
    step: options.step === undefined ? undefined : options.step / magnitude });
}
