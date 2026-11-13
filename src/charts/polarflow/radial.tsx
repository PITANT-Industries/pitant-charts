import { useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { arc, Legend, number, numeric, Pattern, point, seriesData, tone, type Props } from "./shared";
import styles from "./styles.module.css";

const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = Array.from({ length: 365 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 0, index + 1));
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
});
const climate = (base: number, amplitude: number, daily: number) => days.map((_, i) =>
  Math.round(base + Math.sin((i - 127) / 365 * Math.PI * 2) * amplitude + Math.sin(i / 3.8) * daily + Math.cos(i * 1.52) * daily * .48));
const climateSeries = [
  { name: "Record high", values: climate(80, 12, 2.4) },
  { name: "Typical high", values: climate(71, 9, 1.35) },
  { name: "Daily mean", values: climate(61, 8, 2.2) },
  { name: "Typical low", values: climate(51, 7, 1.35) },
  { name: "Record low", values: climate(44, 7, 2.4) },
];
function smoothLine(points: readonly (readonly [number, number])[]) {
  if (!points.length) return "";
  let path = `M ${points[0].join(" ")}`;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[Math.max(0, index - 1)];
    const b = points[index];
    const c = points[index + 1];
    const d = points[Math.min(points.length - 1, index + 2)];
    const first = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const second = [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6];
    path += ` C ${first.join(" ")} ${second.join(" ")} ${c.join(" ")}`;
  }
  return path;
}
const states = ["CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI", "NJ", "VA", "WA", "AZ", "TN", "MA", "IN", "MO", "MD", "WI", "CO", "MN", "SC", "AL", "LA", "KY", "OR", "OK", "CT", "UT", "IA", "NV", "AR", "KS", "MS", "NM", "NE", "ID", "WV", "HI", "NH", "ME", "MT", "RI", "DE", "SD", "ND", "AK", "VT", "WY"];
const hourValues = (seed: number, scale: number) => hours.map((_, index) => Math.round(Math.max(0, 3 + (Math.sin(index / 3.1 - seed) + 1.2) * scale + Math.cos(index * 1.9) * 2)));
const clockIds = new Set(["radial-default", "radial-line", "radial-bar-clock", "radial-area-clock"]);
const quarterHours = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
const nowBin = quarterHours.indexOf("14:30");
const statusNames = ["Merged", "Ready for merge", "Draft"];
const quarterSeries = (shift: number) => [
  quarterHours.map((_, index) => Math.max(0, Math.round(82 + 166 * Math.exp(-((index - 44 - shift) ** 2) / 104) + 260 * Math.exp(-((index - 59 - shift) ** 2) / 190) + 16 * Math.sin(index * .94 + shift)))),
  quarterHours.map((_, index) => Math.max(0, Math.round(6 + 16 * Math.exp(-((index - 37 - shift) ** 2) / 204) + 4 * Math.cos(index * .54 + shift)))),
  quarterHours.map((_, index) => Math.max(0, Math.round(7 + 70 * Math.exp(-((index - 12 - shift) ** 2) / 82) + 8 * Math.sin(index / 4 + shift)))),
];
const today = quarterSeries(0);
const yesterday = quarterSeries(2);

function QuarterHourClock({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const hasFocus = useRef(false);
  const line = example.id === "radial-line";
  const dots = example.id === "radial-default";
  const areas = example.id === "radial-area-clock";
  const fixture = line ? [{ name: "Merged today", values: today[0] }, { name: "Merged yesterday", values: yesterday[0] }]
    : statusNames.map((name, index) => ({ name, values: today[index] }));
  const { categories, series } = seriesData(data, quarterHours, fixture);
  const count = categories.length;
  const sample = Math.min(count - 1, active ?? (data ? 0 : nowBin));
  const currentEnd = data ? count - 1 : nowBin;
  const latestDay = (index: number) => !data && index > currentEnd;
  const readings = series.map((row, layer) => categories.map((_, index) =>
    numeric(!line && latestDay(index) ? yesterday[layer]?.[index] : row.values[index])));
  const levels = readings.map((_, layer) => categories.map((__, index) =>
    readings.slice(0, layer + 1).reduce((sum, row) => sum + Math.max(0, row[index]), 0)));
  const max = (line ? readings : levels).reduce((top, row) => row.reduce((highest, value) => Math.max(highest, value), top), 1);
  const cx = 210;
  const cy = 120;
  const start = 36;
  const end = 100;
  const scale = (value: number) => start + (end - start) * Math.max(0, value) / max;
  const angle = (index: number) => -90 + index * 360 / Math.max(1, count);
  const bins = (values: readonly number[], first = 0, last = count - 1) => values.slice(first, last + 1).map((value, index) => point(cx, cy, scale(value), angle(first + index)));
  const panelTotals = series.map((row, layer) => ({ name: row.name, color: row.color, value: readings[layer].slice(0, currentEnd + 1).reduce((sum, value) => sum + value, 0) }));
  const daySuffix = latestDay(sample) ? " yesterday" : "";
  const previousReadings = line ? readings[1] : data ? undefined : yesterday[0];
  const totalAtRest = active === null && !data;
  const selectedValue = totalAtRest ? panelTotals[0]?.value ?? 0 : line && latestDay(sample) ? previousReadings?.[sample] ?? 0 : readings[0]?.[sample] ?? 0;
  const baseline = totalAtRest ? previousReadings?.slice(0, currentEnd + 1).reduce((sum, value) => sum + value, 0) : previousReadings?.[sample];
  const difference = selectedValue - (baseline ?? 0);
  function select(index: number) {
    const next = ((index % count) + count) % count;
    setActive(next);
    setRotation(previous => {
      const destination = angle(next) + 90;
      const offset = ((destination - previous + 180) % 360 + 360) % 360 - 180;
      return previous + offset;
    });
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!count) return;
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const distance = Math.hypot(pointer.x - cx, pointer.y - cy);
    if (distance < start - 5 || distance > end + 15) {
      if (!hasFocus.current) setActive(null);
      return;
    }
    const phase = (Math.atan2(pointer.y - cy, pointer.x - cx) * 180 / Math.PI + 450) % 360;
    select(Math.round(phase / 360 * count));
  }
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (!count) return;
    const next = { ArrowLeft: sample - 1, ArrowUp: sample - 1, ArrowRight: sample + 1, ArrowDown: sample + 1, Home: 0, End: count - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  }
  function area(layer: number, first: number, last: number) {
    const upper = bins(levels[layer], first, last);
    const lower = bins(levels[layer - 1] ?? categories.map(() => 0), first, last).reverse();
    return upper.length ? `M ${[...upper, ...lower].map(pair => pair.join(" ")).join(" L ")} Z` : "";
  }
  const lastBin = count - 1;
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-roledescription="chart" aria-label={example.title}
      aria-description="Use the arrow keys to inspect adjacent clock bins. Home and End move to the first and last bins."
      tabIndex={compact ? undefined : 0} onPointerMove={move} onPointerLeave={() => { if (!hasFocus.current) setActive(null); }} onKeyDown={key}
      onFocus={() => { hasFocus.current = true; if (active === null && count) select(sample); }} onBlur={() => { hasFocus.current = false; setActive(null); }}>
      <defs>{areas && !compact && <mask id={`${id}-sweep`} maskUnits="userSpaceOnUse" x="100" y="10" width="220" height="220">
        <circle className={styles.clockSweep} cx={cx} cy={cy} r="70" fill="none" stroke="white" strokeWidth="76" strokeDasharray="1" pathLength="1"
          transform={`rotate(-90 ${cx} ${cy})`} />
      </mask>}</defs>
      {[start, 57, 78, end].map(radius => <circle key={radius} cx={cx} cy={cy} r={radius} fill="none" stroke={theme.grid} strokeDasharray="2 3" />)}
      {[0, 1, 2, 3].map((quarter) => {
        const index = Math.min(lastBin, Math.round(quarter * count / 4));
        const [x, y] = point(cx, cy, end + 13, quarter * 90 - 90);
        return <text key={quarter} x={x} y={y + 3} textAnchor="middle" fontSize="9" fill={theme.muted}>{data ? categories[index] : ["00", "06", "12", "18"][quarter]}</text>;
      })}
      <g mask={areas && !compact ? `url(#${id}-sweep)` : undefined}>
        {line && readings.map((row, layer) => <path key={layer} d={smoothLine(bins(row, 0, layer ? lastBin : currentEnd))} fill="none" stroke={tone(theme, layer, series[layer].color)} strokeWidth={layer ? 1 : 2} strokeDasharray={layer ? "4 4" : undefined} opacity={layer ? .5 : 1} />)}
        {areas && readings.map((_, layer) => <g key={layer} opacity={highlight === null || highlight === layer ? 1 : .24}>
          <path d={area(layer, 0, currentEnd)} fill={tone(theme, layer, series[layer].color)} fillOpacity=".65" stroke={tone(theme, layer, series[layer].color)} strokeWidth=".65" />
          {currentEnd < lastBin && <path d={area(layer, currentEnd, lastBin)} fill={tone(theme, layer, series[layer].color)} fillOpacity=".22" />}
        </g>)}
        {!line && !areas && categories.map((_, index) => <g key={index} opacity={(latestDay(index) ? .35 : 1) * (active === null || index === active ? 1 : .37)}>
          {levels.map((values, layer) => {
            const low = levels[layer - 1]?.[index] ?? 0;
            const high = values[index];
            if (high <= low) return null;
            const color = tone(theme, layer, series[layer].color);
            const opacity = highlight === null || highlight === layer ? 1 : .22;
            if (dots) return Array.from({ length: Math.max(1, Math.round((scale(high) - scale(low)) / 5)) }, (_, dot) => {
              const [x, y] = point(cx, cy, Math.min(end, scale(low) + 2 + dot * 5), angle(index));
              return <circle key={`${layer}-${dot}`} cx={x} cy={y} r="1.05" fill={color} opacity={opacity} />;
            });
            const [x1, y1] = point(cx, cy, scale(low) + Math.min(.65, (scale(high) - scale(low)) / 3), angle(index));
            const [x2, y2] = point(cx, cy, scale(high), angle(index));
            return <line key={layer} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={Math.min(5, 270 / Math.max(1, count))} strokeLinecap="round" opacity={opacity} />;
          })}
        </g>)}
      </g>
      {active !== null && <g className={styles.clockCursor} style={{ "--clock-rotation": `${rotation}deg` } as CSSProperties}>
        <line x1={cx} y1={cy - start + 2} x2={cx} y2={cy - end - 4} stroke={theme.muted} strokeWidth=".9" strokeDasharray="3 2" />
        {areas && levels.map((values, layer) => <circle key={layer} cx={cx} cy={cy - scale(values[sample] ?? 0)} r="2.6" fill={tone(theme, layer, series[layer].color)} stroke={theme.surface} strokeWidth=".8" />)}
        {line && readings.map((row, layer) => (layer || sample <= currentEnd) && <circle key={layer} cx={cx} cy={cy - scale(row[sample] ?? 0)} r="2.6" fill={tone(theme, layer, series[layer].color)} stroke={theme.surface} strokeWidth=".8" />)}
      </g>}
      {count > 0 && <g textAnchor="middle" pointerEvents="none">
        <text x={cx} y={cy - 2} fontSize="15" fontWeight="650" fill={theme.text}>{line || dots ? number.format(selectedValue) : categories[sample]}</text>
        <text x={cx} y={cy + 11} fontSize="7.5" fill={theme.muted}>{line || dots ? `merged ${active === null ? "by" : "at"} ${categories[sample]}${daySuffix}` : latestDay(sample) ? "Yesterday" : "Today"}</text>
        {(line || dots) && !data && !latestDay(sample) && <text x={cx} y={cy + 22} fontSize="7.5" fill={theme.muted}>{difference >= 0 ? "+" : "−"}{number.format(Math.abs(difference))} vs yesterday</text>}
      </g>}
    </svg>
    {!compact && !line && <Legend items={panelTotals} theme={theme} active={highlight} onActive={setHighlight} />}
    {!compact && active !== null && count > 0 && <div className={styles.screenReader} role="status" aria-atomic="true">
      {categories[sample]}{daySuffix}: {line && latestDay(sample) ? `Merged yesterday ${number.format(selectedValue)}` : series.map((row, layer) => `${row.name} ${number.format(readings[layer]?.[sample] ?? 0)}`).join(", ")}
    </div>}
  </div>;
}

export function Radial({ example, compact, data }: Props) {
  if (clockIds.has(example.id)) return <QuarterHourClock example={example} compact={compact} data={data} />;
  return <RadialDetail example={example} compact={compact} data={data} />;
}

function RadialDetail({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const instance = useId();
  const [active, setActive] = useState<number | null>(null);
  const id = example.id;
  const temperature = id.includes("temperature") || id.includes("seasonal");
  const storage = id.includes("semicircle") || id.includes("storage");
  const card = id.endsWith("-card");
  const population = id === "radial-population";
  const dots = id === "radial-patterned-dots" || id.includes("activity");
  const source = temperature ? days : storage ? ["MacBook", "Workstation", "Archive"] : population ? states : hours;
  const initial = temperature ? climateSeries : storage ? [
    { name: "Files", values: [28, 40, 60] }, { name: "Media", values: [23, 36, 22] }, { name: "System", values: [11, 13, 8] },
  ] : population ? [
    { name: "Under 18", values: states.map((_, i) => Math.max(1, 14 - i / 3)) },
    { name: "18–64", values: states.map((_, i) => Math.max(3, 38 - i / 1.4)) },
    { name: "65+", values: states.map((_, i) => Math.max(1, 12 - i / 4)) },
  ] : [
    { name: "Today", values: hourValues(2.7, 9) }, { name: id.includes("patterned") ? "Grid power" : "Yesterday", values: hourValues(3.8, 7) },
  ];
  const { categories, series } = seriesData(data, source, initial);
  const limit = storage && card ? Math.min(1, categories.length) : categories.length;
  const count = Math.max(1, limit);
  const cx = card ? 141 : 210;
  const cy = storage ? 174 : 120;
  const radius = storage ? 116 : 99;
  const base = storage ? 100 : 14;
  const angle = (index: number) => -90 + index * 360 / count;
  const domain = Math.max(1, ...categories.map((_, index) => population ?
    series.reduce((acc, item) => acc + Number(item.values[index] ?? 0), 0) : Math.max(0, ...series.map(row => Number(row.values[index] ?? 0)))));
  const scaled = (value: number) => base + Math.max(0, value) / domain * (radius - base);
  const activeIndex = active ?? Math.min(temperature ? 217 : 9, limit - 1);
  const focusedValue = series[temperature ? Math.min(2, series.length - 1) : 0]?.values[activeIndex] ?? 0;
  const areaPath = (values: number[], lower?: number[]) => {
    const p = values.map((value, index) => point(cx, cy, scaled(value), angle(index)).join(","));
    if (!p.length) return "";
    if (lower) {
      const q = lower.map((value, index) => point(cx, cy, scaled(value), angle(index)).join(",")).reverse();
      return `M ${[...p, p[0], q[0], ...q].join(" L ")} Z`;
    }
    return `M ${p.join(" L ")} Z`;
  };
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      <defs>{series.map((row, index) => <Pattern key={index} id={`${instance}-${index}`} color={tone(theme, index, row.color)} variant={index} />)}</defs>
      {!storage && [25, 50, 75, 100].map((value) => <circle key={value} cx={cx} cy={cy} r={value * radius / 100} fill="none" stroke={theme.grid} strokeDasharray="2 3" />)}
      {storage && categories.slice(0, limit).map((name, index) => {
        const r = radius - index * (18 + 6);
        let start = 180;
        const maximum = Math.max(100, series.reduce((total, row) => total + Number(row.values[index] ?? 0), 0));
        return <g key={index} tabIndex={compact ? undefined : 0} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <path d={arc(cx, cy, r, 180, 360)} fill="none" stroke={theme.grid} strokeWidth="16" strokeLinecap="round" />
          {series.map((row, seriesIndex) => {
            const from = start;
            start += 180 * Number(row.values[index] ?? 0) / maximum;
            return <path key={seriesIndex} d={arc(cx, cy, r, from + 1, Math.max(from + 1, start - 1))} fill="none"
              stroke={tone(theme, seriesIndex, row.color)} strokeWidth={active === index ? 19 : 16} strokeLinecap="round"><title>{`${name} · ${row.name}: ${row.values[index] ?? 0}%`}</title></path>;
          })}
        </g>;
      })}
      {temperature && !data && [
        { name: "Record range", high: 0, low: 4, fill: .15 },
        { name: "Typical range", high: 1, low: 3, fill: .25 },
      ].map((band, index) => <path key={band.name}
        d={areaPath(climateSeries[band.high].values, climateSeries[band.low].values)}
        fill={tone(theme, index)} fillOpacity={band.fill} stroke={tone(theme, index)} strokeWidth=".65" />)}
      {temperature && [...series.keys()].reverse().map(index => {
        if (!data && index !== 2) return null;
        const row = series[index];
        const values = categories.map((_, at) => numeric(row.values[at]));
        const color = tone(theme, index, row.color);
        const current = point(cx, cy, scaled(values[activeIndex] ?? 0), angle(activeIndex));
        return <g key={index}>
          <path d={areaPath(values)} fill={index < 2 ? color : "none"} fillOpacity=".22"
            stroke={color} strokeWidth={index === 0 || index === 2 ? 2 : 1} />
          {active !== null && index === 2 && <circle cx={current[0]} cy={current[1]} r="3" fill={color} stroke={theme.surface} />}
        </g>;
      })}
      {!storage && !temperature && categories.map((name, index) => {
        const heading = angle(index);
        const [tx, ty] = point(cx, cy, radius + 13, heading);
        const showLabel = index % (population ? 5 : count > 12 ? 6 : 3) === 0;
        const opacity = active === null || active === index ? 1 : .4;
        const [hx1, hy1] = point(cx, cy, base, heading);
        const [hx2, hy2] = point(cx, cy, radius + 7, heading);
        let begin = 0;
        return <g key={index}>
          {showLabel && <text x={tx} y={ty + 3} fill={theme.muted} fontSize="9" textAnchor="middle">{population ? name : name.slice(0, 2)}</text>}
          {active === index && <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke={theme.muted} strokeDasharray="3 3" />}
          {series.map((row, layer) => {
            const value = Number(row.values[index] ?? 0);
            const color = tone(theme, layer, row.color);
            if (dots) {
              const dotCount = Math.max(0, Math.round(value * 10 / domain));
              return Array.from({ length: dotCount }, (_, dot) => {
                const [x, y] = point(cx, cy, 24 + dot * 7.1, heading + (layer ? 3.2 : -3.2));
                return <circle key={`${layer}-${dot}`} cx={x} cy={y} r={id.includes("patterned") ? 3.3 : 2.15}
                  fill={id.includes("patterned") && layer ? `url(#${instance}-${layer})` : color} opacity={opacity * (layer ? .42 : 1)} />;
              });
            }
            const [sx, sy] = point(cx, cy, scaled(begin), heading);
            begin += value;
            const [ex, ey] = point(cx, cy, scaled(begin), heading);
            return <line key={layer} x1={sx} y1={sy} x2={ex} y2={ey} stroke={color} strokeWidth={population ? 3.4 : 6.5} strokeLinecap="round" opacity={opacity} />;
          })}
          <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="transparent" strokeWidth={Math.max(6, 250 / count)}
            tabIndex={compact ? undefined : 0} aria-label={name} onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
            <title>{`${name} · ${series.map(row => `${row.name}: ${row.values[index] ?? "–"}`).join(" · ")}`}</title>
          </line>
        </g>;
      })}
      {temperature && <g>
        {(data?.categories ?? months).filter((_, index) => index % 3 === 0).map((name, index, labels) => {
          const [x, y] = point(cx, cy, radius + 12, -90 + 360 * index / labels.length);
          return <text key={index} x={x} y={y + 2} fill={theme.muted} fontSize="9" textAnchor="middle">{name}</text>;
        })}
        {active !== null && <line x1={cx} y1={cy} x2={point(cx, cy, radius + 3, angle(active))[0]} y2={point(cx, cy, radius + 3, angle(active))[1]}
          stroke={theme.muted} strokeDasharray="3 3" />}
        <circle cx={cx} cy={cy} r={radius + 7} fill="transparent" tabIndex={compact ? undefined : 0}
          aria-label="Temperature by date. Use left and right arrows to inspect."
          onMouseMove={event => {
            const svg = event.currentTarget.ownerSVGElement;
            const inverse = svg?.getScreenCTM()?.inverse();
            if (!svg || !inverse) return;
            const screen = svg.createSVGPoint();
            screen.x = event.clientX;
            screen.y = event.clientY;
            const pointer = screen.matrixTransform(inverse);
            const phase = (Math.atan2(pointer.y - cy, pointer.x - cx) * 180 / Math.PI + 450) % 360;
            setActive(Math.round(phase / 360 * count) % count);
          }}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(activeIndex)}
          onBlur={() => setActive(null)}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setActive((activeIndex + (event.key === "ArrowLeft" ? -1 : 1) + count) % count);
          }} />
        {active !== null && !card && <text x={cx} y={cy + 5} fill={theme.text} textAnchor="middle" fontSize="11" fontWeight="650">
          {categories[activeIndex]} · {focusedValue}°F
        </text>}
      </g>}
      {card && <g>
        <text x="270" y="100" fill={theme.muted} fontSize="11">{temperature ? "Average temperature" : storage ? "Storage used" : "Pull requests"}</text>
        <text x="270" y="128" fill={theme.text} fontSize="27" fontWeight="650">{storage ? `${series.reduce((total, row) => total + Number(row.values[0] ?? 0), 0)}%` : number.format(focusedValue) + (temperature ? "°F" : "")}</text>
        <text x="270" y="145" fill={theme.muted} fontSize="10">{storage ? "2 TB plan" : categories[activeIndex]}</text>
      </g>}
    </svg>
  </div>;
}
