import { area, curveCatmullRom, curveMonotoneX, curveNatural, line } from "d3-shape";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartExample, ChartSeries } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { candleRows, type CartesianData } from "./data";
import { lineDate, lineDateLabel } from "./line-format";
import { colorFor, down, up, valueFormat, type ChartTheme } from "./options";
import "./composed-detail.css";

type Scale = { min: number; max: number; step: number };
type Layer = { values: readonly (number | null)[]; color: string; width?: number; dash?: string; opacity?: number; fill?: string; floor?: readonly (number | null)[]; interpolation?: typeof curveMonotoneX };
type Bar = { index: number; x: number; y: number; width: number; height: number; radius: number; color: string };
const compactValue = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dollar = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const smallCurrency = (value: number) => `$${valueFormat.format(value)}k`;
const moneyAxis = (value: number) => `${value < 0 ? "-" : ""}$${compactValue.format(Math.abs(value)).toLowerCase()}`;
const good = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const missing: ChartSeries = { name: "", values: [] };
const domains: Record<string, Scale> = {
  grouped: { min: 0, max: 2800, step: 500 }, target: { min: 0, max: 200, step: 50 },
  stacked: { min: 0, max: 900, step: 200 }, "price-volume": { min: 0, max: 100, step: 20 },
  "y-domains": { min: 0, max: 220, step: 50 }, signal: { min: 0, max: 220, step: 50 },
  "profit-loss": { min: -4000, max: 6000, step: 2000 },
};
const shortAxes = new Set(["band", "date-highlights", "price-volume", "signal", "profit-loss"]);
const footer: Record<string, [string, string]> = {
  default: ["Revenue up 21% this month", "Daily units sold, with revenue and run rate in thousands of dollars"],
  grouped: ["84% of signups activated in ten weeks", "Activations met the weekly goal in 6 of 10 weeks"],
  target: ["Above target in 7 of 12 weeks", "Revenue in thousands of dollars, with its four-week average"],
  stacked: ["Paid signups up 24% week over week", "Organic and paid signups for the last two weeks"],
  band: ["Revenue stayed inside its expected range all month", "Revenue in thousands of dollars; the band shows the expected range"],
  "date-highlights": ["Weekend columns sit inside their striped days", "Daily units, with revenue in thousands of dollars"],
  trend: ["Revenue trending up while units hold flat", "One trend line per series, fitted to the whole month"],
  "price-volume": ["Up 17.4% this month", "Opened at $182.00 and closed at $213.66"],
  "y-domains": ["Two scales, no overlap", "Units on the bottom third, revenue on its own floating axis"],
  signal: ["The average climbed 55% over the month", "4,544 signups in October, 190 on the busiest day"],
  "profit-loss": ["Closed the month $4,358 up", "1,534 trades, back above zero since October 6"],
};

function mean(values: readonly (number | null)[], span: number) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - span + 1), index + 1).filter(good);
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null;
  });
}

function linearFit(values: readonly (number | null)[]) {
  const points = values.flatMap((v, i) => good(v) ? [[i, v]] : []);
  if (points.length < 2) return [];
  const avgX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const avgY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const slope = points.reduce((sum, [x, y]) => sum + (x - avgX) * (y - avgY), 0)
    / points.reduce((sum, [x]) => sum + (x - avgX) ** 2, 0);
  return [avgY - slope * avgX, avgY + slope * (values.length - 1 - avgX)];
}

function clipDomain(base: Scale, values: readonly number[]) {
  if (!values.length) return base;
  const min = Math.min(base.min, ...values);
  const max = Math.max(base.max, ...values);
  const step = Math.max(base.step, 10 ** Math.floor(Math.log10((max - min) / 8)));
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

export function ComposedDetail({ example, data, theme, compact, demo }: {
  example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean; demo: boolean;
}) {
  const id = example.id.replace(/^composed-/, "");
  const uid = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(560, 280);
  const [selection, setSelection] = useState<number | null>(null);
  const [first = missing, second = missing, third = missing] = data.series;
  const count = data.categories.length;
  const stacked = id === "stacked";
  const grouped = id === "grouped";
  const target = id === "target";
  const signal = id === "signal";
  const market = id === "price-volume";
  const profit = id === "profit-loss";
  const floating = id === "y-domains";
  const band = id === "band";
  const dated = id === "date-highlights";
  const trend = id === "trend";
  const left = Math.min(compact ? 19 : profit ? 56 : 40, width * .25);
  const right = Math.max(left + 1, width - Math.min(compact ? 19 : market ? 56 : 40, width * .25));
  const top = Math.min(compact ? 16 : 40, height * .3);
  const bottom = Math.max(top + 1, height - top);
  const innerWidth = right - left;
  const innerHeight = bottom - top;
  const step = innerWidth / Math.max(1, count);
  const times = data.categories.map((category, index) => {
    const date = lineDate(category);
    if (!date) return NaN;
    // These October reference dates use local midnight, including the DST transition.
    return date.getTime() + (demo && !target && !grouped && !stacked && index >= 25 ? 3_600_000 : 0);
  });
  const continuous = count > 1 && times.every((time, index) => Number.isFinite(time) && (index === 0 || time > times[index - 1]));
  const xAt = (index: number) => {
    if (count === 1) return (left + right) / 2;
    if (continuous) {
      const range = times[count - 1] - times[0];
      const padding = signal ? 0 : (times[1] - times[0]) / 2;
      return left + (times[index] - times[0] + padding) / (range + 2 * padding) * innerWidth;
    }
    return signal ? left + index * innerWidth / Math.max(1, count - 1) : left + (index + .5) * step;
  };
  const pick = (series: ChartSeries) => data.categories.map((_, index) => series.values[index] ?? null);
  const a = pick(first), b = pick(second), c = pick(third);
  const [, color2, , color4] = theme.colors;
  const firstColor = colorFor(first, grouped ? 1 : 0, theme);
  const secondColor = colorFor(second, grouped ? 3 : stacked ? 1 : 2, theme);
  const mutedBar = `color-mix(in oklch, ${theme.muted} 35%, transparent)`;
  const rising = `var(--chart-positive, ${up})`;
  const falling = `var(--chart-negative, ${down})`;
  const suppliedCandles = market && Boolean(data.rows?.length);
  const candles = market && (suppliedCandles || first.values.some(good)) ? candleRows(data) : [];
  const close = candles.length ? candles.map(row => row[1]) : a;
  const priceDomain = demo ? { min: 155, max: 225, step: 10 } : clipDomain({ min: 0, max: 10, step: 10 }, candles.flat().filter(good));
  const volumeDomain = demo ? { min: 0, max: 100, step: 20 } : clipDomain({ min: 0, max: 10, step: 10 }, b.filter(good));
  const extrema = stacked ? data.categories.flatMap((_, index) => [
    data.series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0),
    data.series.reduce((sum, item) => sum + Math.min(0, item.values[index] ?? 0), 0),
  ]) : [...a, ...b, ...c].filter(good);
  const baseDomain = domains[id] ?? { min: 0, max: 160, step: 50 };
  const scale = demo ? baseDomain : market ? volumeDomain : clipDomain(baseDomain, extrema);
  const yAt = (value: number, domain = scale) => bottom - (value - domain.min) / (domain.max - domain.min) * innerHeight;
  const lineScale = market ? priceDomain : floating ? demo ? { min: 65, max: 130, step: 10 } : clipDomain({ min: 0, max: 10, step: 10 }, a.filter(good)) : scale;
  const curve = band ? curveCatmullRom : dated || floating || signal || profit ? curveMonotoneX : curveNatural;
  const linePath = (values: readonly (number | null)[], interpolation = curve) => line<number | null>()
    .defined(good).x((_, i) => xAt(i)).y(v => yAt(v!, lineScale)).curve(interpolation)(values) ?? undefined;
  const average = third.values.length ? c : mean(signal ? a : market ? close : a, signal ? 7 : market ? 5 : target ? 4 : 7);
  const expected = band ? mean(a, 5) : [];
  const limits = (key: "low" | "high", offset: number) => data.categories.map((_, index) => {
    const provided = data.rows?.[index]?.[key];
    return good(provided) ? provided : good(expected[index]) ? expected[index] + offset : null;
  });
  const low = band ? limits("low", -10) : [];
  const high = band ? limits("high", 13) : [];
  const baseline = Array(count).fill(0) as number[];
  const lineColor = grouped ? colorFor(third, 0, theme) : target ? colorFor(second, 2, theme) : firstColor;
  const fade = `url(#${uid}-line)`;
  const fill = `url(#${uid}-area)`;
  const layers: Layer[] = [];
  if (id === "default" || target) {
    layers.push({ values: average, color: target ? color2 : color4, width: 2, fill, floor: baseline, interpolation: curveMonotoneX });
  }
  if (!stacked) {
    const values = grouped ? c : target ? b : signal || market ? average : a;
    layers.push({ values, color: profit ? `url(#${uid}-sign)` : fade, width: market ? 1.5 : profit ? 2 : 2.5 });
  }
  if (band) {
    layers.push({ values: high, color: firstColor, width: 1, dash: "3 4", opacity: .5, fill, floor: low });
    layers.push({ values: low, color: firstColor, width: 1, dash: "3 4", opacity: .5 });
  }
  const barLimit = market ? 9 : profit ? 12 : band || floating ? 14 : dated ? 18 : Infinity;
  const barWidth = grouped ? Math.max(0, (step * .92 - 4) / 2) : Math.min(step * .88, barLimit);
  const barRadius = market || profit || stacked ? 0 : band || floating ? 3 : 4;
  const barColor = market || profit ? mutedBar : band || floating || dated
    ? `color-mix(in oklch, ${secondColor} ${band ? 30 : floating ? 40 : 32}%, transparent)` : secondColor;
  function makeBar(index: number, value: number, color: string, center = xAt(index)): Bar {
    const scaleValue = market ? (v: number) => yAt(v * 2 / 7, volumeDomain)
      : profit ? (v: number) => bottom - v / (demo ? 220 : Math.max(220, ...b.filter(good))) * innerHeight
      : yAt;
    const from = scaleValue(0);
    const to = scaleValue(value);
    return { index, x: center - barWidth / 2, y: Math.min(from, to), width: barWidth,
      height: Math.abs(to - from), radius: barRadius, color };
  }
  const bars = data.categories.flatMap((_, index) => {
    if (signal) return [];
    if (stacked) {
      let pos = 0, neg = 0, positiveLayers = 0, negativeLayers = 0;
      return data.series.flatMap((item, position) => {
        const value = item.values[index];
        if (!good(value) || value === 0) return [];
        const from = value > 0 ? pos : neg;
        const layers = value > 0 ? positiveLayers++ : negativeLayers++;
        if (value > 0) pos += value;
        else neg += value;
        const to = yAt(from + value), prev = yAt(from);
        return [{ index, x: xAt(index) - barWidth / 2, width: barWidth, y: Math.min(to, prev) + (value > 0 ? -layers * 2 : 2 + layers * 2),
          height: Math.max(0, Math.abs(prev - to) - (layers === 0 ? 2 : 0)), radius: 0, color: colorFor(item, position, theme) }];
      });
    }
    if (grouped) {
      const offset = barWidth / 2 + 2;
      return [a[index], b[index]].flatMap((value, position) => good(value)
        ? [makeBar(index, value, position ? secondColor : firstColor, xAt(index) + (position ? offset : -offset))] : []);
    }
    const value = target ? a[index] : b[index];
    return good(value) ? [makeBar(index, value, target ? firstColor : barColor)] : [];
  });
  const tickMin = market ? Math.ceil(priceDomain.min / priceDomain.step) * priceDomain.step : scale.min;
  const tickMax = market ? priceDomain.max : scale.max;
  const tickStep = market ? priceDomain.step : scale.step;
  const grid = Array.from({ length: Math.min(16, Math.floor((scale.max - scale.min) / scale.step) + 1) }, (_, i) => scale.min + i * scale.step);
  const yTicks = Array.from({ length: Math.min(16, Math.floor((tickMax - tickMin) / tickStep) + 1) }, (_, i) => tickMin + i * tickStep);
  const xCount = compact ? 3 : width < 360 ? count <= 14 ? 2 : 3 : grouped ? 4 : target || stacked || shortAxes.has(id) ? 5 : 8;
  const xTicks = demo && target && xCount === 5 ? [0, 3, 6, 9, 11] : Array.from(new Set(Array.from({ length: Math.min(xCount, count) }, (_, i) => {
    const last = Math.min(xCount, count) - 1;
    return last ? Math.round(i * (count - 1) / last) : 0;
  })));
  const active = selection !== null && selection < count ? selection : null;
  const focusX = active === null ? 0 : xAt(active);
  const centerValue = active === null ? "" : data.categories[active];
  const pillWidth = cartesianPillWidth(centerValue);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, focusX));
  const horizontalTips = id === "default" || target || grouped || stacked;
  function entries(index: number) {
    const row = (name: string, value: unknown, color: string, format: (v: number) => number | string = v => v) =>
      good(value) && name ? [{ name, value: format(value), color }] : [];
    const money = demo && (id === "default" || target || dated) ? smallCurrency : undefined;
    const primary = row(first.name, a[index], firstColor, money);
    const secondary = row(second.name, b[index], secondColor, money && target ? money : undefined);
    const tertiary = row(third.name, c[index], lineColor);
    if (grouped || stacked) return [...primary, ...secondary, ...tertiary];
    if (target) return [...row("Trend", average[index], color2, money), ...primary, ...secondary];
    if (signal) return [...primary, ...row("7-day average", average[index], firstColor, demo ? value => Math.round(value * 10) / 10 : undefined)];
    if (market) return [...secondary, ...row(first.name || "Close", close[index], firstColor), ...row("5-day average", average[index], firstColor)];
    if (id === "default") return [...row("Run rate", average[index], color4, money), ...secondary, ...primary];
    return [...secondary, ...primary, ...(band && good(low[index]) && good(high[index]) ? [{ name: "Expected", color: firstColor, value: `${valueFormat.format(low[index]!)} – ${valueFormat.format(high[index]!)}` }] : [])];
  }
  function pointer(event: PointerEvent<SVGSVGElement>) {
    if (compact || !count) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * width / bounds.width;
    const y = (event.clientY - bounds.top) * height / bounds.height;
    if (x < left || x > right || y < top || y > bottom) { setSelection(null); return; }
    setSelection(data.categories.reduce((nearest, _, i) => Math.abs(x - xAt(i)) < Math.abs(x - xAt(nearest)) ? i : nearest, 0));
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelection(null);
      return;
    }
    const change: Record<string, number> = {
      Home: 0, End: count - 1,
      ArrowLeft: Math.max(0, (active ?? count) - 1), ArrowUp: Math.max(0, (active ?? count) - 1),
      ArrowRight: Math.min(count - 1, (active ?? -1) + 1), ArrowDown: Math.min(count - 1, (active ?? -1) + 1),
    };
    if (count && Object.hasOwn(change, event.key)) {
      event.preventDefault();
      setSelection(change[event.key]);
    }
  }

  const weekendSegments = dated ? data.categories.flatMap((value, i) => {
    const day = lineDate(value)?.getUTCDay();
    if (day !== 6 && !(i === 0 && day === 0)) return [];
    const start = Math.max(left, xAt(i) - step / 2);
    const endIndex = Math.min(count - 1, i + (day === 6 ? 2 : 1));
    return [[start, endIndex === count - 1 ? right : xAt(endIndex) - step / 2]];
  }) : [];
  const markerX = dated && count ? xAt(Math.min(count - 1, demo ? 21 : Math.floor(count * .7))) : 0;
  const label = demo ? footer[id] : undefined;
  const focusValue = active === null ? null : (target ? b[active] : grouped ? c[active] : signal || market ? average[active] : a[active]);
  const focusEntries = active === null ? [] : entries(active);
  const alignLeft = focusX > width * .58;
  const readoutWidth = Math.min(182, Math.max(110, width / 2));
  const readoutX = Math.max(4, Math.min(width - readoutWidth - 4, focusX + (alignLeft ? -readoutWidth - 12 : 12)));
  const zeroOffset = `${100 * (scale.max / (scale.max - scale.min))}%`;
  return <div className="composed-detail" data-composed-id={id}>
    <div className="composed-detail-plot" ref={plot}>
      <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
        aria-label={example.title} aria-describedby={compact ? undefined : `${uid}-keys`} tabIndex={compact || !count ? undefined : 0}
        onKeyDown={keyboard} onPointerMove={pointer} onPointerDown={pointer} onPointerLeave={event => { if (event.pointerType !== "touch") setSelection(null); }}
        onPointerCancel={() => setSelection(null)} onBlur={() => setSelection(null)}>
        {!compact && <desc id={`${uid}-keys`}>Use the arrow keys to inspect each date. Home and End select the first and last dates. Escape clears the selection.</desc>}
        <defs>
          <linearGradient id={`${uid}-line`}>
            <stop offset="0" stopColor={lineColor} stopOpacity="0" /><stop offset=".12" stopColor={lineColor} />
            <stop offset=".88" stopColor={lineColor} /><stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-area`} x2="0%" y2="100%">
            <stop offset="0" stopColor={target ? color2 : band ? firstColor : color4} stopOpacity=".32" />
            <stop offset="1" stopColor={target ? color2 : band ? firstColor : color4} stopOpacity=".04" />
          </linearGradient>
          <linearGradient id={`${uid}-trend`}><stop offset="0" stopColor={firstColor} stopOpacity="0" /><stop offset=".25" stopColor={firstColor} /><stop offset=".75" stopColor={firstColor} /><stop offset="1" stopColor={firstColor} stopOpacity="0" /></linearGradient>
          <linearGradient id={`${uid}-sign`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}>
            <stop offset={zeroOffset} stopColor={rising} /><stop offset={zeroOffset} stopColor={falling} />
          </linearGradient>
          {dated && <>
            <pattern id={`${uid}-weekend`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1L1 -1M0 6L6 0M5 7L7 5" stroke={theme.muted} strokeOpacity=".18" /></pattern>
            <pattern id={`${uid}-deadline`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1L1 -1M0 6L6 0M5 7L7 5" stroke={falling} strokeOpacity=".22" /></pattern>
          </>}
          <clipPath id={`${uid}-clip`}><rect x={left} y={top} width={innerWidth} height={innerHeight} /></clipPath>
        </defs>
        <g aria-hidden="true" data-composed-grid="">
          {grid.map(value => <line key={value} x1={left} x2={right} y1={yAt(value)} y2={yAt(value)} stroke={theme.grid} strokeDasharray="4 4" />)}
        </g>
        <g aria-hidden="true" clipPath={`url(#${uid}-clip)`}>
          {weekendSegments.map(([start, end], i) => <rect key={i} data-composed-weekend="" x={start} y={top} width={Math.max(0, end - start)} height={innerHeight} fill={`url(#${uid}-weekend)`} />)}
          {dated && count > 0 && <g data-composed-deadline="">
            <rect x={markerX} y={top} width={right - markerX} height={innerHeight} fill={`url(#${uid}-deadline)`} opacity=".6" />
            <line x1={markerX} x2={markerX} y1={top} y2={bottom} stroke={falling} />
            <text x={Math.min(right - 70, markerX + 6)} y={top + 6} dominantBaseline="hanging" fontSize="11" fill={falling}>Quarter close</text>
          </g>}
          {layers.map(({ values, floor, fill, color, width, dash, opacity, interpolation = curve }, index) => <g key={index}>
            {floor && <path data-composed-area="" fill={fill} d={area<number | null>().defined((value, i) => good(value) && good(floor[i]))
              .x((_, i) => xAt(i)).y0((_, i) => yAt(floor[i]!, lineScale)).y1(v => yAt(v!, lineScale)).curve(interpolation)(values) ?? undefined} />}
            <path data-composed-line="" d={linePath(values, interpolation)} fill="none" stroke={color} strokeWidth={width}
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} strokeOpacity={opacity} opacity={active === null || band ? 1 : .45} />
          </g>)}
          {trend && [a, b].map((values, i) => {
            const [from, to] = linearFit(values);
            return good(from) && good(to) && <path key={i} data-composed-trend="" d={`M${xAt(0)},${yAt(from)}L${xAt(count - 1)},${yAt(to)}`}
              fill="none" stroke={i ? secondColor : `url(#${uid}-trend)`} strokeWidth="2" strokeLinecap="round" strokeDasharray={i ? "2 4" : "6 4"} />;
          })}
          {bars.map((bar, i) => <rect key={i} data-composed-bar={bar.index} x={bar.x} y={bar.y} width={bar.width} height={bar.height}
            rx={bar.radius} fill={bar.color} opacity={active === null || active === bar.index ? 1 : .35} />)}
          {candles.map(([open, close, low, high], i) => {
            const bodyWidth = step * .55;
            const fill = close >= open ? rising : falling;
            const x = xAt(i);
            const color = first.color ?? fill;
            const y = (value: number) => yAt(value, lineScale);
            return <g key={i} opacity={active === null || active === i ? 1 : .45}>
              <rect data-composed-wick={i} x={x - .75} y={y(high)} width="1.5" height={Math.max(0, y(low) - y(high))} fill={color} />
              <rect data-composed-candle={i} x={x - bodyWidth / 2} y={Math.min(y(open), y(close))} width={bodyWidth}
                height={Math.max(.01, Math.abs(y(open) - y(close)))} rx="1" fill={color} stroke={color} />
            </g>;
          })}
          {signal && a.map((value, i) => good(value) && <circle key={i} data-composed-point={i} cx={xAt(i)} cy={yAt(value)} r="3.5"
            fill={firstColor} fillOpacity={active === null || active === i ? .55 : .25} />)}
          {active !== null && !stacked && <line x1={focusX} x2={focusX} y1={top} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />}
        </g>
        <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 10 : 12}>
          {xTicks.map(index => <text key={index} data-composed-date="" x={xAt(index)} y={bottom + (compact ? 13 : 24)} textAnchor="middle"
            opacity={active !== null && Math.abs(xAt(index) - pillX) < pillWidth / 2 + 24 ? 0 : 1}>{data.categories[index]}</text>)}
          {!compact && (grouped || stacked || profit || market) && yTicks.map(value => <text key={value} data-composed-tick="" x={market ? right + 4 : left - 4}
            y={yAt(value, market ? priceDomain : scale)} textAnchor={market ? "start" : "end"} dominantBaseline="middle">
            {market ? dollar.format(value) : profit ? moneyAxis(value) : compactValue.format(value).toLowerCase()}
          </text>)}
        </g>
        {active !== null && !compact && <>
          <CartesianDatePill x={pillX} y={Math.min(height - 32, bottom + 5)} label={centerValue} width={pillWidth} text={theme.text} surface={theme.surface} />
          {good(focusValue) && !stacked && <CartesianFocusPoint x={focusX} y={yAt(focusValue, lineScale)} color={lineColor} surface={theme.surface} halo={!horizontalTips} />}
        </>}
      </svg>
      {active !== null && focusEntries.length > 0 && <div className="composed-detail-readout" style={{ left: readoutX, top, width: readoutWidth }}>
        <CartesianReadout label={lineDateLabel(centerValue)} entries={focusEntries} />
      </div>}
    </div>
    {!compact && label && <div className="composed-detail-summary"><strong>{label[0]}</strong><span>{label[1]}</span></div>}
  </div>;
}
