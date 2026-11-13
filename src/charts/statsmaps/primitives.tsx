import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import type { ChartData, ChartExample } from "../../types";

export interface DemoProps {
  example: ChartExample;
  compact?: boolean;
  data?: ChartData;
}

export interface Point {
  x: number;
  y: number;
  group: string;
  value?: number;
  label?: string;
}

export interface HoverInfo {
  x: number;
  y: number;
  lines: readonly string[];
}

export type ShowHint = (hint: HoverInfo | null) => void;

export const WIDTH = 640;
export const HEIGHT = 320;
export const MARGIN = { left: 61, right: 32, top: 26, bottom: 42 };
export const PLOT = {
  left: MARGIN.left,
  right: WIDTH - MARGIN.right,
  top: MARGIN.top,
  bottom: HEIGHT - MARGIN.bottom,
};

export const format = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
export const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 });
export const minMax = (values: readonly number[]) => {
  let low = Infinity;
  let high = -Infinity;
  for (const value of values) {
    low = Math.min(value, low);
    high = Math.max(value, high);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1] as const;
  return low === high ? [low - 1, high + 1] as const : [low, high] as const;
};

export function linear(domain: readonly [number, number], range: readonly [number, number]) {
  return (value: number) => range[0] + (range[1] - range[0]) * (value - domain[0]) / (domain[1] - domain[0]);
}

export function ticks([min, max]: readonly [number, number], count = 5) {
  return Array.from({ length: count }, (_, index) => min + index / (count - 1) * (max - min));
}

export function domain(values: readonly number[], pad = 0.07): [number, number] {
  const [min, max] = minMax(values);
  return [min - (max - min) * pad, max + (max - min) * pad];
}

export function createRandom(seed: number) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function normal(random: () => number) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

export function rows(data?: ChartData) {
  return data?.rows?.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") ?? [];
}

export function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function xyData(data?: ChartData): Point[] | undefined {
  if (data?.rows) {
    return rows(data).flatMap((row) => {
      const x = number(row.x);
      const y = number(row.y);
      if (x === undefined || y === undefined) return [];
      return [{ x, y, group: string(row.group) ?? "Series", value: number(row.value), label: string(row.label) }];
    });
  }
  if (data?.series) {
    return data.series.flatMap((series) => series.values.flatMap((entry, index) => {
      const y = number(entry);
      return y === undefined ? [] : [{ x: index + 1, y, group: series.name, label: data.categories?.[index] }];
    }));
  }
  return undefined;
}

export function seriesColors(names: readonly string[], colors: readonly string[], data?: ChartData) {
  return names.map((name, index) => data?.series?.find((series) => series.name === name)?.color ?? colors[index % colors.length]);
}

export function sampleSeries(data: ChartData | undefined, defaults: readonly string[], count = 45) {
  if (data?.series) {
    return data.series.map(({ name, values, color }) => ({
      name,
      color,
      values: values.flatMap((value) => {
        const sample = number(value);
        return sample === undefined ? [] : [sample];
      }).sort((a, b) => a - b),
    })).filter(({ values }) => values.length);
  }
  if (data?.rows) {
    const samples = new Map<string, number[]>();
    for (const row of rows(data)) {
      const value = number(row.value);
      const group = string(row.group) ?? "Samples";
      if (value === undefined) continue;
      if (!samples.has(group)) samples.set(group, []);
      samples.get(group)?.push(value);
    }
    return [...samples].map(([name, values]) => ({ name, color: undefined, values: values.sort((a, b) => a - b) }));
  }
  const random = createRandom(817);
  return defaults.map((name, index) => ({
    name,
    color: undefined,
    values: Array.from({ length: count }, (_, sample) => (
      Math.max(2, 108 + index * 29 + normal(random) * (21 + index * 3) + (sample % 13 === 0 ? 43 : 0))
    )).sort((a, b) => a - b),
  }));
}

export function quantile(values: readonly number[], amount: number) {
  if (!values.length) return 0;
  const index = (values.length - 1) * amount;
  const lower = Math.floor(index);
  return values[lower] + (values[Math.min(values.length - 1, lower + 1)] - values[lower]) * (index - lower);
}

export function linePath(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

export function Grid({ x, y, xLabels, yLabels, xTitle, yTitle, hideVertical, hideHorizontal, horizontalLabelsAtTop, className }: {
  x?: readonly number[];
  y?: readonly number[];
  xLabels?: readonly string[];
  yLabels?: readonly string[];
  xTitle?: string;
  yTitle?: string;
  hideVertical?: boolean;
  hideHorizontal?: boolean;
  horizontalLabelsAtTop?: boolean;
  className?: string;
}) {
  return (
    <g aria-hidden="true" className={className}>
      {y?.map((value, index) => (
        <g key={index}>
          {!hideHorizontal && <path d={`M${PLOT.left} ${value}H${PLOT.right}`} stroke="var(--border)" strokeDasharray="4 5" />}
          {yLabels?.[index] && <text className="stat-axis" x={PLOT.left - 10} y={value + 4} textAnchor="end">{yLabels[index]}</text>}
        </g>
      ))}
      {x?.map((value, index) => (
        <g key={index}>
          {!hideVertical && <path d={`M${value} ${PLOT.top}V${PLOT.bottom}`} stroke="var(--border)" strokeDasharray="4 5" />}
          {xLabels?.[index] && <text className="stat-axis" x={value} y={horizontalLabelsAtTop ? PLOT.top - 9 : PLOT.bottom + 19} textAnchor="middle">{xLabels[index]}</text>}
        </g>
      ))}
      {xTitle && <text className="stat-axis" x={(PLOT.right + PLOT.left) / 2} y={HEIGHT - 4} textAnchor="middle">{xTitle}</text>}
      {yTitle && <text className="stat-axis" transform={`translate(15 ${(PLOT.bottom + PLOT.top) / 2}) rotate(-90)`} textAnchor="middle">{yTitle}</text>}
    </g>
  );
}

export function Legend({ entries, active, onToggle }: {
  entries: readonly { name: string; color: string }[];
  active?: readonly string[];
  onToggle?: (name: string) => void;
}) {
  return (
    <div className="stat-legend" aria-label="Chart legend">
      {entries.map(({ name, color }) => {
        const content = <><i aria-hidden="true" style={{ "--legend-color": color } as CSSProperties} />{name}</>;
        return onToggle
          ? <Toggle key={name} pressed={!active || active.includes(name)} onPressedChange={() => onToggle(name)}>{content}</Toggle>
          : <span key={name}>{content}</span>;
      })}
    </div>
  );
}

export function useVariantLoading(id: string) {
  const available = id.endsWith("-loading");
  const [loading, setLoading] = useState(available);
  return {
    loading,
    button: available ? <Button className="stat-control" onClick={() => setLoading((previous) => !previous)}>{loading ? "Show data" : "Show loading"}</Button> : undefined,
  };
}

export function markEvents(hint: HoverInfo, show: ShowHint, interactive = true) {
  if (!interactive) return {};
  return {
    onPointerEnter: () => show(hint),
    onPointerLeave: () => show(null),
  };
}

export function SvgPlot({ example, compact, hints = [], className = "", loading = false, loadingLabel, controls, legend, height = HEIGHT, children }: {
  example: ChartExample;
  compact?: boolean;
  hints?: readonly HoverInfo[];
  className?: string;
  loading?: boolean;
  loadingLabel?: string;
  controls?: ReactNode;
  legend?: ReactNode;
  height?: number;
  children: (show: ShowHint, current: HoverInfo | null, id: string) => ReactNode;
}) {
  const id = useId().replaceAll(":", "");
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const hovered = hover && hints.find((hint) => hint.x === hover.x && hint.y === hover.y &&
    hint.lines.length === hover.lines.length && hint.lines.every((line, index) => line === hover.lines[index]));
  const current = loading ? null : hovered ?? (focusIndex === null ? null : hints[focusIndex]) ?? null;
  const interactive = !compact && !loading && !!hints.length;
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!interactive) return;
    const index = focusIndex ?? 0;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        setFocusIndex((index + 1) % hints.length);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        setFocusIndex((index + hints.length - 1) % hints.length);
        break;
      case "Home":
        setFocusIndex(0);
        break;
      case "End":
        setFocusIndex(hints.length - 1);
        break;
      case "Escape":
        event.stopPropagation();
        setFocusIndex(null);
        break;
      default:
        return;
    }
    setHover(null);
    event.preventDefault();
  }
  return (
    <div className={`stat-demo ${compact ? "stat-compact" : ""} ${className}`}>
      {!compact && controls && <div className="stat-controls">{controls}</div>}
      <div className="stat-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className={`stat-svg${loading ? " stat-loading" : example.id.endsWith("-loading") ? " stat-ready" : ""}`}
          role="img"
          aria-label={example.title}
          aria-busy={loading || undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={onKeyDown}
          onFocus={() => interactive && setFocusIndex(0)}
          onBlur={() => setFocusIndex(null)}
        >
          {children(compact ? () => {} : setHover, current, id)}
        </svg>
        {!compact && loading && loadingLabel && <div className="stat-loading-label" role="status">{loadingLabel}</div>}
        {!compact && current && (
          <div className="stat-hint" role="status" style={{
            left: `${Math.min(82, Math.max(18, current.x * 100 / WIDTH))}%`,
            top: `${Math.min(83, Math.max(20, current.y * 100 / height))}%`,
          }}>
            {current.lines.map((line, index) => <div key={index}>{line}</div>)}
          </div>
        )}
      </div>
      {legend}
    </div>
  );
}

export function NoData({ example, compact }: Pick<DemoProps, "example" | "compact">) {
  return (
    <SvgPlot example={example} compact={compact}>
      {() => <text className="stat-axis" x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle">No data to display</text>}
    </SvgPlot>
  );
}
