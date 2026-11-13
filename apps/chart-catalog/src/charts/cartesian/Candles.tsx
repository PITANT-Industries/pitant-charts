import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartExample } from "../../types";
import { Choices } from "../../ui/Choices";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { candleRows, type CartesianData } from "./data";
import { down, up, type ChartTheme } from "./options";
import "./candles.css";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const weeklyPercent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const tooltipDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Europe/Berlin" });
const summaryDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "Europe/Berlin" });
const windows = [{ label: "3 months", value: "92" }, { label: "30 days", value: "30" }, { label: "14 days", value: "14" }] as const;
type Period = (typeof windows)[number]["value"];

type Axes = { minimum: number; maximum: number; tick: number; dates: number[] };
const recentAxis = { minimum: 152, maximum: 172, tick: 5, dates: [0, 7, 15, 22, 29] };
const finalAxis = { minimum: 156, maximum: 170, tick: 2, dates: [0, 3, 7, 10, 13] };
const referenceAxes: Record<string, Axes> = {
  "candlestick-default": { minimum: 175, maximum: 225, tick: 10, dates: [0, 10, 20, 30] },
  "candlestick-minimal": { minimum: 56, maximum: 76, tick: 0, dates: [0, 6, 13, 19] },
  "candlestick-colors": { minimum: 390, maximum: 450, tick: 10, dates: [0, 5, 10, 15] },
  "candlestick-range": { minimum: 135, maximum: 175, tick: 10, dates: [0, 30, 61, 91] },
  "candlestick-crosshair": recentAxis,
  "candlestick-pattern": { ...finalAxis, dates: [0, 8, 16, 23] },
};

export function Candles({ example, data, theme, compact }: { example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean }) {
  const { id, title } = example;
  const uid = useId();
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, height: 300 });
  const [period, setPeriod] = useState<Period>("92");
  const [active, setActive] = useState<number | null>(null);
  const minimal = id === "candlestick-minimal";
  const patterned = id === "candlestick-pattern";
  const coloredGuide = id === "candlestick-crosshair";
  const customColors = id === "candlestick-colors";
  const ranged = id === "candlestick-range";
  const categories = ranged ? data.categories.slice(-Number(period)) : data.categories;
  const dates = ranged ? data.candleDates?.slice(-Number(period)) : data.candleDates;
  const values = candleRows(data).slice(-categories.length || data.categories.length);
  const { width, height } = size;
  const margin = compact ? 12 : minimal ? 16 : 40;
  const top = compact ? 8 : margin;
  const bottom = Math.max(top + 1, height - (minimal && !compact ? 40 : compact ? 22 : margin));
  const left = Math.min(margin, Math.max(0, width / 2 - 1));
  const right = Math.max(left + 1, width - left);
  const plotWidth = right - left;
  const intervals = dates && dates.length > 1 ? (customColors ? 7 : 1) * 86_400_000 : 0;
  const positions = categories.map((_, index) => dates && intervals ? (+dates[index] - +dates[0]) / intervals : index);
  const averageGap = positions.length > 1 ? (positions.at(-1) ?? 0) / (positions.length - 1) : 1;
  const step = plotWidth / Math.max(1, positions.length) / averageGap;
  const x = (index: number) => left + ((positions[index] ?? 0) + averageGap / 2) * step;
  const lowest = values.reduce((result, row) => Math.min(result, ...row), Infinity);
  const highest = values.reduce((result, row) => Math.max(result, ...row), -Infinity);
  const padding = Number.isFinite(highest - lowest) ? Math.max(0.8, (highest - lowest) * 0.08) : 1;
  const reference = dates && (ranged && period !== "92" ? period === "30" ? recentAxis : finalAxis : referenceAxes[id]);
  const minimum = reference ? reference.minimum : Number.isFinite(lowest) ? lowest - padding : 0;
  const maximum = reference ? reference.maximum : Number.isFinite(highest) ? highest + padding : 1;
  const y = (price: number) => bottom - (price - minimum) / (maximum - minimum) * (bottom - top);
  const tick = reference ? reference.tick : (maximum - minimum) / 4;
  const firstTick = reference && tick ? Math.ceil(minimum / tick) * tick : minimum;
  const prices = tick ? Array.from({ length: Math.floor((maximum - firstTick) / tick + 1e-8) + 1 }, (_, index) => firstTick + index * tick) : [];
  const tickCount = Math.min(values.length, Math.max(2, Math.floor(plotWidth / 82)));
  const dateTicks = reference && !compact ? reference.dates : Array.from({ length: tickCount }, (_, index) => Math.round(index * (values.length - 1) / Math.max(1, tickCount - 1)));
  const positive = customColors ? theme.colors[1] : `var(--chart-positive, ${up})`;
  const negative = customColors ? theme.colors[4] : `var(--chart-negative, ${down})`;
  const widthOfBody = Math.min(customColors ? 18 : Infinity, step * .8);
  const activeIndex = active !== null && active < values.length ? active : null;
  const selected = activeIndex === null ? undefined : values[activeIndex];
  const label = activeIndex === null ? "" : categories[activeIndex];
  const date = activeIndex === null ? undefined : dates?.[activeIndex];
  const cursorX = activeIndex === null ? 0 : x(activeIndex);
  const pillWidth = cartesianPillWidth(label);
  const pillX = Math.max(pillWidth / 2 + 2, Math.min(width - pillWidth / 2 - 2, cursorX));
  const hasTooltip = Boolean(selected) && !compact;
  const tooltipSpace = width - cursorX - 16;
  const tooltipAnchor = tooltipSpace >= 152 ? { left: cursorX + 16 } : cursorX >= 172
    ? { right: tooltipSpace + 32 } : { left: Math.max(4, width - 156) };
  const negativeCandle = selected && selected[1] < selected[0];
  const cursorColor = coloredGuide ? (negativeCandle ? negative : positive) : `color-mix(in oklab, ${theme.muted} 80%, transparent)`;
  const swatch = coloredGuide ? cursorColor : theme.colors[customColors ? negativeCandle ? 4 : 1 : 0];
  const dimmedOpacity = minimal || coloredGuide ? .25 : .3;
  const tooltipFields = minimal ? [["Close", 1]] as const : [["Open", 0], ["High", 3], ["Low", 2], ["Close", 1]] as const;
  const firstOpen = values[0]?.[0];
  const lastClose = values.at(-1)?.[1];
  const change = firstOpen && lastClose !== undefined ? (lastClose - firstOpen) / Math.abs(firstOpen) * 100 : 0;
  const rising = values.filter(row => row[1] >= row[0]).length;
  const periodLabel = windows.find(option => option.value === period)?.label;
  const firstDate = dates?.[0] ? summaryDate.format(dates[0]) : categories[0];
  const titleSuffix = ranged ? `over the last ${periodLabel}` : !reference ? `since ${firstDate}`
    : minimal ? "in twenty days" : customColors ? "over sixteen weeks" : coloredGuide || patterned ? `since ${firstDate}` : "this month";
  const pricesSummary = firstOpen !== undefined && lastClose !== undefined ? `Opened at ${dollars.format(firstOpen)} and closed at ${dollars.format(lastClose)}` : "";
  const counts = `${rising} rising and ${values.length - rising} falling days`;
  const summary = ranged ? "The buttons narrow the visible window; the data stays the same"
    : patterned ? `${counts}, striped bodies on solid wicks`
    : !reference ? pricesSummary
    : customColors ? "One candle per week, rising and falling weeks in two chart colors"
    : minimal && firstOpen !== undefined && lastClose !== undefined ? `From a ${dollars.format(firstOpen)} open on ${firstDate} to a ${dollars.format(lastClose)} close`
    : coloredGuide ? `${counts}, with the guide matching the candle direction` : pricesSummary;
  const TrendIcon = change >= 0 ? TrendingUp : TrendingDown;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize(previous => previous.width === width && previous.height === height ? previous : { width: Math.max(1, width), height: Math.max(1, height) });
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!values.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - rect.left) * width / rect.width;
    const vertical = (event.clientY - rect.top) * height / rect.height;
    if (position < left || position > right || vertical < top || vertical > bottom) {
      setActive(null);
      return;
    }
    const projected = (position - left) / step - averageGap / 2;
    let start = 0, end = positions.length - 1;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (projected <= (positions[middle] + positions[middle + 1]) / 2) end = middle;
      else start = middle + 1;
    }
    const nearest = start;
    setActive(nearest);
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (!values.length) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      setActive(null);
      return;
    }
    const previous = Math.max(0, (activeIndex ?? 0) - 1);
    const next = Math.min(values.length - 1, (activeIndex ?? -1) + 1);
    const index = { ArrowLeft: previous, ArrowUp: previous, ArrowRight: next, ArrowDown: next, Home: 0, End: values.length - 1 }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    setActive(index);
  }

  return <div className="cartesian-example candle-example">
    {ranged && !compact && <Choices label="Visible range" className="candle-range-controls" options={windows} value={period} onChange={window => { setActive(null); setPeriod(window); }} />}
    <div ref={host} className={`cartesian-plot cartesian-candles${minimal && !compact ? " cartesian-candles--minimal" : ""}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={title}
        aria-describedby={!compact && values.length ? `${uid}-summary` : undefined}
        tabIndex={compact || patterned ? undefined : 0} onPointerMove={compact || patterned ? undefined : move}
        onPointerDown={compact || patterned ? undefined : move} onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }}
        onBlur={() => setActive(null)} onKeyDown={compact || patterned ? undefined : key}>
        <defs>
          {coloredGuide && [positive, negative].map((color, index) => <linearGradient key={index} id={`${uid}-candle-gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop stopColor={theme.colors[index ? 3 : 1]} /><stop offset="100%" stopColor={color} />
          </linearGradient>)}
          {patterned && <pattern id={`${uid}-candle-pattern`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6L6 0M-1.5 1.5L1.5 -1.5M4.5 7.5L7.5 4.5" fill="none" stroke={theme.surface} strokeWidth="1.5" strokeLinecap="square" />
          </pattern>}
          <linearGradient id={`${uid}-candle-guide`} x1="0%" y1="0%" x2="0%" y2="100%">
            {[0, .1, .9, 1].map(offset => <stop key={offset} offset={offset} stopColor={cursorColor} stopOpacity={offset === 0 || offset === 1 ? 0 : 1} />)}
          </linearGradient>
          <linearGradient id={`${uid}-candle-grid-fade`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
            {[0, .1, .9, 1].map(offset => <stop key={offset} offset={offset} stopColor={theme.grid} stopOpacity={offset === 0 || offset === 1 ? 0 : 1} />)}
          </linearGradient>
        </defs>
        {!minimal && prices.map(price => <g key={price}>
          {!patterned && <line data-candle-grid x1={left} y1={y(price)} x2={right} y2={y(price)} stroke={`url(#${uid}-candle-grid-fade)`} strokeDasharray="4 4" />}
          {!compact && <text data-candle-price x={left - 4} y={y(price)} textAnchor="end" dominantBaseline="middle" fill={theme.muted} fontSize="12">{Number(price.toPrecision(5))}</text>}
        </g>)}
        {dateTicks.map(index => <text data-candle-date key={index} x={x(index)} y={bottom + (compact ? 14 : 24)} fill={theme.muted}
          opacity={hasTooltip && Math.abs(x(index) - pillX) < pillWidth / 2 + 13 ? 0 : 1} textAnchor="middle" fontSize={compact ? 8 : 12}>{categories[index]}</text>)}
        {hasTooltip && <rect data-candle-crosshair x={cursorX - .5} y={top} width="1" height={bottom - top} fill={`url(#${uid}-candle-guide)`} />}
        {values.map(([open, close, low, high], index) => {
          const direction = close >= open ? 0 : 1;
          const color = direction ? negative : positive;
          const fill = coloredGuide ? `url(#${uid}-candle-gradient-${direction})` : color;
          const center = x(index);
          const bodyTop = y(Math.max(open, close));
          const bodyBottom = y(Math.min(open, close));
          const bodyHeight = bodyBottom - bodyTop;
          const mark = { x: center - widthOfBody / 2, y: bodyTop, width: widthOfBody, height: bodyHeight, rx: 1 };
          return <g className="candle-mark" key={index} data-candle={direction ? "down" : "up"} data-active={activeIndex === index}
            opacity={activeIndex === null || activeIndex === index ? 1 : dimmedOpacity}>
            <rect data-candle-wick="upper" x={center - .75} y={y(high)} width="1.5" height={Math.max(0, bodyTop - y(high))} fill={fill} />
            <rect data-candle-wick="lower" x={center - .75} y={bodyBottom} width="1.5" height={Math.max(0, y(low) - bodyBottom)} fill={fill} />
            <rect data-candle-body {...mark} fill={fill} stroke={fill} strokeWidth="1" />
            {patterned && <rect {...mark} fill={`url(#${uid}-candle-pattern)`} />}
            {patterned && widthOfBody >= 1 && bodyHeight >= 1 && <rect {...mark} x={mark.x + .5} y={mark.y + .5} width={widthOfBody - 1} height={bodyHeight - 1} fill="none" stroke={color} />}
          </g>;
        })}
        {selected && hasTooltip && !coloredGuide && <CartesianFocusPoint x={cursorX} y={y(selected[1])} color={theme.colors[0]} surface="var(--background)" halo={false} />}
        {hasTooltip && <CartesianDatePill x={pillX} y={bottom + 4} label={label} text={theme.text} surface={theme.surface} />}
      </svg>
      {!compact && !patterned && <div className="candle-readout" role="status" style={{ top, ...tooltipAnchor }}>
        {selected && <CartesianReadout live={false} label={date ? tooltipDate.format(date) : label}
          entries={tooltipFields.map(([name, index]) => ({ name, value: dollars.format(selected[index]), color: swatch }))} />}
      </div>}
    </div>
    {!compact && values.length > 0 && <div id={`${uid}-summary`} className="candle-summary">
      <strong>{change >= 0 ? "Up" : "Down"} {(customColors && reference ? weeklyPercent : percent).format(Math.abs(change))}% {titleSuffix}{!ranged && <TrendIcon size={15} aria-hidden="true" />}</strong>
      <span>{summary}</span>
    </div>}
  </div>;
}
