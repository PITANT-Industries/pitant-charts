import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { Button } from "@ui-sdk/react/button";
import { LoaderCircle, Pause, Play } from "lucide-react";
import type { ChartExample, ChartSeries } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianFocusPoint, CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import { barValueDomain, finiteBarValue as finite, formatBarQuantity, formatBarTotal, formatBarValue, roundedBarPath } from "./bar-geometry";
import { useBarEntrance } from "./bar-motion";
import { BarCategoryPill } from "./BarCategoryPill";
import "./reference-bar.css";

type BarVariant = "bar-default" | "bar-stacked" | "bar-grouped" | "bar-values" | "bar-profit-loss" | "bar-sources" | "bar-squares" |
  "bar-squares-legend" | "bar-depth" | "bar-synced" | "bar-loading";

type Active = { panel: number; category: number };
type Mark = { series: number; category: number; value: number; x: number; y: number; width: number; height: number; color: string; baseline: number };

const domains: Record<BarVariant, [minimum: number, maximum: number, increment: number]> = {
  "bar-default": [0, 24000, 5000],
  "bar-stacked": [0, 3500, 500],
  "bar-grouped": [0, 24000, 5000],
  "bar-values": [0, 1300, 200],
  "bar-profit-loss": [-4000, 7000, 2000],
  "bar-sources": [0, 5000, 1000],
  "bar-squares": [0, 28000, 5000],
  "bar-squares-legend": [0, 24000, 5000],
  "bar-depth": [0, 24000, 5000],
  "bar-synced": [0, 110000, 20000],
  "bar-loading": [0, 2200, 500],
};
const compactValue = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const skeletonHeights = [.75, .23, .53, .42, .47, .57, .29, .39];
const shimmerStops = [[0, .05], [6, .082], [13, .174], [19, .312], [25, .475], [31, .638], [38, .776], [44, .868], [50, .9],
  [56, .868], [63, .776], [69, .638], [75, .475], [81, .312], [88, .174], [94, .082], [100, .05]];

const barFooters: Partial<Record<BarVariant, [string, string]>> = {
  "bar-default": ["Revenue up 77% since January", "Total revenue per month for the first half of 2026"],
  "bar-stacked": ["2,780 sign-ups in June, up 96% on January", "Organic, paid and referral sign-ups per month"],
  "bar-grouped": ["Margin reached 42% in June", "Monthly revenue against profit for the first half of 2026"],
  "bar-values": ["November peaked at 1,120 orders", "9,980 orders across the year"],
  "bar-profit-loss": ["$15,800 net profit since January", "Three months closed at a loss, the largest in April"],
  "bar-sources": ["Organic search brings 34% of all visits", "12,550 visits across six sources this month"],
  "bar-squares": ["Best month yet in October at $25,100", "Total revenue per month over the last twelve months"],
  "bar-squares-legend": ["Profit kept 37% of revenue over six months", "Hover a legend row to pick out its series"],
  "bar-depth": ["June closed at $21,200, the pulsing bar", "Total revenue per month for the first half of 2026"],
  "bar-synced": ["$134 per order over the year", "Hover a month in either chart: both highlight it"],
  "bar-loading": ["12,200 orders since January", "Turn loading off to grow the bars from the skeleton"],
};

function depthFaces(mark: Mark, baseline: number, count: number, progress = 1) {
  const direction = mark.category < count / 2 ? 1 : -1;
  const perspective = Math.abs(mark.category + .5 - count / 2) * 2 / Math.max(1, count - 1);
  const depth = perspective * Math.max(0, Math.min(5.644, mark.width * .2 - .768, mark.height));
  const depthX = depth * direction;
  const depthY = depth * .45 * (mark.value < 0 ? -1 : 1);
  const edge = direction > 0 ? mark.x + mark.width : mark.x;
  const tip = mark.value < 0 ? mark.y + mark.height : mark.y;
  const raised = tip + depthY;
  const yAt = (value: number) => baseline + (value - baseline) * progress;
  const front = yAt(raised);
  const back = front - depthY;
  return {
    side: `M${edge},${front}L${edge + depthX},${back}L${edge + depthX},${baseline - depthY}L${edge},${baseline}Z`,
    lid: `M${mark.x},${front}L${mark.x + mark.width},${front}L${mark.x + mark.width + depthX},${back}L${mark.x + depthX},${back}Z`,
    y: Math.min(front, baseline), height: Math.abs(baseline - raised) * progress, direction,
  };
}

function squareGeometry(mark: Mark, top: number, bottom: number, baseline: number) {
  const width = mark.width;
  const stride = width + 3;
  const negative = mark.value < 0;
  const room = negative ? bottom - baseline : baseline - top;
  const slots = Math.min(150, Math.max(0, Math.floor((room + 3) / stride)));
  const count = Math.min(slots, Math.round(mark.height / stride));
  const stackSize = Math.max(0, count * stride - 3);
  const track = negative ? { y: baseline + stackSize, height: Math.max(0, room - stackSize) }
    : { y: top, height: Math.max(0, room - stackSize) };
  return {
    track, count, width, stackSize, stride,
    y: (i: number) => negative ? baseline + i * stride : baseline - width - i * stride,
  };
}

function DepthPaint({ uid, pulse }: { uid: string; pulse: Mark | undefined }) {
  return <defs>
    {[-1, 1].map(direction => <linearGradient key={direction} id={`${uid}-side-${direction}`} x1={direction < 0 ? "100%" : "0%"} y1="0%" x2={direction < 0 ? "0%" : "100%"} y2="100%">
      <stop offset="0%" stopColor="black" stopOpacity=".05" /><stop offset="100%" stopColor="black" stopOpacity=".55" />
    </linearGradient>)}
    <linearGradient id={`${uid}-top`} x2="0%" y1="100%" y2="0%">
      <stop offset="0%" stopColor="black" stopOpacity="0" /><stop offset="100%" stopColor="black" stopOpacity=".18" />
    </linearGradient>
    <linearGradient id={`${uid}-glass`} x2="0%" y2="100%">
      <stop offset="0%" stopColor="white" stopOpacity=".20" /><stop offset="3%" stopColor="white" stopOpacity=".09" />
      <stop offset="8%" stopColor="white" stopOpacity=".02" /><stop offset="55%" stopColor="white" stopOpacity="0" />
      <stop offset="100%" stopColor="black" stopOpacity=".26" />
    </linearGradient>
    <linearGradient id={`${uid}-pulse`} x2="0%" y1="100%" y2="0%">
      {[[0, 0], [10, 0], [22, .15], [34, .43], [44, .72], [50, .85], [56, .72], [66, .43], [78, .15], [90, 0], [100, 0]].map(([offset, opacity]) =>
        <stop key={offset} offset={`${offset}%`} stopColor="white" stopOpacity={opacity} />)}
    </linearGradient>
    {pulse && <clipPath id={`${uid}-clip`}><rect x={pulse.x} y={pulse.y} width={pulse.width} height={pulse.height} /></clipPath>}
  </defs>;
}

function BarPanel({ label, variant, series, panel, categories, compact, demo, theme, active, setActive, loading, paused, highlighted, panels }: {
  label: string; variant: BarVariant; series: ChartSeries[]; panel: number; categories: string[]; compact: boolean; demo: boolean; theme: ChartTheme;
  active: Active | null; setActive: (next: Active | null) => void; loading: boolean; paused: boolean; highlighted: number | null; panels: number;
}) {
  const uid = useId();
  const tooltip = useRef<HTMLDivElement>(null);
  const [measuredTipWidth, setMeasuredTipWidth] = useState(0);
  const keyboardCategory = useRef<number | null>(null);
  const pointerCategory = useRef<number | null>(null);
  const lastPillCategory = useRef(0);
  const synced = variant === "bar-synced";
  const horizontal = variant === "bar-sources";
  const stacked = variant === "bar-stacked";
  const grouped = variant === "bar-grouped";
  const values = variant === "bar-values";
  const signed = variant === "bar-profit-loss";
  const squaresLegend = variant === "bar-squares-legend";
  const squares = squaresLegend || variant === "bar-squares";
  const depth = variant === "bar-depth";
  const primary = horizontal || variant === "bar-loading" || variant === "bar-default";
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(728, synced ? 728 / 3 : 364);
  const height = compact ? measuredHeight : width / (synced ? 3 : 2);
  const inset = compact ? 20 : 40;
  const top = Math.min(inset, (height - 1) / 2);
  const bottom = height - top;
  const left = Math.min(horizontal ? compact ? 48 : 64 : inset, width * .32);
  const right = Math.max(left + 1, width - Math.min(inset, width * .32));
  const count = categories.length;
  useLayoutEffect(() => {
    if (keyboardCategory.current !== null && keyboardCategory.current >= count) keyboardCategory.current = null;
    if (pointerCategory.current !== null && pointerCategory.current >= count) pointerCategory.current = null;
    lastPillCategory.current = Math.max(0, Math.min(count - 1, lastPillCategory.current));
  }, [count]);
  const padding = grouped ? .3 : .2;
  const band = (horizontal ? bottom - top : right - left) / Math.max(1, count + padding);
  const centerAt = (i: number) => (horizontal ? top : left) + (i + (1 + padding) / 2) * band;
  const columns = stacked ? 1 : series.length;
  const gap = columns > 1 ? Math.min(squaresLegend ? 4 : 6, band * .3 / (columns - 1)) : 0;
  const groupSpan = band * (grouped ? .7 : .8);
  const thickness = Math.max(.25, (groupSpan - gap * (columns - 1)) / Math.max(1, columns));
  const fixtureDomain: [number, number, number] = synced && panel > 0 ? [0, 800, 200] : domains[variant];
  const { minimum: lo, maximum: hi, magnitude, units, ticks } = barValueDomain(series, count, stacked, demo ? fixtureDomain : undefined);
  const valueAt = (value: number) => horizontal ? left + (value - lo) / (hi - lo) * (right - left)
    : bottom - (value - lo) / (hi - lo) * (bottom - top);
  const baseline = valueAt(0);
  const colorAt = (index: number) => {
    const item = series[index];
    const paint = colorFor(item, squaresLegend && index ? index + 1 : signed || synced ? panel + (signed ? 1 : 0) + index : index, theme);
    return primary && !item.color ? `var(--chart-line-primary, ${paint})` : paint;
  };
  const marks: Mark[] = categories.flatMap((_, category) => {
    let positive = 0;
    let negative = 0;
    let positiveLayers = 0;
    let negativeLayers = 0;
    return series.flatMap((item, i) => {
    const value = item.values[category];
    if (!finite(value)) return [];
    const unit = units[i][category]!;
    const from = stacked ? value < 0 ? negative : positive : 0;
    const to = from + unit;
    const offset = !stacked ? 0 : value < 0 ? negativeLayers * 2 : -positiveLayers * 2;
    if (stacked && value < 0) { negative = to; negativeLayers++; }
    else if (stacked && value > 0) { positive = to; positiveLayers++; }
    const center = centerAt(category) - groupSpan / 2 + (stacked ? 0 : i * (thickness + gap));
    const origin = valueAt(from) + offset;
    const edge = valueAt(to) + offset;
    const length = loading ? 0 : Math.abs(edge - origin);
    return [{ series: i, category, value, color: colorAt(i),
      baseline: origin,
      x: horizontal ? Math.min(origin, edge) : center,
      y: horizontal ? center : loading ? origin : Math.min(origin, edge),
      width: horizontal ? length : thickness,
      height: horizontal ? thickness : length,
    }];
    });
  });
  const categoryDelay = 440 / Math.max(1, count);
  const baseEnd = 1100 + Math.max(0, count - 1) * categoryDelay;
  const extraStagger = !squares ? 0 : marks.reduce((extra, mark) => {
    const cells = squareGeometry(mark, top, bottom, baseline).count;
    return Math.max(extra, mark.category * categoryDelay + (cells > 1 ? 1540 : 1100) - baseEnd);
  }, 0);
  const motion = useBarEntrance(count, true, loading, extraStagger);
  const focus = !loading && active && active.category < count ? active : null;
  const ownFocus = focus?.panel === panel;
  const entries = ownFocus ? series.flatMap((item, index) => {
    const value = item.values[focus.category];
    return finite(value) ? [{ name: item.name, value: demo ? value : formatBarValue(value), color: colorAt(index) }] : [];
  }) : [];
  const selected = focus ? marks.filter(mark => mark.category === focus.category) : [];
  const selectedName = ownFocus ? categories[focus.category] : "";
  if (focus) lastPillCategory.current = focus.category;
  const pillCategory = Math.max(0, Math.min(count - 1, focus?.category ?? lastPillCategory.current));
  const pillX = centerAt(pillCategory);
  const fadeX = Number(pillX.toFixed(2));
  const anchor = !ownFocus ? 0 : horizontal && selected.length
    ? Math.max(...selected.map(mark => mark.x + mark.width)) : centerAt(focus.category);
  const tipWidth = measuredTipWidth || 140;
  const tipLeft = anchor + 16 + tipWidth > width;
  const tipStyle = {
    top: horizontal && focus ? centerAt(focus.category) - 32 : top,
    left: tipLeft ? anchor - tipWidth - 16 : anchor + 16,
  };
  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!element) return;
    const measure = () => setMeasuredTipWidth(element.offsetWidth);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ownFocus, entries.length, compact]);
  const labelEvery = Math.max(1, Math.ceil((compact ? 32 : 28) / Math.max(1, band)));
  const opacity = (mark: Mark) => focus ? (focus.category === mark.category ? 1 : .3)
    : highlighted === null || highlighted === mark.series ? 1 : .3;
  const pulse = depth ? marks.find(mark => mark.category === count - 1 && mark.series === 0 && mark.value > 0) : undefined;
  const pulseFront = pulse && depthFaces(pulse, baseline, count);
  const pulseHeight = Math.max(36, (pulseFront?.height ?? 0) * .55);
  const skeleton = loading ? categories.map((_, i) => {
    const step = (right - left) / Math.max(1, count);
    const plotHeight = Math.round(bottom - top);
    const height = plotHeight * skeletonHeights[i % skeletonHeights.length];
    return { x: left + (i + .15) * step, y: top + plotHeight - height, width: step * .7, height, rx: 2 };
  }) : [];

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (loading || compact || !count || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left || x > right || y < top || y > bottom) {
      pointerCategory.current = null;
      setActive(null);
      return;
    }
    const category = Math.max(0, Math.min(count - 1, Math.round(((horizontal ? y : x) - centerAt(0)) / band)));
    pointerCategory.current = category;
    setActive({ category, panel });
  }

  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact || !count) return;
    const moves: Record<string, number> = {
      Home: 0, End: count - 1,
      ArrowLeft: (focus?.category ?? count) - 1, ArrowUp: (focus?.category ?? count) - 1,
      ArrowRight: (focus?.category ?? -1) + 1, ArrowDown: (focus?.category ?? -1) + 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const category = Math.min(count - 1, Math.max(0, next));
    keyboardCategory.current = category;
    setActive({ category, panel });
  }

  return <div className="reference-bar-panel" data-bar-panel={panel} data-bar-loading={loading} data-bar-ready={motion.ready} ref={plot}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label}
      data-bar-motion-state={motion.state}
      aria-describedby={compact ? undefined : `${uid}-instructions`} aria-busy={loading || undefined} tabIndex={!compact && !loading && count ? 0 : undefined}
      onPointerMove={inspect} onPointerDown={inspect} onPointerCancel={event => {
        if (event.pointerType === "touch") return;
        pointerCategory.current = null;
        const category = document.activeElement === event.currentTarget ? keyboardCategory.current : null;
        setActive(category === null ? null : { category, panel });
      }} onPointerLeave={event => {
        if (event.pointerType === "touch") return;
        pointerCategory.current = null;
        const category = document.activeElement === event.currentTarget ? keyboardCategory.current : null;
        setActive(category === null ? null : { category, panel });
      }} onKeyDown={navigate} onBlur={() => {
        keyboardCategory.current = null;
        setActive(pointerCategory.current === null ? null : { category: pointerCategory.current, panel });
      }} onFocus={() => {
        if (pointerCategory.current !== null) {
          setActive({ category: pointerCategory.current, panel });
          return;
        }
        keyboardCategory.current = 0;
        setActive({ category: 0, panel });
      }}>
      {!compact && <desc id={`${uid}-instructions`}>Use the arrow keys to inspect each category. Home and End select the first and last.</desc>}
      {depth && <DepthPaint uid={uid} pulse={pulse && pulseFront ? { ...pulse, y: pulseFront.y, height: pulseFront.height } : undefined} />}
      {loading && <defs>
        <linearGradient id={`${uid}-shimmer`} x1="0" x2="1" y1="0" y2="0">
          {shimmerStops.map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="white" stopOpacity={opacity} />)}
        </linearGradient>
        <mask id={`${uid}-skeleton-mask`} maskUnits="userSpaceOnUse">
          <g transform={`rotate(25 ${(left + right) / 2} ${top + Math.round(bottom - top) / 2})`}>
            <rect className="reference-bar-shimmer" x={left} y={top - Math.round(bottom - top)} width={right - left} height={Math.round(bottom - top) * 3}
              fill={`url(#${uid}-shimmer)`} style={{ "--bar-shimmer-travel": `${right - left}px` } as CSSProperties} />
          </g>
        </mask>
      </defs>}
      {!horizontal && <g className="reference-bar-grid" aria-hidden="true">
        {ticks.map(tick => <line key={tick} data-bar-grid={tick} x1={left} x2={right} y1={valueAt(tick)} y2={valueAt(tick)}
          stroke={theme.grid} strokeDasharray="4 4" />)}
      </g>}
      {signed && <line data-bar-zero="" aria-hidden="true" x1={left} x2={right} y1={baseline} y2={baseline} stroke={theme.muted} />}
      <g aria-hidden="true">
        {loading && <g mask={`url(#${uid}-skeleton-mask)`}>
          {skeleton.map((shape, i) => <rect data-bar-placeholder={i} key={i} {...shape} fill={series.length ? colorAt(0) : theme.colors[0]} fillOpacity={.45} />)}
        </g>}
        {marks.map(finalMark => {
          const progress = squares ? 1 : motion.progress[finalMark.category] ?? 1;
          const length = (horizontal ? finalMark.width : finalMark.height) * progress;
          const mark = horizontal ? { ...finalMark, width: length,
            x: finalMark.value < 0 ? finalMark.baseline - length : finalMark.baseline }
            : { ...finalMark, height: length, y: finalMark.value < 0 ? finalMark.baseline : finalMark.baseline - length };
          const key = `${mark.category}-${mark.series}`;
          const selection = opacity(mark);
          const { x, y, width, height, color } = mark;
          if (stacked) return <g key={key} data-bar-column={key} data-category={mark.category} data-series={mark.series} opacity={selection}>
            <path data-bar-mark={key} data-value={mark.value} d={roundedBarPath(x, y, width, height, mark.value < 0)} fill={color} />
          </g>;
          if (squares) {
            const squares = squareGeometry(mark, top, bottom, baseline);
            const trackProgress = motion.progressFor(mark.category, 0, squares.count > 1 ? 1540 : 1100);
            const trackRoom = mark.value < 0 ? bottom - baseline : baseline - top;
            const trackOrigin = mark.value < 0 ? baseline : top;
            return <g key={key} data-bar-column={key} data-category={mark.category} data-series={mark.series} data-value={mark.value}>
              <rect data-bar-track={key} x={x} y={trackOrigin + (squares.track.y - trackOrigin) * trackProgress}
                width={width} height={trackRoom + (squares.track.height - trackRoom) * trackProgress} rx={width / 4}
                fill={theme.grid} opacity={focus ? 0 : .3} />
              {Array.from({ length: squares.count }, (_, i) => {
                const share = 100 * (1 - (i * squares.stride + width / 2) / squares.stackSize);
                const fill = mark.series === 0 ? `color-mix(in srgb, ${color} ${share.toFixed(1)}%, ${theme.colors[1]})` : color;
                const height = width * motion.progressFor(mark.category, squares.count > 1 ? i * 440 / (squares.count - 1) : 0);
                return <rect data-bar-square={`${key}-${i}`} key={i} x={x} y={squares.y(i) + width - height} width={width} height={height}
                  rx={width / 4} fill={fill} opacity={selection} />;
              })}
            </g>;
          }
          if (depth) {
            const faces = depthFaces(finalMark, baseline, count, progress);
            return <g key={key} data-bar-column={key} data-category={mark.category} data-series={mark.series} opacity={selection}>
              <rect data-bar-mark={key} data-value={mark.value} x={x} y={faces.y} width={width} height={faces.height} fill={color} />
              <path data-bar-side={key} d={faces.side} fill={color} />
              <path d={faces.side} fill={`url(#${uid}-side-${faces.direction})`} />
              <path d={faces.side} fill={`url(#${uid}-glass)`} />
              <path data-bar-lid={key} d={faces.lid} fill={color} />
              <path d={faces.lid} fill="white" opacity=".2" />
              <path d={faces.lid} fill={`url(#${uid}-top)`} />
              <rect x={x} y={faces.y} width={width} height={faces.height} fill={`url(#${uid}-glass)`} />
            </g>;
          }
          const labelX = x + width / 2;
          const labelY = y + height / 2;
          const valueLabel = values ? demo ? valueFormat.format(mark.value) : formatBarValue(mark.value) : "";
          const rotate = width < valueLabel.length * 8 + 6;
          return <g key={key} data-bar-column={key} data-category={mark.category} data-series={mark.series} opacity={selection}>
            <rect data-bar-mark={key} data-value={mark.value} x={x} y={y} width={width} height={height} rx={signed ? 4 : 8} fill={color}
              />
            {values && width >= 18 && height >= (rotate ? valueLabel.length * 7 + 4 : 15) && <text data-bar-value={key} x={labelX} y={labelY}
              transform={rotate ? `rotate(-90 ${labelX} ${labelY})` : undefined} fill="white" textAnchor="middle"
              dominantBaseline="middle" fontSize={compact ? 9 : 12} fontWeight={600}>{valueLabel}</text>}
          </g>;
        })}
        {pulse && pulseFront && !compact && <g clipPath={`url(#${uid}-clip)`} opacity={opacity(pulse)}>
          <g className="reference-bar-pulse" data-paused={paused}>
            <rect x={pulse.x} y={baseline} width={pulse.width} height={pulseHeight} fill={`url(#${uid}-pulse)`} />
            <rect x={pulse.x} y={pulse.y} width={1} height={1} fill="none" />
          </g>
        </g>}
      </g>
      <g aria-hidden="true" fill={`var(--chart-label, ${theme.muted})`} fontSize={compact ? 10 : 12}>
        {(!synced || panel === panels - 1) && categories.map((category, i) => {
          if (!horizontal && i % labelEvery !== 0) return null;
          const point = Number(centerAt(i).toFixed(2));
          return horizontal ? <text key={i} data-bar-axis-label={i} x={left - 8} y={point} textAnchor="end" dominantBaseline="middle"
            opacity={focus?.category === i ? 1 : .7}>{category}</text>
            : <text key={i} data-bar-axis-label={i} x={point} y={bottom + (compact ? 13 : 24)} textAnchor="middle"
              opacity={focus ? Math.max(0, Math.min(1, (Math.abs(point - fadeX) - 50) / 20)) : 1}>{category}</text>;
        })}
        {(grouped || signed) && !compact && ticks.map(tick => <text key={tick} data-bar-value-tick={tick} x={left - 4} y={valueAt(tick)}
          textAnchor="end" dominantBaseline="middle">{demo ? compactValue.format(tick).toLowerCase() : formatBarQuantity(tick, magnitude)}</text>)}
      </g>
      {!horizontal && selected.map(mark => <CartesianFocusPoint key={mark.series} x={mark.x + mark.width / 2}
        y={mark.value < 0 ? mark.y + mark.height : mark.y} color={mark.color} surface={theme.surface} halo={false} />)}
    </svg>
    {!compact && !horizontal && <BarCategoryPill categories={categories} index={pillCategory} x={pillX} y={height - 36}
      visible={Boolean(focus) && !loading} theme={theme} />}
    {!compact && !loading && ownFocus && entries.length > 0 && <div className="reference-bar-readout reference-bar-tooltip" data-placement={tipLeft ? "left" : "right"} style={tipStyle} ref={tooltip}
      role="status" aria-atomic="true">
      <CartesianReadout label={selectedName} entries={entries} live={false} />
    </div>}
  </div>;
}

export function ReferenceBar({ example, data, compact, demo, theme }: {
  example: ChartExample; data: CartesianData; compact: boolean; demo: boolean; theme: ChartTheme;
}) {
  const valid = data.categories.length > 0 && data.series.some(item =>
    data.categories.some((_, index) => finite(item.values[index])));
  return valid ? <ReferenceBarChart example={example} data={data} compact={compact} demo={demo} theme={theme} />
    : <div className="chart-render-message" role="status">No bar data</div>;
}

function ReferenceBarChart({ example, data, compact, demo, theme }: {
  example: ChartExample; data: CartesianData; compact: boolean; demo: boolean; theme: ChartTheme;
}) {
  const variant = example.id as BarVariant;
  const [active, setActive] = useState<Active | null>(null);
  const [loading, setLoading] = useState(variant === "bar-loading");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const synced = variant === "bar-synced";
  const legend = variant === "bar-squares-legend" && !compact;
  const panels = synced && !compact && data.series.length ? data.series.map(item => [item]) : [data.series];
  useEffect(() => {
    setActive(previous => previous && (previous.category >= data.categories.length || previous.panel >= panels.length) ? null : previous);
    const keep = (previous: number | null) => previous !== null && previous >= data.series.length ? null : previous;
    setHovered(keep); setFocused(keep);
  }, [data.categories.length, data.series.length, panels.length]);
  let footer = demo && !compact ? barFooters[variant] : undefined;
  if (loading) footer = ["Fetching orders…", "Turn loading off to grow the bars from the skeleton"];
  if (footer && synced && active) {
    const revenue = data.series[0]?.values[active.category];
    const orders = data.series[1]?.values[active.category];
    if (finite(revenue) && finite(orders) && orders > 0) footer = [`${dollars.format(revenue / orders)} per order in ${data.categories[active.category]}`, footer[1]];
  }
  return <div className="reference-bar" data-bar-variant={variant} data-bar-compact={compact}>
    {!compact && (variant === "bar-loading" || variant === "bar-depth") && <div className="reference-bar-controls">
      {variant === "bar-loading" ? <Toggle pressed={loading} onPressedChange={next => { setLoading(next); setActive(null); }}>
        <LoaderCircle aria-hidden="true" size={16} />Loading
      </Toggle> : <Toggle pressed={paused} onPressedChange={setPaused}>
        {paused ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
        {paused ? "Resume pulse" : "Pause pulse"}
      </Toggle>}
    </div>}
    <div className="reference-bar-layout" data-bar-layout={legend ? "legend" : synced ? "synced" : "single"}>
      <div className="reference-bar-plots">
        {panels.map((series, panel) => <Fragment key={panel}>
          {synced && !compact && panels.length > 1 && <div className="reference-bar-panel-title">{series[0]?.name}</div>}
          <BarPanel label={synced && panels.length > 1 ? `${example.title} — ${series[0]?.name}` : example.title} variant={variant}
            series={series} panel={panel} categories={data.categories} compact={compact} theme={theme} demo={demo} active={active}
            setActive={setActive} loading={loading} paused={paused} highlighted={hovered ?? focused} panels={panels.length} />
        </Fragment>)}
      </div>
      {legend && <div className="reference-bar-legend">
        <p>{demo ? "Six-month total" : "Series total"}</p>
        <ul aria-label="Bar series">
          {data.series.map((item, i) => {
            const highlight = hovered ?? focused;
            const visibleValues = item.values.slice(0, data.categories.length);
            const total = demo ? visibleValues.reduce<number>((sum, value) => sum + (finite(value) ? value : 0), 0) : 0;
            return <li key={i}><Button className="reference-bar-legend-item" data-highlighted={highlight === i || undefined} data-dimmed={highlight !== null && highlight !== i}
              onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(i); }}
              onPointerLeave={() => { setHovered(null); setFocused(null); }} onFocus={() => setFocused(i)} onBlur={() => setFocused(null)}>
              <i aria-hidden="true" style={{ background: colorFor(item, i ? i + 1 : i, theme) }} />
              <span>{item.name}</span><strong>{demo ? dollars.format(total) : formatBarTotal(visibleValues)}</strong>
            </Button></li>;
          })}
        </ul>
      </div>}
    </div>
    {footer && !compact && <div className="reference-bar-footer" role={loading ? "status" : undefined}>
      <strong>{footer[0]}</strong><span>{footer[1]}</span>
    </div>}
  </div>;
}
