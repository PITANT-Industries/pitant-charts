import { curveCatmullRom, curveLinear, curveNatural, line } from "d3-shape";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { Button } from "@ui-sdk/react/button";
import { Choices } from "../../ui/Choices";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { LineBand, LineDateRegions, LineEvents, negative, positive, type Fill } from "./LineDetailDecorations";
import { LineLegend, LineLoadToggle } from "./LineExtras";
import { lineDateLabel, lineMoney } from "./line-format";
import { designForLine, lineDynamicDomain, lineOverlays, toLocalTime, type LineVariant } from "./line-detail-data";
import { referenceLineFixture } from "./line-reference-fixtures";
import { readLineEvents } from "./line-events";
import { LineEventReadout } from "./LineEventReadout";
import { resolveChartTooltipPlacement } from "../tooltip/placement";
import type { ChartTheme } from "./options";
import "./line-detail.css";

export { detailedLines } from "./line-detail-data";

const fillChoices = [{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }, { value: "pattern", label: "Pattern" }] as const;
const trendChoices = [{ value: "dashed", label: "Dashed" }, { value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }] as const;
const rangeChoices = [{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "90", label: "90d" }] as const;
const trendColors = [2, 0];
const placeholder = [9.5, 12.6, 13.3, 11.6, 9.9, 10.6, 13.7];
const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
const conversion = new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 3 });
const axisNumber = (value: number) => Math.abs(value) >= 1000 ? `${value / 1000}k` : String(value);

type Trend = typeof trendChoices[number]["value"];
type PlotProps = {
  variant: LineVariant;
  label: string;
  data: CartesianData;
  compact: boolean;
  theme: ChartTheme;
  fixture: boolean;
};
type PlotPoint = { x: number; y: number; value: number };
type TrendPoint = Pick<PlotPoint, "x" | "value">;

function trendEndpoints(points: TrendPoint[]) {
  const count = points.length;
  if (count < 2) return null;
  const center = points.reduce((sum, point) => sum + point.x, 0) / count;
  const average = points.reduce((sum, point) => sum + point.value, 0) / count;
  const variance = points.reduce((sum, point) => sum + (point.x - center) ** 2, 0);
  const slope = variance === 0 ? 0 : points.reduce((sum, point) => sum + (point.x - center) * (point.value - average), 0) / variance;
  return [points[0].x, points[count - 1].x].map(x => ({ x, value: average + (x - center) * slope }));
}

function LinePlot({ variant, label, data, compact, theme, fixture, fill, trend, activeSeries, loading, range, fills = false }: PlotProps & {
  fill: Fill;
  trend: Trend;
  activeSeries?: number;
  loading: boolean;
  range: number;
  fills?: boolean;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const tooltip = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const design = designForLine(variant);
  const selection = useRef<{ pointer: number; point: number } | null>(null);
  const [segment, setSegment] = useState<readonly [number, number] | null>(null);
  const isSegment = variant === "line-segment";
  const glow = variant === "line-glow";
  const dual = design.axis === "dual";
  const profit = variant.startsWith("line-profit-loss");
  const projection = variant === "line-projection" || variant === "line-projection-manual";
  const manual = variant === "line-projection-manual";
  const crosshair = variant === "line-crosshair-point";
  const skeleton = variant === "line-loading-placeholder";
  const rangeChart = variant === "line-time-range";
  const source = skeleton ? {
    categories: placeholder.map((_, index) => String(index)),
    series: [{ name: "Sessions", values: placeholder }],
  } : rangeChart ? {
    categories: data.categories.slice(-range),
    series: data.series.map(series => ({ ...series, values: series.values.slice(-range) })),
    rows: data.rows?.slice(-range),
  } : data;
  const last = source.categories.length - 1;
  const usable = last >= 0 && !compact && !loading;
  const { bands, average } = lineOverlays(variant, source);
  const scaled = fixture || variant === "line-fixed-scale" || skeleton;
  const { domain, tick } = scaled ? rangeChart && range === 7 ? { domain: [0, 3500], tick: 500 } : { domain: design.domain, tick: design.step } : lineDynamicDomain(dual ? source.series.slice(0, 1) : source.series, bands, design.step);
  const { domain: rightDomain, tick: rightTick } = fixture ? { domain: [0, 4.5], tick: 1 } : lineDynamicDomain(source.series.slice(1), [], 1);
  const inset = (value: number) => glow ? 0 : compact ? Math.min(15, value) : value;
  const left = Math.min(inset(fills ? 16 : dual ? 56 : design.axis === "percent" ? 48 : 40), width * .2);
  const right = width - Math.min(inset(fills ? 16 : dual ? 56 : 40), width * .2);
  const top = Math.min(inset(fills ? 16 : 40), height * .29);
  const bottom = height - Math.min(glow ? 0 : compact ? 20 : fills ? 32 : 40, height * .29);
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const times = source.categories.map(toLocalTime);
  const useDates = times.every(time => time !== undefined);
  const projectEnd = fixture && projection ? toLocalTime(manual ? "Oct 26" : "Nov 5") : undefined;
  const start = useDates ? times[0] ?? 0 : 0;
  const end = useDates ? projectEnd ?? times[last] ?? start : last;
  const xTime = (time: number) => left + (time - start) / (end - start || 1) * plotWidth;
  const x = (index: number) => xTime(useDates ? times[index] ?? start : index);
  const y = (value: number) => bottom - (value - domain[0]) / (domain[1] - domain[0]) * plotHeight;
  const yRight = (value: number) => bottom - (value - rightDomain[0]) / (rightDomain[1] - rightDomain[0]) * plotHeight;
  const colors = source.series.map((series, index) => series.color ?? (variant === "line-loading" ? theme.text : theme.colors[(design.colors?.[index] ?? index) % theme.colors.length]));
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  const coordinates = source.series.map(({ values }, series) => source.categories.map((_, index) => {
    const value = values[index];
    return { x: x(index), y: valid(value) ? (dual && series === 1 ? yRight(value) : y(value)) : NaN, value: valid(value) ? value : NaN };
  }));
  const path = line<PlotPoint>().x(point => point.x).y(point => point.y).defined(point => Number.isFinite(point.y))
    .curve(design.curve === "linear" ? curveLinear : design.curve === "catmull" ? curveCatmullRom : curveNatural);
  const xCount = Math.min(last + 1, compact ? 3 : rangeChart && range === 7 ? 4 : width < 450 ? design.narrowTicks ?? design.ticks ?? 5 : design.ticks ?? 5);
  const xTicks = Array.from({ length: glow || skeleton ? 0 : Math.max(0, xCount) }, (_, index) => {
    const portion = index / (xCount - 1 || 1);
    if (projectEnd !== undefined) {
      const time = start + portion * (end - start);
      return { x: xTime(time), label: monthDay.format(time) };
    }
    const point = fixture && last === 23 && xCount === 4 ? Math.min(last, index * 8)
      : fixture && last === 29 && xCount === 4 ? Math.min(last, index * 10) : Math.round(portion * last);
    return { x: x(point), label: source.categories[point] };
  });
  const yTicks = (limits: readonly number[], spacing: number) => {
    const start = Math.ceil(limits[0] / spacing) * spacing;
    const count = Math.floor((limits[1] - start) / spacing) + 1;
    return spacing ? Array.from({ length: Math.max(0, count) }, (_, index) => start + spacing * index) : [];
  };
  const ticks = fills ? [] : yTicks(domain, tick);
  const active = usable && !selection.current && selected !== null && selected <= last ? selected : null;
  const labelDate = active === null ? "" : source.categories[active];
  const activeEvents = variant === "line-markers" && active !== null ? readLineEvents(source.rows?.[active]) : [];
  const pillWidth = cartesianPillWidth(labelDate);
  const activeX = active === null ? 0 : x(active);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, Math.round(activeX)));
  const focusPoints = active === null ? [] : coordinates.flatMap((points, index) => {
    const point = points[active];
    return point && valid(point.value) ? [{ ...point, index, color: profit ? point.value < 0 ? negative : positive : colors[index] }] : [];
  });
  const sign = (value: number) => value < 0 ? negative : positive;
  const valueLabel = (value: number, series: number) => profit || manual || variant === "line-loading" || dual && series === 0 ? lineMoney(value)
    : dual && series === 1 ? `${conversion.format(value)}%` : number.format(value);
  const entries = active === null ? [] : focusPoints.map(point => ({
    name: source.series[point.index].name, value: valueLabel(point.value, point.index), color: point.color,
  }));
  if (active !== null) {
    for (const band of bands) {
      const low = band.low[active], high = band.high[active];
      if (!valid(low) || !valid(high)) continue;
      if (variant === "line-bollinger") {
        entries.unshift({ name: "Upper band", value: number.format(high), color: theme.colors[2] },
          { name: "Lower band", value: number.format(low), color: theme.colors[2] },
          { name: "10-day average", value: number.format(average?.[active] ?? 0), color: theme.colors[1] });
      } else {
        entries.push({ name: band.name, value: `${number.format(low)} – ${number.format(high)}`, color: theme.colors[band.color] });
        const mean = average?.[active];
        if (valid(mean)) entries.push({ name: "10-day average", value: number.format(mean), color: theme.colors[band.color] });
      }
    }
  }
  const projected = coordinates[0]?.at(-1);
  const averagePoints = average?.map((value, index) => ({ x: x(index), y: valid(value) ? y(value) : NaN, value: value ?? NaN }));
  const trendPoints = variant === "line-trend" ? trendEndpoints((coordinates[0] ?? []).filter(point => valid(point.value))) : null;
  const fallbackPoint = focusPoints[0]?.y ?? bottom;
  const tipLeft = activeX > width / 2;
  const tipTop = Math.max(4, Math.min(height - (44 + entries.length * 21), Math.min(top + 7, fallbackPoint)));

  useLayoutEffect(() => {
    const element = tooltip.current;
    if (variant !== "line-markers" || !element) return;
    const place = () => {
      const position = resolveChartTooltipPlacement({ x: activeX, y: top + element.offsetHeight / 2 },
        { width: element.offsetWidth, height: element.offsetHeight },
        { left: 0, top: 0, right: width, bottom: height }, ["right", "left"], 16);
      element.style.left = `${position.left}px`;
      element.style.top = `${position.top}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [variant, active, activeX, top, width, height, source.rows]);

  function pointAt(event: PointerEvent<SVGSVGElement>, clamp = false) {
    if (!usable) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    if (!clamp && (px < left - 4 || px > right + 4 || py < top || py > bottom)) return null;
    let nearest = 0;
    for (let index = 1; index <= last; index++) {
      if (Math.abs(x(index) - px) < Math.abs(x(nearest) - px)) nearest = index;
    }
    return nearest;
  }

  function inspect(event: PointerEvent<SVGSVGElement>) {
    const start = selection.current;
    const point = pointAt(event, start?.pointer === event.pointerId);
    if (start?.pointer === event.pointerId && point !== null) {
      setSegment([Math.min(start.point, point), Math.max(start.point, point)]);
      return;
    }
    setSelected(point);
  }

  function startSelection(event: PointerEvent<SVGSVGElement>) {
    const point = pointAt(event);
    if (isSegment && point !== null && event.isPrimary && event.button === 0) {
      selection.current = { pointer: event.pointerId, point };
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelected(null);
      return;
    }
    setSelected(point);
  }

  function stopSelection(event: PointerEvent<SVGSVGElement>) {
    const start = selection.current;
    if (!start || start.pointer !== event.pointerId) return;
    const point = pointAt(event, true);
    selection.current = null;
    if (point !== null && point !== start.point) {
      setSegment([Math.min(start.point, point), Math.max(start.point, point)]);
      setSelected(null);
    } else {
      setSelected(point);
    }
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!usable || event.target !== event.currentTarget) return;
    if (event.key === "Escape" && (active !== null || segment)) {
      event.preventDefault();
      event.stopPropagation();
      if (selection.current && event.currentTarget.hasPointerCapture(selection.current.pointer)) event.currentTarget.releasePointerCapture(selection.current.pointer);
      selection.current = null;
      setSegment(null);
      setSelected(null);
      return;
    }
    const next = {
      Home: 0, End: last, ArrowLeft: Math.max(0, (active ?? last + 1) - 1), ArrowRight: Math.min(last, (active ?? -1) + 1),
      ArrowDown: Math.max(0, (active ?? last + 1) - 1), ArrowUp: Math.min(last, (active ?? -1) + 1),
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setSelected(next);
    }
  }

  function drawForecast(point: PlotPoint) {
    const target = right - 7;
    const distance = target - point.x;
    if (manual) {
      const predictions = data.rows?.flatMap(row => {
        const date = toLocalTime(String(row.category ?? ""));
        return date !== undefined && valid(row.forecast) ? [{ x: Math.min(target, xTime(date)), y: y(row.forecast), value: row.forecast }] : [];
      }) ?? [];
      return <path data-line-forecast="manual" d={path([point, ...predictions]) ?? undefined} fill="none" stroke={theme.colors[1]} strokeWidth="2" strokeDasharray="6 4" />;
    }
    return [2800, 2436].map(value => <path key={value} data-line-forecast="" d={`M${point.x},${point.y}C${point.x + distance * .45},${point.y},${target - distance * .45},${y(value)},${target},${y(value)}`}
      fill="none" stroke={`url(#${id}-projection)`} strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />);
  }

  return <div ref={plot} className="line-detail-plot" data-line-markers={variant === "line-markers" || undefined} data-line-loading={loading} data-line-selection={isSegment} role={loading ? "status" : undefined} aria-busy={loading || undefined}
    aria-label={loading ? skeleton ? "Loading sessions" : "Loading revenue" : undefined}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={loading ? "Loading chart" : label} aria-describedby={usable ? `${id}-help` : undefined} tabIndex={usable ? 0 : undefined}
      onPointerMove={inspect} onPointerDown={startSelection} onPointerUp={stopSelection} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
      onPointerCancel={() => { selection.current = null; setSelected(null); }} onFocus={event => { if (usable && event.target === event.currentTarget) setSelected(previous => previous ?? 0); }} onBlur={() => setSelected(null)} onKeyDown={onKeyDown}>
      {usable && <desc id={`${id}-help`}>Use the arrow keys to inspect each data point. Home and End jump to the first or last point. Escape clears the selection.</desc>}
      <defs>
        <linearGradient id={`${id}-grid`}>
          <stop offset="0" stopColor={theme.grid} stopOpacity="0" /><stop offset=".1" stopColor={theme.grid} />
          <stop offset=".9" stopColor={theme.grid} /><stop offset="1" stopColor={theme.grid} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-guide`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={crosshair ? fallbackPoint : top} y2={bottom}>
          <stop offset="0" stopColor={crosshair ? colors[0] : theme.muted} stopOpacity={crosshair ? 1 : 0} />
          {!crosshair && <><stop offset=".1" stopColor={theme.muted} stopOpacity=".8" /><stop offset=".9" stopColor={theme.muted} stopOpacity=".8" /></>}
          <stop offset="1" stopColor={crosshair ? colors[0] : theme.muted} stopOpacity="0" />
        </linearGradient>
        {projection && <linearGradient id={`${id}-projection`}><stop stopColor={theme.colors[2]} /><stop offset="1" stopColor={theme.colors[4]} /></linearGradient>}
        {trendPoints && <linearGradient id={`${id}-trend`}>
          <stop stopColor={theme.colors[trendColors[0]]} stopOpacity="0" /><stop offset=".15" stopColor={theme.colors[trendColors[0]]} />
          <stop offset=".85" stopColor={theme.colors[trendColors[1]]} /><stop offset="1" stopColor={theme.colors[trendColors[1]]} stopOpacity="0" />
        </linearGradient>}
        {profit && <linearGradient id={`${id}-profit`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}>
          <stop stopColor={positive} stopOpacity={activeSeries === 1 ? .25 : 1} /><stop offset={Math.max(0, Math.min(1, (y(0) - top) / plotHeight))} stopColor={positive} stopOpacity={activeSeries === 1 ? .25 : 1} />
          <stop offset={Math.max(0, Math.min(1, (y(0) - top) / plotHeight))} stopColor={negative} stopOpacity={activeSeries === 0 ? .25 : 1} /><stop offset="1" stopColor={negative} stopOpacity={activeSeries === 0 ? .25 : 1} />
        </linearGradient>}
        {glow && <>
          <radialGradient id={`${id}-glow-a`} cx="50%" cy="57.75%" r="42.25%">
            <stop stopColor={theme.colors[0]} stopOpacity=".55" /><stop offset=".3" stopColor={theme.colors[1]} stopOpacity=".4" />
            <stop offset=".65" stopColor={theme.colors[2]} stopOpacity=".18" /><stop offset="1" stopColor={theme.colors[2]} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-glow-b`} cx="65.57%" cy="79.44%" r="20.56%">
            <stop stopColor={theme.colors[3]} stopOpacity=".55" /><stop offset="1" stopColor={theme.colors[3]} stopOpacity="0" />
          </radialGradient>
        </>}
        {coordinates.map((_, index) => <linearGradient key={index} id={`${id}-series-${index}`}>
          <stop stopColor={colors[index]} stopOpacity={glow ? 1 : 0} /><stop offset=".15" stopColor={colors[index]} />
          {glow && <stop offset=".5" stopColor={theme.colors[1]} />}
          <stop offset=".85" stopColor={glow ? theme.colors[3] : colors[index]} /><stop offset="1" stopColor={glow ? theme.colors[3] : colors[index]} stopOpacity={glow ? 1 : 0} />
        </linearGradient>)}
      </defs>
      {glow && coordinates[0] && <g aria-hidden="true">
        {["a", "b"].map(layer => <path key={layer} d={`${path(coordinates[0]) ?? ""}L${width},0L0,0Z`} fill={`url(#${id}-glow-${layer})`} />)}
      </g>}
      <g data-line-grid="" aria-hidden="true" opacity={skeleton ? .5 : loading ? .35 : 1}>
        {ticks.map(value => <line key={value} x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={variant === "line-grid" ? theme.grid : `url(#${id}-grid)`} strokeDasharray={variant === "line-grid" ? "2 4" : "4 4"} />)}
        {variant === "line-grid" && source.categories.map((_, index) => <line key={index} x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke={theme.grid} strokeDasharray="2 4" />)}
      </g>
      <g aria-hidden="true">
        {isSegment && <rect data-line-segment="" x={(segment ? x(segment[0]) : left) + .75} y={top + .75}
          width={Math.max(0, (segment ? x(segment[1]) - x(segment[0]) : plotWidth) - 1.5)} height={Math.max(0, plotHeight - 1.5)}
          fill={segment ? colors[0] : theme.grid} fillOpacity={segment ? .15 : .45} />}
        <LineDateRegions id={`${id}-regions`} variant={variant} fill={fill} categories={source.categories} top={top} bottom={bottom} right={right} x={x} />
        {bands.map((band, index) => variant !== "line-bollinger" && <LineBand key={index} id={`${id}-band-${index}`} variant={variant}
          band={band} fill={fill} color={theme.colors[band.color]} width={width} x={x} y={y} />)}
        {variant === "line-bollinger" && bands.flatMap(band => [band.high, band.low].map((values, index) =>
          <path key={index} data-line-bollinger-bound="" d={line<number>().x(x).y(index => y(values[index]!)).defined(index => values[index] != null).curve(curveNatural)(values.map((_, index) => index)) ?? undefined}
            fill="none" stroke={theme.colors[2]} strokeWidth="1.5" />))}
        {averagePoints && <path data-line-average="" d={path(averagePoints) ?? undefined} fill="none"
          stroke={variant === "line-bollinger" ? theme.colors[1] : theme.colors[0]} strokeWidth={variant === "line-bollinger" ? 2 : 1}
          strokeDasharray={variant === "line-band-bollinger" ? "4 4" : undefined} />}
        {active !== null && <line data-line-guide="" x1={activeX} x2={activeX} y1={crosshair ? fallbackPoint : top} y2={bottom} stroke={`url(#${id}-guide)`} />}
        {coordinates.map((points, index) => {
          const dashed = variant === "line-dashed" && points.length > 5;
          const plainStroke = variant === "line-bollinger" ? colors[index] : `url(#${id}-series-${index})`;
          const stroke = loading ? "var(--muted-foreground)" : profit ? `url(#${id}-profit)` : plainStroke;
          return <g key={index} data-line-series={source.series[index].name} opacity={loading ? .22 : !profit && activeSeries !== undefined && activeSeries !== index ? .25 : 1}>
            {glow && <path d={path(points) ?? undefined} fill="none" stroke={stroke} strokeWidth="4" opacity=".6" className="line-detail-glow" />}
            <path data-line-actual="" d={path(dashed ? points.slice(0, -4) : points) ?? undefined} fill="none" stroke={stroke}
              strokeWidth={glow ? 2 : design.stroke ?? 2.5} strokeLinecap="round" strokeLinejoin="round" />
            {dashed && <path data-line-dashed-tail="" d={path(points.slice(-5)) ?? undefined} fill="none" stroke={stroke} strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />}
            {variant === "line-points" && points.map((point, j) => valid(point.y) && <g key={j} data-line-point="">
              <circle cx={point.x} cy={point.y} r="8" stroke={colors[index]} strokeWidth="2" fill="none" />
              <circle cx={point.x} cy={point.y} r="4" fill={colors[index]} />
            </g>)}
          </g>;
        })}
        {fixture && projection && projected && valid(projected.value) && drawForecast(projected)}
        {fixture && variant === "line-projection" && projected && valid(projected.value) && <circle data-line-projection-terminal=""
          cx={projected.x} cy={projected.y} r="11.75" fill="none" stroke={colors[0]} strokeWidth="1.5" />}
        {trendPoints && <path data-line-trend="" d={`M${trendPoints[0].x},${y(trendPoints[0].value)}L${trendPoints[1].x},${y(trendPoints[1].value)}`}
          fill="none" stroke={trend === "gradient" ? `url(#${id}-trend)` : theme.colors[0]} strokeWidth="2" strokeDasharray={trend === "dashed" ? "6 4" : undefined} />}
        {focusPoints.map(point => <CartesianFocusPoint key={point.index} x={point.x} y={point.y} color={profit ? sign(point.value) : point.color} surface={theme.surface} />)}
      </g>
      {variant === "line-markers" && <LineEvents rows={source.rows ?? []} x={x} top={top} bottom={bottom} compact={compact} onInspectMarkers={() => setSelected(null)} />}
      <g data-line-axis="" aria-hidden="true" fill={theme.muted} fontSize={compact ? 9 : 12} opacity={loading ? .44 : 1}>
        {xTicks.map((tick, index) => <text key={index} x={tick.x} y={bottom + (compact ? 14 : 24)} textAnchor="middle" opacity={tick.label === labelDate ? 0 : 1}>{tick.label}</text>)}
        {design.axis && !compact && ticks.map(value => <text key={value} x={left - 4} y={y(value)} textAnchor="end" dominantBaseline="middle">
          {design.axis === "dual" ? `$${axisNumber(value)}` : design.axis === "percent" ? `${value}%` : axisNumber(value)}
        </text>)}
        {dual && !compact && yTicks(rightDomain, rightTick).map(value => <text key={value} x={right + 4} y={yRight(value)} textAnchor="start" dominantBaseline="middle">{value}%</text>)}
      </g>
      {active !== null && !glow && <CartesianDatePill x={pillX} y={bottom + 4} label={labelDate} text={theme.text} surface={theme.surface} />}
    </svg>
    {isSegment && segment && <output className="line-detail-segment-selection" aria-live="polite">{source.categories[segment[0]]} – {source.categories[segment[1]]}</output>}
    {loading && <span className="line-detail-loading-label" aria-hidden="true">{skeleton ? "Loading sessions" : "Loading revenue"}</span>}
    {active !== null && (entries.length > 0 || activeEvents.length > 0) && <div ref={tooltip} className="line-detail-tooltip" style={variant === "line-markers" ? { left: activeX + 16, top } : { left: tipLeft ? undefined : activeX + 13, right: tipLeft ? width - activeX + 13 : undefined, top: tipTop }}>
      <CartesianReadout label={lineDateLabel(labelDate)} entries={entries}>
        <LineEventReadout events={activeEvents} />
      </CartesianReadout>
    </div>}
  </div>;
}

export function LineDetail(props: PlotProps) {
  const { variant, compact, theme } = props;
  const data = props.fixture && variant === "line-band-range" ? referenceLineFixture(variant) ?? props.data : props.data;
  const [fill, setFill] = useState<Fill>("gradient");
  const [trend, setTrend] = useState<Trend>("dashed");
  const [range, setRange] = useState<typeof rangeChoices[number]["value"]>("90");
  const [activeSeries, setActiveSeries] = useState<number>();
  const [loading, setLoading] = useState(true);
  const legend = variant === "line-legend";
  const profitLegend = variant === "line-profit-loss-legend";
  const rangesLegend = variant === "line-band-ranges";
  const series = data.series.map((series, index) => ({ ...series, color: series.color ?? theme.colors[index % theme.colors.length] }));
  const renderPlot = (mode: Fill, fills = false) => <LinePlot {...props} data={data} key={`${variant}-${range}`}
    fill={mode} trend={trend} activeSeries={activeSeries} loading={variant === "line-loading-placeholder" || variant === "line-loading" && loading} range={Number(range)} fills={fills} />;

  return <div className="line-detail" data-line-detail={variant} data-compact={compact}>
    {!compact && <>
      {variant === "line-band-fill" && <div className="line-detail-controls"><span>Band fill</span><Choices label="Band fill" className="cartesian-choice-group" options={fillChoices} value={fill} onChange={setFill} /></div>}
      {variant === "line-trend" && <div className="line-detail-controls"><Choices label="Trend style" className="cartesian-choice-group" options={trendChoices} value={trend} onChange={setTrend} /></div>}
      {variant === "line-time-range" && <div className="line-detail-controls"><Choices label="Time range" className="cartesian-choice-group" options={rangeChoices} value={range} onChange={setRange} /></div>}
      {variant === "line-loading" && <div className="line-detail-controls"><LineLoadToggle loading={loading} onChange={setLoading} /></div>}
    </>}
    {variant === "line-deadline-fills"
      ? <div className="line-detail-fill-grid">{(["pattern", "gradient", "solid"] as const).map(mode => <figure key={mode}>
        <figcaption>{mode}</figcaption>{renderPlot(mode, true)}
      </figure>)}</div>
      : <div className="line-detail-body" data-legend={legend && !compact}>
        {renderPlot(variant === "line-deadline" ? "pattern" : fill)}
        {legend && !compact && <LineLegend series={series} currency={false} title="Sessions" active={activeSeries} onActive={setActiveSeries} />}
      </div>}
    {!compact && profitLegend && <div className="line-detail-key" aria-label="Profit and loss legend">
      {[{ label: "Profit", color: positive }, { label: "Loss", color: negative }].map(({ label, color }, index) =>
        <Button type="button" key={label} onPointerEnter={() => setActiveSeries(index)} onPointerLeave={() => setActiveSeries(undefined)}
          onFocus={() => setActiveSeries(index)} onBlur={() => setActiveSeries(undefined)}><i style={{ background: color }} />{label}</Button>)}
    </div>}
    {!compact && rangesLegend && <div className="line-detail-key">{series.map((series, index) => <span key={index}>
      <i style={{ background: theme.colors[index === 1 ? 2 : index] }} />{series.name}
    </span>)}</div>}
  </div>;
}
