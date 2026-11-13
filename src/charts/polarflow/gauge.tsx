import { useEffect, useId, useRef, useState } from "react";
import { useChartTheme } from "../theme";
import { arc, Controls, number, numeric, Pattern, point, sector, tone, type Props, type Theme } from "./shared";
import { createNotchPath } from "./upstream/gauge-notch";
import styles from "./styles.module.css";

type ArcMode = "notches" | "solid" | "ring" | "sector";
type Needle = "line" | "gradient" | "triangle" | "polygon";
interface DialOptions {
  mode?: ArcMode;
  needle?: Needle;
  tip?: number;
  ruler?: "inside" | "outside" | "ends";
  zone?: "band" | "fill" | "both";
  dots?: boolean;
  ring?: boolean;
  glow?: boolean;
  disc?: boolean;
  count?: number;
  sweep?: number;
  pattern?: number;
  unit?: string;
  name?: string;
}

const options: Record<string, DialOptions[]> = {
  "gauge-semicircle": [{ sweep: 180, name: "CPU load" }],
  "gauge-fixed": [{ name: "CPU", count: 40 }, { name: "Memory", count: 40 }, { name: "Disk", count: 40 }],
  "gauge-interactive": [{ name: "Attainment" }],
  "gauge-dial": [{ needle: "line", ruler: "inside", count: 90, name: "Reading" }],
  "gauge-arc-styles": [{ name: "Notches" }, { mode: "solid", name: "Solid arc" }, { mode: "ring", name: "Ring only" }],
  "gauge-ruler": [{ ruler: "inside", name: "Inside" }, { ruler: "ends", name: "Ends only" }, { ruler: "outside", unit: " rpm", name: "RPM" }],
  "gauge-needles": [{ needle: "line", name: "Line" }, { needle: "gradient", name: "Gradient" }, { needle: "triangle", name: "Triangle" }, { needle: "polygon", name: "Polygon" }],
  "gauge-needle-tips": [{ needle: "line", tip: .66, name: "Inside" }, { needle: "line", tip: 1, name: "Edge" }, { needle: "line", tip: 1.15, ruler: "outside", name: "Past scale" }],
  "gauge-zones": [{ zone: "band", name: "Zone band" }, { zone: "fill", name: "Color fill" }, { zone: "both", name: "Band and fill" }],
  "gauge-sectors": [{ mode: "sector", pattern: 0, name: "Angular gradient" }, { mode: "sector", pattern: 1, name: "Radial gradient" }, { mode: "sector", pattern: 2, name: "Lines" }],
  "gauge-progress-ring": [{ ring: true, name: "With notches" }, { mode: "ring", name: "Ring only" }],
  "gauge-dots": [{ mode: "solid", dots: true, name: "Behind arc" }, { mode: "ring", dots: true, name: "With progress ring" }],
  "gauge-glow": [{ glow: true, name: "Soft bloom" }, { glow: true, mode: "solid", name: "Strong bloom" }],
  "gauge-center-disc": [{ disc: true, mode: "sector", name: "Sector" }, { disc: true, needle: "line", name: "Needle" }],
  "gauge-fan-duty": [{ mode: "solid", zone: "band", ruler: "outside", needle: "line", tip: .45, name: "Fan duty" }],
  "gauge-speedometer": [{ count: 90, glow: true, dots: true, ruler: "outside", zone: "fill", unit: " km/h", name: "Speed" }],
  "gauge-throughput": [{ mode: "sector", ring: true, ruler: "outside", needle: "triangle", disc: true, unit: " t", name: "Throughput" }],
  "gauge-live-load": [{ zone: "fill", mode: "solid", needle: "gradient", tip: .75, ruler: "outside", name: "CPU" }],
};

const quarterValues = [82, 94, 67, 41];
const dialValues = [38, 56, 73, 64, 86, 47];
const liveValues = [42, 58, 71, 86, 78, 62, 49];
const fixedValues = [38, 71, 54];
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function useSweepingValue(value: number, enabled: boolean) {
  const [position, setPosition] = useState(value);
  const latest = useRef(value);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      latest.current = value;
      setPosition(value);
      return;
    }
    const from = latest.current;
    if (from === value) return;
    const start = performance.now();
    let frame: number;
    const update = (time: number) => {
      const fraction = Math.min(1, (time - start) / 520);
      const next = from + (value - from) * (1 - (1 - fraction) ** 3);
      latest.current = next;
      setPosition(next);
      if (fraction < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [enabled, value]);
  return enabled ? position : value;
}

function gaugeColor(theme: Theme, index: number, value: number, zone: DialOptions["zone"]) {
  if (zone === "fill" || zone === "both") return value < 65 ? "#24a978" : value < 80 ? "#e7a520" : "#e65b61";
  return tone(theme, index);
}

function Dial({ options: config, value, index, total, id, theme, fixed, labelValue }: {
  options: DialOptions; value: number; index: number; total: number; id: string; theme: Theme; fixed?: boolean; labelValue?: string;
}) {
  const size = Math.min(228, 400 / Math.max(1, total));
  const cx = fixed ? 80 : 210 + (index - (total - 1) / 2) * size;
  const cy = fixed ? 80 : config.sweep === 180 ? 150 : 110;
  const radius = fixed ? 68 : Math.min(83, size * .37);
  const sweep = config.sweep ?? 252;
  const start = (90 + (360 - sweep) / 2) % 360;
  const end = start + sweep * value / 100;
  const color = gaugeColor(theme, index, value, config.zone);
  const count = config.count ?? 48;
  const mode = config.mode ?? "notches";
  const needle = config.needle;
  const [nx, ny] = point(cx, cy, radius * (config.tip ?? .82), end);
  const [bx, by] = point(cx, cy, radius * .26, end + 180);
  const [leftX, leftY] = point(cx, cy, radius * .09, end - 90);
  const [rightX, rightY] = point(cx, cy, radius * .09, end + 90);
  const fill = config.pattern === 2 ? `url(#${id}-lines)` : `url(#${id}-sector)`;
  return <g>
    <defs>
      <radialGradient id={`${id}-sector`}>
        <stop offset="10%" stopColor={color} stopOpacity=".14" /><stop offset="100%" stopColor={color} />
      </radialGradient>
      <linearGradient id={`${id}-needle`} gradientUnits="userSpaceOnUse" x1={cx} y1={cy} x2={nx} y2={ny}>
        <stop offset="0" stopColor={theme.text} stopOpacity=".3" /><stop offset="1" stopColor={color} />
      </linearGradient>
      <Pattern id={`${id}-lines`} color={color} variant={1} />
    </defs>
    {config.dots && [radius + 11, radius - 17].map((ring, j) => <g key={j}>
      {Array.from({ length: 42 }, (_, tick) => {
        const [x, y] = point(cx, cy, ring, start + tick * sweep / 41);
        return <circle key={tick} cx={x} cy={y} r={1.6} fill={(value > 0 && tick <= value * .41) ? color : theme.grid} opacity=".64" />;
      })}
    </g>)}
    {(config.zone === "band" || config.zone === "both") && [[0, 65, "#24a978"], [65, 80, "#e7a520"], [80, 100, "#e65b61"]].map(([from, to, zone]) =>
      <path key={from} d={arc(cx, cy, radius + 7, start + sweep * Number(from) / 100, start + sweep * Number(to) / 100)} stroke={String(zone)} strokeWidth="3" fill="none" />
    )}
    <g style={config.glow ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}>
      {mode === "notches" && Array.from({ length: count }, (_, tick) => {
        const angle = start + tick * sweep / (count - 1);
        const notch = sweep / (count - 1) * .29;
        const [x1, y1] = point(cx, cy, radius - 11, angle - notch);
        const [x2, y2] = point(cx, cy, radius, angle - notch);
        const [x3, y3] = point(cx, cy, radius, angle + notch);
        const [x4, y4] = point(cx, cy, radius - 11, angle + notch);
        const activeColor = config.sweep === 180 ? tone(theme, Math.floor(tick * 6 / count)) :
          config.name === "Speed" && tick * 100 / count > 78 ? "#e65b61" : color;
        return <path key={tick} d={createNotchPath({ x1, y1, x2, y2, x3, y3, x4, y4 }, 1.2, 11)}
          fill={value > 0 && angle <= end ? activeColor : theme.grid} style={{ transition: "fill 350ms" }} />;
      })}
      {mode === "solid" && <path d={arc(cx, cy, radius - 5, start, start + sweep)} stroke={theme.grid} strokeWidth="12" fill="none" strokeLinecap="round" />}
      {mode === "solid" && <path d={arc(cx, cy, radius - 5, start, end)} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" />}
      {(mode === "ring" || config.ring) && <path d={arc(cx, cy, mode === "ring" ? radius : radius + 5, start, end)} stroke={color} strokeWidth={mode === "ring" ? 6 : 2} fill="none" strokeLinecap="round" />}
      {mode === "sector" && config.pattern !== 0 && <path d={sector(cx, cy, radius, 0, start, end)} fill={fill} opacity=".8" />}
      {mode === "sector" && config.pattern === 0 && Array.from({ length: 24 }, (_, tick) => <path key={tick}
        d={sector(cx, cy, radius, 0, start + (end - start) * tick / 24, start + (end - start) * (tick + 1.02) / 24)}
        fill={color} opacity={.13 + .8 * tick / 24} />)}
    </g>
    {config.ruler && Array.from({ length: config.ruler === "ends" ? 2 : 11 }, (_, tick) => {
      const last = config.ruler === "ends" ? 1 : 10;
      const angle = start + tick * sweep / last;
      const r = config.ruler === "inside" ? radius - 18 : radius + 14;
      const [x1, y1] = point(cx, cy, r - 2, angle);
      const [x2, y2] = point(cx, cy, r + 2, angle);
      const [tx, ty] = point(cx, cy, r + (config.ruler === "inside" ? -7 : 8), angle);
      return <g key={tick} fill={angle <= end ? color : theme.muted}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity=".32" />
        {tick % 2 === 0 || last === 1 ? <text x={tx} y={ty + 2} fontSize={total > 2 ? "5" : "7"} textAnchor="middle">
          {tick * (config.unit === " rpm" ? 1200 : 100) / last}
        </text> : null}
      </g>;
    })}
    {config.disc && <circle cx={cx} cy={cy} r={radius * .4} fill={theme.surface} stroke={theme.grid} strokeWidth="2" />}
    {needle && <g>
      {(needle === "line" || needle === "gradient") && <line x1={bx} y1={by} x2={nx} y2={ny} stroke={needle === "gradient" ? `url(#${id}-needle)` : theme.text} strokeWidth={needle === "gradient" ? 4 : 2} strokeLinecap="round" />}
      {needle === "triangle" && <path d={`M ${nx} ${ny} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={theme.text} />}
      {needle === "polygon" && <path d={`M ${nx} ${ny} L ${leftX} ${leftY} L ${bx} ${by} L ${rightX} ${rightY} Z`} fill={color} />}
      <circle cx={cx} cy={cy} r={radius * .055} fill={theme.text} />
    </g>}
    <g textAnchor="middle" transform={`translate(${cx} ${cy + (needle ? radius * .48 : 0)})`}>
      <text y="7" fill={theme.text} fontWeight="650" fontSize={total > 2 ? 17 : 26}>{labelValue ?? `${number.format(value)}${config.unit ?? "%"}`}</text>
      <text y={total > 2 ? 19 : 23} fill={theme.muted} fontSize={total > 2 ? 8 : 10}>{config.name ?? "Annual target"}</text>
    </g>
  </g>;
}

export function Gauge({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const id = useId();
  const variant = example.id;
  const interactive = variant === "gauge-interactive";
  const dial = variant === "gauge-dial";
  const live = variant === "gauge-live-load";
  const fixed = variant === "gauge-fixed";
  const [selected, setSelected] = useState(interactive ? 2 : 0);
  const [sample, setSample] = useState({ count: 1, current: liveValues[0], sum: liveValues[0], peak: liveValues[0] });
  const items = options[variant] ?? [{}];
  const rowValue = data?.rows?.[0]?.value;
  const dataValue = numeric(rowValue ?? data?.series?.[0]?.values[0], Number.NaN);
  const useFixture = !Number.isFinite(dataValue);
  const linear = variant === "gauge-linear" || variant === "gauge-linear-gradient";
  const value = clamp(!useFixture ? dataValue : live ? sample.current : interactive ? quarterValues[selected] : dial ? dialValues[selected] : 66);
  const position = useSweepingValue(value, !compact && (live || interactive || dial || !useFixture));
  useEffect(() => {
    if (!live || compact || !useFixture) return;
    const timer = setInterval(() => setSample((previous) => {
      const current = liveValues[previous.count % liveValues.length];
      return { count: previous.count + 1, current, sum: previous.sum + current, peak: Math.max(previous.peak, current) };
    }), 1800);
    return () => clearInterval(timer);
  }, [compact, live, useFixture]);
  const fixedValue = (index: number) => clamp(numeric(data?.rows?.[index]?.value ?? data?.series?.[0]?.values[index], fixedValues[index]));
  if (fixed && !compact) return <div className={styles.fixedGauges}>
    {items.map((item, index) => <svg key={index} width="160" height="160" viewBox="0 0 160 160" role="img" aria-roledescription="chart"
      aria-label={`${item.name}: ${fixedValue(index)}%`}>
      <Dial options={item} value={fixedValue(index)} index={index} total={items.length} id={`${id}-${index}`} theme={theme} fixed />
    </svg>)}
  </div>;
  return <div className={styles.frame}>
    {!compact && interactive && <Controls items={["Q1", "Q2", "Q3", "Q4"]} value={selected} onChange={setSelected} />}
    <svg className={styles.native} viewBox="0 0 420 220" role="img" aria-roledescription="chart" aria-label={`${example.title}: ${value}%`}>
      {linear ? <g>
        <defs><linearGradient id={`${id}-linear`} gradientUnits="userSpaceOnUse" x1="40" x2="380">
          {theme.colors.slice(0, 5).map((color, index) => <stop key={index} offset={index / 4} stopColor={color} />)}
        </linearGradient></defs>
        <text x="41" y="82" fill={theme.text} fontSize="30" fontWeight="650">{number.format(Number.isFinite(dataValue) ? value : 12.4)}{Number.isFinite(dataValue) ? "%" : "k"}</text>
        <text x="42" y="101" fill={theme.muted} fontSize="12">{Number.isFinite(dataValue) ? "Progress" : "Downloads this month"}</text>
        {Array.from({ length: variant.endsWith("gradient") ? 72 : 30 }, (_, tick) => {
          const count = variant.endsWith("gradient") ? 72 : 30;
          return <rect key={tick} x={42 + 336 * tick / count} y="122" width={336 / count - (count > 30 ? 0 : 4)} height="33" rx={count > 30 ? 0 : 2}
            fill={value > 0 && tick * 100 / count <= value ? count > 30 ? `url(#${id}-linear)` : tone(theme, 0) : theme.grid} />;
        })}
      </g> : items.map((item, index) => <Dial key={index} options={dial ? { ...item, name: `Load at 14:${String(selected * 5).padStart(2, "0")}` } : interactive ? { ...item, name: `Closed in Q${selected + 1}` } : item}
        value={fixed ? fixedValue(index) : position} index={index} total={items.length} theme={theme} id={`${id}-${index}`}
        labelValue={interactive && useFixture ? `$${(Math.round(1.5 * position) / 100).toFixed(2)}M` : `${number.format(Math.round(fixed ? fixedValue(index) : position))}${item.unit ?? "%"}`} />)}
    </svg>
    {!compact && interactive && <p className={styles.hint}>{value}% of quota in Q{selected + 1}</p>}
    {!compact && dial && <div className={styles.controls}><button className={styles.control} type="button" onClick={() => setSelected((previous) => (previous + 1) % dialValues.length)}>Next reading</button>
      <span className={styles.hint}>Reading {selected + 1} of {dialValues.length}</span></div>}
    {!compact && live && <dl className={styles.gaugeSummary} aria-label="CPU sample summary">
      {[["Now", value], ["Average", useFixture ? Math.round(sample.sum / sample.count) : value], ["Peak", useFixture ? sample.peak : value]].map(([label, reading]) =>
        <div key={label}><dt>{label}</dt><dd>{reading}%</dd></div>)}
    </dl>}
  </div>;
}
