import type { ChartData } from "../../../types";

import { day, demoBounds } from "./bounds";

const weekStart = demoBounds[0];
const weekDuration = 7 * day;
export const pointLimit = 6000;

export type Bounds = readonly [left: number, right: number, low: number, high: number];
type Group = { name: string; color?: string };
export type ExactPoint = { x: number; y: number; group: number; label?: string };
type Input = { count: number; data?: ChartData };
export type ScatterRequest =
  | { kind: "prepare"; input: Input }
  | { kind: "view"; id: number; view?: Bounds; columns: number; rows: number };

type FrameInfo = { view: Bounds; full: Bounds; count: number; visible: number; groups: Group[]; reference: boolean };
export type ScatterFrame = FrameInfo & (
  | { mode: "density"; columns: number; rows: number; counts: Uint32Array; peak: number }
  | { mode: "points"; points: ExactPoint[] }
);
export type ScatterResponse = { id: number; frame: ScatterFrame };

const indexColumns = 128;
const indexRows = 64;
const indexCells = indexColumns * indexRows;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function noise(index: number, channel: number) {
  const value = Math.sin(index * 12.9898 + channel * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function gridCoordinate(value: number, min: number, max: number, size: number) {
  return Math.max(0, Math.min(size - 1, Math.floor((value - min) / (max - min) * size)));
}

export function prepareScatter({ count, data }: Input) {
  const capacity = data?.rows?.length ?? data?.series?.reduce((sum, item) => sum + item.values.length, 0) ?? count;
  const x = new Float64Array(capacity), y = new Float64Array(capacity), group = new Uint32Array(capacity);
  const labels = new Map<number, string>();
  const groups: Group[] = [];
  const groupIndex = new Map<string, number>();
  const colors = new Map(data?.series?.map(item => [item.name, item.color]));
  const reference = !data && (count === 10_000 || count === 50_000);
  let size = 0;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  function add(a: number, b: number, name: string, label?: string) {
    let index = groupIndex.get(name);
    if (index === undefined) {
      index = groups.length;
      groups.push({ name, color: colors.get(name) });
      groupIndex.set(name, index);
    }
    x[size] = a;
    y[size] = b;
    group[size] = index;
    if (label) labels.set(size, label);
    size++;
    xMin = Math.min(xMin, a); xMax = Math.max(xMax, a);
    yMin = Math.min(yMin, b); yMax = Math.max(yMax, b);
  }
  if (data?.rows) {
    for (const row of data.rows) {
      if (!row || !finite(row.x) || !finite(row.y)) continue;
      add(row.x, row.y, typeof row.group === "string" && row.group.trim() ? row.group : "Series", typeof row.label === "string" ? row.label : undefined);
    }
  } else if (data?.series) {
    for (const item of data.series) {
      for (let i = 0; i < item.values.length; i++) {
        const value = item.values[i];
        if (finite(value)) add(i + 1, value, item.name, data.categories?.[i]);
      }
    }
  } else if (reference) {
    // Match the reference checkout demo's evenly spaced timestamps and two request channels.
    for (let i = 0; i < count; i++) {
      const elapsed = Math.floor(i / count * weekDuration);
      const dailyCycle = Math.sin(elapsed / day * 2 * Math.PI - Math.PI / 2);
      const tail = -Math.log(1 - noise(i, 1) * .995);
      const duration = Math.round(140 + 45 * dailyCycle + 90 * tail + 30 * noise(i, 2));
      const mobile = i % 3 === 0;
      add(weekStart + elapsed, mobile ? Math.round(duration * 1.35) : duration, mobile ? "Mobile" : "Web");
    }
  } else {
    let seed = 511;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = 0; i < count; i++) {
      const offset = random() * 7;
      const z = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
      const value = Math.min(998, Math.round(Math.max(18, (125 + Math.sin(offset * 1.5) * 18) * Math.exp(z * .64))));
      add(weekStart + offset * day, value, "Requests");
    }
  }

  function extent(min: number, max: number): [number, number] {
    const pad = min === max ? Math.max(1, Math.abs(min) * .025) : (max - min) * .025;
    return [min - pad, max + pad];
  }
  const custom = Boolean(data?.rows || data?.series);
  const full: Bounds = reference ? [xMin, xMax, demoBounds[2], demoBounds[3]]
    : custom && size ? [...extent(xMin, xMax), ...extent(yMin, yMax)] : demoBounds;
  if (reference) {
    const points = Array.from({ length: size }, (_, i) => ({ x: x[i], y: y[i], group: group[i] }));
    return ({ view = full }: { view?: Bounds; columns: number; rows: number }): ScatterFrame => {
      const visible = view === full ? points : points.filter(point =>
        point.x >= view[0] && point.x <= view[1] && point.y >= view[2] && point.y <= view[3]);
      return { view, full, count: size, groups, reference, visible: visible.length, mode: "points", points: visible };
    };
  }
  function cellFor(i: number) {
    return gridCoordinate(x[i], full[0], full[1], indexColumns) +
      indexColumns * gridCoordinate(y[i], full[2], full[3], indexRows);
  }

  // Packed grid index. A zoomed query visits only cells intersecting the viewport.
  const cells = new Uint16Array(size);
  const offsets = new Uint32Array(indexCells + 1);
  const indices = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    const cell = cellFor(i);
    cells[i] = cell;
    offsets[cell + 1]++;
  }
  for (let i = 1; i < offsets.length; i++) offsets[i] += offsets[i - 1];
  const next = offsets.slice();
  for (let i = 0; i < size; i++) indices[next[cells[i]]++] = i;

  return ({ view = full, columns, rows }: { view?: Bounds; columns: number; rows: number }): ScatterFrame => {
    const info = { view, full, count: size, groups, reference };
    const [left, right, low, high] = view;
    const firstCol = gridCoordinate(left, full[0], full[1], indexColumns);
    const lastCol = gridCoordinate(right, full[0], full[1], indexColumns);
    const firstRow = gridCoordinate(low, full[2], full[3], indexRows);
    const lastRow = gridCoordinate(high, full[2], full[3], indexRows);
    const overview = view.every((edge, i) => edge === full[i]);
    const counts = new Uint32Array(columns * rows);
    const exact: number[] = [];
    let visible = 0, peak = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const cell = row * indexColumns + col;
        for (let at = offsets[cell]; at < offsets[cell + 1]; at++) {
          const i = indices[at], a = x[i], b = y[i];
          if (a < left || a > right || b < low || b > high) continue;
          visible++;
          if (!overview && visible <= pointLimit) exact.push(i);
          const bin = gridCoordinate(a, left, right, columns) + columns * gridCoordinate(b, low, high, rows);
          peak = Math.max(peak, ++counts[bin]);
        }
      }
    }
    if (overview || visible > pointLimit) return { ...info, visible, mode: "density", columns, rows, counts, peak };
    exact.sort((a, b) => x[a] - x[b] || y[a] - y[b] || a - b);
    return { ...info, visible, mode: "points", points: exact.map(i => ({ x: x[i], y: y[i], group: group[i], label: labels.get(i) })) };
  };
}
