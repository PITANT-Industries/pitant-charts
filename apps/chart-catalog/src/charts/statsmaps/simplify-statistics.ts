// Adapted from Simplify Charts' box-plot-chart and violin-chart shadcn registry items.
// https://ui.simplifyingai.com/r/box-plot-chart.json
// https://ui.simplifyingai.com/r/violin-chart.json
// Copyright (c) 2025-present Simplifying AI Inc. MIT, see LICENSE-SIMPLIFY.md.
import { quantile } from "./primitives";

export function distributionStatistics(sorted: readonly number[], minimumBandwidth: number) {
  const q1 = quantile(sorted, .25);
  const median = quantile(sorted, .5);
  const q3 = quantile(sorted, .75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const observed = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  const whiskerLow = observed[0] ?? sorted[0];
  const whiskerHigh = observed.at(-1) ?? sorted.at(-1)!;
  const outliers = sorted.filter((value) => value < lowerFence || value > upperFence);
  const std = Math.sqrt(sorted.reduce((sum, value) => sum + (value - median) ** 2, 0) / sorted.length);
  const bandwidth = Math.max(minimumBandwidth, .9 * Math.min(std, iqr / 1.34) * sorted.length ** -.2);
  return { q1, median, q3, whiskerLow, whiskerHigh, outliers, bandwidth };
}

export function estimate(samples: readonly number[], coordinates: readonly number[], bandwidth: number) {
  return coordinates.map((x) => {
    const density = samples.reduce((total, value) => {
      const u = (x - value) / bandwidth;
      return total + Math.exp(-.5 * u * u) / Math.sqrt(2 * Math.PI);
    }, 0);
    return density / (samples.length * bandwidth);
  });
}
