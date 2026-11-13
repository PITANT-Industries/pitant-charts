import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import { Choices } from "../../ui/Choices";
import type { ChartExample, ChartSeries } from "../../types";
import type { CartesianData } from "./data";
import { colorFor, down, tint, up, valueFormat, type ChartTheme } from "./options";
import { sparklineBarPath, sparklinePaths } from "./sparkline-path";
import styles from "./sparkline.module.css";

const ranges = [7, 30, 90].map(day => ({ value: String(day), label: `${day}D`, ariaLabel: `${day} days` }));
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactDollars = new Intl.NumberFormat("en", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const crosshairs = ["dashed", "solid", "gradient"] as const;
const hoverLabels = ["Spring (default)", "Snappy: stiffness 600, damping 45", "No spring", "Bars, no spring"];
const hoverMotion = ["spring", "snappy", "immediate", "immediate"] as const;
const matrixKinds = ["area", "line", "bar"] as const;
const fullDate = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const summaries: Record<string, readonly [string, string]> = {
  "sparkline-line": ["Up 1.5% since October 16, peaking at $5,689", "$4,587 on November 8, 2026"],
  "sparkline-area": ["Down 33.2% since October 16", "1,286 visitors on November 8, 2026"],
  "sparkline-area-solid": ["1,646 visitors a day on average", "From 2,015 at the peak to 1,286 on November 8"],
  "sparkline-bar": ["Up 36.4% since October 16", "176 orders on November 8, 2026, the best day yet"],
  "sparkline-step": ["25 seats, five times July’s", "Two downgrades along the way, in September and October"],
};
type Kind = "line" | "area" | "bar" | "step";

interface SparkProps {
  item: ChartSeries;
  label: string;
  color: string;
  kind: Kind;
  crosshair: typeof crosshairs[number];
  motion?: typeof hoverMotion[number];
  solid?: boolean;
  endpoint?: boolean;
  endMarker?: boolean;
  fixture?: boolean;
  stat?: boolean;
  radius?: number;
  includeZero?: boolean;
  compact: boolean;
  active: number | null;
  categories: readonly string[];
  format: (value: number) => string;
  onActive: (index: number | null) => void;
}

function Spark({ item, label, color, kind, crosshair, motion = "spring", solid, endpoint, endMarker,
  fixture, stat, radius, includeZero, compact, active, categories, format, onActive }: SparkProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const plot = useRef<SVGSVGElement>(null);
  const [{ width, height }, setSize] = useState({ width: 216, height: 56 });
  useEffect(() => {
    const node = plot.current;
    if (!node || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const measuredWidth = fixture ? Math.round(width * 2) / 2 : width;
      if (width > 12 && height > 12) setSize(previous => previous.width === measuredWidth && previous.height === height ? previous : { width: measuredWidth, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixture]);

  const values = item.values;
  let low = Infinity, high = -Infinity;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (low === Infinity) low = high = 0;
  const isBar = kind === "bar";
  const min = isBar || includeZero ? Math.min(0, low) : low;
  const max = isBar ? Math.max(0, high) : high;
  const pad = fixture ? stat ? 0 : isBar ? 2 : 4 : 4;
  const vertical = fixture && stat ? height / 22 : pad;
  const slot = (width - 2 * pad) / Math.max(1, values.length);
  const xAt = (index: number) => isBar ? pad + (index + .5) * slot : values.length === 1 ? width / 2 : pad + index / Math.max(1, values.length - 1) * (width - 2 * pad);
  const yAt = (value: number) => min === max ? height / 2 : height - vertical - (value - min) / (max - min) * (height - 2 * vertical);
  const { line, area } = isBar ? { line: "", area: "" }
    : sparklinePaths(values, xAt, yAt, min, kind === "step", fixture, fixture && endpoint);
  const current = values.at(-1);
  const point = active === null ? null : values[active];
  const dotIndex = endpoint || endMarker && active === null ? values.length - 1 : active;
  const dotValue = dotIndex === null ? null : values[dotIndex];
  const barWidth = Math.max(1, slot - (fixture ? 2 : Math.min(2, slot * .3)));
  const strokeWidth = fixture ? stat ? 2.5 : 1.5 : 1.65;
  const barSegments = fixture && isBar ? values.map((value, index) => value === null || !Number.isFinite(value) ? ""
    : sparklineBarPath(xAt(index), barWidth, yAt(value), yAt(0), radius ?? 1)) : [];

  const setPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (endpoint || !values.length || fixture && compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = ((event.clientX - bounds.left) / Math.max(1, bounds.width) * width - pad) / (width - pad * 2);
    const index = isBar ? Math.floor(fraction * values.length) : Math.round(fraction * (values.length - 1));
    onActive(Math.min(values.length - 1, Math.max(0, index)));
  };
  const setKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (endpoint || !values.length || fixture && compact) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      onActive(null);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const initial = event.key === "ArrowLeft" ? values.length : -1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : (active ?? initial) + (event.key === "ArrowRight" ? 1 : -1);
    onActive(Math.min(values.length - 1, Math.max(0, next)));
  };
  const description = active === null ? `latest ${typeof current === "number" ? format(current) : "unavailable"}`
    : `${categories[active] ?? `Sample ${active + 1}`} ${typeof point === "number" ? format(point) : "unavailable"}`;
  const fill = solid ? fixture ? color : tint(color, .24) : `url(#${id}-fill)`;
  const focusRadius = fixture ? 1 : 2;
  const crosshairColor = fixture ? "color-mix(in oklab, var(--muted-foreground) 80%, transparent)" : tint(color, .55);
  const gradientColor = fixture ? crosshairColor : color;
  const guideInset = fixture ? isBar ? 1 : 2 : pad;

  return <svg ref={plot} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-roledescription="sparkline"
    tabIndex={endpoint || compact || !values.length ? undefined : 0} aria-label={`${label}, ${description}`}
    className={styles.plot} data-spark-kind={kind} data-spark-motion={motion} data-point-count={values.length}
    onPointerMove={setPointer} onPointerDown={setPointer} onPointerLeave={event => { if (!fixture || event.pointerType !== "touch") onActive(null); }}
    onPointerCancel={() => onActive(null)} onKeyDown={setKeyboard} onBlur={() => onActive(null)}>
    <defs>
      {(kind === "area" || kind === "step") && !solid && <linearGradient id={`${id}-fill`} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop stopColor={color} stopOpacity={fixture ? .3 : .38} /><stop offset="100%" stopColor={color} stopOpacity={fixture ? 0 : .02} />
      </linearGradient>}
      {crosshair === "gradient" && <linearGradient id={`${id}-crosshair`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={height}>
        <stop stopColor={gradientColor} stopOpacity={0} /><stop offset="50%" stopColor={gradientColor} stopOpacity={fixture ? 1 : .75} /><stop offset="100%" stopColor={gradientColor} stopOpacity={0} />
      </linearGradient>}
      {!isBar && active !== null && <clipPath id={`${id}-focus`}><rect x={xAt(Math.max(0, active - focusRadius))}
        width={xAt(Math.min(active + focusRadius, values.length - 1)) - xAt(Math.max(0, active - focusRadius))} y={0} height={height} /></clipPath>}
    </defs>
    {isBar ? <>
      {fixture ? <>
        <path data-spark-bars="" d={barSegments.join("")} fill={color} opacity={active === null ? 1 : .4} />
        {active !== null && <path data-spark-active-bar="" d={barSegments[active]} fill={color} />}
      </> : <>
      {min < 0 && max > 0 && <line x1={pad} x2={width - pad} y1={yAt(0)} y2={yAt(0)} stroke="var(--border)" data-zero-line="" />}
      {values.map((value, index) => value === null || !Number.isFinite(value) ? null : <rect data-spark-bar="" key={index}
        x={xAt(index) - barWidth / 2} y={Math.min(yAt(value), yAt(0))} width={barWidth}
        height={Math.max(1, Math.abs(yAt(value) - yAt(0)))} rx={Math.min(2, barWidth / 3)} fill={color}
        opacity={active === null || active === index ? 1 : .4} />)}
      </>}
    </> : <>
      {(kind === "area" || kind === "step") && <path data-spark-area="" d={area} fill={fill} fillOpacity={fixture && solid ? .2 : undefined} />}
      <path d={line} data-spark-stroke="" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" opacity={active === null ? 1 : .5} />
      {active !== null && <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} clipPath={`url(#${id}-focus)`} />}
    </>}
    {active !== null && !(fixture && crosshair === "gradient") && <g className={styles.guide} style={{ transform: `translateX(${xAt(active)}px)` }}>
      <line y1={guideInset} y2={height - guideInset}
        stroke={crosshair === "gradient" ? `url(#${id}-crosshair)` : crosshairColor}
        strokeDasharray={crosshair === "dashed" ? "2 2" : undefined} data-spark-guide={crosshair} />
    </g>}
    {active !== null && fixture && crosshair === "gradient" && <g className={styles.guide} style={{ transform: `translateX(${xAt(active)}px)` }}>
      <rect x="-.5" y="0" width="1" height={height} fill={`url(#${id}-crosshair)`} data-spark-guide={crosshair} />
    </g>}
    {dotIndex !== null && typeof dotValue === "number" && Number.isFinite(dotValue) && <g className={styles.guide} style={{ transform: `translate(${xAt(dotIndex)}px, ${yAt(dotValue)}px)` }}>
      <circle r={3} fill={color} stroke="var(--card)" strokeWidth={fixture ? 1.5 : 1.3} data-spark-dot={active === null ? "end" : "active"} />
    </g>}
  </svg>;
}

function delta(value: number | null | undefined, first: unknown) {
  return typeof first === "number" && Number.isFinite(first) && first !== 0 && typeof value === "number" && Number.isFinite(value)
    ? (value - first) / Math.abs(first) * 100 : null;
}

function numberSummary(value: number | null | undefined, format: (value: number) => string = valueFormat.format) {
  return typeof value === "number" && Number.isFinite(value) ? format(value) : "–";
}

function Change({ amount, fixture = false }: { amount: number | null; fixture?: boolean }) {
  if (amount === null) return null;
  return <small className={styles.change} style={{ color: trendColor(amount < 0, fixture) }}>
    <span aria-hidden="true">{amount < 0 ? "↓" : "↑"}</span> {!fixture && (amount >= 0 ? "+" : "−")}{Math.abs(amount).toFixed(1)}%
  </small>;
}

function trendColor(negative: boolean, fixture: boolean) {
  return fixture ? negative ? "var(--chart-negative)" : "var(--chart-positive)" : negative ? down : up;
}

export function SparklineExamples({ example, data, theme, compact, fixture = false }: {
  example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean; fixture?: boolean;
}) {
  const [indices, setIndices] = useState<Record<number, number | null>>({});
  const [range, setRange] = useState(30);
  const captionId = useId();
  const { id } = example;
  const table = id === "sparkline-table";
  const cards = id === "sparkline-default";
  const shared = id === "sparkline-synced";
  const matrix = id === "sparkline-grid";
  const rangeControl = id === "sparkline-range";
  const hoverFeel = id === "sparkline-hover-feel";
  const guideDemo = id === "sparkline-crosshairs";
  const stat = id === "sparkline-stat-card";
  const endpoint = id === "sparkline-end-dot";
  const signed = id === "sparkline-bar-negative";
  const single = !table && !cards && !shared && !matrix && !hoverFeel && !guideDemo;
  const source = compact && matrix ? data.series.slice(0, 12) : data.series;
  const categories = rangeControl ? data.categories.slice(-range) : data.categories;
  const previousValues = stat ? data.rows?.flatMap(row => typeof row.previous === "number" && Number.isFinite(row.previous) ? [row.previous] : []) : undefined;
  const previousMean = previousValues?.length ? previousValues.reduce((sum, value) => sum + value, 0) / previousValues.length : null;
  const makeSpark = (item: ChartSeries, index: number) => {
    const selected = indices[shared ? 0 : index] ?? null;
    const current = selected === null ? item.values.at(-1) : item.values[selected];
    const change = delta(current, fixture || selected === null ? item.values[0] : item.values[selected - 1]);
    const previous = delta(item.values.at(-1), item.values[0]);
    const money = table || ["Revenue", "Daily P&L"].includes(item.name);
    const format = money ? dollars.format : endpoint ? (value: number) => `${valueFormat.format(value)}${fixture ? "" : " "}ms` : valueFormat.format;
    const summaryFormat = money && !signed ? compactDollars.format : endpoint || signed ? format : compactNumber.format;
    const defaultColor = guideDemo || hoverFeel && index < 3 ? 0 : index;
    const fixtureColor = endpoint ? 3 : id === "sparkline-step" ? 4 : id === "sparkline-area-solid" ? 1
      : stat || id === "sparkline-bar" || hoverFeel && index === 3 ? 2 : matrix ? index % 5 : defaultColor;
    const color = table ? trendColor(previous !== null && previous < 0, fixture)
      : colorFor(item, fixture ? fixtureColor : defaultColor, theme);
    const kind: Kind = matrix ? matrixKinds[index % 3] : cards ? matrixKinds[index % 3] : hoverFeel ? index === 3 ? "bar" : "line"
      : id.includes("-bar") ? "bar" : id === "sparkline-step" ? "step" : id.includes("-area") || rangeControl ? "area" : "line";
    const label = guideDemo ? ["Dashed", "Solid", "Gradient"][index % 3] : hoverFeel ? hoverLabels[index % 4] : item.name;
    const selectPoint = (value: number | null) => setIndices(state => state[shared ? 0 : index] === value ? state : ({ ...state, [shared ? 0 : index]: value }));
    const plot = <Spark item={item} label={label} color={color} kind={kind}
      solid={id === "sparkline-area-solid"} endpoint={endpoint} fixture={fixture} stat={stat}
      radius={id === "sparkline-bar" ? 2 : 1} includeZero={fixture && id === "sparkline-step"}
      endMarker={fixture && (cards && index === 1 || id === "sparkline-step")}
      crosshair={guideDemo ? crosshairs[index % 3] : stat ? "gradient" : "dashed"}
      motion={hoverFeel ? hoverMotion[index % 4] : undefined} compact={compact} active={selected} categories={categories} format={format} onActive={selectPoint} />;
    return { plot, label, selected, current, change, previous, format, summaryFormat };
  };

  if (table) return <div className={styles.tableWrap} data-spark-fixture={fixture || undefined} role="region" aria-labelledby={captionId} tabIndex={compact ? undefined : 0}>
    <table className={styles.table}>
      <caption id={captionId} className={styles.srOnly}>Monthly recurring revenue by plan</caption>
      <thead><tr><th scope="col">Plan</th><th scope="col">Trend</th><th scope="col">MRR</th><th scope="col">Change</th></tr></thead>
      <tbody>{source.map((item, index) => {
        const { plot, previous, summaryFormat } = makeSpark(item, index);
        return <tr key={index}><th scope="row">{item.name}</th><td>{plot}</td><td>{numberSummary(item.values.at(-1), summaryFormat)}</td><td><Change amount={previous} fixture={fixture} /></td></tr>;
      })}</tbody>
    </table>
  </div>;

  const layout = matrix ? "matrix" : shared ? "shared" : stat ? "stat" : cards ? "cards" : hoverFeel ? "motion" : single ? "single" : "guides";
  const caption = (title: string, content: ReactNode) => <div className={styles.caption}><span>{title}</span>{content}</div>;
  const commonFooter = fixture && !compact && summaries[id];
  return <div className={styles.layout} data-spark-layout={layout} data-spark-fixture={fixture || undefined}
    data-spark-variant={id} data-spark-compact={compact || undefined}>
    {rangeControl && !compact && <div className="cartesian-controls">
      <Choices label="Time range" className={fixture ? styles.rangeChoices : "cartesian-choice-group"} options={ranges}
        value={String(range)} onChange={day => { setRange(Number(day)); setIndices({}); }} />
    </div>}
    <div className={styles.items} aria-label={matrix ? "Service trends" : undefined}>
      {source.map((original, index) => {
        const item = rangeControl ? { ...original, values: original.values.slice(-range) } : original;
        const { plot, label, selected, current, change, previous, format, summaryFormat } = makeSpark(item, index);
        const average = item.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const mean = average.length ? Math.round(average.reduce((sum, value) => sum + value, 0) / average.length) : null;
        const statChange = selected === null ? fixture ? 8.2 : delta(mean, previousMean) : delta(current, data.rows?.[selected]?.previous);
        const statValue = selected === null ? mean : current;
        const statBadge = <Change amount={statChange ?? (selected === null ? null : change)} fixture={fixture} />;
        const selectedLabel = categories[selected ?? Math.max(0, item.values.length - 1)];
        return <div className={styles.item} key={index}>
          {(cards || signed || endpoint) && caption(label, signed ? <strong style={{ color: trendColor((current ?? 0) < 0, fixture) }}>{selectedLabel}: {numberSummary(current, format)}</strong>
            : cards ? <small>{selectedLabel}</small> : <strong>{numberSummary(current, format)}</strong>)}
          {(guideDemo || hoverFeel) && caption(label, null)}
          {cards && <div className={styles.metric}><strong>{numberSummary(current, summaryFormat)}</strong><Change amount={change} fixture={fixture} /></div>}
          {shared && (fixture ? <span className={styles.sharedLabel}>{label}</span>
            : <div className={styles.seriesKey}><span>{label}</span><strong>{numberSummary(current, summaryFormat)}</strong></div>)}
          {stat && fixture && !compact && <div className={styles.statBadge}>{statBadge}</div>}
          <div className={styles.plotWrap}>{plot}
            {stat && <div className={styles.statReadout}>{(!fixture || compact) && statBadge}
              <strong>{fixture && !compact && typeof statValue === "number"
                ? <NumberFlow value={statValue} locales="en-US" respectMotionPreference />
                : numberSummary(statValue, format)}</strong>
              <small>{selected === null ? "Daily average" : selectedLabel}</small></div>}
          </div>
          {fixture && shared && <strong className={styles.sharedValue}>{numberSummary(current, summaryFormat)}</strong>}
          {!compact && (rangeControl || !fixture && single && !stat && !signed && !endpoint) && <div className={styles.summary}>
            <strong>{rangeControl ? `${numberSummary(mean)} a day on average${fixture && previous !== null ? `, ${previous >= 0 ? "up" : "down"} ${Math.abs(previous).toFixed(1)}%` : ""}`
              : `${numberSummary(current, format)}${selectedLabel ? ` on ${selectedLabel}` : ""}`}</strong>
            {rangeControl && <small>Over the last {range} days</small>}
            {!fixture && <Change amount={previous} />}
          </div>}
        </div>;
      })}
    </div>
    {commonFooter && <div className={styles.summary}><strong>{commonFooter[0]}</strong><small>{commonFooter[1]}</small></div>}
    {fixture && cards && !compact && <div className={styles.summary}>Hover a sparkline, or tab to it and use the arrow keys, to read a day</div>}
    {shared && !compact && <div className={styles.summary}>{fixture
      ? fullDate.format(Date.UTC(2026, 9, 16 + (indices[0] ?? Math.max(0, categories.length - 1))))
      : categories[indices[0] ?? Math.max(0, categories.length - 1)]}</div>}
    {fixture && !compact && matrix && <div className={styles.summary}>Last 20 minutes, November 8, 2026</div>}
  </div>;
}
