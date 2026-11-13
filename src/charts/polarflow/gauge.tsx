import { useEffect, useId, useState } from "react";
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
  "gauge-fixed": [{ name: "Revenue" }, { sweep: 180, name: "CPU" }, { mode: "solid", name: "Storage" }],
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
  "gauge-live-load": [{ zone: "fill", mode: "solid", name: "CPU load" }],
};

function gaugeColor(theme: Theme, index: number, value: number, zone: DialOptions["zone"]) {
  if (zone === "fill" || zone === "both") return value < 65 ? "#24a978" : value < 80 ? "#e7a520" : "#e65b61";
  return tone(theme, index);
}

function Dial({ options: config, value, index, total, id, theme }: {
  options: DialOptions; value: number; index: number; total: number; id: string; theme: Theme;
}) {
  const size = Math.min(228, 400 / Math.max(1, total));
  const cx = 210 + (index - (total - 1) / 2) * size;
  const cy = config.sweep === 180 ? 150 : 110;
  const radius = Math.min(83, size * .37);
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
      {mode === "solid" && <path d={arc(cx, cy, radius - 5, start, end)} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" style={{ transition: "d 420ms" }} />}
      {(mode === "ring" || config.ring) && <path d={arc(cx, cy, mode === "ring" ? radius : radius + 5, start, end)} stroke={color} strokeWidth={mode === "ring" ? 6 : 2} fill="none" strokeLinecap="round" style={{ transition: "d 420ms" }} />}
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
      <text y="7" fill={theme.text} fontWeight="650" fontSize={total > 2 ? 17 : 26}>{number.format(value)}{config.unit ?? "%"}</text>
      <text y={total > 2 ? 19 : 23} fill={theme.muted} fontSize={total > 2 ? 8 : 10}>{config.name ?? "Annual target"}</text>
    </g>
  </g>;
}

export function Gauge({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const id = useId();
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState(66);
  const variant = example.id;
  const values = [66, 79, 58, 91];
  const items = options[variant] ?? [{}];
  const rowValue = data?.rows?.[0]?.value;
  const dataValue = numeric(rowValue ?? data?.series?.[0]?.values[0], Number.NaN);
  const linear = variant === "gauge-linear" || variant === "gauge-linear-gradient";
  const value = Math.max(0, Math.min(100, Number.isFinite(dataValue) ? dataValue : variant === "gauge-live-load" ? live : values[selected]));
  useEffect(() => {
    if (variant !== "gauge-live-load" || compact || Number.isFinite(dataValue)) return;
    let tick = 0;
    const timer = setInterval(() => setLive([62, 77, 91, 83, 59, 68][tick++ % 6]), 1800);
    return () => clearInterval(timer);
  }, [variant, compact, dataValue]);
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 220" role="img" aria-label={`${example.title}: ${value}%`}>
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
      </g> : items.map((item, index) => <Dial key={index} options={item} value={variant === "gauge-fixed" ? Math.max(0, value - index * 10) : value} index={index} total={items.length} theme={theme} id={`${id}-${index}`} />)}
    </svg>
    {!compact && variant === "gauge-interactive" && <Controls items={["Q1", "Q2", "Q3", "Q4"]} value={selected} onChange={setSelected} />}
    {!compact && variant === "gauge-dial" && <button className={styles.control} type="button" onClick={() => setSelected((selected + 1) % values.length)}>Next reading</button>}
  </div>;
}
