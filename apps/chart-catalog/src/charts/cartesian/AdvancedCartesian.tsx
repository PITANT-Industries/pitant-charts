import { curveNatural, line } from "d3-shape";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { lineDate, lineDateLabel } from "./line-format";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import { finiteLineValue, lineCalendar, lineFormatValue, lineValueScale } from "./line-input";
import "./advanced-cartesian.css";

type Variant = "bar-stacked" | "line-threshold";

function stackSegments(data: CartesianData, theme: ChartTheme) {
  return data.categories.map((_, category) => {
    let aboveZero = 0;
    let belowZero = 0;
    let positiveLayers = 0;
    let negativeLayers = 0;
    return data.series.flatMap((series, index) => {
      const value = series.values[category];
      if (value == null || !Number.isFinite(value)) return [];
      const negative = value < 0;
      const from = negative ? belowZero : aboveZero;
      const to = from + value;
      const offset = negative ? 2 * negativeLayers : -2 * positiveLayers;
      if (negative) {
        belowZero = to;
        negativeLayers++;
      } else if (value > 0) {
        aboveZero = to;
        positiveLayers++;
      }
      return [{ from, to, value, offset, color: colorFor(series, index, theme), index }];
    });
  });
}

function barOutline(left: number, top: number, width: number, height: number, negative: boolean) {
  const right = left + width;
  const bottom = top + height;
  const radius = Math.min(8, width / 2, height);
  return negative
    ? `M${left} ${top}H${right}V${bottom - radius}A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}H${left + radius}A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}Z`
    : `M${left + radius} ${top}H${right - radius}A${radius} ${radius} 0 0 1 ${right} ${top + radius}V${bottom}H${left}V${top + radius}A${radius} ${radius} 0 0 1 ${left + radius} ${top}Z`;
}

function calendarOffsets(categories: string[]) {
  const times = categories.map(category => {
    const date = lineDate(category);
    return date ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime() : NaN;
  });
  if (!Number.isFinite(times[0]) || times.some((time, index) => index > 0 && !(time > times[index - 1]))) return null;
  const first = times[0];
  const range = times[times.length - 1] - first;
  return times.map(time => range ? (time - first) / range : .5);
}

export function AdvancedCartesian({ variant, label, data, compact, theme, demo = true }: {
  variant: Variant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme; demo?: boolean;
}) {
  const uid = useId();
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<number | null>(null);
  useEffect(() => { if (!demo) setSelection(null); }, [data, demo]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    function measure(width: number, height: number) {
      setSize(previous => width === previous.width && height === previous.height ? previous : { width, height });
    }
    measure(element.clientWidth, element.clientHeight);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const isBar = variant === "bar-stacked";
  const sideInset = Math.min(compact ? 20 : 40, width * (isBar && !compact ? .32 : .13));
  const verticalInset = Math.min(compact ? 20 : 40, height * (isBar && !compact ? .45 : .24));
  const left = sideInset + (!compact && !isBar ? 16 : 0);
  const right = Math.max(left + 1, width - sideInset);
  const top = verticalInset;
  const bottom = Math.max(top + 1, height - verticalInset);
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const count = data.categories.length;
  const span = plotWidth / Math.max(1, isBar ? count + .2 : count - 1);
  const callerCalendar = !demo && !isBar ? lineCalendar(data) : undefined;
  const offsets = isBar ? null : demo ? calendarOffsets(data.categories)
    : callerCalendar?.times && count > 1 ? callerCalendar.times.map(time => (time - callerCalendar.times![0]) / (callerCalendar.times!.at(-1)! - callerCalendar.times![0])) : null;
  const xAt = (index: number) => {
    if (offsets) return left + offsets[index] * plotWidth;
    return !count || !isBar && count === 1 ? (left + right) / 2 : left + (isBar ? .6 + index : index) * span;
  };
  const stacks = isBar ? stackSegments(data, theme) : [];
  const extents = isBar ? stacks.flatMap(stack => stack.map(({ to }) => to)) : data.series.flatMap(item => item.values.filter((value): value is number => value != null && Number.isFinite(value)));
  const increment = isBar ? 500 : 50;
  let minimum = 0;
  let maximum = isBar ? 3500 : 350;
  for (const value of extents) {
    minimum = Math.min(minimum, Math.floor(value / increment) * increment);
    maximum = Math.max(maximum, Math.ceil(value / increment) * increment);
  }
  const threshold = demo ? 250 : data.rows?.map(row => row.threshold).find(finiteLineValue);
  const callerScale = !demo && !isBar ? lineValueScale([...data.series.map(item => item.values), threshold === undefined ? [] : [threshold]]) : undefined;
  const yAt = (value: number) => callerScale ? callerScale.position(value, bottom, top) : bottom - (value - minimum) / (maximum - minimum) * plotHeight;
  const ticks = callerScale?.ticks ?? Array.from({ length: 8 }, (_, index) => Math.round(minimum + (maximum - minimum) * index / 7));
  const tickY = (value: number) => callerScale ? callerScale.positionUnit(value, bottom, top) : yAt(value);
  const points = line<number | null>().defined(value => value != null && Number.isFinite(value))
    .x((_, index) => xAt(index)).y(value => yAt(value!)).curve(curveNatural);
  const paths = isBar ? [] : data.series.map((item, index) => ({
    index, path: points(data.categories.map((_, at) => item.values[at] ?? null)), color: colorFor(item, index, theme), strokeWidth: index === 0 ? 3 : 2.5,
  }));
  const active = selection !== null && selection < count ? selection : null;
  const activeX = active === null ? 0 : xAt(active);
  const highlightSpan = offsets && count > 1 ? xAt(1) - xAt(0) : span;
  const readoutMinWidth = isBar ? 141 : 149;
  const readoutRight = width - activeX >= readoutMinWidth + 16 || activeX < width / 2;
  const readoutRoom = (readoutRight ? width - activeX : activeX) - 16;
  const activeCategory = active === null ? "" : data.categories[active];
  const activeTitle = isBar || !demo ? activeCategory : lineDateLabel(activeCategory);
  const activeEntries = active === null ? [] : data.series.flatMap((item, index) => {
    const value = item.values[active];
    if (value == null || !Number.isFinite(value)) return demo ? [] : [{ name: item.name, color: colorFor(item, index, theme), value: "—" }];
    return [{ name: item.name, color: colorFor(item, index, theme), value: !demo ? lineFormatValue(value) : isBar ? value : `${valueFormat.format(value)} ms` }];
  });
  const pillWidth = cartesianPillWidth(activeCategory);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, activeX));
  const labelCount = compact ? 3 : isBar ? Math.min(6, Math.max(3, Math.floor(plotWidth / 28))) : width < 500 ? 4 : 5;
  const axisLabels = Array.from({ length: Math.min(count, labelCount) }, (_, index) => {
    const fraction = index / (labelCount - 1);
    const category = count <= labelCount ? index : Math.min(count - 1, Math.floor(fraction * count));
    return { category, x: xAt(category) };
  });

  function selectPointer(event: PointerEvent<SVGSVGElement>) {
    if (compact || !count) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left || x > right || y < top || y > bottom) {
      setSelection(null);
      return;
    }
    const index = offsets
      ? offsets.reduce((nearest, _, index) => Math.abs(x - xAt(index)) < Math.abs(x - xAt(nearest)) ? index : nearest, 0)
      : Math.round((x - xAt(0)) / span);
    setSelection(Math.min(count - 1, Math.max(0, index)));
  }

  function selectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || !count) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelection(null);
      return;
    }
    const indices: Record<string, number> = {
      Home: 0, End: count - 1,
      ArrowLeft: Math.max(0, (active ?? count) - 1), ArrowUp: Math.max(0, (active ?? count) - 1),
      ArrowRight: Math.min(count - 1, (active ?? -1) + 1), ArrowDown: Math.min(count - 1, (active ?? -1) + 1),
    };
    const next = indices[event.key];
    if (typeof next === "number") {
      event.preventDefault();
      setSelection(next);
    }
  }

  return <div ref={host} className="cartesian-advanced" data-cartesian-variant={variant}>
    {width > 0 && height > 0 && <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label}
      aria-describedby={compact ? undefined : `${uid}-instructions`} tabIndex={!compact && count ? 0 : undefined}
      onPointerMove={selectPointer} onPointerDown={selectPointer} onPointerLeave={event => { if (event.pointerType !== "touch") setSelection(null); }}
      onPointerCancel={() => setSelection(null)} onKeyDown={selectKey} onBlur={() => setSelection(null)}>
      {!compact && <desc id={`${uid}-instructions`}>Use the arrow keys to inspect each category. Home and End select the first and last. Escape clears the selection.</desc>}
      <defs>
        {paths.map(({ index, color }) => <linearGradient key={index} id={`${uid}-fade-${index}`}>
          {[0, 15, 85, 100].map(offset => <stop key={offset} offset={`${offset}%`} stopColor={color} stopOpacity={offset === 0 || offset === 100 ? 0 : 1} />)}
        </linearGradient>)}
        <linearGradient id={`${uid}-guide`} x1="0" y1="0" x2="0" y2="1">
          {[0, 10, 90, 100].map(offset => <stop key={offset} offset={`${offset}%`} stopColor={theme.muted} stopOpacity={offset === 0 || offset === 100 ? 0 : 1} />)}
        </linearGradient>
        <clipPath id={`${uid}-plot`}><rect x={left} y={top} width={plotWidth} height={plotHeight} /></clipPath>
        {active !== null && !isBar && <clipPath id={`${uid}-active`}><rect x={activeX - highlightSpan} y={top} width={2 * highlightSpan} height={plotHeight} /></clipPath>}
      </defs>
      <g aria-hidden="true" data-advanced-grid="" className="cartesian-advanced-grid">
        {ticks.map((value, index) => <line key={index} x1={left} x2={right} y1={tickY(value)} y2={tickY(value)} stroke={theme.grid} strokeDasharray="4 4" />)}
        {!isBar && threshold !== undefined && <line data-advanced-threshold={threshold} x1={left} x2={right} y1={yAt(threshold)} y2={yAt(threshold)} stroke={theme.muted} strokeOpacity=".45" />}
      </g>
      <g aria-hidden="true" clipPath={isBar ? undefined : `url(#${uid}-plot)`}>
        {stacks.map((stack, category) => stack.map(({ from, to, offset, color, index, value }) => {
          const start = yAt(from);
          const end = yAt(to);
          const negative = value < 0;
          const height = Math.abs(start - end);
          const barWidth = span * .8;
          return <path key={`${category}-${index}`} data-advanced-bar={category} data-value={value}
            d={barOutline(xAt(category) - barWidth / 2, Math.min(start, end) + offset, barWidth, height, negative)}
            fill={color} opacity={active === null || active === category ? 1 : .3} />;
        }))}
        {paths.map(({ index, path, color, strokeWidth }) => <g key={index}>
          <path data-advanced-line={index} d={path ?? undefined} fill="none" stroke={`url(#${uid}-fade-${index})`} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" opacity={active === null ? 1 : .3} />
          {!demo && data.series[index].values.map((value, at, values) => finiteLineValue(value) && !finiteLineValue(values[at - 1]) && !finiteLineValue(values[at + 1])
            ? <circle key={at} data-line-isolated-point={`${index}-${at}`} cx={xAt(at)} cy={yAt(value)} r={compact ? 2 : 3} fill={color} pointerEvents="none" /> : null)}
          {active !== null && <path d={path ?? undefined} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${uid}-active)`} />}
        </g>)}
      </g>
      <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 10 : 12}>
        {!isBar && !compact && ticks.map((value, index) => <text key={index} x={left - 4} y={tickY(value)} dominantBaseline="middle" textAnchor="end">{callerScale ? callerScale.format(value) : `${valueFormat.format(value)} ms`}</text>)}
        {axisLabels.map(({ category, x }) => <text key={category} x={x} y={bottom + (compact ? 13 : 24)} textAnchor="middle"
          opacity={active !== null && Math.abs(x - pillX) < pillWidth / 2 + Math.min(24, 3.3 * data.categories[category].length) ? 0 : 1}>{data.categories[category]}</text>)}
      </g>
      {active !== null && <g aria-hidden="true" data-advanced-focus="">
        {!isBar && <rect x={activeX - .5} y={top} width={1} height={plotHeight} fill={`url(#${uid}-guide)`} opacity=".8" />}
        {isBar ? stacks[active].filter(item => item.value !== 0).map(({ to, offset, color, index }) => {
          const end = yAt(to);
          return <CartesianFocusPoint key={index} x={activeX} y={end + offset} color={color} halo={false} surface={theme.surface} />;
        })
          : data.series.map((item, index) => {
            const value = item.values[active];
            return value == null || !Number.isFinite(value) ? null : <CartesianFocusPoint key={index} x={activeX} y={yAt(value)} color={colorFor(item, index, theme)} />;
          })}
        <CartesianDatePill x={pillX} y={bottom + 4} label={activeCategory} text={theme.text} surface={theme.surface} />
      </g>}
    </svg>}
    {!compact && <div className="cartesian-advanced-readout" role="status" style={{
      top,
      left: readoutRight ? activeX + 16 : undefined,
      right: readoutRight ? undefined : width - activeX + 16,
      minWidth: Math.min(readoutRoom, readoutMinWidth),
      maxWidth: Math.min(readoutRoom, 175),
    }}>
      {active !== null && <CartesianReadout label={activeTitle} entries={activeEntries} live={false} />}
    </div>}
  </div>;
}
