import { area, curveMonotoneX, line } from "d3-shape";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartData } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { datePillColumns, RolledAxisPill } from "../RolledAxisPill";
import { CartesianFocusPoint, CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { lineDateLabel } from "./line-format";
import type { ChartTheme } from "./options";
import { areaOverlayModel, detailedAreas, overlayPosition, overlayTicks, type AreaOverlayVariant, type OverlayModel } from "./area-overlay-data";
import "./area-detail.css";

export { detailedAreas } from "./area-overlay-data";
type Point = { x: number; y: number; value: number };
type Props = { variant: AreaOverlayVariant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme; input?: ChartData };
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const callerNumber = new Intl.NumberFormat("en", { maximumSignificantDigits: 15 });
const scientificNumber = new Intl.NumberFormat("en", { notation: "scientific", maximumSignificantDigits: 15 });
const callerValue = (value: number) => (Math.abs(value) >= 1e12 || value !== 0 && Math.abs(value) < 1e-6 ? scientificNumber : callerNumber).format(value);

function trendPath(points: Point[], yAt: (value: number) => number, pixels = false, bounds?: readonly [number, number]) {
  if (points.length < 2) return undefined;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const value = (point: Point) => pixels ? point.y : point.value;
  const meanY = points.reduce((sum, point) => sum + value(point), 0) / points.length;
  const variance = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (value(point) - meanY), 0);
  if (!variance) return undefined;
  const y = (x: number) => pixels ? meanY + (x - meanX) * covariance / variance : yAt(meanY + (x - meanX) * covariance / variance);
  const start = bounds?.[0] ?? points[0].x;
  const end = bounds?.[1] ?? points[points.length - 1].x;
  return `M${start},${y(start)}L${end},${y(end)}`;
}

export function AreaDetail(props: Props) {
  const model = useMemo(() => areaOverlayModel(props.variant, props.data, props.input), [props.variant, props.data, props.input]);
  if (!model.categories.length || !model.series.some(series => series.values.some(value => value !== null && Number.isFinite(value)))) {
    return <div className="chart-render-message" role="status">No area data</div>;
  }
  return <AreaDetailChart {...props} model={model} />;
}

function AreaDetailChart({ variant, label, compact, theme, input, model }: Props & { model: OverlayModel }) {
  const demo = !input;
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const tip = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const pointerIndex = useRef<number | null>(null);
  const keyboardIndex = useRef<number | null>(null);
  const releasedTouch = useRef(false);
  const [tipWidth, setTipWidth] = useState(0);
  useLayoutEffect(() => {
    const panel = tip.current;
    if (!panel) return;
    setTipWidth(panel.offsetWidth);
  }, [selected, compact, model]);
  useLayoutEffect(() => {
    const panel = tip.current;
    if (!panel) return;
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => setTipWidth(panel.offsetWidth));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [compact]);

  const { minimum, maximum } = model;
  const left = Math.min(compact ? 15 : 40, width / 4);
  const right = Math.max(left + 1, width - left);
  const top = Math.min(compact ? 13 : 40, height / 3);
  const bottom = Math.max(top + 1, height - (compact ? 22 : top));
  const yAt = (value: number) => demo ? bottom - value / maximum * (bottom - top) : overlayPosition(value, minimum, maximum, bottom, top);
  const count = model.categories.length;
  const calendarDates = model.dates?.every((date): date is string => date !== undefined) ? model.dates : undefined;
  const points = model.categories.map((category, index) => {
    const x = count === 1 ? (left + right) / 2 : model.times
      ? left + (model.times[index] - model.times[0]) / (model.times[count - 1] - model.times[0]) * (right - left)
      : left + index / (count - 1) * (right - left);
    return { x, category, date: model.dates?.[index], index };
  });
  const forecast = variant === "area-forecast";
  const trend = variant === "area-trend";
  const targetBand = variant === "area-reference-band";
  const launchWeek = variant === "area-reference-range";
  const tickFadeRadius = targetBand || launchWeek ? 56 : 50;
  const tickCount = Math.min(count, width < 340 ? 3 : 5);
  const xTicks = demo ? width < 340 && (targetBand || launchWeek) ? [0, 15, 30] : detailedAreas[variant].ticks
    : [...new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index / Math.max(1, tickCount - 1) * (count - 1))))];
  const series = model.series.map((item, index) => {
    const color = !demo && item.color ? item.color : `var(--chart-${demo && trend ? 2 : index + 1}, ${theme.colors[demo && trend ? 1 : index % theme.colors.length]})`;
    const positions = points.map((point, at): Point | null => {
      const value = item.values[at];
      return value === null || value === undefined || !Number.isFinite(value) ? null : { x: point.x, y: yAt(value), value };
    });
    return { ...item, color, positions, gradient: index === 0 ? `${id}-fill` : `${id}-fill-${index}`, trendGradient: index === 0 ? `${id}-trend` : `${id}-trend-${index}` };
  });
  const color = series[0].color;
  const axisColor = `var(--muted-foreground, ${theme.muted})`;
  const gridColor = `var(--border, ${theme.grid})`;
  const ticksY = overlayTicks(model);
  const strokePath = line<Point | null>().defined((point): point is Point => point !== null).x(point => point!.x).y(point => point!.y).curve(curveMonotoneX);
  const fillPath = area<Point | null>().defined((point): point is Point => point !== null).x(point => point!.x).y0(demo ? bottom : yAt(0)).y1(point => point!.y).curve(curveMonotoneX);
  const active = selected === null || compact ? undefined : points[selected];
  const focusBottom = Math.round(bottom);
  const focusY = (value: number) => demo ? focusBottom - value / maximum * (focusBottom - top) : yAt(value);
  const pillX = active ? Math.round(active.x) : 0;
  const activeIndex = Math.max(0, Math.min(count - 1, selected ?? 0));
  const highlightLeft = points[Math.max(0, activeIndex - 1)].x;
  const highlightRight = points[Math.min(points.length - 1, activeIndex + 1)].x;
  const middle = (left + right) / 2;
  const refLeft = launchWeek && model.range ? points[model.range[0]].x : left;
  const refRight = launchWeek && model.range ? points[model.range[1]].x : right;
  const refTop = targetBand ? yAt(model.band[1]) : top;
  const refBottom = targetBand ? yAt(model.band[0]) : bottom;
  const panelX = active ? Math.max(4, active.x + tipWidth + 16 > width ? active.x - tipWidth - 16 : active.x + 16) : undefined;
  useEffect(() => {
    if (pointerIndex.current !== null && pointerIndex.current >= count) pointerIndex.current = null;
    if (keyboardIndex.current !== null && keyboardIndex.current >= count) keyboardIndex.current = null;
    setSelected(current => current !== null && current >= count ? null : current);
  }, [count]);
  useEffect(() => { if (compact) clearInspection(); }, [compact]);

  function clearInspection() {
    releasedTouch.current = false;
    pointerIndex.current = null;
    keyboardIndex.current = null;
    setSelected(null);
  }

  function inspect(event: Pick<PointerEvent<SVGSVGElement>, "currentTarget" | "clientX" | "clientY">) {
    if (compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * width;
    const y = (event.clientY - bounds.top) / bounds.height * height;
    if (x < left - 3 || x > right + 3 || y < top || y > bottom) {
      pointerIndex.current = null;
      setSelected(keyboardIndex.current);
      return;
    }
    const index = points.reduce((nearest, point, index) => Math.abs(point.x - x) < Math.abs(points[nearest].x - x) ? index : nearest, 0);
    pointerIndex.current = index;
    setSelected(index);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (compact) return;
    const last = points.length - 1;
    const previous = Math.max(0, Math.min(last, (selected ?? last + 1) - 1));
    const next = Math.max(0, Math.min(last, (selected ?? -1) + 1));
    const index = { Home: 0, End: last, ArrowLeft: previous, ArrowRight: next, ArrowUp: previous, ArrowDown: next }[event.key];
    if (index !== undefined) {
      event.preventDefault();
      releasedTouch.current = false;
      keyboardIndex.current = index;
      setSelected(index);
    }
  }

  return <div className="cartesian-area-detail" data-area-detail={variant} ref={plot} style={{
    "--area-plot-inset": `${left}px`,
    "--chart-axis-pill-background": `var(--chart-focus-pill, ${theme.text})`,
    "--chart-axis-pill-foreground": `var(--chart-focus-pill-text, ${theme.surface})`,
  } as CSSProperties}>
    {width > 0 && height > 0 && <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-roledescription="chart" aria-label={label} aria-describedby={compact ? undefined : `${id}-instructions`} tabIndex={compact ? undefined : 0}
      onPointerMove={event => { if (event.pointerType !== "touch") releasedTouch.current = false; inspect(event); }} onPointerDown={event => {
        if (compact) return;
        releasedTouch.current = false;
        if (event.pointerType === "mouse") { event.preventDefault(); clearInspection(); }
        else {
          keyboardIndex.current = null;
          inspect(event);
          if (document.activeElement === event.currentTarget) keyboardIndex.current = pointerIndex.current;
        }
      }} onPointerLeave={event => { if (event.pointerType !== "touch") { pointerIndex.current = null; setSelected(keyboardIndex.current); } }}
      onMouseDown={event => { if (!compact) event.preventDefault(); }}
      onPointerUp={event => { if (event.pointerType === "touch") {
        pointerIndex.current = null;
        if (document.activeElement !== event.currentTarget) keyboardIndex.current = null;
        setSelected(null);
        releasedTouch.current = true;
      } }}
      onClick={event => {
        const afterTouch = releasedTouch.current;
        releasedTouch.current = false;
        const kind = "pointerType" in event.nativeEvent ? event.nativeEvent.pointerType : undefined;
        // Engines can deliver a compatibility mouse click after releasing touch.
        if (!compact && afterTouch) {
          // A focused touch keeps its start row even when a small move still clicks.
          if (document.activeElement === event.currentTarget) setSelected(keyboardIndex.current);
          else if (kind !== "touch") inspect(event);
        }
        if (!compact && kind === "touch") event.stopPropagation();
      }}
      onPointerCancel={clearInspection} onBlur={() => {
        keyboardIndex.current = null;
        setSelected(pointerIndex.current);
      }} onFocus={() => { if (!compact) setSelected(pointerIndex.current ?? 0); }} onKeyDown={onKeyDown}>
      {!compact && <desc id={`${id}-instructions`}>Use the arrow keys to inspect {calendarDates ? "dates" : "points"}. Home and End jump to the first and last {calendarDates ? "dates" : "points"}.</desc>}
      <defs>
        {series.map(item => <linearGradient key={item.gradient} id={item.gradient} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0" stopColor={item.color} stopOpacity={trend ? .3 : .4} /><stop offset="1" stopColor={item.color} stopOpacity="0" />
        </linearGradient>)}
        <linearGradient id={`${id}-guide`} x1="0%" x2="0%" y1="0%" y2="100%">
          {[0, .1, .5, .9, 1].map(offset => <stop key={offset} offset={offset} stopColor={axisColor} stopOpacity={offset === 0 || offset === 1 ? 0 : .8} />)}
        </linearGradient>
        {trend && series.map(item => <linearGradient key={item.trendGradient} id={item.trendGradient} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0" stopColor={`var(--chart-3, ${theme.colors[2]})`} stopOpacity="0" />
          {[15, 85].map(weight => <stop key={weight} offset={`${weight}%`}
            stopColor={`color-mix(in srgb, ${demo ? `var(--chart-1, ${theme.colors[0]})` : item.color} ${weight}%, var(--chart-3, ${theme.colors[2]}))`} />)}
          <stop offset="1" stopColor={demo ? `var(--chart-1, ${theme.colors[0]})` : item.color} stopOpacity="0" />
        </linearGradient>)}
        <clipPath id={`${id}-highlight`}><rect data-area-highlight="" x={highlightLeft} y={top - 2} width={highlightRight - highlightLeft} height={bottom - top + 4} /></clipPath>
        {!demo && <clipPath id={`${id}-bounds`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>}
      </defs>
      <g aria-hidden="true" className="cartesian-area-detail-fade" data-area-grid="">
        {ticksY.map(value => <line key={value} x1={left} x2={right} y1={yAt(value)} y2={yAt(value)} stroke={gridColor} strokeDasharray="4 4" />)}
      </g>
      {(targetBand || launchWeek && model.range) && <g aria-hidden="true" className={compact ? undefined : "cartesian-area-detail-overlay-reveal"}>
        <g className={targetBand ? "cartesian-area-detail-fade" : undefined}>
          <rect data-area-reference="" x={refLeft} y={refTop} width={refRight - refLeft} height={refBottom - refTop} fill="color-mix(in oklch, var(--area-reference-color) 12%, transparent)" />
        </g>
        {[refTop, refBottom].map((y, index) => <line key={index} data-area-rule="" className={targetBand ? "cartesian-area-detail-fade" : undefined}
          x1={refLeft} x2={refRight} y1={y} y2={y} fill="none" stroke="var(--area-reference-color)" strokeDasharray={targetBand ? "4 4" : undefined} />)}
        {targetBand && <>
          <path data-area-reference-marker="" d={`M${middle - 3},${refTop}h6l-3,6Z`} fill={color} />
          <path data-area-reference-marker="" d={`M${middle - 3},${refBottom}h6l-3,-6Z`} fill={color} />
        </>}
      </g>}
      <g aria-hidden="true">
        {series.map((item, index) => {
          const actual = strokePath(forecast ? item.positions.slice(0, model.forecastSplit + 1) : item.positions) ?? undefined;
          const projected = forecast ? strokePath(item.positions.slice(model.forecastSplit)) ?? undefined : undefined;
          return <g key={index} data-area-series={item.name}>
        <g className={compact ? undefined : "cartesian-area-detail-reveal"}>
          <path data-area-fill="" d={fillPath(item.positions) ?? undefined} fill={`url(#${item.gradient})`} opacity={active ? .6 : 1} />
          <g fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path data-area-actual="" d={actual} opacity={active ? .6 : 1} />
            {projected && <path data-area-projection="" d={projected} strokeDasharray="6 4" opacity={active ? .6 : 1} />}
            <path data-area-highlight-line="" d={actual} clipPath={`url(#${id}-highlight)`} opacity={active ? 1 : 0} />
          </g>
          {trend && <path data-area-trend="" className={compact ? undefined : "cartesian-area-detail-overlay-reveal"}
            d={trendPath(item.positions.filter((point): point is Point => point !== null), yAt, !demo, demo ? undefined : [left, right])}
            clipPath={demo ? undefined : `url(#${id}-bounds)`} fill="none" stroke={`url(#${item.trendGradient})`} strokeWidth="2.5" strokeLinecap="round" />}
        </g>
        {forecast && item.positions.map((point, index) => point && <g key={index} data-area-forecast-marker="" data-dimmed={active ? "" : undefined} opacity={active ? .5 : 1}>
          <g className={compact ? undefined : "cartesian-area-detail-marker-reveal"}
            style={{ "--area-marker-delay": `${1100 * Number((index / points.length).toFixed(4))}ms` } as CSSProperties}>
            <circle cx={point.x} cy={point.y} r="8" fill="none" stroke={item.color} strokeWidth="2" />
            <circle cx={point.x} cy={point.y} r="5" fill={item.color} />
          </g>
        </g>)}
        </g>;
        })}
        <g fill={axisColor} fontSize={compact ? 9 : 12}>
          {xTicks.map(index => {
            const point = points[index];
            const distance = active ? Math.abs(point.x - Math.round(active.x * 10) / 10) : Infinity;
            return <text key={index} data-area-tick="" x={point.x} y={bottom + (compact ? 14 : 24)} textAnchor="middle"
              opacity={Math.min(1, Math.max(0, (distance - tickFadeRadius) / 20))}>{demo && trend && point.date ? day.format(new Date(point.date)) : point.category}</text>;
          })}
          {targetBand && !compact && ticksY.map(value => <text key={value} x={left - 4} y={yAt(value)} dominantBaseline="middle" textAnchor="end">{demo ? value : callerValue(value)}</text>)}
        </g>
        {active && <>
          <rect data-area-guide="" x={active.x - .5} y={top} width={1} height={Math.round(bottom - top)} fill={`url(#${id}-guide)`} pointerEvents="none" />
          {series.map((item, index) => {
            const point = item.positions[active.index];
            return point && <g key={index} data-area-focus-series={item.name}>
              {forecast && <g data-area-forecast-focus="">
                <circle cx={active.x} cy={focusY(point.value)} r="6.75" fill={item.color} />
                <circle cx={active.x} cy={focusY(point.value)} r="10.8" fill="none" stroke={item.color} strokeWidth="2.7" />
              </g>}
              <CartesianFocusPoint x={active.x} y={focusY(point.value)} color={item.color} />
            </g>;
          })}
        </>}
      </g>
    </svg>}
    {active && <RolledAxisPill className="cartesian-area-detail-pill" columns={calendarDates ? datePillColumns(calendarDates.map(date => new Date(date))) : [model.categories]}
      index={active.index} x={pillX} y={focusBottom + 4} />}
    {!compact && <div className="cartesian-area-detail-panel" ref={tip} role="status" style={{ left: panelX, top }}>
      {active && <CartesianReadout label={active.date ? lineDateLabel(active.date) : active.category} entries={series.map(item => ({ name: item.name,
        value: item.values[active.index] === null ? "—" : demo ? item.values[active.index]! : callerValue(item.values[active.index]!), color: item.color }))} live={false} />}
    </div>}
  </div>;
}
