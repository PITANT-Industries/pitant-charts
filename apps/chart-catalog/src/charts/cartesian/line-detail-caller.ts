import type { CartesianData } from "./data";
import type { LineVariant } from "./line-detail-data";
import { finiteLineValue, lineCalendar, lineFormatQuantity, lineMagnitude } from "./line-input";

export type LineCallerTarget = { axis: number; value: number; label: string; row: number };
type LineCallerEvent = { axis: number; label: string };

/** Resolve explicit future/event rows without adding duplicate null future slots. */
export function lineCallerTimeline(data: CartesianData, variant: LineVariant) {
  const calendar = lineCalendar(data);
  const axis = calendar.times ?? data.categories.map((_, index) => index);
  const dated = calendar.times !== undefined;
  const projection = variant === "line-projection" || variant === "line-projection-manual";
  const dateRegions = variant === "line-weekends" || variant === "line-deadline" || variant === "line-deadline-fills";
  const field = variant === "line-projection-manual" ? "forecast" : "goal";
  const targets: LineCallerTarget[] = [];
  const highlights: LineCallerEvent[] = [];
  const extraCategories = new Map<string, number>();
  const firstCategory = new Map<string, number>();
  data.categories.forEach((category, index) => { if (!firstCategory.has(category)) firstCategory.set(category, index); });
  let deadline: LineCallerEvent | undefined;
  let sawDeadline = false;
  const positions = [...axis];
  const ticks = axis.map((position, index) => ({ axis: position, label: data.categories[index] }));
  const tickAxes = new Set(axis);
  for (const [index, row] of (data.rows ?? []).entries()) {
    const candidate = row[field];
    const value = projection && finiteLineValue(candidate) ? candidate : undefined;
    const due = dateRegions && row.deadline === true && !sawDeadline;
    if (dateRegions && row.deadline === true) sawDeadline = true;
    const highlight = dateRegions && row.highlight === true;
    if (value === undefined && !due && !highlight) continue;
    const rawLabel = row.category ?? row.date ?? row.label ?? row.name;
    const label = rawLabel === undefined ? data.categories[index] : String(rawLabel);
    const aligned = label === data.categories[index] ? index : firstCategory.get(label ?? "") ?? -1;
    const rowTime = label === undefined ? undefined : lineCalendar({ categories: [label], series: [], rows: [row] }).times?.[0];
    let position: number | undefined;
    if (dated) position = rowTime ?? (aligned >= 0 ? axis[aligned] : rawLabel === undefined ? axis[index] : undefined);
    else if (aligned >= 0) position = aligned;
    else if (rawLabel === undefined && index < axis.length) position = index;
    else if (label !== undefined) {
      if (!extraCategories.has(label)) extraCategories.set(label, data.categories.length + extraCategories.size);
      position = extraCategories.get(label);
    }
    if (!finiteLineValue(position)) continue;
    const text = label ?? String(index + 1);
    positions.push(position);
    if (!tickAxes.has(position)) { tickAxes.add(position); ticks.push({ axis: position, label: text }); }
    if (value !== undefined) targets.push({ axis: position, value, label: text, row: index });
    if (due) deadline = { axis: position, label: text };
    if (highlight) highlights.push({ axis: position, label: text });
  }
  return {
    calendar, axis, dated, targets: targets.sort((a, b) => a.axis - b.axis), deadline, highlights,
    ticks: ticks.sort((a, b) => a.axis - b.axis),
    start: positions.reduce((minimum, value) => Math.min(minimum, value), positions[0] ?? 0),
    end: positions.reduce((maximum, value) => Math.max(maximum, value), positions[0] ?? 0),
  };
}

/** Least-squares values remain in normalized units, including extrapolation. */
export function lineUnitRegression(values: readonly (number | null)[], axis: readonly number[]) {
  const points = values.flatMap((value, index) => finiteLineValue(value) && finiteLineValue(axis[index])
    ? [{ value, x: axis[index] }] : []);
  if (points.length < 2) return null;
  const first = points[0].x;
  const last = points[points.length - 1].x;
  const span = last - first || 1;
  const count = points.length;
  const center = points.reduce((sum, point) => sum + (point.x - first) / span / count, 0);
  const average = points.reduce((sum, point) => sum + point.value / count, 0);
  let variance = 0;
  let covariance = 0;
  for (const point of points) {
    const distance = (point.x - first) / span - center;
    variance += distance * distance / count;
    covariance += distance * (point.value - average) / count;
  }
  const slope = variance ? covariance / variance : 0;
  const at = (position: number) => average + ((position - first) / span - center) * slope;
  return { at, ends: [{ x: first, value: at(first) }, { x: last, value: at(last) }] };
}

export function lineCallerTotal(values: readonly (number | null)[]) {
  const magnitude = lineMagnitude([values]);
  const sum = values.reduce<number>((total, value) => total + (finiteLineValue(value) ? value / magnitude : 0), 0);
  return lineFormatQuantity(sum, magnitude);
}
