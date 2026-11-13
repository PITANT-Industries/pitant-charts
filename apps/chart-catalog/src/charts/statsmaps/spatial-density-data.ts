import { contourDensity, type ContourMultiPolygon } from "d3-contour";
import { curveCatmullRomClosed, line } from "d3-shape";

export type Sample = { x: number; y: number; value?: number; group?: string };
export type Bounds = { left: number; right: number; top: number; bottom: number };
type Range = [number, number];
type Axis = { values: number[]; format: (value: number) => string };
type ContourField = ((threshold: number) => ContourMultiPolygon) & { max: number };
export type SpatialDesign = {
  x: Range; y: Range; margins: [number, number, number, number];
  xAxis?: Axis; yAxis?: Axis; vertical?: boolean; xTitle?: string; pointRadius?: number;
  bandwidth?: number; levels?: number; binWidth?: number; thresholds?: number[];
  summary: [string, string];
};

const sequence = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const minutes = (n: number) => `${n}m`;
const hours = (n: number) => `${n}h`;
const dollars = (n: number) => `$${Math.round(n)}`;
const sessions: SpatialDesign = {
  x: [0, 25], y: [0, 18], margins: [57, 29, 25, 45], binWidth: 22, thresholds: [5, 16, 35],
  xAxis: { values: sequence(0, 25, 5), format: minutes }, yAxis: { values: sequence(0, 15, 5), format: String },
  summary: ["Most sessions end within 4 minutes", "900 sessions across the session-length and page-view bins"],
};
const bookings: SpatialDesign = {
  x: [0, 120], y: [0, 700], margins: [48, 20, 16, 54], pointRadius: 2.5, bandwidth: 22, levels: 8,
  xAxis: { values: sequence(0, 120, 20), format: n => `${n}d` }, yAxis: { values: sequence(0, 700, 100), format: dollars },
  xTitle: "Days booked ahead", summary: ["Median fare $364", "Bookings form a last-minute cluster and a cluster a month or two ahead"],
};
export const designs: Record<string, SpatialDesign> = {
  "hexbin-default": sessions,
  "hexbin-loading": sessions,
  "hexbin-average": {
    x: [0, 26], y: [0, 110], margins: [55, 27, 23, 43], binWidth: 18, thresholds: [15, 25, 40], vertical: true,
    xAxis: { values: sequence(0, 25, 5), format: n => `${n} km` }, yAxis: { values: sequence(0, 100, 20), format: n => `${n} min` },
    summary: ["Average fare $31 across 1,200 rides", "Slow rides cost more than fast rides of the same distance"],
  },
  "hexbin-custom-tooltip": {
    x: [0, 24], y: [0, 100], margins: [60, 32, 28, 48], binWidth: 26, thresholds: [4, 14, 30],
    xAxis: { values: sequence(0, 20, 5), format: hours }, yAxis: { values: sequence(0, 100, 20), format: String },
    summary: ["33.7% of tickets answered within 2 hours", "Satisfaction falls as the first reply takes longer"],
  },
  "density-default": bookings,
  "density-loading": bookings,
  "density-groups": {
    x: [.5, 3.5], y: [0, 24], margins: [47, 19, 15, 35], bandwidth: 18, levels: 5, pointRadius: 2, vertical: true,
    xAxis: { values: sequence(.5, 3.5, .5), format: n => `${n} kg` }, yAxis: { values: sequence(0, 20, 5), format: hours },
    summary: ["Ultrabooks last almost three times as long as gaming laptops", "240 laptops in three segments"],
  },
  "density-contours": {
    x: [0, 844], y: [0, 390], margins: [12, 16, 12, 12], bandwidth: 14, levels: 12,
    summary: ["46% of taps land on the pay button", "The top of the checkout screen is on the left"],
  },
};

const modulus = 2_147_483_647;
function randomSequence(seed: number, zeroBased = false) {
  let state = seed;
  return () => {
    state = state * 16807 % modulus;
    return zeroBased ? (state - 1) / (modulus - 1) : state / modulus;
  };
}

function skeletonRandom(seed: number) {
  let state = Math.imul(seed + 271829, 2246822507);
  state = Math.imul(state ^ state >>> 13, 3266489909);
  return randomSequence(((state ^ state >>> 16) >>> 0) % modulus || 1, true);
}

const round = (n: number, places = 1) => Math.round(n * places) / places;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function spatialFixture(id: string): Sample[] {
  const seed = id === "hexbin-average" ? 7 : id === "hexbin-custom-tooltip" ? 2026
    : id.startsWith("hexbin") ? 42 : id === "density-groups" ? 240 : id === "density-contours" ? 1500 : 11;
  const random = randomSequence(seed);
  const normal = (center: number, spread: number) => center + spread * Math.sqrt(-2 * Math.log(random() || .5)) * Math.cos(2 * Math.PI * random());
  if (id === "hexbin-average") return Array.from({ length: 1200 }, () => {
    const x = round(1 + 24 * random() ** 1.8, 10);
    const y = Math.round(4 + x * 2.2 * (.6 + random() * 1.4));
    return { x, y, value: round(3.5 + x * 1.6 + y * .35, 100) };
  });
  if (id === "hexbin-custom-tooltip") return Array.from({ length: 700 }, () => {
    const x = round(24 * random() ** 2.2, 10);
    return { x, y: Math.round(clamp(94 - x * 2.6 + (random() - .5) * 34, 5, 100)) };
  });
  if (id.startsWith("hexbin")) {
    const clusters = [[520, 2.5, 2.4, 1.6, 1.1], [300, 9, 7, 2.6, 1.8], [80, 17, 12, 3, 2.4]];
    return clusters.flatMap(([count, x, y, sx, sy]) => Array.from({ length: count }, () => ({
      x: round(clamp(normal(x, sx), .2, 25), 10), y: clamp(Math.round(normal(y, sy)), 1, 18),
    })));
  }
  if (id === "density-groups") return [
    { group: "Ultrabook", weight: 1.2, battery: 15 },
    { group: "Gaming", weight: 2.5, battery: 5.5 },
    { group: "Workstation", weight: 1.9, battery: 9 },
  ].flatMap(({ group, weight, battery }) => Array.from({ length: 80 }, () => {
    const y = round(Math.max(2, normal(battery, 2.1)), 10);
    return { x: round(Math.max(.8, normal(weight, .28)), 100), y, group };
  }));
  if (id === "density-contours") return [[690, 195, 70, 780, 16], [300, 120, 50, 520, 18], [330, 200, 90, 330, 40], [180, 36, 14, 70, 14]]
    .flatMap(([count, row, rowSpread, col, colSpread]) => Array.from({ length: count }, () => {
      const y = round(clamp(normal(row, rowSpread), 0, 390));
      return { x: round(clamp(normal(col, colSpread), 0, 844)), y };
    }));
  return Array.from({ length: id === "density-loading" ? 360 : 500 }, (_, index) => {
    const lastMinute = index % 3 === 0;
    const x = round(clamp(lastMinute ? normal(9, 6) : normal(58, 24), 0, 120));
    return { x, y: round(Math.max(90, normal(lastMinute ? 520 : 410 - x * 1.6, lastMinute ? 70 : 55))) };
  });
}

export type Bin = { x: number; y: number; count: number; sum: number };
// The staggered nearest-cell calculation is adapted from d3-hexbin. See THIRD_PARTY_NOTICES.md.
export function hexBins(samples: readonly Sample[], x: (n: number) => number, y: (n: number) => number, width: number): Bin[] {
  const rowStep = width * Math.sqrt(3) / 2;
  const bins = new Map<string, Bin>();
  for (const point of samples) {
    const py = y(point.y) / rowStep;
    let row = Math.round(py);
    const px = x(point.x) / width - (row & 1) / 2;
    let col = Math.round(px);
    const dy = py - row;
    if (Math.abs(dy) > 1 / 3) {
      const alternateCol = col + (px < col ? -.5 : .5);
      const alternateRow = row + Math.sign(dy);
      const originalDistance = (px - col) ** 2 + dy ** 2;
      const alternateDistance = (px - alternateCol) ** 2 + (py - alternateRow) ** 2;
      if (originalDistance > alternateDistance) {
        col = alternateCol + (row & 1 ? .5 : -.5);
        row = alternateRow;
      }
    }
    const key = `${row}:${col}`;
    const bin = bins.get(key) ?? { x: (col + (row & 1) / 2) * width, y: row * rowStep, count: 0, sum: 0 };
    bin.count++;
    bin.sum += point.value ?? 1;
    bins.set(key, bin);
  }
  return [...bins.values()];
}

export function hexPath(x: number, y: number, radius: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 3;
    return `${i ? "L" : "M"}${x + Math.sin(angle) * radius},${y - Math.cos(angle) * radius}`;
  }).join("") + "Z";
}

function tickLevels(max: number, count: number) {
  if (max <= 0) return [];
  const desired = max / count;
  const power = 10 ** Math.floor(Math.log10(desired));
  const ratio = desired / power;
  const step = power * (ratio >= Math.sqrt(50) ? 10 : ratio >= Math.sqrt(10) ? 5 : ratio >= Math.sqrt(2) ? 2 : 1);
  return Array.from({ length: Math.floor(max / step + 1e-10) }, (_, i) => (i + 1) * step);
}

export function contourPaths(points: readonly Sample[], names: readonly string[], bounds: Bounds, bandwidth: number, levels: number) {
  const { left, top, right, bottom } = bounds;
  const density = contourDensity<Sample>().x(p => p.x - left).y(p => p.y - top)
    .size([right - left, bottom - top]).bandwidth(bandwidth).cellSize(4) as ReturnType<typeof contourDensity<Sample>>
      & { contours: (samples: readonly Sample[]) => ContourField };
  const fields = [...names].sort().map(group => ({ group, field: density.contours(points.filter(p => (p.group ?? "") === group)) }));
  const thresholds = tickLevels(Math.max(0, ...fields.map(({ field }) => field.max)), levels);
  return fields.flatMap(({ group, field }) => thresholds.flatMap(value => {
    const polygons = field(value).coordinates;
    if (!polygons.length) return [];
    const path = polygons.flatMap(polygon => polygon.map(ring => {
      return ring.slice(0, -1).map(([x, y], index) => `${index ? "L" : "M"}${round(x, 100)},${round(y, 100)}`).join("") + "Z";
    })).join("");
    return [{ group, value, path }];
  }));
}

export function hexSkeleton(bounds: Bounds, width: number) {
  const random = skeletonRandom(3);
  const { left, right, top, bottom } = bounds;
  const rowStep = width * Math.sqrt(3) / 2;
  const spots = [[.2, .72, .16, .2, 1], [.48, .46, .14, .17, .85], [.78, .24, .1, .13, .6]];
  const cells: { x: number; y: number; opacity: number }[] = [];
  for (let row = 0; row * rowStep <= bottom - top; row++) {
    for (let col = 0; (col + (row & 1) / 2) * width <= right - left; col++) {
      const dx = (col + (row & 1) / 2) * width, dy = row * rowStep;
      const strength = spots.reduce((total, [x, y, rx, ry, weight]) => {
        return total + weight * Math.exp(-(((dx / (right - left) - x) / rx) ** 2 + ((dy / (bottom - top) - y) / ry) ** 2) / 2);
      }, 0) + (random() - .5) * .24;
      if (strength > .3) cells.push({ x: left + dx, y: top + dy, opacity: Math.min(1, .3 + strength * .6) });
    }
  }
  return cells;
}

export function densitySkeleton({ left, right, top, bottom }: Bounds) {
  const randomBand = skeletonRandom(5);
  const randomDot = skeletonRandom(9);
  const spots = [[.3, .38, .2, .3], [.7, .66, .19, .24]];
  const width = right - left, height = bottom - top;
  const bands = [1, .74, .5, .28].flatMap(scale => spots.map(([x, y, rx, ry]) => {
    const phase = randomBand() * Math.PI * 2, wobble = randomBand() * Math.PI * 2;
    const vertices = Array.from({ length: 9 }, (_, index): [number, number] => {
      const angle = index / 9 * Math.PI * 2;
      const radius = 1 + .14 * (.7 * Math.sin(2 * angle + phase) + .3 * Math.sin(3 * angle + wobble));
      return [round(left + width * (x + rx * scale * radius * Math.cos(angle)), 100),
        round(top + height * (y + ry * scale * radius * Math.sin(angle)), 100)];
    });
    return line().curve(curveCatmullRomClosed)(vertices) ?? "";
  }));
  const dots = Array.from({ length: 72 }, (_, index) => {
    const [x, y, rx, ry] = spots[index % spots.length];
    const radius = Math.sqrt(-2 * Math.log(randomDot() || .5)) * .45;
    const angle = randomDot() * Math.PI * 2;
    return { x: left + width * clamp(x + Math.cos(angle) * radius * rx, 0, 1),
      y: top + height * clamp(y + Math.sin(angle) * radius * ry, 0, 1) };
  });
  return { bands, dots };
}
