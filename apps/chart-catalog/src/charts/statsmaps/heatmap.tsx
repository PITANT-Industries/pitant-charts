import { TrendingUp } from "lucide-react";
import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { usePlotSize } from "../usePlotSize";
import { calendarValues, dayMs, firstAtOrAfter, heatmapLayout } from "./heatmap-layout";
import { HeatmapTiles } from "./HeatmapTiles";
import { format, type DemoProps } from "./primitives";
import "./heatmap.css";

const month = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });
const exact = new Intl.NumberFormat("en", { maximumSignificantDigits: 21 });
const levels = [0, 1, 2, 3, 4] as const;

function ordinal(day: number) {
  return day >= 11 && day <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
}

function footer(variant: string, values: ReturnType<typeof calendarValues>, demo: boolean, loading: boolean) {
  if (loading) return ["Fetching contributions…", "Turn loading off to reveal the calendar."];
  const count = values.reduce((sum, item) => sum + item.value, 0);
  const total = `${format.format(count)} contributions`;
  if (!demo) return [total];
  switch (variant) {
    case "heatmap-default":
      return [`${total} in the last year`, "Each week starts on Sunday."];
    case "heatmap-scroll":
      return [`${total} in the last year`, "Scroll sideways to inspect the year. Weekday labels stay in view."];
    case "heatmap-loading":
      return [`${total} in the last year`, "Turn loading off to reveal the calendar."];
    case "heatmap-patterns":
      return [`${total} in six months`, "Inspect an intensity to highlight the days at that level."];
    case "heatmap-gradient-legend":
      return [`Active on ${values.filter(item => item.value > 0).length} of ${values.length} days`, "The gradient shows intensity from empty days to the busiest days."];
    case "heatmap-weekdays": {
      const weekdayCount = values.reduce((sum, item) => sum + (item.date.getUTCDay() > 0 && item.date.getUTCDay() < 6 ? item.value : 0), 0);
      return [`${Math.round(weekdayCount / Math.max(1, count) * 100)}% of contributions on weekdays`, "Saturday and Sunday are muted."];
    }
    case "heatmap-quarters":
    case "heatmap-separators-solid": {
      const thirdQuarter = values.reduce((sum, item) => sum + (item.date.getUTCMonth() >= 6 && item.date.getUTCMonth() <= 8 ? item.value : 0), 0);
      return [`${format.format(thirdQuarter)} contributions in Q3 2026`, "A labeled divider marks each quarter."];
    }
    case "heatmap-separators-dashed": {
      const activeWeeks = new Set(values.flatMap((item, index) => item.value > 0 ? [Math.floor(index / 7)] : [])).size;
      return [`Active in ${activeWeeks} of ${Math.ceil(values.length / 7)} weeks`, "Quarter dividers fade at both ends."];
    }
    case "heatmap-dots":
      return [`Up to ${Math.max(...values.map(item => item.value))} contributions on the busiest day`, "Each dot represents one day."];
    case "heatmap-active-scale":
      return [`${values.filter(item => item.value >= 4).length} days with four or more contributions`, "Inspect a day to enlarge its cell."];
    default:
      return [total];
  }
}

export function Heatmap({ example, compact, data }: DemoProps) {
  const id = useId().replaceAll(":", "");
  const instructions = `${id}-keys`;
  const { id: variant } = example;
  const loadingDemo = variant === "heatmap-loading";
  const [loading, setLoading] = useState(loadingDemo);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const { plot: scroll, width: measuredWidth } = usePlotSize<HTMLDivElement>(640, 120);
  const weekdays = variant === "heatmap-weekdays";
  const quarter = variant === "heatmap-quarters";
  const dots = variant === "heatmap-dots";
  const solid = variant === "heatmap-separators-solid";
  const dashed = variant === "heatmap-separators-dashed";
  const split = dots || solid || dashed;
  const stripes = variant === "heatmap-patterns";
  const scaled = variant === "heatmap-active-scale";
  const continuous = variant === "heatmap-gradient-legend";
  const instant = variant === "heatmap-default";
  const demo = !data?.rows && !data?.series;
  const values = useMemo(() => calendarValues(data, variant), [data, variant]);
  // Keep individual days inspectable when several years would compress the cells into subpixel columns.
  const large = !demo && values.length > 0 && (+values.at(-1)!.date - +values[0].date) / dayMs >= 2048;
  const scrolling = large || (!compact && variant === "heatmap-scroll");
  const tiled = scrolling;
  const layout = useMemo(() => heatmapLayout(values, measuredWidth, variant, demo, scrolling), [values, measuredWidth, variant, demo, scrolling]);
  const { cellAt, indexAt, indexAtDay, months, quarters, labels, width, height, cellWidth, cellHeight, top, paddingStart, rowStep } = layout;
  const viewportWidth = scrolling ? measuredWidth : width;
  const left = Math.max(0, Math.min(scrollLeft, width - viewportWidth));
  const visibleLabels = <T extends { x: number }>(items: readonly T[]) => !tiled ? items : items.slice(
    firstAtOrAfter(items, left - 40, item => item.x), firstAtOrAfter(items, left + viewportWidth + 40, item => item.x),
  );
  const activeCell = loading ? undefined : cellAt(hover ?? focus ?? -1);
  const filteredLevel = hoveredLevel ?? level;
  const legendLevel = filteredLevel ?? (instant ? undefined : activeCell?.strength);
  const inactiveOpacity = dots ? .8 : scaled ? .45 : .3;
  const color = (index: number) => `var(--heat-level-${index})`;
  const fill = (index: number) => stripes && index === 2 ? `url(#${id}-stripe)` : color(index);
  const stripeColor = `color-mix(in oklch, ${color(2)} 45%, white)`;
  const borderRadius = dots ? 999 : 2;
  const [summary, detail] = useMemo(() => compact ? [] : footer(variant, values, demo, loading), [compact, variant, values, demo, loading]);
  const panelWidth = Math.min(140, measuredWidth);
  const anchorX = activeCell ? activeCell.x + cellWidth / 2 - left : 0;
  const panelOffset = scaled ? 18 : split || scrolling ? 17.5 : 17;
  const rightX = anchorX + panelOffset;
  const panelLeft = Math.max(0, Math.min(measuredWidth - panelWidth, rightX + panelWidth <= measuredWidth ? rightX : anchorX - panelWidth - panelOffset));
  const panelTop = activeCell ? Math.max(16, Math.min(height - 108, activeCell.y + cellHeight / 2 - (split || scrolling ? 44 : 44.5))) : 0;
  const visibleReadout = activeCell && anchorX >= 0 && anchorX <= measuredWidth;

  function select(index: number) {
    setFocus(index);
    const cell = cellAt(index);
    const viewport = scroll.current;
    if (!cell || !scrolling || compact || !viewport) return;
    if (cell.x < viewport.scrollLeft) viewport.scrollLeft = Math.max(0, cell.x - paddingStart);
    else if (cell.x + cellWidth > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = cell.x + cellWidth + 12 - viewport.clientWidth;
    setScrollLeft(viewport.scrollLeft);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (focus !== null || hover !== null || level !== null)) {
      event.preventDefault();
      event.stopPropagation();
      setFocus(null);
      setHover(null);
      setLevel(null);
      return;
    }
    if (!interactive || !values.length) return;
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!movement && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const current = activeCell ?? cellAt(0)!;
    setHover(null);
    if (!movement) {
      select(event.key === "Home" ? 0 : values.length - 1);
      return;
    }
    const [dx, dy] = movement;
    const column = current.column + dx, row = current.row + dy;
    const match = row >= 0 && row < 7 ? indexAtDay(column, row) : -1;
    if (match >= 0) select(match);
    else if (!demo) {
      let nearest = 0, distance = Infinity;
      const origin = firstAtOrAfter(values, +current.date, entry => +entry.date);
      for (const step of [-1, 1]) {
        for (let i = origin; i >= 0 && i < values.length; i += step) {
          const cell = cellAt(i)!;
          const across = Math.abs(cell.column - column);
          if (across > distance && (step < 0 ? cell.column < column : cell.column > column)) break;
          const score = across + Math.abs(cell.row - row);
          if (score < distance || (score === distance && i < nearest)) { distance = score; nearest = i; }
        }
      }
      select(nearest);
    }
  }

  function hit(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = left + (event.clientX - box.left) * viewportWidth / box.width;
    const y = (event.clientY - box.top) * height / box.height;
    const index = indexAt(x, y);
    if (dots && index >= 0) {
      const cell = cellAt(index)!;
      if (((x - cell.x) / cellWidth * 2 - 1) ** 2 + ((y - cell.y) / cellHeight * 2 - 1) ** 2 > 1) return -1;
    }
    return index;
  }

  const interactive = !compact && !loading;

  return (
    <div className="stat-heatmap" data-heat-variant={variant} data-heat-compact={compact || undefined} data-heat-quarter-rail={split || undefined}>
      {!compact && loadingDemo && <div className="stat-heatmap-controls">
        <Toggle className="stat-control" pressed={loading} onPressedChange={next => { setLoading(next); setFocus(null); setHover(null); }}>Loading</Toggle>
      </div>}
      <div className="stat-heatmap-plot" onPointerLeave={() => setHover(null)}>
        {scrolling && <div className="stat-heatmap-weekday-rail" aria-hidden="true">
          {[[1, "Mon"], [3, "Wed"], [5, "Fri"]].map(([row, day]) => <span key={row} style={{ top: top + Number(row) * rowStep + .5 }}>{day}</span>)}
        </div>}
        <div ref={scroll} className={scrolling ? "stat-heatmap-viewport stat-heat-scroll" : "stat-heatmap-viewport"}
          onScroll={scrolling ? event => { setScrollLeft(event.currentTarget.scrollLeft); setHover(null); } : undefined}>
          <div className={tiled ? "stat-heatmap-track" : undefined} style={tiled ? { width, height } : undefined}>
          <div className={tiled ? "stat-heatmap-window" : undefined} style={tiled ? { width: viewportWidth, height } : undefined}>
          {tiled && <HeatmapTiles layout={layout} left={left} width={viewportWidth} active={activeCell}
            filtered={filteredLevel} inactiveOpacity={inactiveOpacity} dots={dots} weekdays={weekdays} stripes={stripes}
            mutedByFocus={split || quarter} scaled={scaled} instant={instant} loading={loading} />}
          <svg className="stat-heatmap-svg" width={viewportWidth} height={height} viewBox={`${left} 0 ${viewportWidth} ${height}`} role="img" aria-label={example.title}
            aria-describedby={!compact ? instructions : undefined} aria-busy={loading || undefined} tabIndex={!compact && !loading ? 0 : undefined}
            onFocus={() => {
              if (interactive && !activeCell) {
                const firstVisible = tiled ? layout.visibleCells(left, viewportWidth)[0]?.index : 0;
                if (firstVisible !== undefined && (tiled || values.length)) select(firstVisible);
              }
            }} onBlur={() => setFocus(null)} onKeyDown={onKeyDown}
            onPointerMove={tiled && interactive ? event => {
              if (event.pointerType === "touch") return;
              const index = hit(event);
              setHover(index < 0 ? null : index);
            } : undefined}
            onClick={tiled && interactive ? event => {
              const index = hit(event);
              if (index >= 0) { setHover(null); select(index); }
            } : undefined}>
            <defs>
              {stripes && <pattern id={`${id}-stripe`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`translate(${paddingStart} ${top - 2})`}>
                <rect width="6" height="6" fill={color(2)} /><path d="M-2 1L1 -2M-1 6L6 -1M4 7L7 4" stroke={stripeColor} strokeWidth="1" />
              </pattern>}
              {(quarter || dots || dashed) && <linearGradient id={`${id}-rule`} x1="0" x2="0" y1={quarter ? 28 : -20} y2={height - (quarter ? 0 : 1.5)} gradientUnits="userSpaceOnUse">
                <stop stopColor={quarter ? "var(--border)" : "var(--muted-foreground)"} stopOpacity="0" />
                <stop offset=".5" stopColor={quarter ? "var(--border)" : "var(--muted-foreground)"} stopOpacity={quarter ? 1 : dots ? .5 : .6} />
                <stop offset="1" stopColor={quarter ? "var(--border)" : "var(--muted-foreground)"} stopOpacity="0" />
              </linearGradient>}
            </defs>
            {!compact && <desc id={instructions}>Use the arrow keys to inspect days and weeks, Home and End to move to the first or last date, and Escape to clear inspection.</desc>}
            {!values.length && <text className="stat-heatmap-axis" x={width / 2} y={height / 2} textAnchor="middle">No data to display</text>}
            <g aria-hidden="true" className="stat-heatmap-axis">
              {visibleLabels(quarters).map(item => <text key={item.key} data-heat-quarter="" x={item.x} y={split ? tiled ? 8 : -8 : 21} dominantBaseline="middle"
                fill={dots ? "var(--chart-3)" : solid ? "var(--foreground)" : undefined}>{item.name}</text>)}
              {visibleLabels(months).map(item => <text key={item.key} data-heat-month="" x={item.x} y={split && tiled ? 25 : 12}>{item.name}</text>)}
              {labels.map(item => <text key={item.row} data-heat-weekday={item.row} x={item.x} y={item.y} opacity={item.opacity}
                textAnchor="end" dominantBaseline="middle">{item.label}</text>)}
            </g>
            <g aria-hidden="true">
              {visibleLabels(quarters).flatMap(item => item.rule === undefined ? [] : <line key={item.key} data-heat-divider="" x1={item.rule} x2={item.rule}
                y1={split ? tiled ? 0 : -18.5 : 29} y2={height} stroke={solid ? "var(--border)" : `url(#${id}-rule)`}
                strokeLinecap="round" strokeDasharray={dashed ? "3 5" : undefined} />)}
              {!tiled && values.map((_, index) => {
                const cell = cellAt(index)!;
                const active = index === (hover ?? focus);
                const muted = filteredLevel !== null && filteredLevel !== cell.strength || activeCell && (dots || quarter || solid || dashed);
                const opacity = (weekdays && cell.row >= 5 ? .35 : 1) * (muted ? inactiveOpacity : 1);
                const scale = dots && muted ? .94 : 1;
                const motion = loadingDemo && !compact ? {
                  "--heat-delay": `${cell.column * 12 + cell.row * 12}ms`,
                  "--heat-pulse": `${5 + ((cell.column * 17 + cell.row * 23) % 39) / 10}s`,
                } as CSSProperties : undefined;
                return <g key={+cell.date} className={loading ? "stat-heatmap-bone" : loadingDemo && !compact ? "stat-heatmap-reveal" : undefined} style={motion}>
                  <rect className="stat-heatmap-cell" data-heat-day={cell.date.toISOString().slice(0, 10)} data-heat-count={cell.value} data-heat-level={cell.strength}
                    data-heat-weekday={cell.row} data-heat-column={cell.column} data-heat-selected={active || undefined}
                    x={cell.x} y={cell.y} width={cellWidth} height={cellHeight} rx={borderRadius}
                    fill={loading ? color(0) : fill(cell.strength)} style={{ opacity: loading ? 1 : opacity, transform: scale === 1 ? undefined : `scale(${scale})` }}
                    onPointerEnter={!compact && !loading ? event => { if (event.pointerType !== "touch") setHover(index); } : undefined}
                    onClick={!compact && !loading ? () => { setHover(null); select(index); } : undefined} />
                </g>;
              })}
              {!tiled && activeCell && !instant && <rect data-heat-highlight="" className="stat-heatmap-highlight" x={activeCell.x} y={activeCell.y} width={cellWidth} height={cellHeight} rx={borderRadius}
                fill={fill(activeCell.strength)} fillOpacity={weekdays && activeCell.row >= 5 ? .35 : 1}
                style={{ transform: scaled ? "scale(1.1)" : undefined }} />}
            </g>
          </svg>
          </div>
          </div>
        </div>
        {!compact && loading && <div className="stat-heatmap-loading-status" role="status">Loading contributions</div>}
        {!compact && <div className="stat-heatmap-status" role="status" style={{ left: panelLeft + (scrolling ? 44 : 0), top: panelTop }}>
          {visibleReadout && <div className="stat-heatmap-tooltip">
            <div className="stat-heatmap-date">{month.format(activeCell.date)} {activeCell.date.getUTCDate()}{ordinal(activeCell.date.getUTCDate())} {activeCell.date.getUTCFullYear()}</div>
            <div className="stat-heatmap-tooltip-weekday">{weekday.format(activeCell.date)}</div>
            <div className="stat-heatmap-tooltip-rule" />
            <div>{exact.format(activeCell.value)} {activeCell.value === 1 ? "contribution" : "contributions"}</div>
          </div>}
        </div>}
      </div>
      {!weekdays && !quarter && !loadingDemo && !loading && values.length > 0 && <div className="stat-heatmap-legend" role="group" aria-label="Contribution intensity"
        data-heat-legend-align={split || scaled || scrolling ? "center" : "end"} data-heat-legend-spacing={scaled ? "wide" : split || scrolling ? "medium" : "narrow"}
        onKeyDown={event => { if (event.key === "Escape" && level !== null) { event.preventDefault(); event.stopPropagation(); setLevel(null); } }}>
        <span>Less</span>
        <div className={continuous ? "stat-heatmap-gradient" : "stat-heatmap-swatches"} style={continuous ? {
          backgroundImage: `linear-gradient(90deg, ${levels.map(index => `${color(index)} ${index * 25}%`).join(", ")})`,
        } : undefined}>
          {levels.map(index => <Toggle key={index} className="stat-heatmap-level" aria-label={`Intensity ${index} of 4`} pressed={level === index}
            tabIndex={compact ? -1 : undefined} disabled={compact}
            onPressedChange={selected => setLevel(selected ? index : null)}
            onPointerEnter={!instant ? () => setHoveredLevel(index) : undefined} onPointerLeave={!instant ? () => setHoveredLevel(null) : undefined}
            style={{ opacity: !continuous && legendLevel != null && legendLevel !== index ? inactiveOpacity : 1,
              transform: legendLevel === index && scaled ? "scale(1.1)" : legendLevel != null && legendLevel !== index && dots ? "scale(.94)" : undefined }}>
            {!continuous && <i className="stat-heatmap-swatch" data-heat-swatch={index} style={stripes && index === 2 ? {
              backgroundImage: `repeating-linear-gradient(135deg, transparent 0 3.24px, ${stripeColor} 3.24px 4.24px)`,
              backgroundColor: color(index),
            } : { backgroundColor: color(index) }} />}
          </Toggle>)}
        </div>
        <span>More</span>
      </div>}
      {!compact && values.length > 0 && summary && <div className="stat-heatmap-footer">
        <strong>{summary}{demo && !loadingDemo && <TrendingUp size={16} aria-hidden="true" />}</strong>
        {detail && <span>{detail}</span>}
      </div>}
    </div>
  );
}
