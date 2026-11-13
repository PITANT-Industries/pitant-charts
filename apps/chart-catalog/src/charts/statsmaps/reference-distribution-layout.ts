import { distributionStatistics } from "./simplify-statistics";
import {
  deployDots, deployProfiles, groupedBoxes, groupedMedians, groupedProfiles, groupedRanges, loadingBoxes, loadingDots, loadingProfiles,
  loadingViolinQuartiles, regionalDots, regionalProfiles, regions, responseDots, responseSeries, teams, type BoxSummary,
} from "./reference-distribution-fixtures";

type Sample = readonly [group: number, value: number];
type Point = readonly [x: number, y: number];
type Summary = {
  low: number; q1: number; median: number; q3: number; high: number;
  min: number; max: number; count: number; outliers: readonly number[];
};

function summarize(samples: readonly Sample[], group: number): Summary {
  const values = samples.filter(sample => sample[0] === group).map(sample => sample[1]);
  const { q1, median, q3, whiskerLow, whiskerHigh, outliers } = distributionStatistics(values, 1);
  return { low: whiskerLow, high: whiskerHigh, min: values[0], max: values[values.length - 1], q1, median, q3, count: values.length, outliers };
}

function boxSummary([low, q1, median, q3, high, outliers]: BoxSummary, count: number): Summary {
  return { low, q1, median, q3, high, min: Math.min(low, ...outliers), max: Math.max(high, ...outliers), count, outliers };
}

const regionSummaries = regions.map((_, i) => summarize(regionalDots, i));
const teamSummaries = teams.map((_, i) => summarize(deployDots, i));
const groupedSummaries = groupedBoxes.map((sample, i) => ({
  ...boxSummary(sample, 60),
  median: groupedMedians[Math.floor(i / 2)][i % 2],
}));
const placeholderBoxes = loadingBoxes.map(sample => boxSummary(sample, 0));

export function distributionLayout(variant: string, width: number, height: number, compact: boolean, loading: boolean) {
  const swarm = variant.startsWith("beeswarm");
  const violin = variant.startsWith("violin");
  const box = !swarm && !violin;
  const shared = variant === "beeswarm-series";
  const horizontal = variant.endsWith("-horizontal") || swarm && !variant.endsWith("-vertical");
  const grouped = variant.endsWith("-grouped");
  const left = Math.min(compact ? 17 : shared ? 16 : horizontal ? 67 : 70, width * .36);
  const right = width - Math.min(16, width * .12);
  const top = Math.min(compact ? 10 : 16, height * .2);
  const bottom = Math.max(top + 1, height - Math.min(compact ? 24 : 36, height * .47));
  const capacity = shared ? 1000 : horizontal ? 40 : grouped ? 6000 : 5000;
  const tickStep = shared ? 200 : horizontal ? 10 : 1000;
  const names = shared ? [] : horizontal ? teams : regions;
  const laneCount = shared ? 1 : names.length;
  const start = horizontal ? top : left;
  const end = horizontal ? bottom : right;
  const band = (end - start) / (laneCount + (box ? .1 : 0));
  const category = (i: number) => start + (i + (box ? .55 : .5)) * band;
  const point = (along: number, cross: number): Point => horizontal ? [along, cross] : [cross, along];
  const value = (v: number) => horizontal ? left + v / capacity * (right - left) : bottom - v / capacity * (bottom - top);
  const positions = Array.from({ length: laneCount }, (_, i) => category(i));
  const grid = Array.from({ length: 1 + capacity / tickStep }, (_, i) => i * tickStep);
  const summaries = loading && box ? placeholderBoxes : grouped ? groupedSummaries : horizontal ? teamSummaries : regionSummaries;
  const profiles = loading ? loadingProfiles : grouped ? groupedProfiles : horizontal ? deployProfiles : regionalProfiles;
  const dots = loading ? loadingDots : shared ? responseDots : horizontal ? deployDots : regionalDots;
  return { swarm, violin, box, shared, horizontal, grouped, left, right, top, bottom, capacity, names, band, category, point, value, positions, grid, summaries, profiles, dots };
}

type Layout = ReturnType<typeof distributionLayout>;

export function swarmPoints(layout: Layout, compact: boolean, loading: boolean) {
  const { shared, horizontal, dots, band, category, point, value } = layout;
  const radius = shared ? 4.5 : horizontal ? 4 : 3;
  const distance = radius * 2 + 1;
  const lanes = Array.from({ length: shared ? 1 : 4 }, () => [] as { index: number; group: number; along: number; cross: number; value: number }[]);
  dots.forEach(([group, sample], index) => {
    const lane = lanes[shared ? 0 : group];
    const along = value(sample);
    const neighbors = lane.filter(other => Math.abs(other.along - along) < distance);
    const available = [0, ...neighbors.flatMap(other => {
      const shift = Math.sqrt(distance ** 2 - (other.along - along) ** 2);
      return [other.cross - shift, other.cross + shift];
    })].sort((a, b) => Math.abs(a) - Math.abs(b));
    const cross = available.find(candidate => neighbors.every(other => Math.hypot(other.along - along, other.cross - candidate) >= distance - 1e-8)) ?? 0;
    lane.push({ index, group, along, cross, value: sample });
  });
  return lanes.flatMap((lane, i) => {
    const maxOffset = Math.max(0, ...lane.map(item => Math.abs(item.cross)));
    const compress = Math.min(1, band * .46 / (maxOffset + radius));
    return lane.map(item => {
      const [x, y] = point(item.along, category(i) + item.cross * compress);
      const name = (shared ? responseSeries : layout.names)[item.group];
      return { ...item, x, y, name, radius: radius * (compact ? .72 : 1),
        color: loading ? "var(--muted-foreground)" : shared && item.group === 0 ? "var(--chart-3)" : horizontal ? "var(--chart-1)" : "var(--chart-2)" };
    });
  }).sort((a, b) => a.index - b.index);
}

function curvePath(points: Point[]) {
  const format = (p: Point) => p.map(value => Number(value.toFixed(2))).join(",");
  return `M${format(points[0])}` + points.slice(1).map((end, i) => {
    const before = points[Math.max(0, i - 1)];
    const start = points[i];
    const after = points[Math.min(i + 2, points.length - 1)];
    const a: Point = [start[0] + (end[0] - before[0]) / 6, start[1] + (end[1] - before[1]) / 6];
    const b: Point = [end[0] - (after[0] - start[0]) / 6, end[1] - (after[1] - start[1]) / 6];
    return `C${format(a)},${format(b)},${format(end)}`;
  }).join("") + "Z";
}

export function quantileMarks(layout: Layout, loading: boolean) {
  const { band, category, grouped, point, profiles, summaries, violin, horizontal, capacity, value } = layout;
  return summaries.map((summary, index) => {
    const group = grouped ? Math.floor(index / 2) : index;
    const second = grouped && index % 2 === 1;
    const center = category(group) + (grouped ? (second ? 1 : -1) * band * (violin ? .22 : .175) : 0);
    const width = violin ? Math.min(10, band * (horizontal ? .067 : .06336) / (grouped ? 2 : 1)) : band * (grouped ? .252 : .434);
    const thickness = violin ? Math.max(3, width) : width;
    const color = loading ? "var(--muted-foreground)" : horizontal ? "var(--chart-2)" : second ? "var(--chart-3)" : "var(--chart-1)";
    const at = (v: number, offset = 0) => point(value(v), center + offset);
    const placeholder = loading && violin ? loadingViolinQuartiles[index] : undefined;
    const [q1, q3] = placeholder ?? [summary.q1, summary.q3];
    const rect = horizontal
      ? { x: value(q1), y: center - thickness / 2, width: value(q3) - value(q1), height: thickness }
      : { x: center - thickness / 2, y: value(q3), width: thickness, height: value(q1) - value(q3) };
    const marker = at(summary.median);
    const profile = profiles[index];
    const path = violin ? curvePath(Array.from({ length: profile.length / 2 }, (_, i) => point(value(profile[i * 2] * capacity), center + profile[i * 2 + 1] * band))) : undefined;
    const [min, max] = grouped && violin ? groupedRanges[index] : [summary.min, summary.max];
    return { ...summary, min, max, group, second, thickness, color, at, rect, marker, path };
  });
}
