import type { CartesianData } from "./data";
import type { BrushRange } from "./Brush";
import { lineCalendar } from "./line-input";

/** Caller-only range coordinates. Demo calendars stay in their existing renderers. */
export function lineRangeModel(data: CartesianData) {
  const calendar = lineCalendar(data, false);
  const count = data.categories.length;
  const last = Math.max(0, count - 1);
  const origin = calendar.times?.[0] ?? 0;
  const coordinates = calendar.times?.map(time => time - origin) ?? data.categories.map((_, index) => index);
  const extent = coordinates[last] ?? 0;
  const full: readonly [number, number] = count > 1 ? [0, extent] : [-.5, .5];
  const at = (index: number) => coordinates[index] ?? 0;
  function nearest(position: number) {
    let left = 0, right = last;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (at(mid) < position) left = mid + 1;
      else right = mid;
    }
    return left > 0 && Math.abs(at(left - 1) - position) <= Math.abs(at(left) - position) ? left - 1 : left;
  }
  const caption = (index: number) => calendar.dates[index] ?? data.categories[index] ?? "";
  const isEmpty = !count || !data.series.length;
  return { count, last, calendar, coordinates, full, at, nearest, caption, isEmpty };
}

export type LineRangeModel = ReturnType<typeof lineRangeModel>;

export function clampLineBrush(range: BrushRange, last: number): BrushRange {
  if (last < 1) return [0, 0];
  const start = Math.max(0, Math.min(Math.floor(range[0]), last - 1));
  return [start, Math.max(start + 1, Math.min(Math.floor(range[1]), last))];
}

export function lineRangeTicks(start: number, end: number, count: number) {
  return [...new Set(Array.from({ length: Math.max(1, count) }, (_, index) =>
    Math.round(start + index / Math.max(1, count - 1) * (end - start))))];
}

export function lineRangeLabel(model: LineRangeModel, categories: readonly string[], index: number) {
  const date = model.calendar.dates[index];
  return date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(date))
    : categories[index] ?? "";
}

export function clampCallerZoom(domain: readonly [number, number], full: readonly [number, number], minimum: number): readonly [number, number] {
  const span = Math.max(minimum, Math.min(full[1] - full[0], domain[1] - domain[0]));
  const start = Math.max(full[0], Math.min(full[1] - span, domain[0]));
  return [start, start + span];
}
