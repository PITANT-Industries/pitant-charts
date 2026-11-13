import type { BrushRange } from "./Brush";
import { referenceLineFixture } from "./line-reference-fixtures";

const visits = referenceLineFixture("line-time-range")!;

export const brushDates = visits.categories;
export const brushVisitors = visits.series[0].values as readonly number[];
export const brushSignups = [
  72, 75, 80, 76, 80, 89, 91, 92, 93, 95, 89, 92, 99, 98, 95,
  93, 90, 85, 82, 86, 82, 78, 78, 72, 67, 66, 70, 66, 66, 67,
  65, 61, 63, 71, 71, 74, 74, 79, 75, 78, 88, 92, 94, 95, 100,
  93, 97, 103, 108, 106, 105, 108, 97, 97, 108, 103, 102, 101, 100, 89,
  89, 93, 92, 89, 88, 87, 83, 83, 89, 92, 91, 94, 95, 89, 92,
  103, 107, 111, 111, 113, 105, 108, 118, 117, 121, 120, 121, 108, 110, 117,
] as const;
export const brushLast = brushDates.length - 1;
export const launchDay = brushDates.indexOf("Sep 1");
export const firstSaturday = brushDates.indexOf("Jul 4");
export const visitorTicks = [0, 1000, 2000, 3000, 4000];
export const signupTicks = [0, 50, 100];

export function brushDomain(values: readonly number[], [start, end]: BrushRange, signups: boolean) {
  const observed = Math.max(...values.slice(start, end + 1));
  const unit = signups ? 20 : 500;
  return Math.ceil(observed * 1.1 / unit) * unit;
}

export function moveBrushWindow([start, end]: BrushRange, days: number): BrushRange {
  const shift = Math.max(-start, Math.min(brushLast - end, days));
  return [start + shift, end + shift];
}

export function brushTicks([start, end]: BrushRange, count: number) {
  return Array.from({ length: count }, (_, index) => start + Math.round(index / (count - 1) * (end - start)));
}
