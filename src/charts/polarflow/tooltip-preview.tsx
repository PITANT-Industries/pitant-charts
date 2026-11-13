import { area as areaPath, curveMonotoneX, line as linePath } from "d3-shape";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { Controls, dollars, number, seriesData, tone, type Props } from "./shared";
import { tooltipFixtures } from "./tooltip-fixtures";
import styles from "./styles.module.css";
import tooltipStyles from './tooltip-preview.module.css';

const indicatorWidths = [1, 2, 4, 8];
const tooltipDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const contentDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const headerDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' });
const changePercent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' });
const fixedAxis: Record<string, { max: number; step: number }> = {
  'tooltip-standard': { max: 4000, step: 1000 }, 'tooltip-crosshair': { max: 350, step: 50 },
  'tooltip-indicator': { max: 5000, step: 1000 }, 'tooltip-motion': { max: 900, step: 200 },
  'tooltip-rows': { max: 9000, step: 2000 }, 'tooltip-content': { max: 20000, step: 5000 },
  'tooltip-pinned': { max: 22000, step: 5000 }, 'tooltip-ring': { max: 3000, step: 500 },
  'tooltip-header': { max: 200, step: 50 }, 'tooltip-horizontal-crosshair': { max: 200, step: 50 },
  'tooltip-custom-indicator': { max: 70000, step: 10000 },
};

function finiteValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rangeTicks(min: number, max: number, step: number) {
  const start = Math.ceil(min / step) * step;
  return Array.from({ length: Math.max(0, Math.floor((max - start) / step + 1e-8) + 1) }, (_, index) => start + index * step);
}

export function TooltipPreview({ example, compact, data, renderTooltip }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const uid = useId();
  const graph = useRef<SVGSVGElement>(null);
  const chartHost = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 728, height: 364 });
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState<number | null>(compact ? 4 : null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [heightAtPointer, setPointerHeight] = useState<number | null>(null);
  const [mode, setMode] = useState(example.id === 'tooltip-indicator' ? 2 : 0);
  const header = id === "tooltip-header";
  const content = id === "tooltip-content";
  const ring = id === "tooltip-ring";
  const horizontal = id === "tooltip-horizontal-crosshair";
  const dashed = id === "tooltip-crosshair";
  const styled = id === "tooltip-indicator";
  const custom = id === "tooltip-custom-indicator";
  const panelMotion = id === "tooltip-motion";
  const pinEnabled = id === "tooltip-pinned";
  const fixture = tooltipFixtures[id] ?? tooltipFixtures['tooltip-standard'];
  const { categories, series } = seriesData(data, fixture.categories, fixture.series);
  const pad = compact ? 15 : width < 430 ? 27 : 40;
  const plot = { left: pad + (horizontal ? 16 : pinEnabled ? 8 : 0), right: Math.max(pad + 45, width - pad), top: compact ? 12 : height < 290 ? 24 : 40, bottom: Math.max(48, height - (compact ? 23 : 40)) };
  const limit = Math.max(1, categories.length);
  const step = (plot.right - plot.left) / Math.max(1, limit - 1);
  const barStep = (plot.right - plot.left) / limit;
  const customStep = (plot.right - plot.left) / (limit + .2);
  const bars = ring || custom;
  const area = ['tooltip-standard', 'tooltip-content', 'tooltip-pinned', 'tooltip-header'].includes(id);
  const tradingDates = !data && (header || horizontal) ? fixture.dates : undefined;
  const tradingSpan = tradingDates ? +tradingDates[tradingDates.length - 1] - +tradingDates[0] : 0;
  const x = (index: number) => plot.left + (custom ? customStep * (index + .6)
    : ring ? barStep * (index + .5)
    : tradingDates ? (+tradingDates[index] - +tradingDates[0]) / tradingSpan * (plot.right - plot.left)
    : limit === 1 ? (plot.right - plot.left) / 2 : step * index);
  const totals = pinEnabled ? categories.map((_, index) => series.reduce((sum, row) => sum + (finiteValue(row.values[index]) ?? 0), 0)) : undefined;
  const values = totals ?? series.flatMap(row => row.values.filter((value): value is number => value !== null && Number.isFinite(value)));
  const fixtureAxis = data ? undefined : fixedAxis[id];
  const min = values.reduce((low, value) => Math.min(low, value), 0);
  const max = fixtureAxis?.max ?? values.reduce((high, value) => Math.max(high, value), min + 1);
  const range = max - min;
  const y = (value: number) => plot.bottom - (value - min) / range * (plot.bottom - plot.top);
  const selected = pinned ?? active;
  const index = selected === null || !categories.length ? null : Math.min(limit - 1, Math.max(0, selected));
  const pointX = index === null ? 0 : x(index);
  const first = series[0];
  const close = index === null ? 0 : finiteValue(first?.values[index]) ?? 0;
  const previous = index === null ? close : finiteValue(first?.values[Math.max(0, index - 1)]) ?? close;
  const change = close - previous;
  const crossY = horizontal && heightAtPointer !== null ? Math.max(plot.top, Math.min(plot.bottom, heightAtPointer)) : y(close);
  const crossValue = min + (plot.bottom - crossY) / (plot.bottom - plot.top) * range;
  const date = index === null || data ? undefined : fixture?.dates?.[index];
  const panelLabel = date ? (content || pinEnabled ? contentDate : header ? headerDate : tooltipDate).format(date) : categories[index ?? 0];
  const pinnedTotal = index === null ? 0 : totals?.[index] ?? 0;
  const datePill = !dashed;
  useEffect(() => {
    const host = chartHost.current;
    if (!host) return;
    const measure = () => {
      const width = Math.max(96, host.clientWidth);
      const height = Math.max(88, host.clientHeight);
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const svg = graph.current;
    const tip = panel.current;
    const host = svg?.parentElement;
    if (index === null || !svg || !tip || !host) return;
    const place = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(pointX, plot.top).matrixTransform(matrix);
      const bounds = host.getBoundingClientRect();
      const tipWidth = tip.offsetWidth;
      const right = point.x - bounds.left + 16;
      const left = right + tipWidth + 4 > bounds.width ? point.x - bounds.left - tipWidth - 16 : right;
      const next = { x: Math.max(4, Math.min(left, bounds.width - tipWidth - 4)), y: Math.max(4, Math.min(point.y - bounds.top, bounds.height - tip.offsetHeight - 4)) };
      setPanelPosition(previous => previous.x === next.x && previous.y === next.y ? previous : next);
    };
    place();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(place);
    observer.observe(host);
    observer.observe(tip);
    return () => observer.disconnect();
  }, [index, pointX, plot.top, pinned]);
  useEffect(() => {
    if (pinned === null) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        if (panel.current?.contains(document.activeElement)) graph.current?.focus();
        setPinned(null);
        setActive(null);
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [pinned]);
  function pointerPosition(event: PointerEvent<SVGSVGElement>) {
    const svg = graph.current;
    const inverse = svg?.getScreenCTM()?.inverse();
    if (!svg || !inverse) return null;
    const screen = svg.createSVGPoint();
    screen.x = event.clientX;
    screen.y = event.clientY;
    const point = screen.matrixTransform(inverse);
    if (point.x < plot.left - 4 || point.x > plot.right + 4 || point.y < plot.top - 4 || point.y > plot.bottom + 4) return null;
    const offset = point.x - plot.left;
    const position = tradingDates ? tradingDates.reduce((closest, _, index) => Math.abs(x(index) - point.x) < Math.abs(x(closest) - point.x) ? index : closest, 0)
      : custom ? Math.round(offset / customStep - .6)
      : ring ? Math.floor(offset / barStep) : Math.round(offset / step);
    return { position: Math.max(0, Math.min(limit - 1, position)), y: Math.max(plot.top, Math.min(plot.bottom, point.y)) };
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!categories.length || pinned !== null) return;
    const point = pointerPosition(event);
    setActive(point?.position ?? null);
    if (horizontal) setPointerHeight(point?.y ?? null);
  }
  function select(event: PointerEvent<SVGSVGElement>) {
    if (!categories.length || (!pinEnabled && event.pointerType !== "touch")) return;
    const point = pointerPosition(event);
    if (!point) {
      setPinned(null);
      setActive(null);
      return;
    }
    setActive(point.position);
    if (horizontal) setPointerHeight(point.y);
    if (pinEnabled) setPinned(pinned === point.position ? null : point.position);
  }
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (!categories.length) return;
    const current = index ?? 0;
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: limit - 1 }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setPinned(null);
      setActive(Math.max(0, Math.min(limit - 1, next)));
      setPointerHeight(null);
    }
    if (event.key === "Escape" && index !== null) { event.preventDefault(); setActive(null); setPinned(null); }
    if (pinEnabled && (event.key === "Enter" || event.key === " ") && index !== null) {
      event.preventDefault();
      setPinned(pinned === null ? index : null);
    }
  }
  const motion = panelMotion ? ["eased", "matched", "instant"][mode] : undefined;
  const displayedSeries = index === null ? [] : series.map((row, seriesIndex) => ({ name: row.name, value: finiteValue(row.values[index]), previousValue: index > 0 ? finiteValue(row.values[index - 1]) : null, color: tone(theme, seriesIndex, row.color) }));
  const users = displayedSeries[0]?.value;
  const pageviews = displayedSeries[1]?.value;
  const ratio = users && pageviews != null ? (pageviews / users).toFixed(1) : '—';
  const currencyAxis = pinEnabled || content;
  const ticks = fixtureAxis ? rangeTicks(min, max, fixtureAxis.step) : [0, .25, .5, .75, 1].map(amount => min + range * amount);
  const tickCount = bars ? limit : compact || width < 430 ? 4 : dashed ? 4 : header || horizontal ? 6 : 5;
  const tickIndices = [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round(i * (limit - 1) / Math.max(1, tickCount - 1))))];
  const pillWidth = compact ? 43 : (bars ? 63 : 75);
  const pillHeight = compact ? 17 : 32;
  const pillX = Math.max(pillWidth / 2 + 2, Math.min(width - pillWidth / 2 - 2, pointX));
  const markerRadius = compact ? 3 : styled ? 6 : 5;
  const strokeWidth = dashed || horizontal ? 2.5 : 2;
  const points = totals ? [{ name: 'Revenue', values: totals, color: series[0]?.color }] : series;
  const guide = `${uid}-guide`;
  const emphasis = `${uid}-focus`;
  const groupWidth = custom ? customStep * .8 : barStep * .727;
  const hoverWidth = groupWidth / Math.max(1, series.length);
  return <div className={styles.frame}>
    {!compact && styled && <Controls label="Tooltip indicator style" items={["Line", "Thin", "Medium", "Thick"]} value={mode} onChange={setMode} />}
    {!compact && panelMotion && <Controls label="Tooltip movement" items={["Eased", "Matched", "Instant"]} value={mode} onChange={setMode} />}
    <div className={styles.graph} ref={chartHost}>
      <svg ref={graph} className={styles.native} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title}
        tabIndex={compact ? undefined : 0} onPointerMove={move} onPointerLeave={(event) => { if (pinned === null && event.pointerType !== "touch") setActive(null); }}
        onPointerUp={select}
        onFocus={() => { if (active === null) setActive(0); }} onKeyDown={key}
        onBlur={() => { if (pinned === null) setActive(null); }}>
        <defs>
          {points.map((row, i) => <linearGradient key={i} id={`${uid}-area-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tone(theme, i, row.color)} stopOpacity=".3" /><stop offset="100%" stopColor={tone(theme, i, row.color)} stopOpacity="0" />
          </linearGradient>)}
          <linearGradient id={guide} x1="0%" x2="0%" y1="0%" y2="100%">
            {[0, .1, .9, 1].map((offset, i) => <stop key={offset} offset={offset} stopColor={styled ? tone(theme, 0) : theme.muted} stopOpacity={i === 0 || i === 3 ? 0 : 1} />)}
          </linearGradient>
          {index !== null && <clipPath id={emphasis}><rect x={Math.max(plot.left, pointX - 30)} y={plot.top - 2} width={Math.min(plot.right, pointX + 30) - Math.max(plot.left, pointX - 30)} height={plot.bottom - plot.top + 4} /></clipPath>}
        </defs>
        {ticks.map(value => <g key={value}>
          <line data-tooltip-grid="" x1={plot.left} x2={plot.right} y1={y(value)} y2={y(value)} stroke={theme.grid} strokeDasharray="4 4" />
          {(currencyAxis || horizontal) && <text x={plot.left - (horizontal ? 4 : 8)} y={y(value) - 1} fill={theme.muted} opacity={horizontal && index !== null && Math.abs(crossY - y(value)) < 20 ? .12 : 1} fontSize={compact ? 8 : 11} textAnchor="end">{currencyAxis && value !== 0 ? `$${Math.round(value / 1000)}k` : currencyAxis ? '$0' : Math.round(value)}</text>}
        </g>)}
        {tickIndices.map(position => categories[position] !== undefined && <text data-tooltip-tick="" key={position} x={x(position)} y={plot.bottom + (compact ? 14 : 24)} fill={theme.muted} opacity={index !== null && datePill && Math.abs(x(position) - pillX) < pillWidth / 2 + 10 ? 0 : 1} fontSize={compact ? 8 : 12} textAnchor="middle">{categories[position]}</text>)}
        {index !== null && !bars && !horizontal && <g data-tooltip-guide="" transform={`translate(${pointX} 0)`} style={panelMotion && mode === 1 ? { transform: `translateX(${pointX}px)` } : undefined} className={panelMotion && mode === 1 ? tooltipStyles.matchedGuide : undefined}>
          {dashed ? <line x1="0" x2="0" y1={plot.top} y2={plot.bottom} stroke={tone(theme, 1)} strokeDasharray="6 4" strokeWidth="1" />
            : <rect x={-(styled ? indicatorWidths[mode] : 1) / 2} y={plot.top} width={styled ? indicatorWidths[mode] : 1} height={plot.bottom - plot.top} fill={`url(#${guide})`} />}
        </g>}
        {[...points].reverse().map((row, reverse) => {
          const seriesIndex = points.length - 1 - reverse;
          const color = tone(theme, header ? 1 : seriesIndex, row.color);
          const samples = categories.map((_, i) => finiteValue(row.values[i]));
          if (bars) return <g key={seriesIndex}>{samples.map((value, pos) => {
            if (value === null) return null;
            const center = x(pos) + (seriesIndex - (series.length - 1) / 2) * (hoverWidth + 4);
            return <g key={pos}>
              <rect data-tooltip-bar="" x={center - hoverWidth / 2} y={Math.min(y(value), y(0))} width={hoverWidth} height={Math.abs(y(0) - y(value))} rx={Math.min(4, hoverWidth * .18)} fill={color} opacity={pos === index || index === null ? 1 : .3} />
              {ring && pos === index && <rect data-bar-ring="" x={center - hoverWidth / 2} y={y(value) - hoverWidth / 2} width={hoverWidth} height={hoverWidth} rx={hoverWidth / 4} fill="none" stroke={color} strokeWidth="2" />}
            </g>;
          })}</g>;
          const isDefined = (value: number | null) => value !== null && Number.isFinite(value);
          const valueY = (value: number | null) => y(value ?? 0);
          const trace = linePath<number | null>().defined(isDefined).x((_, i) => x(i)).y(valueY).curve(curveMonotoneX)(samples) ?? undefined;
          const fill = area && areaPath<number | null>().defined(isDefined).x((_, i) => x(i)).y0(y(0)).y1(valueY).curve(curveMonotoneX)(samples);
          return <g key={seriesIndex}>
            {fill && <path d={fill} fill={`url(#${uid}-area-${seriesIndex})`} />}
            <path data-tooltip-trace="" d={trace} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={index === null ? 1 : .52} />
            {index !== null && <path d={trace} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${emphasis})`} />}
            {index !== null && !dashed && samples[index] !== null && <g data-tooltip-marker="" className={panelMotion && mode === 1 ? tooltipStyles.matchedGuide : undefined} style={{ transform: `translate(${pointX}px,${valueY(samples[index])}px)` }}>
              <circle r={markerRadius * 2.6} fill={color} opacity=".3" /><circle r={markerRadius} fill={color} stroke={styled ? theme.surface : undefined} strokeWidth={styled ? 3 : undefined} />
            </g>}
          </g>;
        })}
        {index !== null && custom && <rect data-custom-guide="" x={pointX - groupWidth / 2} y={plot.bottom - 3} width={groupWidth} height="3" rx="1.5" fill={tone(theme, 0)} />}
        {index !== null && horizontal && <g data-horizontal-guide="">
          <line x1={plot.left} x2={plot.right} y1={crossY} y2={crossY} stroke={theme.muted} strokeDasharray="4 3" />
          <rect x={Math.max(1, plot.left - 54)} y={crossY - 13} width="47" height="26" rx="13" className={tooltipStyles.axisPill} />
          <text x={Math.max(24.5, plot.left - 30.5)} y={crossY + 4} textAnchor="middle" fontSize="12" className={tooltipStyles.axisText}>{Math.round(crossValue)}</text>
        </g>}
        {index !== null && datePill && <g data-tooltip-date-pill="">
          <rect x={pillX - pillWidth / 2} y={plot.bottom + 4} width={pillWidth} height={pillHeight} rx={pillHeight / 2} className={tooltipStyles.axisPill} />
          <text x={pillX} y={plot.bottom + 4 + pillHeight / 2 + (compact ? 3 : 4)} textAnchor="middle" fontSize={compact ? 8 : 12} className={tooltipStyles.axisText}>{categories[index]}</text>
        </g>}
      </svg>
      {index !== null && (!compact || index > 0) && <div ref={panel} className={`${styles.panel} ${tooltipStyles.panel}`} data-pinned={pinned !== null} data-tooltip-motion={motion} data-tooltip-style={header ? 'header' : content ? 'content' : pinEnabled ? 'pin' : 'rows'}
        role={pinned !== null ? "region" : "status"} aria-label="Chart tooltip"
        style={{ left: 0, top: panelPosition.y, transform: `translateX(${panelPosition.x}px)` }}>
        {pinned !== null && <Button className={styles.control} aria-label="Unpin tooltip" onClick={() => { graph.current?.focus(); setPinned(null); setActive(null); }}>×</Button>}
        {renderTooltip ? renderTooltip({ category: categories[index], index, pinned: pinned !== null, series: displayedSeries }) : <>
          <p className={header ? tooltipStyles.header : tooltipStyles.date}><strong>{panelLabel}</strong></p>
          {pinEnabled && <p className={tooltipStyles.revenue}><strong>{dollars.format(pinnedTotal)}</strong></p>}
          {content ? <>
            <p className={tooltipStyles.revenue}><strong>{displayedSeries[0]?.value == null ? '—' : dollars.format(close)}</strong></p>
            {index > 0 && previous !== 0 && displayedSeries[0]?.value != null && displayedSeries[0]?.previousValue != null && <p className={tooltipStyles.change}>{changePercent.format(change / Math.abs(previous))} vs. the day before</p>}
            {index === 0 && !data && <p className={tooltipStyles.change}>First day of April</p>}
          </> : header ? <>
            <p data-row><span>Close</span><strong>{displayedSeries[0]?.value == null ? '—' : dollars.format(close)}</strong></p>
            <p data-row><span>Change</span><strong>{index > 0 && displayedSeries[0]?.previousValue != null && displayedSeries[0]?.value != null ? `${change > 0 ? '+' : ''}${number.format(change)}` : !data && index === 0 ? '0' : '—'}</strong></p>
          </> : (!pinEnabled || pinned !== null) && displayedSeries.map((row, seriesIndex) => <p data-row key={seriesIndex}>
            <span><i style={{ backgroundColor: row.color }} />{row.name}</span>
            <strong>{row.value === null ? '—' : (pinEnabled ? dollars : number).format(row.value)}</strong>
          </p>)}
          {id === "tooltip-rows" && <p data-row><span>Pages per user</span><strong>{ratio}</strong></p>}
          {pinEnabled && pinned === null && <p>Click to pin</p>}
        </>}
      </div>}
    </div>
  </div>;
}
