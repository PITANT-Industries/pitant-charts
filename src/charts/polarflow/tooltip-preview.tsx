import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { Controls, dollars, number, percent, seriesData, tone, type Props } from "./shared";
import styles from "./styles.module.css";

const initialCategories = ["Jan 1", "Jan 5", "Jan 9", "Jan 13", "Jan 17", "Jan 21", "Jan 25", "Jan 29"];
const initialSeries = [
  { name: "Direct", values: [37, 62, 49, 81, 68, 91, 76, 110] },
  { name: "Organic", values: [20, 34, 29, 51, 39, 59, 51, 78] },
  { name: "Referral", values: [16, 26, 21, 37, 29, 45, 41, 58] },
];
const width = 420;
const height = 230;
const plot = { left: 38, right: 399, top: 18, bottom: 197 };
const indicatorWidths = [1, 4, 12, 24];
const matchedTransition = "transform 280ms cubic-bezier(.2,1.3,.45,1)";
const tradingDays = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 7, 3 + i)))
  .filter((date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
  .map((date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date));

function calendarLabels(month: string, start: number, count: number) {
  return Array.from({ length: count }, (_, i) => `${month} ${start + i}`);
}

function sampleSeries(names: string[], base: number, count: number) {
  return names.map((name, index) => ({ name, values: Array.from({ length: count }, (_, i) => Math.round(base * (1 + .19 * Math.sin(i / 2.1 + index) + .11 * Math.cos(i * 1.5)) / (1 + index * .55))) }));
}

const tooltipFixtures = {
  'tooltip-indicator': { categories: calendarLabels('Jul', 1, 21), series: sampleSeries(['Users'], 3700, 21) },
  'tooltip-motion': { categories: calendarLabels('Aug', 1, 21), series: sampleSeries(['Web', 'App'], 640, 21) },
  'tooltip-pinned': { categories: calendarLabels('Nov', 1, 30), series: sampleSeries(['Online store', 'Retail', 'Partners'], 7100, 30) },
  'tooltip-horizontal-crosshair': { categories: tradingDays, series: sampleSeries(['Price'], 145, tradingDays.length) },
  'tooltip-custom-indicator': { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], series: [{ name: 'Revenue', values: [38700, 46900, 44500, 51600, 49200, 56300, 50400, 53800] }] },
} satisfies Record<string, { categories: string[]; series: typeof initialSeries }>;

export function TooltipPreview({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const uid = useId();
  const graph = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(compact ? 4 : null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [heightAtPointer, setPointerHeight] = useState<number | null>(null);
  const [mode, setMode] = useState(example.id === 'tooltip-indicator' ? 2 : 0);
  const hasHeader = id === "tooltip-header" || id === "tooltip-content";
  const ring = id === "tooltip-ring";
  const horizontal = id === "tooltip-horizontal-crosshair";
  const dashed = id === "tooltip-crosshair";
  const styled = id === "tooltip-indicator";
  const custom = id === "tooltip-custom-indicator";
  const panelMotion = id === "tooltip-motion";
  const pinEnabled = id === "tooltip-pinned";
  const fixture = tooltipFixtures[id as keyof typeof tooltipFixtures];
  const { categories, series } = seriesData(data, fixture?.categories ?? initialCategories, fixture?.series ?? initialSeries.slice(0, hasHeader ? 1 : 3));
  const limit = Math.max(1, categories.length);
  const step = (plot.right - plot.left) / Math.max(1, limit - 1);
  const barStep = (plot.right - plot.left) / limit;
  const x = (index: number) => plot.left + (ring ? barStep * (index + .5) : limit === 1 ? (plot.right - plot.left) / 2 : step * index);
  const allValues = series.flatMap(row => row.values.filter((value): value is number => value !== null && Number.isFinite(value)));
  const min = Math.min(0, ...allValues);
  const max = Math.max(min + 1, ...allValues);
  const range = max - min;
  const y = (value: number) => plot.bottom - (value - min) / range * (plot.bottom - plot.top - 7);
  const selected = pinned ?? active;
  const index = selected === null || !categories.length ? null : Math.min(limit - 1, Math.max(0, selected));
  const pointX = index === null ? 0 : x(index);
  const first = series[0];
  const close = index === null ? 0 : Number(first?.values[index] ?? 0);
  const previous = index === null ? close : Number(first?.values[Math.max(0, index - 1)] ?? close);
  const change = close - previous;
  const crossY = horizontal && heightAtPointer !== null ? heightAtPointer : y(close);
  const crossValue = min + (plot.bottom - crossY) / (plot.bottom - plot.top - 7) * range;
  const panelOffset = pointX > 257 ? -145 : 17;
  const panelY = Math.min(54, Math.max(3, crossY / height * 100 - 23));
  const pinnedTotal = index === null ? 0 : series.reduce((total, row) => total + Number(row.values[index] ?? 0), 0);
  const datePill = !dashed && !custom && !horizontal && !ring;
  useEffect(() => {
    if (pinned === null) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
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
    const position = ring ? Math.floor((point.x - plot.left) / barStep) : Math.round((point.x - plot.left) / step);
    return { position: Math.max(0, Math.min(limit - 1, position)), y: Math.max(plot.top, Math.min(plot.bottom, point.y)) };
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!categories.length || pinned !== null) return;
    const point = pointerPosition(event);
    setActive(point?.position ?? null);
    setPointerHeight(point?.y ?? null);
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
  const transition = !panelMotion || mode === 2 ? "none" : mode === 1 ? "transform 280ms cubic-bezier(.2,1.3,.45,1), top 280ms cubic-bezier(.2,1.3,.45,1)" : "transform 140ms ease-out, top 140ms ease-out";
  return <div className={styles.frame}>
    {!compact && styled && <Controls items={["Line", "Thin", "Medium", "Thick"]} value={mode} onChange={setMode} />}
    {!compact && panelMotion && <Controls items={["Eased", "Matched", "Instant"]} value={mode} onChange={setMode} />}
    <div className={styles.graph} style={{ containerType: 'inline-size' }}>
      <svg ref={graph} className={styles.native} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title}
        tabIndex={compact ? undefined : 0} onPointerMove={move} onPointerLeave={() => { if (pinned === null) setActive(null); }}
        onPointerUp={(event) => { if (!pinEnabled || !categories.length) return; const point = pointerPosition(event); setPinned(point ? pinned === point.position ? null : point.position : null); }}
        onFocus={() => { if (active === null) setActive(0); }} onKeyDown={key}
        onBlur={() => { if (pinned === null) setActive(null); }}>
        <defs>{series.map((row, seriesIndex) => <linearGradient key={seriesIndex} id={`${uid}-area-${seriesIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={tone(theme, seriesIndex, row.color)} stopOpacity=".32" />
          <stop offset="100%" stopColor={tone(theme, seriesIndex, row.color)} stopOpacity=".01" />
        </linearGradient>)}</defs>
        {[0, .25, .5, .75, 1].map(amount => <g key={amount}>
          <line x1={plot.left} x2={plot.right} y1={y(min + range * amount)} y2={y(min + range * amount)} stroke={theme.grid} strokeDasharray="3 4" />
          <text x={plot.left - 8} y={y(min + range * amount) + 3} fill={theme.muted} opacity={horizontal && index !== null && Math.abs(crossY - y(min + range * amount)) < 13 ? .12 : 1} fontSize="9" textAnchor="end">{pinEnabled ? `$${Math.round((min + range * amount) / 1000)}k` : Math.round(min + range * amount)}</text>
        </g>)}
        {categories.map((name, position) => position % Math.max(1, Math.ceil(limit / 7)) === 0 &&
          <text key={position} x={x(position)} y={plot.bottom + 15} fill={theme.muted} fontSize="9" textAnchor="middle">{name}</text>)}
        {index !== null && !custom && !ring && <g transform={`translate(${pointX} 0)`} style={panelMotion && mode === 1 ? { transition: matchedTransition, transform: `translateX(${pointX}px)` } : undefined}>
          {styled && mode > 0 ? <rect x={-indicatorWidths[mode] / 2} y={plot.top} width={indicatorWidths[mode]} height={plot.bottom - plot.top} fill={tone(theme, 1)} opacity=".3" /> : <line x1="0" x2="0" y1={plot.top} y2={plot.bottom} stroke={dashed || styled ? tone(theme, 1) : theme.muted} strokeDasharray={dashed || horizontal ? "5 4" : undefined} strokeWidth="1" />}
        </g>}
        {index !== null && custom && <rect x={pointX - Math.min(14, step * .23)} y={plot.bottom + 22} width={Math.min(28, step * .46)} height="3" rx="1.5" fill={tone(theme, 0)} />}
        {[...series].reverse().map((row, reverse) => {
          const seriesIndex = series.length - 1 - reverse;
          const color = tone(theme, seriesIndex, row.color);
          const values = categories.map((_, i) => row.values[i] ?? null);
          if (ring) return <g key={seriesIndex}>{values.map((value, pos) => {
            if (value === null) return null;
            const w = barStep * .73 / Math.max(1, series.length);
            const bx = x(pos) - (w * series.length) / 2 + w * seriesIndex;
            return <g key={pos}>
              <rect x={bx} y={Math.min(y(value), y(0))} width={Math.max(1, w - 2)} height={Math.abs(y(0) - y(value))} rx="2" fill={color} opacity={pos === index || index === null ? 1 : .55} />
              {pos === index && <ellipse cx={bx + (w - 2) / 2} cy={y(value)} rx={Math.max(2, w / 2)} ry="3.5" fill={theme.surface} stroke={color} strokeWidth="2" />}
            </g>;
          })}</g>;
          const segments: Array<Array<[number, number]>> = [];
          let current: Array<[number, number]> = [];
          for (const [pos, value] of values.entries()) {
            if (value === null) {
              if (current.length) segments.push(current);
              current = [];
            } else current.push([x(pos), y(value)]);
          }
          if (current.length) segments.push(current);
          return <g key={seriesIndex}>
            {segments.map((positions, seg) => {
              const line = `M ${positions.map(point => point.join(" ")).join(" L ")}`;
              const fill = `${line} L ${positions.at(-1)?.[0]} ${y(0)} L ${positions[0][0]} ${y(0)} Z`;
              return <g key={seg}>
                {!horizontal && !hasHeader && <path d={fill} fill={`url(#${uid}-area-${seriesIndex})`} />}
                <path d={line} fill="none" stroke={color} strokeWidth="2" />
              </g>;
            })}
            {index !== null && !dashed && !custom && values[index] !== null && <circle cx={pointX} cy={y(Number(values[index]))}
              r={styled ? 4.5 : 3.2} fill={theme.surface} stroke={color} strokeWidth={styled ? 2.5 : 1.8} />}
          </g>;
        })}
        {index !== null && horizontal && <g>
          <line x1={plot.left} x2={plot.right} y1={crossY} y2={crossY} stroke={tone(theme, 0)} strokeDasharray="4 3" />
          <rect x={plot.left - 34} y={crossY - 8} width="32" height="16" rx="4" fill={tone(theme, 0)} />
          <text x={plot.left - 18} y={crossY + 3} textAnchor="middle" fontSize="8" fill="#fff">{dollars.format(crossValue)}</text>
        </g>}
        {index !== null && datePill && <g>
          <rect x={pointX - 21} y={plot.bottom + 3} width="42" height="16" rx="5" fill={theme.surface} stroke={theme.grid} />
          <text x={pointX} y={plot.bottom + 14} textAnchor="middle" fontSize="9" fill={theme.text}>{categories[index]}</text>
        </g>}
      </svg>
      {index !== null && (!compact || index > 0) && <div className={styles.panel} data-pinned={pinned !== null} data-tooltip-motion={panelMotion ? ["eased", "matched", "instant"][mode] : undefined}
        role={pinned !== null ? "region" : "status"} aria-label="Chart tooltip"
        style={{ left: 0, top: `${panelY}%`, transform: `translateX(${(pointX + panelOffset) / width * 100}cqw)`, transition }}>
        {pinned !== null && <button type="button" className={styles.control} aria-label="Unpin tooltip" onClick={() => { setPinned(null); setActive(null); }}>×</button>}
        {!dashed && <p style={id === "tooltip-header" ? { borderBottom: "1px solid var(--border)", paddingBottom: ".25rem" } : undefined}><strong>{categories[index]}</strong></p>}
        {pinEnabled && <p><strong>{dollars.format(pinnedTotal)}</strong></p>}
        {hasHeader ? <>
          <p data-row><span>{id === "tooltip-header" ? "Close" : "Revenue"}</span><strong>{dollars.format(close * 100)}</strong></p>
          <p data-row><span>Daily change</span><strong>{change >= 0 ? "+" : "−"}{dollars.format(Math.abs(change) * 100)}</strong></p>
        </> : (!pinEnabled || pinned !== null) && series.map((row, seriesIndex) => <p data-row key={seriesIndex}>
          <span><i style={{ backgroundColor: tone(theme, seriesIndex, row.color) }} />{row.name}</span>
          <strong>{row.values[index] === null || row.values[index] === undefined ? "–" : (pinEnabled ? dollars : number).format(Number(row.values[index]))}</strong>
        </p>)}
        {id === "tooltip-rows" && <p data-row><span>Pages per user</span><strong>{(percent(close, Number(series[1]?.values[index] ?? 0)) / 100).toFixed(2)}</strong></p>}
        {pinEnabled && pinned === null && <p>Click to pin</p>}
      </div>}
    </div>
  </div>;
}
