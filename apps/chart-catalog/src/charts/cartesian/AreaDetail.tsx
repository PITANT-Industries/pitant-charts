import { area, curveMonotoneX, line } from "d3-shape";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { lineDateLabel } from "./line-format";
import type { ChartTheme } from "./options";
import "./area-detail.css";

export const detailedAreas = {
  "area-forecast": { maximum: 90_000, step: 20_000, ticks: [0, 3, 6, 9, 11] },
  "area-reference-band": { maximum: 350, step: 50, ticks: [0, 10, 20, 30] },
  "area-reference-range": { maximum: 4000, step: 1000, ticks: [0, 10, 20, 30] },
  "area-trend": { maximum: 450, step: 100, ticks: [0, 3, 6, 9] },
} as const;

type Variant = keyof typeof detailedAreas;
type Point = { x: number; y: number; value: number; date: string; category: string };
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function demoDate(date: string) {
  // These demo dates are local calendar days, including any daylight-saving changes.
  const utc = new Date(date);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()).valueOf();
}

function trendPath(points: Point[], yAt: (value: number) => number) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const variance = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.value - meanY), 0);
  const y = (x: number) => yAt(meanY + (x - meanX) * covariance / variance);
  const start = points[0].x;
  const end = points[points.length - 1].x;
  return `M${start},${y(start)}L${end},${y(end)}`;
}

export function AreaDetail({ variant, label, data, compact, theme }: {
  variant: Variant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const tip = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tipWidth, setTipWidth] = useState(0);
  useEffect(() => {
    const panel = tip.current;
    if (!panel) return;
    setTipWidth(panel.offsetWidth);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => setTipWidth(panel.offsetWidth));
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const { maximum, step, ticks } = detailedAreas[variant];
  const left = Math.min(compact ? 15 : 40, width / 4);
  const right = Math.max(left + 1, width - left);
  const top = Math.min(compact ? 13 : 40, height / 3);
  const bottom = Math.max(top + 1, height - (compact ? 22 : top));
  const yAt = (value: number) => bottom - value / maximum * (bottom - top);
  const series = data.series[0];
  const dates = data.rows!.map(row => String(row.date));
  const times = dates.map(demoDate);
  const extent = times[times.length - 1] - times[0];
  const points = dates.map((date, index): Point => {
    const value = series.values[index]!;
    const x = left + (times[index] - times[0]) / extent * (right - left);
    return { x, y: yAt(value), value, date, category: data.categories[index] };
  });
  const forecast = variant === "area-forecast";
  const trend = variant === "area-trend";
  const targetBand = variant === "area-reference-band";
  const launchWeek = variant === "area-reference-range";
  const xTicks = width < 340 && (targetBand || launchWeek) ? [0, 15, 30] : ticks;
  const color = theme.colors[trend ? 1 : 0];
  const ticksY = Array.from({ length: Math.floor(maximum / step) + 1 }, (_, index) => index * step);
  const strokePath = line<Point>().x(point => point.x).y(point => point.y).curve(curveMonotoneX);
  const fillPath = area<Point>().x(point => point.x).y0(bottom).y1(point => point.y).curve(curveMonotoneX)(points) ?? undefined;
  const actual = strokePath(forecast ? points.slice(0, 9) : points) ?? undefined;
  const projected = forecast ? strokePath(points.slice(8)) ?? undefined : undefined;
  const active = selected === null ? undefined : points[selected];
  const activeLabel = active ? day.format(new Date(active.date)) : "";
  const pillWidth = forecast || trend ? 70.5 : 74.4;
  const pillX = active ? Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, Math.round(active.x))) : 0;
  const activeIndex = selected ?? 0;
  const highlightLeft = points[Math.max(0, activeIndex - 1)].x;
  const highlightRight = points[Math.min(points.length - 1, activeIndex + 1)].x;
  const middle = (left + right) / 2;
  const refLeft = launchWeek ? points[11].x : left;
  const refRight = launchWeek ? points[17].x : right;
  const refTop = targetBand ? yAt(240) : top;
  const refBottom = targetBand ? yAt(180) : bottom;
  const panelX = active ? Math.max(4, Math.min(width - tipWidth - 4, active.x + tipWidth + 16 > width ? active.x - tipWidth - 16 : active.x + 16)) : undefined;

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left - 3 || x > right + 3 || y < top || y > bottom) {
      setSelected(null);
      return;
    }
    setSelected(points.reduce((nearest, point, index) => Math.abs(point.x - x) < Math.abs(points[nearest].x - x) ? index : nearest, 0));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (compact) return;
    if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const last = points.length - 1;
    const previous = Math.max(0, (selected ?? last + 1) - 1);
    const next = Math.min(last, (selected ?? -1) + 1);
    const index = { Home: 0, End: last, ArrowLeft: previous, ArrowRight: next, ArrowUp: previous, ArrowDown: next }[event.key];
    if (index !== undefined) {
      event.preventDefault();
      setSelected(index);
    }
  }

  return <div className="cartesian-area-detail" data-area-detail={variant} ref={plot} style={{ "--area-plot-inset": `${left}px` } as CSSProperties}>
    {width > 0 && height > 0 && <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-roledescription="chart" aria-label={label} aria-describedby={compact ? undefined : `${id}-instructions`} tabIndex={compact ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
      onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)} onKeyDown={onKeyDown}>
      {!compact && <desc id={`${id}-instructions`}>Use the arrow keys to inspect dates. Home and End jump to the first and last dates. Escape clears the selection.</desc>}
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={trend ? .3 : .4} /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-guide`} x1="0" x2="0" y1="0" y2="1">
          {[0, .1, .9, 1].map(offset => <stop key={offset} offset={offset} stopColor={theme.muted} stopOpacity={offset === 0 || offset === 1 ? 0 : .8} />)}
        </linearGradient>
        {trend && <linearGradient id={`${id}-trend`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={theme.colors[2]} stopOpacity="0" />
          <stop offset=".15" stopColor={`color-mix(in srgb, ${theme.colors[0]} 15%, ${theme.colors[2]})`} />
          <stop offset=".85" stopColor={`color-mix(in srgb, ${theme.colors[0]} 85%, ${theme.colors[2]})`} />
          <stop offset="1" stopColor={theme.colors[0]} stopOpacity="0" />
        </linearGradient>}
        {active && <clipPath id={`${id}-highlight`}><rect data-area-highlight="" x={highlightLeft} y={top} width={highlightRight - highlightLeft} height={bottom - top} /></clipPath>}
      </defs>
      <g aria-hidden="true" className="cartesian-area-detail-fade" data-area-grid="">
        {ticksY.map(value => <line key={value} x1={left} x2={right} y1={yAt(value)} y2={yAt(value)} stroke={theme.grid} strokeDasharray="4 4" />)}
      </g>
      {(targetBand || launchWeek) && <g aria-hidden="true">
        <g className={targetBand ? "cartesian-area-detail-fade" : undefined}>
          <rect data-area-reference="" x={refLeft} y={refTop} width={refRight - refLeft} height={refBottom - refTop} fill="var(--area-reference-color)" fillOpacity=".12" />
          {[refTop, refBottom].map(y => <line key={y} data-area-rule="" x1={refLeft} x2={refRight} y1={y} y2={y} stroke="var(--area-reference-color)" strokeDasharray={targetBand ? "4 4" : undefined} />)}
        </g>
        {targetBand && <>
          <path data-area-reference-marker="" d={`M${middle - 3},${refTop}h6l-3,6Z`} fill={color} />
          <path data-area-reference-marker="" d={`M${middle - 3},${refBottom}h6l-3,-6Z`} fill={color} />
        </>}
      </g>}
      <g aria-hidden="true">
        {active && <rect data-area-guide="" x={active.x - .5} y={top} width={1} height={bottom - top} fill={`url(#${id}-guide)`} />}
        <g className={compact ? undefined : "cartesian-area-detail-reveal"}>
          <path data-area-fill="" d={fillPath} fill={`url(#${id}-fill)`} opacity={active ? .6 : 1} />
          <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path data-area-actual="" d={actual} opacity={active ? .6 : 1} />
            {projected && <path data-area-projection="" d={projected} strokeDasharray="6 4" opacity={active ? .6 : 1} />}
            {active && <path d={actual} clipPath={`url(#${id}-highlight)`} />}
          </g>
          {trend && <path data-area-trend="" d={trendPath(points, yAt)} fill="none" stroke={`url(#${id}-trend)`} strokeWidth="2.5" strokeLinecap="round" />}
        </g>
        {forecast && points.map((point, index) => <g key={point.date} data-area-forecast-marker="" opacity={active ? .5 : 1}>
          <g className={compact ? undefined : "cartesian-area-detail-marker-reveal"} style={{ animationDelay: `${1100 * index / points.length}ms` }}>
            <circle cx={point.x} cy={point.y} r="8" fill="none" stroke={color} strokeWidth="2" />
            <circle cx={point.x} cy={point.y} r="5" fill={color} />
          </g>
        </g>)}
        <g fill={theme.muted} fontSize={compact ? 9 : 12}>
          {xTicks.map(index => {
            const point = points[index];
            return <text key={index} data-area-tick="" x={point.x} y={bottom + (compact ? 14 : 24)} textAnchor="middle"
              opacity={active && Math.abs(point.x - pillX) < pillWidth / 2 + 18 ? 0 : 1}>{trend ? day.format(new Date(point.date)) : point.category}</text>;
          })}
          {targetBand && !compact && ticksY.map(value => <text key={value} x={left - 4} y={yAt(value)} dominantBaseline="middle" textAnchor="end">{value}</text>)}
        </g>
        {active && <>
          <CartesianFocusPoint x={active.x} y={active.y} color={color} />
          {forecast && <g data-area-forecast-focus="">
            <circle cx={active.x} cy={active.y} r="10.8" fill="none" stroke={color} strokeWidth="2.7" />
            <circle cx={active.x} cy={active.y} r="6.75" fill={color} />
          </g>}
          <CartesianDatePill x={pillX} y={bottom + 4} label={activeLabel} text={theme.text} surface={theme.surface} width={pillWidth} />
        </>}
      </g>
    </svg>}
    {!compact && <div className="cartesian-area-detail-panel" ref={tip} role="status" style={{ left: panelX, top }}>
      {active && <CartesianReadout label={lineDateLabel(active.date)} entries={[{ name: series.name, value: active.value, color }]} live={false} />}
    </div>}
  </div>;
}
