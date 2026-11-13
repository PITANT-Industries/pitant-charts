// Adapted from Bklit UI's sparkline path builders, copyright (c) 2026 uixmat, MIT.
// See licenses/Bklit-UI-MIT.md.
import { area, curveMonotoneX, curveStep, line } from "d3-shape";

export function sparklinePaths(values: readonly (number | null)[], xAt: (index: number) => number, yAt: (value: number) => number, baseline: number, stepped: boolean) {
  const curve = stepped ? curveStep : curveMonotoneX;
  const defined = (value: number | null) => value !== null && Number.isFinite(value);
  const y = (value: number | null) => yAt(value!);
  return {
    line: line<number | null>().defined(defined).x((_, index) => xAt(index)).y(y).curve(curve)(values) ?? "",
    area: area<number | null>().defined(defined).x((_, index) => xAt(index)).y0(yAt(baseline)).y1(y).curve(curve)(values) ?? "",
  };
}
