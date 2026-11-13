import { Fragment, useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle, Pause, Play } from "lucide-react";
import type { ChartExample, ChartSeries } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianFocusPoint, CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import "./reference-bar.css";

type BarVariant = "bar-grouped" | "bar-values" | "bar-profit-loss" | "bar-sources" | "bar-squares" |
  "bar-squares-legend" | "bar-depth" | "bar-synced" | "bar-loading";

type Active = { panel: number; category: number };
type Mark = { series: number; category: number; value: number; x: number; y: number; width: number; height: number; color: string };

const domains: Record<BarVariant, [minimum: number, maximum: number, increment: number]> = {
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
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

const barFooters: Partial<Record<BarVariant, [string, string]>> = {
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

function depthFaces(mark: Mark, baseline: number, count: number) {
  const direction = mark.category < count / 2 ? 1 : -1;
  const perspective = Math.abs(mark.category + .5 - count / 2) * 2 / Math.max(1, count - 1);
  const depth = perspective * Math.max(0, Math.min(5.644, mark.width * .2 - .768, mark.height));
  const depthX = depth * direction;
  const depthY = depth * .45 * (mark.value < 0 ? -1 : 1);
  const edge = direction > 0 ? mark.x + mark.width : mark.x;
  const tip = mark.value < 0 ? mark.y + mark.height : mark.y;
  const raised = tip + depthY;
  return {
    side: `M${edge},${raised}L${edge + depthX},${tip}L${edge + depthX},${baseline - depthY}L${edge},${baseline}Z`,
    lid: `M${mark.x},${raised}L${mark.x + mark.width},${raised}L${mark.x + mark.width + depthX},${tip}L${mark.x + depthX},${tip}Z`,
    y: Math.min(raised, baseline), height: Math.abs(baseline - raised), direction,
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
  const synced = variant === "bar-synced";
  const horizontal = variant === "bar-sources";
  const grouped = variant === "bar-grouped";
  const values = variant === "bar-values";
  const signed = variant === "bar-profit-loss";
  const squaresLegend = variant === "bar-squares-legend";
  const squares = squaresLegend || variant === "bar-squares";
  const depth = variant === "bar-depth";
  const primary = horizontal || variant === "bar-loading";
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(728, synced ? 728 / 3 : 364);
  const height = compact ? measuredHeight : width / (synced ? 3 : 2);
  const inset = compact ? 20 : 40;
  const top = Math.min(inset, (height - 1) / 2);
  const bottom = height - top;
  const left = Math.min(horizontal ? compact ? 48 : 64 : inset, width * .32);
  const right = Math.max(left + 1, width - Math.min(inset, width * .32));
  const count = categories.length;
  const padding = grouped ? .3 : .2;
  const band = (horizontal ? bottom - top : right - left) / Math.max(1, count + padding);
  const centerAt = (i: number) => (horizontal ? top : left) + (i + (1 + padding) / 2) * band;
  const gap = series.length > 1 ? Math.min(squaresLegend ? 4 : 6, band * .3 / (series.length - 1)) : 0;
  const groupSpan = band * (grouped ? .7 : .8);
  const thickness = Math.max(.25, (groupSpan - gap * (series.length - 1)) / Math.max(1, series.length));
  const [min, max, step] = synced && panel > 0 ? [0, 800, 200] : domains[variant];
  const extents = series.reduce(([low, high], item) => item.values.reduce<[number, number]>((range, value) => {
    if (!finite(value)) return range;
    return [Math.min(range[0], value), Math.max(range[1], value)];
  }, [low, high]), [0, 0]);
  const lo = demo ? min : Math.min(0, extents[0]);
  const hi = demo ? max : Math.max(lo + 1, extents[1] * 1.12);
  const ticks = demo ? Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step)
    : Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * i / 4);
  const valueAt = (value: number) => horizontal ? left + (value - lo) / (hi - lo) * (right - left)
    : bottom - (value - lo) / (hi - lo) * (bottom - top);
  const baseline = valueAt(0);
  const colorAt = (index: number) => {
    const item = series[index];
    const paint = colorFor(item, squaresLegend && index ? index + 1 : signed || synced ? panel + (signed ? 1 : 0) + index : index, theme);
    return primary && !item.color ? `var(--chart-line-primary, ${paint})` : paint;
  };
  const marks: Mark[] = categories.flatMap((_, category) => series.flatMap((item, i) => {
    const value = item.values[category];
    if (!finite(value)) return [];
    const center = centerAt(category) - groupSpan / 2 + i * (thickness + gap);
    const edge = valueAt(value);
    const length = loading ? 0 : Math.abs(edge - baseline);
    return [{ series: i, category, value, color: colorAt(i),
      x: horizontal ? Math.min(baseline, edge) : center,
      y: horizontal ? center : loading ? baseline : Math.min(baseline, edge),
      width: horizontal ? length : thickness,
      height: horizontal ? thickness : length,
    }];
  }));
  const focus = !loading && active && active.category < count ? active : null;
  const ownFocus = focus?.panel === panel;
  const entries = ownFocus ? series.flatMap((item, index) => {
    const value = item.values[focus.category];
    return finite(value) ? [{ name: item.name, value, color: colorAt(index) }] : [];
  }) : [];
  const selected = focus ? marks.filter(mark => mark.category === focus.category) : [];
  const selectedName = ownFocus ? categories[focus.category] : "";
  const anchor = !ownFocus ? 0 : horizontal && selected.length
    ? Math.max(...selected.map(mark => mark.x + mark.width)) : centerAt(focus.category);
  const tipWidth = Math.min(width - 8, entries.some(entry => entry.name === "Revenue") ? 154 : 140);
  const tipRight = anchor + 16 + tipWidth <= width || anchor - 16 < tipWidth;
  const tipStyle = {
    top: horizontal && focus ? Math.max(4, centerAt(focus.category) - 32) : top,
    left: tipRight ? Math.max(4, Math.min(width - tipWidth - 4, anchor + 16)) : undefined,
    right: tipRight ? undefined : width - anchor + 16,
  };
  const labelEvery = Math.max(1, Math.ceil((compact ? 32 : 28) / Math.max(1, band)));
  const opacity = (mark: Mark) => focus ? (focus.category === mark.category ? 1 : .3)
    : highlighted === null || highlighted === mark.series ? 1 : .22;
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
    if (loading || compact || !count || event.type === "pointermove" && event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left || x > right || y < top || y > bottom) {
      setActive(null);
      return;
    }
    const category = Math.max(0, Math.min(count - 1, Math.round(((horizontal ? y : x) - centerAt(0)) / band)));
    setActive({ category, panel });
  }

  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact || !count) return;
    if (event.key === "Escape" && focus) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
      return;
    }
    const moves: Record<string, number> = {
      Home: 0, End: count - 1,
      ArrowLeft: (focus?.category ?? count) - 1, ArrowUp: (focus?.category ?? count) - 1,
      ArrowRight: (focus?.category ?? -1) + 1, ArrowDown: (focus?.category ?? -1) + 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive({ category: Math.min(count - 1, Math.max(0, next)), panel });
  }

  return <div className="reference-bar-panel" data-bar-panel={panel} data-bar-loading={loading} ref={plot}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label}
      aria-describedby={compact ? undefined : `${uid}-instructions`} aria-busy={loading || undefined} tabIndex={!compact && !loading && count ? 0 : undefined}
      onPointerMove={inspect} onPointerDown={inspect} onPointerCancel={() => setActive(null)}
      onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }} onKeyDown={navigate} onBlur={() => setActive(null)}>
      {!compact && <desc id={`${uid}-instructions`}>Use the arrow keys to inspect each category. Home and End select the first and last. Escape clears the selection.</desc>}
      {depth && <DepthPaint uid={uid} pulse={pulse && pulseFront ? { ...pulse, y: pulseFront.y, height: pulseFront.height } : undefined} />}
      {loading && <defs>
        <clipPath id={`${uid}-skeleton`}>{skeleton.map((shape, i) => <rect key={i} {...shape} />)}</clipPath>
        <linearGradient id={`${uid}-shimmer`} x1="0%" x2="100%" y1="10%" y2="90%">
          <stop offset="20%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity=".42" />
          <stop offset="80%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>}
      {!horizontal && <g className="reference-bar-grid" aria-hidden="true">
        {ticks.map(tick => <line key={tick} data-bar-grid={tick} x1={left} x2={right} y1={valueAt(tick)} y2={valueAt(tick)}
          stroke={theme.grid} strokeDasharray="4 4" />)}
      </g>}
      {signed && <line data-bar-zero="" aria-hidden="true" x1={left} x2={right} y1={baseline} y2={baseline} stroke={theme.muted} />}
      <g aria-hidden="true">
        {skeleton.map((shape, i) => <rect data-bar-placeholder={i} key={i} {...shape} fill={series.length ? colorAt(0) : theme.colors[0]} fillOpacity={.45} />)}
        {loading && <g clipPath={`url(#${uid}-skeleton)`}>
          <rect className="reference-bar-shimmer" x={left} y={top - (bottom - top)} width={right - left} height={(bottom - top) * 3}
            fill={`url(#${uid}-shimmer)`} style={{ "--bar-shimmer-travel": `${right - left}px` } as CSSProperties} />
        </g>}
        {marks.map(mark => {
          const key = `${mark.category}-${mark.series}`;
          const selection = opacity(mark);
          const { x, y, width, height, color } = mark;
          if (squares) {
            const squares = squareGeometry(mark, top, bottom, baseline);
            return <g key={key} data-bar-column={key} opacity={selection}>
              <rect data-bar-track={key} x={x} y={squares.track.y} width={width} height={squares.track.height} rx={width / 4}
                fill={theme.grid} opacity={focus ? 0 : .3} />
              {Array.from({ length: squares.count }, (_, i) => {
                const share = 100 * (1 - (i * squares.stride + width / 2) / squares.stackSize);
                const fill = mark.series === 0 ? `color-mix(in srgb, ${color} ${share.toFixed(1)}%, ${theme.colors[1]})` : color;
                return <rect data-bar-square={`${key}-${i}`} key={i} x={x} y={squares.y(i)} width={width} height={width} rx={width / 4} fill={fill} />;
              })}
            </g>;
          }
          if (depth) {
            const faces = depthFaces(mark, baseline, count);
            return <g key={key} data-bar-column={key} opacity={selection}>
              <rect data-bar-mark={key} x={x} y={faces.y} width={width} height={faces.height} fill={color} />
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
          const valueLabel = values ? valueFormat.format(mark.value) : "";
          const rotate = width < valueLabel.length * 8 + 6;
          return <g key={key} data-bar-column={key} opacity={selection}>
            <rect data-bar-mark={key} x={x} y={y} width={width} height={height} rx={signed ? 4 : 8} fill={color}
              data-bar-grow={variant === "bar-loading" && !loading ? "true" : undefined} style={{ animationDelay: `${mark.category * 65}ms`, transformOrigin: `${labelX}px ${baseline}px` }} />
            {values && width >= 18 && height >= (rotate ? valueLabel.length * 7 + 4 : 15) && <text data-bar-value={key} x={labelX} y={labelY}
              transform={rotate ? `rotate(-90 ${labelX} ${labelY})` : undefined} fill="white" textAnchor="middle"
              dominantBaseline="middle" fontSize={compact ? 9 : 12} fontWeight={600}>{valueLabel}</text>}
          </g>;
        })}
        {pulse && pulseFront && !compact && <g clipPath={`url(#${uid}-clip)`} opacity={opacity(pulse)}>
          <rect className="reference-bar-pulse" data-paused={paused} x={pulse.x} y={baseline} width={pulse.width}
            height={pulseHeight} fill={`url(#${uid}-pulse)`} style={{ "--bar-pulse-travel": `${-pulseFront.height - pulseHeight}px` } as CSSProperties} />
        </g>}
      </g>
      <g aria-hidden="true" fill={`var(--chart-label, ${theme.muted})`} fontSize={compact ? 10 : 12}>
        {(!synced || panel === panels - 1) && categories.map((category, i) => {
          if (!horizontal && i % labelEvery !== 0) return null;
          const point = centerAt(i);
          return horizontal ? <text key={i} data-bar-axis-label={i} x={left - 8} y={point} textAnchor="end" dominantBaseline="middle"
            opacity=".7">{category}</text>
            : <text key={i} data-bar-axis-label={i} x={point} y={bottom + (compact ? 13 : 24)} textAnchor="middle">{category}</text>;
        })}
        {(grouped || signed) && !compact && ticks.map(tick => <text key={tick} data-bar-value-tick={tick} x={left - 4} y={valueAt(tick)}
          textAnchor="end" dominantBaseline="middle">{compactValue.format(tick).toLowerCase()}</text>)}
      </g>
      {!horizontal && selected.map(mark => <CartesianFocusPoint key={mark.series} x={mark.x + mark.width / 2}
        y={valueAt(mark.value)} color={mark.color} surface={theme.surface} halo={false} />)}
    </svg>
    {!compact && !loading && <div className="reference-bar-readout" style={tipStyle}
      role="status" aria-atomic="true">
      {ownFocus && entries.length > 0 && <CartesianReadout label={selectedName} entries={entries} live={false} />}
    </div>}
  </div>;
}

export function ReferenceBar({ example, data, compact, demo, theme }: {
  example: ChartExample; data: CartesianData; compact: boolean; demo: boolean; theme: ChartTheme;
}) {
  const variant = example.id as BarVariant;
  const [active, setActive] = useState<Active | null>(null);
  const [loading, setLoading] = useState(variant === "bar-loading");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const synced = variant === "bar-synced";
  const legend = variant === "bar-squares-legend" && !compact;
  const panels = synced && !compact && data.series.length ? data.series.map(item => [item]) : [data.series];
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
            setActive={setActive} loading={loading} paused={paused} highlighted={hovered ?? focused ?? pinned} panels={panels.length} />
        </Fragment>)}
      </div>
      {legend && <div className="reference-bar-legend">
        <p>{demo ? "Six-month total" : "Series total"}</p>
        <ul aria-label="Bar series" onKeyDown={event => {
          if (event.key !== "Escape" || pinned === null && focused === null && hovered === null) return;
          event.preventDefault();
          event.stopPropagation();
          setPinned(null); setFocused(null); setHovered(null);
        }}>
          {data.series.map((item, i) => {
            const highlight = hovered ?? focused ?? pinned;
            const total = item.values.reduce<number>((sum, value) => sum + (finite(value) ? value : 0), 0);
            return <li key={i}><Toggle className="reference-bar-legend-item" pressed={pinned === i} data-dimmed={highlight !== null && highlight !== i}
              onPressedChange={pressed => setPinned(pressed ? i : null)} onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(i); }}
              onPointerLeave={() => setHovered(null)} onFocus={() => setFocused(i)} onBlur={() => setFocused(null)}>
              <i aria-hidden="true" style={{ background: colorFor(item, i ? i + 1 : i, theme) }} />
              <span>{item.name}</span><strong>{demo ? dollars.format(total) : valueFormat.format(total)}</strong>
            </Toggle></li>;
          })}
        </ul>
      </div>}
    </div>
    {footer && !compact && <div className="reference-bar-footer" role={loading ? "status" : undefined}>
      <strong>{footer[0]}</strong><span>{footer[1]}</span>
    </div>}
  </div>;
}
