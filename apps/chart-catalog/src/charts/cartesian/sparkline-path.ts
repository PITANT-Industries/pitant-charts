// Adapted from Bklit UI's sparkline path builders, copyright (c) 2026 uixmat, MIT.
// See licenses/Bklit-UI-MIT.md.
import { area, curveMonotoneX, curveNatural, curveStep, line } from "d3-shape";

export function sparklinePaths(values: readonly (number | null)[], xAt: (index: number) => number, yAt: (value: number) => number, baseline: number, stepped: boolean, fixture = false, natural = false) {
  const curve = stepped ? curveStep : natural ? curveNatural : curveMonotoneX;
  const defined = (value: number | null) => value !== null && Number.isFinite(value);
  const y = (value: number | null) => yAt(value!);
  if (fixture && values.length && values.every(defined)) {
    const stroke = stepped ? referenceStep(values, xAt, y) : line<number | null>().x((_, index) => xAt(index)).y(y).curve(curve).digits(2)(values) ?? "";
    const y0 = round(yAt(baseline));
    return { line: stroke, area: `${stroke}L${round(xAt(values.length - 1))},${y0}L${round(xAt(0))},${y0}Z` };
  }
  return {
    line: line<number | null>().defined(defined).x((_, index) => xAt(index)).y(y).curve(curve)(values) ?? "",
    area: area<number | null>().defined(defined).x((_, index) => xAt(index)).y0(yAt(baseline)).y1(y).curve(curve)(values) ?? "",
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

function referenceStep(values: readonly (number | null)[], xAt: (index: number) => number, yAt: (value: number | null) => number) {
  let path = `M${round(xAt(0))},${round(yAt(values[0]))}`;
  for (let index = 1; index < values.length; index++) {
    path += `H${round((xAt(index - 1) + xAt(index)) / 2)}V${round(yAt(values[index]))}`;
  }
  return `${path}H${round(xAt(values.length - 1))}`;
}

export function sparklineBarPath(center: number, width: number, tip: number, baseline: number, radius: number) {
  if (tip === baseline) return "";
  const left = center - width / 2;
  const right = center + width / 2;
  const cap = Math.min(radius, width / 2, Math.abs(tip - baseline));
  const sweep = tip < baseline ? 1 : 0;
  const y = round(tip + (sweep ? cap : -cap));
  const r = round(cap);
  return `M${round(left)},${round(baseline)}V${y}A${r},${r} 0 0 ${sweep} ${round(left + cap)},${round(tip)}`
    + `H${round(right - cap)}A${r},${r} 0 0 ${sweep} ${round(right)},${y}V${round(baseline)}Z`;
}
