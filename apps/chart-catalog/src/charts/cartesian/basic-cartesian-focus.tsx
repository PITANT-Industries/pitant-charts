import { useActiveTooltipLabel, useIsTooltipActive, usePlotArea, useXAxisScale, useYAxisScale, ZIndexLayer, type XAxisTickContentProps } from "recharts";
import { CartesianDatePill, CartesianFocusPoint, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import type { ChartTheme } from "./options";

export function useBasicInspection(dismissed: boolean) {
  const active = useIsTooltipActive();
  const label = useActiveTooltipLabel();
  return active && !dismissed && label !== undefined ? Number(label) : undefined;
}

export function BasicTick({ x, y, payload, categories, color, compact, dismissed }: XAxisTickContentProps & {
  categories: string[];
  color: string;
  compact: boolean;
  dismissed: boolean;
}) {
  const active = useBasicInspection(dismissed);
  const scale = useXAxisScale();
  const label = categories[Number(payload.value)] ?? "";
  const activeX = active === undefined ? undefined : scale?.(active, { position: "middle" });
  const selectedLabel = active === undefined ? "" : categories[active] ?? "";
  const collides = activeX !== undefined && Math.abs(Number(x) - activeX) < (cartesianPillWidth(selectedLabel) + label.length * 6) / 2;
  return <text data-cartesian-tick="" x={x} y={y} dy={compact ? 8 : 9} textAnchor="middle" fontSize={compact ? 9 : 12}
    fill={color} opacity={collides ? 0 : 1}>{label}</text>;
}

export function BasicStrokeGradients({ id, colors, isArea, pointCount, dismissed }: {
  id: string;
  colors: string[];
  isArea: boolean;
  pointCount: number;
  dismissed: boolean;
}) {
  const active = useBasicInspection(dismissed);
  const plot = usePlotArea();
  const scale = useXAxisScale();
  const x = active === undefined ? undefined : scale?.(active);
  const focus = plot && plot.width > 0 && x !== undefined ? (x - plot.x) / plot.width : undefined;
  const edgeStops = [0, 0.15, 0.85, 1];
  const halfBand = 1 / Math.max(pointCount - 1, 2);
  const focusStops = focus !== undefined ? [-halfBand - 0.0001, -halfBand, halfBand, halfBand + 0.0001]
    .map(delta => Math.max(0, Math.min(1, focus + delta))) : [];
  const stops = [...new Set([...edgeStops, ...focusStops])].sort((a, b) => a - b);
  const opacityAt = (position: number) => {
    const edge = Math.min(1, position / 0.15, (1 - position) / 0.15);
    if (focus === undefined) return edge;
    const emphasized = Math.abs(focus - position) <= halfBand + 1e-9;
    return emphasized ? 1 : (isArea ? 0.6 : 0.3) * edge;
  };
  return <defs>{colors.map((color, index) => <g key={index}>
    {isArea && <linearGradient id={`${id}-area-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>}
    <linearGradient id={`${id}-stroke-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
      {stops.map(position => <stop key={position} offset={position} stopColor={color} stopOpacity={opacityAt(position)} />)}
    </linearGradient>
  </g>)}</defs>;
}

export function BasicFocusOverlay({ kind, data, colors, theme, id, dismissed }: {
  kind: "bar" | "line" | "area";
  data: CartesianData;
  colors: string[];
  theme: ChartTheme;
  id: string;
  dismissed: boolean;
}) {
  const active = useBasicInspection(dismissed);
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  const x = active === undefined ? undefined : xScale?.(active, { position: "middle" });
  if (active === undefined || x === undefined || !plot) return null;
  const label = data.categories[active];
  if (label === undefined) return null;
  const bottom = plot.y + plot.height;
  const halfPill = cartesianPillWidth(label) / 2;
  const pillX = Math.max(halfPill + 2, Math.min(plot.x * 2 + plot.width - halfPill - 2, x));
  return <>
    {kind !== "bar" && <ZIndexLayer zIndex={450}>
      <g aria-hidden="true" pointerEvents="none">
        <defs><linearGradient id={`${id}-guide`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.muted} stopOpacity="0" />
          <stop offset="0.18" stopColor={theme.muted} stopOpacity="0.7" />
          <stop offset="0.82" stopColor={theme.muted} stopOpacity="0.7" />
          <stop offset="1" stopColor={theme.muted} stopOpacity="0" />
        </linearGradient></defs>
        <rect x={x - 0.5} y={plot.y} width={1} height={plot.height} fill={`url(#${id}-guide)`} />
      </g>
    </ZIndexLayer>}
    <ZIndexLayer zIndex={1200}>
      {data.series.map(({ values }, index) => {
        const value = values[active];
        const y = typeof value === "number" ? yScale?.(value) : undefined;
        return y === undefined ? null : <CartesianFocusPoint key={index} x={x} y={y} color={colors[index]}
          surface={kind === "bar" ? theme.surface : undefined} halo={kind !== "bar"} />;
      })}
      <CartesianDatePill x={pillX} y={bottom + 4} label={label} text={theme.text} surface={theme.surface} />
    </ZIndexLayer>
  </>;
}
