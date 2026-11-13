import type { ChartData } from "../../types";
import { schedules, type ScheduleRow, type ScheduleVariant } from "./gantt-detail-data";

const dayMilliseconds = 86_400_000;

export type CallerScheduleRow = ScheduleRow & {
  kind?: "phase";
  phase?: string;
  color?: string;
  unavailable?: boolean;
};

export type CallerSchedule = {
  origin: number;
  minimum: number;
  maximum: number;
  minimumWidth: number;
  labelWidth: number;
  rowHeight: number;
  rowTop: number;
  radius: number;
  ticks: number[];
  footer: [string, string];
  rows: CallerScheduleRow[];
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));

function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : undefined;
}

export function isSchedulePhase(row: CallerScheduleRow) {
  return row.kind === "phase" || row.taskCount !== undefined;
}

function scheduleTicks(origin: number, minimum: number, maximum: number, roadmap: boolean) {
  const span = maximum - minimum;
  if (roadmap && span > 35) {
    const first = new Date(origin + minimum * dayMilliseconds);
    let date = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
    const ticks: number[] = [];
    while ((date - origin) / dayMilliseconds <= maximum && ticks.length < 100) {
      ticks.push((date - origin) / dayMilliseconds);
      const current = new Date(date);
      date = Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1);
    }
    return ticks;
  }
  const step = span < 7 ? Math.max(.25, Math.ceil(span / 4)) : span > 100 ? Math.ceil(span / 70) * 7 : 7;
  const first = Math.ceil(minimum / step);
  const count = Math.max(0, Math.min(100, Math.floor(maximum / step) - first + 1));
  return Array.from({ length: count }, (_, index) => (first + index) * step);
}

/** Caller progress remains fractional. Native percentages require progressPercent. */
export function adaptGanttCaller(variant: ScheduleVariant, data: ChartData): CallerSchedule {
  const layout = schedules[variant];
  const rawRows = data.rows ?? [];
  const seriesCount = Math.max(0, ...(data.series ?? []).map(series => series.values.length));
  const categories = data.categories ? [...data.categories] : rawRows.length
    ? rawRows.map((row, index) => String(row?.name ?? row?.category ?? `Task ${index + 1}`))
    : Array.from({ length: seriesCount }, (_, index) => String(index + 1));
  const records = categories.map((_, index) => rawRows[index] ?? {});
  const dates = records.flatMap(row => [isoDate(row.start), isoDate(row.end)].filter(finite));
  // Legacy numeric roadmap offsets used July 1, while the measured demo uses July 2.
  const legacyOrigin = variant === "gantt-roadmap" ? Date.UTC(2026, 6, 1) : layout.origin;
  const origin = dates.length ? dates.reduce((first, date) => Math.min(first, date)) : legacyOrigin;
  const offset = (value: unknown) => finite(value) ? value : isoDate(value) === undefined ? undefined : (isoDate(value)! - origin) / dayMilliseconds;
  const rows: CallerScheduleRow[] = records.map((row, index) => {
    const start = offset(row.start) ?? index * 4;
    const end = Math.max(start, offset(row.end) ?? start + 5);
    const milestone = row.milestone === true;
    const taskCount = finite(row.taskCount) && row.taskCount >= 0 ? Math.floor(row.taskCount) : undefined;
    const phase = row.kind === "phase" || taskCount !== undefined;
    const progress = finite(row.progressPercent) ? clamp(row.progressPercent, 100) : finite(row.progress) ? Number((clamp(row.progress, 1) * 100).toPrecision(12)) : 0;
    return {
      name: categories[index], start: milestone ? end : start, end, progress, dependencies: [],
      ...(phase ? { kind: "phase" as const, taskCount } : {}),
      team: String(row.team ?? row.owner ?? "Unassigned"), owner: String(row.owner ?? "Unassigned"),
      ...(typeof row.phase === "string" ? { phase: row.phase } : {}),
      ...(typeof row.color === "string" ? { color: row.color } : {}),
      unavailable: typeof row.start === "string" && isoDate(row.start) === undefined || typeof row.end === "string" && isoDate(row.end) === undefined,
    };
  });
  rows.forEach((row, index) => {
    if (!isSchedulePhase(row)) return;
    const next = rows.findIndex((candidate, position) => position > index && isSchedulePhase(candidate));
    const children = rows.slice(index + 1, next < 0 ? rows.length : next).filter(child => !child.unavailable);
    row.taskCount ??= children.length;
    if (children.length) {
      if (records[index].start === undefined) row.start = children.reduce((start, child) => Math.min(start, child.start), children[0].start);
      if (records[index].end === undefined) row.end = children.reduce((end, child) => Math.max(end, child.end), children[0].end);
    }
    row.end = Math.max(row.start, row.end);
  });
  const ids = new Map<string, number>();
  records.forEach((row, index) => { if (typeof row.id === "string" && !ids.has(row.id)) ids.set(row.id, index); });
  records.forEach((record, index) => {
    const references = [...(Array.isArray(record.dependencies) ? record.dependencies : []), ...(record.dependsOn === undefined ? [] : [record.dependsOn])];
    rows[index].dependencies = [...new Set(references.map(reference => typeof reference === "string" ? ids.get(reference) : reference)
      .filter((target): target is number => finite(target) && Number.isInteger(target) && target >= 0 && target < rows.length && target !== index && !rows[target].unavailable))];
  });
  const available = rows.filter(row => !row.unavailable);
  const first = available.length ? available.reduce((start, row) => Math.min(start, row.start), available[0].start) : 0;
  const last = available.length ? available.reduce((end, row) => Math.max(end, row.end), available[0].end) : 1;
  const span = Math.max(1, last - first);
  const margin = variant === "gantt-milestones" ? 1 : first === last ? .5 : span * .02;
  const minimum = first - margin;
  const maximum = Math.max(minimum + 1, last + margin);
  return {
    origin, minimum, maximum, minimumWidth: layout.minimumWidth, labelWidth: layout.labelWidth,
    rowHeight: layout.rowHeight, rowTop: layout.rowTop, radius: layout.radius,
    ticks: available.length ? scheduleTicks(origin, minimum, maximum, variant === "gantt-roadmap") : [],
    footer: [`${rows.length} schedule rows`, `${rows.filter(isSchedulePhase).length} phases · ${rows.filter(row => !isSchedulePhase(row) && row.start === row.end && !row.unavailable).length} milestones`],
    rows,
  };
}
