import { useEffect, useId, useRef, useState } from "react";
import { useChartTheme } from "../theme";
import { arc, Controls, Legend, metrics, number, Pattern, percent, point, sector, seriesData, sum, tone, type Props } from "./shared";
import styles from "./styles.module.css";

const pieNames = ["Platform", "Services", "Marketplace", "Support", "Other"];
const pieValues = [470, 285, 192, 140, 108];

function useAnimatedNumber(value: number, enabled: boolean) {
  const previous = useRef(value);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = previous.current;
    let frame = 0;
    function update(time: number) {
      const elapsed = Math.min(1, (time - start) / 240);
      const next = from + (value - from) * (1 - (1 - elapsed) ** 3);
      previous.current = next;
      setDisplay(next);
      if (elapsed < 1) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value, enabled]);
  return enabled ? display : value;
}

export function Pie({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const instance = useId();
  const [active, setActive] = useState<number | null>(null);
  const [effect, setEffect] = useState(0);
  const patterned = id.includes("pattern");
  const gradient = id === "pie-gradients";
  const isHalf = id === "pie-half-donut";
  const donut = id.includes("center") || id === "pie-hover-legend" || isHalf || ["pie-donut-grow", "pie-glow", "pie-patterns"].includes(id);
  const rows = metrics(data, pieNames, pieValues);
  const total = sum(rows);
  const item = active === null ? undefined : rows[active];
  const display = useAnimatedNumber(item?.value ?? total, donut && !compact);
  const selectedEffect = id === "pie-hover-effects" ? effect : (isHalf || id === "pie-donut-grow" ? 1 : id === "pie-glow" ? 2 : 0);
  const angle = isHalf ? 180 : 360;
  const centerY = isHalf ? 161 : 120;
  const gap = donut ? 2.2 : .65;
  let start = isHalf ? 180 : -90;
  return <div className={styles.frame}>
    {!compact && id === "pie-hover-effects" && <Controls items={["Pop out", "Grow", "Stay put"]} value={effect} onChange={setEffect} />}
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      <defs>
        {rows.map((row, index) => {
          const color = tone(theme, index, row.color);
          return <g key={index}>
            <Pattern id={`${instance}-pattern-${index}`} color={color} variant={id === "pie-pattern-tile" && !index ? 4 : index} />
            <radialGradient id={`${instance}-gradient-${index}`}>
              <stop offset="0" stopColor={tone(theme, index + 1)} />
              <stop offset="1" stopColor={color} />
            </radialGradient>
            <filter id={`${instance}-glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={color} floodOpacity=".9" />
            </filter>
          </g>;
        })}
      </defs>
      {rows.map((row, index) => {
        const sweep = total > 0 ? angle * Math.max(0, row.value) / total : 0;
        const from = start;
        start += sweep;
        const isActive = active === index;
        const [tx, ty] = point(0, 0, isActive && selectedEffect === 0 ? 7 : 0, from + sweep / 2);
        const usePattern = patterned && (id !== "pie-pattern" || index === 1);
        const color = usePattern ? `url(#${instance}-pattern-${index})`
          : gradient ? `url(#${instance}-gradient-${index})` : tone(theme, index, row.color);
        return sweep > 0 && <path key={index} d={sector(210, centerY, (isHalf ? 117 : 101) + (isActive && selectedEffect === 1 ? 6 : 0), donut ? (isHalf ? 73 : 59) : 0, from + Math.min(gap, sweep / 5), start - Math.min(gap, sweep / 5))}
          transform={`translate(${tx} ${ty})`} fill={color} opacity={active === null || isActive ? 1 : .48}
          stroke={donut ? color : theme.surface} strokeWidth={donut ? 2.5 : 1.5} strokeLinejoin="round"
          filter={id === "pie-glow" && isActive ? `url(#${instance}-glow-${index})` : undefined}
          style={{ transition: "opacity 150ms, transform 200ms, d 220ms" }}
          tabIndex={compact ? undefined : 0} aria-label={`${row.name}: ${number.format(row.value)}`}
          onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <title>{`${row.name} · ${number.format(row.value)} · ${percent(row.value, total).toFixed(1)}%`}</title>
        </path>;
      })}
      {(donut || item) && <g pointerEvents="none" textAnchor="middle">
        <text x="210" y={centerY + 3} fill={item ? tone(theme, active ?? 0, item.color) : theme.text} fontSize="25" fontWeight="650">{number.format(Math.round(display))}</text>
        <text x="210" y={centerY + 22} fill={theme.muted} fontSize="11">{item?.name ?? (id === "pie-center-custom" ? "Product revenue" : "Total")}</text>
        {id === "pie-center-share" && item && <text x="210" y={centerY + 36} fill={theme.muted} fontSize="10">{percent(item.value, total).toFixed(1)}% of total</text>}
      </g>}
    </svg>
    {!compact && id === "pie-hover-legend" && <Legend items={rows} theme={theme} active={active} onActive={setActive} />}
  </div>;
}

export function Ring({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const [active, setActive] = useState<number | null>(null);
  const rows = metrics(data, ["Direct", "Organic", "Email", "Partners", "Social"], [156, 135, 108, 82, 57]);
  const sweep = id === "ring-semicircle" ? 180 : id === "ring-arc" ? 270 : 315;
  const start = sweep === 180 ? 180 : -90;
  const cy = sweep === 180 ? 170 : 120;
  const showGrid = id === "ring-grid" || id === "ring-semicircle";
  const goals = rows.map((_, index) => id === "ring-center-custom" ? 160 + index * 12 : Math.max(200, ...(data ? rows.map(row => row.value) : [])));
  const current = active === null ? undefined : rows[active];
  const ratio = Boolean(current && id === "ring-center-custom");
  const display = useAnimatedNumber(ratio && current ? percent(current.value, goals[active ?? 0] ?? 1) : current?.value ?? sum(rows), !compact && !ratio);
  const width = Math.min(13, 68 / Math.max(1, rows.length));
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      {showGrid && Array.from({ length: sweep === 180 ? 3 : 5 }, (_, index) => {
        const angle = start + index * sweep / (sweep === 180 ? 2 : 4);
        const [x1, y1] = point(210, cy, 26, angle);
        const [x2, y2] = point(210, cy, 112, angle);
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.grid} strokeDasharray="3 4" />;
      })}
      {rows.map((row, index) => {
        const radius = 101 - index * (width + 3);
        if (radius <= 15) return null;
        const end = start + sweep * Math.min(1, Math.max(0, row.value / (goals[index] || 1)));
        const color = tone(theme, index, row.color);
        const [tx, ty] = point(210, cy, radius, start - 8);
        return <g key={index} tabIndex={compact ? undefined : 0} aria-label={`${row.name}: ${row.value} of ${goals[index]}`}
          opacity={active === null || active === index ? 1 : .4} style={{ transition: "opacity 160ms" }}
          onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <title>{`${row.name} · ${row.value} of ${goals[index]}`}</title>
          <path d={arc(210, cy, radius, start, start + sweep)} fill="none" stroke={theme.grid} strokeWidth={width} strokeLinecap={id === "ring-arc" ? "butt" : "round"} />
          <path d={arc(210, cy, radius, start, end)} fill="none" stroke={color} strokeWidth={width} strokeLinecap={id === "ring-arc" ? "butt" : "round"} />
          {showGrid && <text x={sweep === 180 ? 200 - radius : tx - 7} y={sweep === 180 ? cy + 15 : ty + 3} textAnchor="end" fontSize="8" fill={color}>{row.name}</text>}
        </g>;
      })}
      <g textAnchor="middle" pointerEvents="none">
        <text x="210" y={cy + 3} fill={theme.text} fontSize="22" fontWeight="650">{ratio ? `${Math.round(display)}%` : number.format(Math.round(display))}</text>
        <text x="210" y={cy + 20} fill={theme.muted} fontSize="10">{current?.name ?? "Total"}</text>
      </g>
    </svg>
    {!compact && id === "ring-legend" && <Legend items={rows} active={active} onActive={setActive} progress={Math.max(...goals)} theme={theme} />}
  </div>;
}

const radarCategories = ["Reach", "Conversion", "Retention", "Engagement", "Value", "Reliability"];
const radarSeries = [
  { name: "Direct", values: [82, 56, 75, 84, 55, 70] },
  { name: "Referral", values: [52, 80, 47, 65, 81, 49] },
  { name: "Organic", values: [64, 46, 87, 50, 68, 79] },
  { name: "Social", values: [42, 66, 53, 70, 41, 82] },
];

export function Radar({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const [active, setActive] = useState<number | null>(null);
  const [focusMetric, setMetric] = useState<number | null>(null);
  const minimal = id === "radar-minimal";
  const fillOnly = id === "radar-fill-only";
  const noSpokes = minimal || fillOnly || ["radar-grid-only", "radar-levels"].includes(id);
  const limit = minimal || id === "radar-single" || id === "radar-levels" ? 1 : ["radar-triangle", "radar-fill-only", "radar-grid-only"].includes(id) ? 2 : 4;
  const { categories, series } = seriesData(data, radarCategories.slice(0, id === "radar-triangle" || id === "radar-grid-only" ? 3 : fillOnly ? 6 : 5), radarSeries.slice(0, limit));
  const max = Math.max(100, ...series.flatMap(row => row.values.map(value => Number(value ?? 0))));
  const radius = 91;
  const count = categories.length;
  const coords = (index: number, r: number) => point(210, 120, r, -90 + index * 360 / count);
  const points = (values: readonly (number | null)[], scale = 1) => categories.map((_, index) => coords(index, (Math.max(0, Number(values[index] ?? 0)) / max) * radius * scale).join(",")).join(" ");
  const items = series.map(row => ({ name: row.name, color: row.color, value: row.values.reduce<number>((total, value) => total + Number(value ?? 0), 0) / Math.max(1, row.values.length) }));
  const gridLevels = id === "radar-levels" ? 3 : 5;
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      {!minimal && Array.from({ length: gridLevels }, (_, i) => {
        const level = (i + 1) * max / gridLevels;
        return <g key={i}>
          <polygon points={points(Array.from({ length: count }, () => level))} fill="none" stroke={theme.grid} />
          {!fillOnly && id !== "radar-levels" && <text x="214" y={117 - (i + 1) * radius / gridLevels} fill={theme.muted} fontSize="8">{number.format(level)}</text>}
        </g>;
      })}
      {categories.map((category, index) => {
        const [x, y] = coords(index, radius);
        const [tx, ty] = coords(index, radius + 15);
        return <g key={index} onMouseEnter={() => setMetric(index)} onMouseLeave={() => setMetric(null)}>
          {!noSpokes && <line x1="210" y1="120" x2={x} y2={y} stroke={theme.grid} />}
          <text x={tx} y={ty + 3} fontSize="10" textAnchor="middle" fill={focusMetric === index && id === "radar-hover" ? theme.text : theme.muted}>{category}</text>
        </g>;
      })}
      {series.map((row, index) => {
        const color = tone(theme, index, row.color);
        const opacity = active === null || active === index ? 1 : .3;
        const positions = points(row.values, active === index ? 1.05 : 1);
        return <g key={index} opacity={opacity} style={{ transition: "opacity 180ms" }} tabIndex={compact ? undefined : 0}
          onFocus={() => setActive(index)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
          <title>{row.name}</title>
          <polygon points={positions} fill={color} fillOpacity={fillOnly ? .4 : .17} stroke={fillOnly ? "none" : color} strokeWidth="1.8"
            style={active === index ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
          {!fillOnly && !minimal && id !== "radar-single" && id !== "radar-levels" && categories.map((_, position) => {
            const [x, y] = coords(position, Math.max(0, Number(row.values[position] ?? 0)) / max * radius * (active === index ? 1.05 : 1));
            return <circle key={position} cx={x} cy={y} r={focusMetric === position ? 4 : 2.5} fill={color} />;
          })}
        </g>;
      })}
    </svg>
    {!compact && id === "radar-hover" && <div className={styles.hint}>{active === null ? "Focus a series to inspect it" : series[active]?.name}</div>}
    {!compact && id === "radar-hover-legend" && <Legend items={items} theme={theme} active={active} onActive={setActive} />}
  </div>;
}
