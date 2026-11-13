import { useState } from "react";
import type { ChartData, ChartExample } from "../../types";
import { useChartTheme } from "../theme";
import styles from "./styles.module.css";

export type Theme = ReturnType<typeof useChartTheme>;
export interface Props {
  example: ChartExample;
  compact?: boolean;
  data?: ChartData;
}
export type Metric = { name: string; value: number; color?: string };

export function numeric(value: unknown, fallback = 0) {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function metrics(data: ChartData | undefined, names: readonly string[], values: readonly number[]): Metric[] {
  if (data?.rows) return data.rows.map((row, index) => ({
    name: String(row.name ?? row.label ?? index + 1),
    value: numeric(row.value),
    color: typeof row.color === "string" ? row.color : undefined,
  }));
  const first = data?.series?.[0];
  return (first?.values ?? values).map((value, index) => ({
    name: data?.categories?.[index] ?? names[index] ?? String(index + 1),
    value: numeric(value),
    color: first?.color,
  }));
}

export function seriesData(
  data: ChartData | undefined,
  categories: readonly string[],
  defaults: readonly { name: string; values: readonly (number | null)[]; color?: string }[],
) {
  const series = data?.series ?? defaults;
  return {
    categories: data?.categories ?? (data?.series ? Array.from({ length: Math.max(0, ...series.map(row => row.values.length)) }, (_, index) => categories[index] ?? String(index + 1)) : categories),
    series,
  };
}

export function tone(theme: Theme, index: number, color?: string) {
  return color ?? theme.colors[index % theme.colors.length] ?? "#654bea";
}

export function sum(rows: readonly Metric[]) {
  return rows.reduce((total, row) => total + Math.max(0, row.value), 0);
}

export function percent(part: number, total: number) {
  return total > 0 ? (100 * part / total) : 0;
}

export const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function tooltip(theme: Theme) {
  return { backgroundColor: theme.surface, borderColor: theme.grid, textStyle: { color: theme.text, fontSize: 12 }, confine: true };
}

export function Legend({ items, active, onActive, onClick, progress, theme }: {
  items: readonly Metric[];
  active: number | null;
  onActive: (index: number | null) => void;
  onClick?: (index: number) => void;
  progress?: number;
  theme: Theme;
}) {
  return (
    <div className={styles.legend}>
      {items.map((item, index) => (
        <button key={index} type="button" className={styles.legendItem} data-active={active === index}
          onMouseEnter={() => onActive(index)} onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(index)} onBlur={() => onActive(null)}
          onClick={() => onClick?.(index)}>
          <i style={{ background: tone(theme, index, item.color) }} aria-hidden="true" />
          <span>{item.name}</span>
          <strong>{number.format(item.value)}</strong>
          {progress !== undefined && <meter value={Math.max(0, Math.min(100, percent(item.value, progress)))} min={0} max={100} aria-label={`${item.name} progress`} />}
        </button>
      ))}
    </div>
  );
}

export function useLoading(id: string, compact: boolean | undefined) {
  const [override, setOverride] = useState<boolean>();
  const loading = override ?? (id.endsWith("-loading"));
  return {
    loading,
    control: !compact && id.endsWith("-loading") ? (
      <button className={styles.control} type="button" onClick={() => setOverride(!loading)}>
        {loading ? "Show chart" : "Show loading state"}
      </button>
    ) : null,
  };
}

export function Controls({ items, value, onChange }: {
  items: readonly string[]; value: number; onChange: (index: number) => void;
}) {
  return <div className={styles.controls}>{items.map((item, index) => (
    <button key={item} className={styles.control} type="button" aria-pressed={value === index} onClick={() => onChange(index)}>{item}</button>
  ))}</div>;
}

export function point(cx: number, cy: number, radius: number, angle: number) {
  const rad = Math.PI * angle / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)] as const;
}

export function arc(cx: number, cy: number, radius: number, start: number, end: number) {
  const delta = Math.max(0, Math.min(359.999, end - start));
  const [x1, y1] = point(cx, cy, radius, start);
  const [x2, y2] = point(cx, cy, radius, start + delta);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${delta > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export function safeText(value: unknown) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]!));
}

export function sector(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const delta = Math.max(0, Math.min(359.999, end - start));
  const [outerX, outerY] = point(cx, cy, outer, start + delta);
  const opening = arc(cx, cy, outer, start, start + delta);
  if (!inner) return `${opening} L ${cx} ${cy} Z`;
  const [innerX, innerY] = point(cx, cy, inner, start + delta);
  const [startX, startY] = point(cx, cy, inner, start);
  return `${opening} L ${innerX} ${innerY} A ${inner} ${inner} 0 ${delta > 180 ? 1 : 0} 0 ${startX} ${startY} L ${outerX} ${outerY} Z`;
}

export function Pattern({ id, color, variant = 0 }: { id: string; color: string; variant?: number }) {
  return <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill={color} />
    {variant % 5 === 0 && <path d="M-2 2l4-4m-2 10l8-8m-2 10l4-4" fill="none" stroke="white" opacity=".5" />}
    {variant % 5 === 1 && <path d="M0 2h8M0 6h8" stroke="white" opacity=".5" />}
    {variant % 5 === 2 && <circle cx="4" cy="4" r="1.25" fill="white" opacity=".6" />}
    {variant % 5 === 3 && <path d="M0 0h8v8M4 0v8M0 4h8" fill="none" stroke="white" opacity=".32" />}
    {variant % 5 === 4 && <path d="M1.5 4h5M4 1.5v5" stroke="white" opacity=".65" />}
  </pattern>;
}
