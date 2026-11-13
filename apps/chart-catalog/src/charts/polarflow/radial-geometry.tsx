import { point } from "./shared";
import type { Theme } from "./shared";

export const polarTurn = Math.PI * 2;
export const radialRadius = (value: number, min: number, max: number, inner: number, outer: number) =>
  Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * Math.max(0, Math.min(1, (value - min) / (max - min || 1))));
export const radialPoint = (r: number, angle: number) => point(0, 0, r, angle * 180 / Math.PI - 90);

export function ClockAxis({ radius, theme, labels }: { radius: number; theme: Theme; labels: readonly string[] }) {
  const labelSize = Math.max(10, radius * .045);
  return <g data-clock-axis="" aria-hidden="true">
    <circle cx="0" cy="0" r={radius * .37} fill="none" stroke={theme.text} strokeOpacity=".1" />
    {Array.from({ length: 24 }, (_, i) => (i % 6 !== 0)).map((minor, i) => {
      const angle = polarTurn * i / 24;
      const [x1, y1] = radialPoint(radius * .38, angle);
      const [x2, y2] = radialPoint(radius * (minor ? .393 : .405), angle);
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeOpacity={minor ? ".22" : ".45"} strokeLinecap="round" />;
    })}
    {labels.map((label, i) => {
      const [x, y] = radialPoint(radius * .955, polarTurn * i / labels.length);
      return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize} fill={theme.muted}>{label}</text>;
    })}
  </g>;
}

/* Bklit UI radial grid, copyright (c) 2026 uixmat, MIT. See licenses/Bklit-UI-MIT.md. */
export function radialDots(binCount: number, inner: number, outer: number, rows: number, columns: boolean) {
  const result: { row: number; x: number; y: number }[][] = Array.from({ length: binCount }, () => []);
  if (!binCount) return result;
  const spacing = (outer - inner) / rows;
  for (let row = 0; row < rows; row++) {
    const r = inner + spacing * (row + .5);
    const count = columns ? binCount : Math.max(1, Math.round(polarTurn * r / spacing));
    for (let i = 0; i < count; i++) {
      const fraction = (i + .5) / count;
      const [x, y] = radialPoint(r, fraction * polarTurn);
      result[Math.floor(fraction * binCount)].push({ row, x, y });
    }
  }
  return result;
}

export function dotStack(values: readonly number[], maximum: number, inner: number, outer: number, rows: number) {
  let total = 0;
  let previous = 0;
  return values.map(value => {
    total += Math.max(0, value);
    const height = Math.round(rows * (radialRadius(total, 0, maximum, inner, outer) - inner) / (outer - inner));
    previous = Math.min(rows, Math.max(previous + (value > 0 ? 1 : 0), height));
    return previous;
  });
}
