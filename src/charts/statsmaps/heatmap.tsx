import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import {
  WIDTH, createRandom, format, markEvents, number, rows, useVariantLoading, type DemoProps, type HoverInfo,
} from "./primitives";

const mondayFirst = ["M", "T", "W", "T", "F", "S", "S"];
const sundayFirst = ["S", "M", "T", "W", "T", "F", "S"];
const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
const dayMs = 86_400_000;

function calendar(data: DemoProps["data"], variant: string) {
  if (data?.rows) {
    return rows(data).flatMap((row) => {
      const date = typeof row.date === "string" ? Date.parse(row.date) : NaN;
      const value = number(row.value);
      return !Number.isFinite(date) || value === undefined ? [] : [{ date: new Date(date), value: Math.max(0, value) }];
    });
  }
  if (data?.series) {
    return (data.series[0]?.values ?? []).flatMap((point, index) => {
      const value = number(point);
      const date = data.categories?.[index] ? Date.parse(data.categories[index]) : Date.UTC(2025, 0, 1) + index * dayMs;
      return value === undefined || !Number.isFinite(date) ? [] : [{ date: new Date(date), value: Math.max(0, value) }];
    });
  }
  const random = createRandom(1121);
  const short = variant === "heatmap-dots" || variant === "heatmap-active-scale";
  const loading = variant === "heatmap-loading";
  const start = short ? Date.UTC(2026, 4, 3) : loading ? Date.UTC(2025, 10, 1) : Date.UTC(2025, 0, 1);
  return Array.from({ length: short ? 182 : variant === "heatmap-quarters" ? 304 : 365 }, (_, index) => ({
    date: new Date(start + index * dayMs),
    value: random() > .33 ? Math.round((random() ** 1.8) * 18) : 0,
  }));
}

export function Heatmap({ example, compact, data }: DemoProps) {
  const id = useId().replaceAll(":", "");
  const { loading, button } = useVariantLoading(example.id);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const quarter = example.id === "heatmap-quarters";
  const weekend = example.id === "heatmap-weekdays";
  const round = example.id === "heatmap-dots";
  const stripes = example.id === "heatmap-patterns";
  const scaled = example.id === "heatmap-active-scale";
  const dashed = example.id === "heatmap-separators-dashed";
  const dividers = quarter || round || dashed || example.id === "heatmap-separators-solid";
  const continuous = example.id === "heatmap-gradient-legend";
  const scrolling = !compact && example.id === "heatmap-scroll";
  const weekDays = weekend || scrolling ? mondayFirst : sundayFirst;
  const values = useMemo(() => {
    const daily = new Map<number, number>();
    for (const { date, value } of calendar(data, example.id)) {
      const utcDay = Math.floor(date.getTime() / dayMs) * dayMs;
      daily.set(utcDay, (daily.get(utcDay) ?? 0) + value);
    }
    return [...daily].sort(([a], [b]) => a - b).map(([date, value]) => ({ date: new Date(date), value }));
  }, [data, example.id]);
  const first = values[0]?.date.getTime() ?? Date.UTC(2025, 0, 1);
  const beginning = first - (((values[0]?.date.getUTCDay() ?? 1) + (weekend || scrolling ? 6 : 0)) % 7) * dayMs;
  const color = (i: number) => i ? `color-mix(in srgb, var(--chart-1) ${25 + i * 18}%, var(--muted))` : "var(--muted)";
  const max = Math.max(1, ...values.map(({ value }) => value));
  const firstQuarter = values[0] ? values[0].date.getUTCFullYear() * 4 + Math.floor(values[0].date.getUTCMonth() / 3) : 0;
  const lastDate = values.at(-1)?.date ?? new Date(first);
  const weeks = Math.max(1, Math.ceil((lastDate.getTime() - beginning + 1) / (dayMs * 7)));
  const quarterSpan = Math.max(0, lastDate.getUTCFullYear() * 4 + Math.floor(lastDate.getUTCMonth() / 3) - firstQuarter);
  const dividerGap = dividers ? Math.min(5, 70 / Math.max(1, quarterSpan)) : 0;
  const perCell = scrolling ? 24 : Math.min(17, (592 - dividerGap * quarterSpan) / weeks);
  const geometry = values.map(({ date, value }) => {
    const days = Math.max(0, Math.floor((date.getTime() - beginning) / dayMs));
    const weekday = days % 7;
    const week = Math.floor(days / 7);
    const group = Math.floor(date.getUTCMonth() / 3);
    const quarterIndex = date.getUTCFullYear() * 4 + group - firstQuarter;
    const x = 40 + week * perCell + dividerGap * quarterIndex;
    const y = 26 + weekday * perCell;
    const strength = value ? Math.ceil(value / max * 4) : 0;
    return { date, value, weekday, week, x, y, strength, group, quarterIndex, hint: { x, y, lines: [dateFormat.format(date), `${format.format(value)} contributions`] } };
  });
  const width = scrolling ? Math.max(WIDTH, (geometry.at(-1)?.x ?? 0) + 30) : WIDTH;
  const height = 35 + 7 * perCell;
  const activeCell = loading ? undefined : geometry[hover ?? focus ?? -1];
  const current = activeCell?.hint;
  const monthStarts = geometry.filter((cell, i) => i === 0 || cell.date.getUTCMonth() !== geometry[i - 1].date.getUTCMonth());
  const quarterStarts = geometry.filter((cell, i) => i > 0 && cell.quarterIndex !== geometry[i - 1].quarterIndex);
  const months = quarter ? [geometry[0], ...quarterStarts].filter(Boolean) : monthStarts;
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const next = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setFocus(null);
      setHover(null);
      return;
    }
    if (next === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    setHover(null);
    const index = event.key === "Home" ? 0 : event.key === "End" ? geometry.length - 1 : Math.max(0, Math.min(geometry.length - 1, (focus ?? 0) + (next ?? 0)));
    setFocus(index);
    const cell = geometry[index];
    if (scroll.current && cell) {
      const offset = scroll.current.scrollLeft;
      if (cell.x < offset + 46) scroll.current.scrollLeft = Math.max(0, cell.x - 46);
      else if (cell.x + perCell > offset + scroll.current.clientWidth) scroll.current.scrollLeft = cell.x + perCell - scroll.current.clientWidth;
    }
  }
  return (
    <div className={`stat-demo stat-calendar ${compact ? "stat-compact" : ""}`}>
      {!compact && button && <div className="stat-controls">{button}</div>}
      <div className="stat-frame">
        <div className={scrolling ? "stat-heat-scroll" : undefined} ref={scrolling ? scroll : undefined}>
          {scrolling && <div className="stat-heat-sticky" aria-hidden="true">{weekDays.map((day, index) => <span key={index}>{day}</span>)}</div>}
          <svg className={`stat-svg ${loading ? "stat-loading" : ""}`} width={width} height={height} style={{ minWidth: scrolling ? width : undefined, height: "auto" }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title} aria-busy={loading || undefined} tabIndex={!compact && !loading ? 0 : undefined}
            onFocus={() => setFocus(0)} onBlur={() => setFocus(null)} onKeyDown={onKeyDown}>
            <defs>
              <pattern id={`${id}-stripe`} width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill={color(2)} /><path d="M0 0v4" stroke={color(4)} strokeWidth="1.2" /></pattern>
              <linearGradient id={`${id}-divider`} x2="0" y2="1"><stop stopColor="var(--muted-foreground)" stopOpacity=".15" /><stop offset="50%" stopColor="var(--muted-foreground)" stopOpacity=".7" /><stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity=".15" /></linearGradient>
            </defs>
            {!values.length && <text className="stat-axis" x={width / 2} y={height / 2} textAnchor="middle">No data to display</text>}
            {!dashed && !scrolling && weekDays.map((day, index) => scaled && ![1, 3, 5].includes(index) ? null : <text key={index} className="stat-axis" x="28" y={26 + index * perCell + perCell * .66} opacity={weekend && index >= 5 ? .4 : 1} textAnchor="end">{day}</text>)}
            {months.map((cell) => <text key={cell.date.toISOString()} className="stat-axis" x={cell.x} y="15">{quarter ? `Q${cell.group + 1}` : month.format(cell.date)}</text>)}
            {dividers && quarterStarts.map((cell) => <path key={cell.quarterIndex} d={`M${cell.x - 3} 23V${height - 6}`} stroke={dashed || quarter ? `url(#${id}-divider)` : "var(--border)"} strokeDasharray={dashed ? "4 4" : undefined} />)}
            {geometry.map((cell, index) => {
              const active = cell === activeCell;
              const opacity = level !== null && level !== cell.strength || current && !active && (round || scaled) ? .44 : weekend && cell.weekday >= 5 ? .39 : 1;
              const fill = stripes && cell.strength === 2 ? `url(#${id}-stripe)` : color(cell.strength);
              const style = { opacity, transform: `scale(${active && scaled ? 1.1 : current && round && !active ? .93 : 1})`, animationDelay: `${loading ? cell.week % 10 * 60 : cell.week * 11 + cell.weekday * 5}ms` };
              const className = `stat-heat-scale ${loading ? "stat-load" : example.id === "heatmap-loading" ? "stat-heat-reveal" : ""}`;
              const events = markEvents(cell.hint, (hint) => setHover(hint ? index : null), !compact && !loading);
              const size = Math.max(.3, perCell - (scrolling ? 4 : Math.min(2.1, perCell * .2)));
              return round
                ? <circle key={cell.date.toISOString()} className={className} cx={cell.x + size / 2} cy={cell.y + size / 2} r={size / 2} fill={fill} style={style} {...events} />
                : <rect key={cell.date.toISOString()} className={className} x={cell.x} y={cell.y} width={Math.max(.6, size)} height={Math.max(.6, size)} rx={Math.min(3, size / 4)} fill={fill} style={style} {...events} />;
            })}
          </svg>
        </div>
        {!compact && current && (
          <div className="stat-hint" role="status" style={{ left: `${Math.min(81, Math.max(19, scrolling && scroll.current ? (current.x - scroll.current.scrollLeft) * 100 / scroll.current.clientWidth : current.x * 100 / width))}%`, top: `${Math.min(83, Math.max(25, current.y * 100 / height))}%` }}>
            {current.lines.map((text, index) => <div key={index}>{text}</div>)}
          </div>
        )}
      </div>
      <div className="stat-legend" aria-label="Contribution intensity">
        <span>Less</span>
        {continuous ? <i className="stat-heat-gradient" style={{ width: 110, background: `linear-gradient(90deg, ${color(0)}, ${color(4)})` }} /> : [0, 1, 2, 3, 4].map((i) => (
          <Toggle className="stat-heat-scale" key={i} aria-label={`Intensity ${i} of 4`} pressed={level === null || level === i} onPressedChange={() => setLevel((current) => current === i ? null : i)} tabIndex={compact ? -1 : undefined} disabled={compact}
            style={{ transform: scaled && activeCell?.strength === i ? "scale(1.1)" : undefined, opacity: scaled && activeCell && activeCell.strength !== i ? .44 : undefined }}>
            <i style={{ "--legend-color": stripes && i === 2 ? `repeating-linear-gradient(135deg, ${color(2)} 0 2px, ${color(4)} 2px 3px)` : color(i) } as CSSProperties} />
          </Toggle>
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
