import { contributionFixture } from "./heatmap-fixture";
import { number, type DemoProps } from "./primitives";

export const dayMs = 86_400_000;
const formatMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

export function calendarValues(data: DemoProps["data"], variant: string) {
  if (!data) return contributionFixture(variant);
  if (!data.rows && !data.series) return contributionFixture(variant);
  const byDate = new Map<number, number>();
  function add(timestamp: number, value: unknown) {
    const reading = number(value);
    if (!Number.isFinite(timestamp) || reading === undefined) return;
    const day = Math.floor(timestamp / dayMs) * dayMs;
    byDate.set(day, (byDate.get(day) ?? 0) + Math.max(0, reading));
  }
  if (data.rows) {
    for (const row of data.rows) if (typeof row?.date === "string") add(Date.parse(row.date), row.value);
  } else {
    data.series?.[0]?.values.forEach((value, index) => {
      const label = data.categories?.[index];
      add(label ? Date.parse(label) : Date.UTC(2025, 0, 1) + index * dayMs, value);
    });
  }
  return [...byDate].sort(([a], [b]) => a - b).map(([date, value]) => ({ date: new Date(date), value }));
}

type Coordinate = { column: number; row: number };
function quarterOf(date: Date) {
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
}

export function firstAtOrAfter<T>(items: readonly T[], target: number, coordinate: (item: T) => number) {
  let low = 0, high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (coordinate(items[middle]) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function heatmapLayout(values: ReturnType<typeof calendarValues>, measuredWidth: number, variant: string, demo: boolean, scrolling: boolean) {
  const weekdays = variant === "heatmap-weekdays";
  const quarter = variant === "heatmap-quarters";
  const dots = variant === "heatmap-dots";
  const solid = variant === "heatmap-separators-solid";
  const dashed = variant === "heatmap-separators-dashed";
  const activeScale = variant === "heatmap-active-scale";
  const split = dots || solid || dashed;
  const dividerGap = split ? 20 : quarter ? 8 : 0;
  const first = values[0]?.date ?? new Date(Date.UTC(2025, 0, 1));
  const last = values.at(-1)?.date ?? first;
  const beginning = +first - (weekdays && !demo ? (first.getUTCDay() + 6) % 7 : first.getUTCDay()) * dayMs;
  const weeks = Math.floor((+last - beginning) / (7 * dayMs)) + 1;
  const coordinate = (date: Date): Coordinate => {
    const days = Math.round((+date - beginning) / dayMs);
    return { column: Math.floor(days / 7), row: (days + (weekdays && demo ? 6 : 0)) % 7 };
  };
  const monthStarts = values.filter(({ date }, index) => index === 0 || date.getUTCMonth() !== values[index - 1].date.getUTCMonth())
    .filter(({ date }) => !quarter || !demo || date.getUTCFullYear() === 2026);
  const quarterStarts = dividerGap === 0 ? [] : monthStarts.filter(({ date }, index) => index === 0 || quarterOf(date) !== quarterOf(monthStarts[index - 1].date));
  const boundaries = [...new Set(quarterStarts.slice(1).map(({ date }) => coordinate(date).column))].filter(column => column > 0);
  const paddingStart = scrolling ? 1.5 : dashed ? 12 : split || activeScale ? 44 : 40;
  const padding = scrolling ? 13.5 : dashed ? 24 : 56;
  const gap = scrolling || split ? 3 : activeScale ? 4 : 2;
  const width = scrolling ? Math.max(measuredWidth, 12 + weeks * 20) : measuredWidth;
  const available = width - padding;
  const gapAtQuarter = boundaries.length ? Math.min(dividerGap, available / (boundaries.length * 2)) : 0;
  const step = Math.max(0.01, (available - gapAtQuarter * boundaries.length) / weeks);
  const rowStep = scrolling && width === 12 + weeks * 20 ? 20 : step;
  const cellWidth = Math.max(step / 2, step - gap);
  const cellHeight = Math.max(rowStep / 2, rowStep - gap);
  const top = scrolling || split ? 31 : activeScale ? 32 : 30;
  const height = top + rowStep * 6 + cellHeight + (scrolling || split ? 1.5 : activeScale ? 2 : 1);
  const xAt = (column: number) => paddingStart + column * step + firstAtOrAfter(boundaries, column + 1, value => value) * gapAtQuarter;
  const yAt = (row: number) => top + row * rowStep;
  const max = values.reduce((peak, entry) => Math.max(peak, entry.value), 1);
  function cellAt(index: number) {
    const entry = values[index];
    if (!entry) return undefined;
    const { row, column } = coordinate(entry.date);
    const strength = demo ? Math.min(4, entry.value) : Math.ceil(entry.value / max * 4);
    return { ...entry, row, column, strength, x: xAt(column), y: yAt(row) };
  }
  function visibleCells(left: number, viewportWidth: number) {
    const xOf = (entry: (typeof values)[number]) => xAt(coordinate(entry.date).column);
    const start = firstAtOrAfter(values, left - cellWidth, xOf);
    const end = firstAtOrAfter(values, left + viewportWidth, xOf);
    return Array.from({ length: end - start }, (_, offset) => ({ ...cellAt(start + offset)!, index: start + offset }));
  }
  function indexAt(x: number, y: number) {
    const row = Math.floor((y - top) / rowStep);
    if (row < 0 || row > 6 || y > yAt(row) + cellHeight) return -1;
    const xOf = (entry: (typeof values)[number]) => xAt(coordinate(entry.date).column);
    const start = firstAtOrAfter(values, x - cellWidth, xOf);
    for (let index = start; index < Math.min(start + 7, values.length); index++) {
      const cell = cellAt(index)!;
      if (cell.x > x) break;
      if (cell.row === row && x <= cell.x + cellWidth) return index;
    }
    return -1;
  }
  function indexAtDay(column: number, row: number) {
    const day = beginning + (column * 7 + (row + (weekdays && demo ? 1 : 0)) % 7) * dayMs;
    const index = firstAtOrAfter(values, day, entry => +entry.date);
    return +values[index]?.date === day ? index : -1;
  }
  const months = monthStarts.map(({ date }) => ({ name: formatMonth.format(date), x: xAt(coordinate(date).column), key: +date }));
  const quarters = quarterStarts.map(({ date }, index) => {
    const x = xAt(coordinate(date).column);
    return { name: `Q${quarterOf(date) % 4 + 1}`, x: x - (split ? 1.5 : 1), rule: index === 0 ? undefined : x - gapAtQuarter / 2 - (split ? 1.5 : 1), key: +date };
  });
  const labelMode = cellHeight < 9;
  const days = weekdays ? (labelMode ? ["", "T", "", "T", "", "S", ""] : ["M", "T", "W", "T", "F", "S", "S"])
    : dots && !labelMode ? ["S", "M", "T", "W", "T", "F", "S"]
    : dots || solid || activeScale ? ["", "M", "", "W", "", "F", ""]
    : ["", "Mon", "", "Wed", "", "Fri", ""];
  const weekdayX = split ? 35.5 : activeScale ? 35 : 32;
  const labels = dashed || scrolling ? [] : days.flatMap((label, row) => label ? [{
    label, row, x: weekdayX, y: yAt(row) + cellHeight / 2 - 1.2, opacity: weekdays && row >= 5 ? .35 : 1,
  }] : []);
  return { cellAt, visibleCells, indexAt, indexAtDay, months, quarters, labels, width, height, cellWidth, cellHeight, top, paddingStart, rowStep };
}
