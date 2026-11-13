import { Button } from "@ui-sdk/react/button";
import { useEffect, useId, useRef, useState } from "react";
import { useChartTheme } from "../theme";
import { arc, Controls, number, numeric, point, sector, tone, type Props, type Theme } from "./shared";
import { createNotchPath } from "./upstream/gauge-notch";
import { dialFixtures, gaugeMetrics, type DialOptions, type GaugeZone } from "./gauge-fixtures";
import gauge from "./gauge.module.css";
import styles from "./styles.module.css";

const quarterValues = [82, 94, 67, 41];
const dialValues = [38, 56, 73, 64, 86, 47];
const liveValues = [42, 58, 71, 86, 78, 62, 49];
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function useSweepingValue(value: number, enabled: boolean) {
  const initialValue = enabled && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : value;
  const [position, setPosition] = useState(initialValue);
  const latest = useRef(initialValue);
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

function zoneAt(zones: readonly GaugeZone[], value: number) {
  for (let index = zones.length - 1; index >= 0; index--) {
    const zone = zones[index];
    if (value >= zone.from && value < zone.to) return zone.color;
  }
  return undefined;
}

function trackGradient(id: string, theme: Theme, x1: number, x2: number) {
  return <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} x2={x2} y1="0" y2="0">
    <stop offset="0" stopColor={tone(theme, 0)} /><stop offset="1" stopColor={tone(theme, 4)} />
  </linearGradient>;
}

function Dial({ config, target, label, compact, fixed, index }: {
  config: DialOptions; target: number; label: string; compact?: boolean; fixed?: boolean; index: number;
}) {
  const theme = useChartTheme();
  const id = useId();
  const value = useSweepingValue(target, !compact);
  const cx = fixed ? 80 : 130;
  const cy = fixed ? 80 : config.sweep === 180 ? 128 : 100;
  const radius = fixed ? 69 : config.radius ?? 92;
  const sweep = config.sweep ?? 270;
  const start = 270 - sweep / 2;
  const angle = (reading: number) => start + sweep * reading / 100;
  const end = angle(value);
  const mode = config.mode ?? "notches";
  const thickness = config.depth ?? (mode === "solid" ? 9 : fixed ? 21 : 29);
  const trackRadius = radius - thickness / 2;
  const color = config.paint === "foreground" ? theme.text : tone(theme, config.paint ?? 0);
  const dots = config.dots ?? [];
  const dotColor = config.dotPaint ?? color;
  const activePaint = config.gradient ? `url(#${id}-track)` : color;
  const track = (from: number, to: number, r = trackRadius) => arc(cx, cy, r, angle(from), angle(to));
  const zones = config.zones ?? [];
  const colorFill = config.zoneDisplay === "fill" || config.zoneDisplay === "both";
  const showBand = config.zoneDisplay === "band" || config.zoneDisplay === "both";
  const count = config.count ?? 40;
  const ruler = config.ruler;
  const discRadius = 39;
  const sectorRadius = mode === "none" ? radius - 3 : radius - thickness / 2 - 3;
  const sectorInner = config.disc ? discRadius : config.sector === "pattern" ? sectorRadius * .5 : config.sector === "radial" ? sectorRadius * .3 : 0;
  const wedge = sector(cx, cy, sectorRadius, sectorInner, start, end);
  const needleRadius = config.tip === "inner" ? radius - thickness - 2 : config.tip === "outer" ? radius :
    config.tip === "edge" ? radius + (ruler?.position === "outside" ? 17 : 9) : config.disc ? radius * .92 : mode === "solid" ? radius * .86 : radius - thickness - 3;
  const needleStart = config.tip === "inner" && mode === "solid" && config.needle === "line" ? needleRadius - 8 :
    config.needle === "triangle" && config.disc ? discRadius - 5 : config.disc ? discRadius - 1 : needleRadius * (config.tip ? .7 : .48);
  const readout = config.readout?.(value) ?? `${Math.round(value)}%`;
  const notchStart = start + sweep / count / 2;
  const notchDepth = Math.max(1, thickness);
  const notches = mode === "notches" ? Array.from({ length: count }, (_, tick) => {
    const a = notchStart + tick * sweep / count;
    const width = sweep / count * .38;
    const [x1, y1] = point(cx, cy, radius - notchDepth, a - width);
    const [x2, y2] = point(cx, cy, radius, a - width);
    const [x3, y3] = point(cx, cy, radius, a + width);
    const [x4, y4] = point(cx, cy, radius - notchDepth, a + width);
    return { a, path: createNotchPath({ x1, y1, x2, y2, x3, y3, x4, y4 }, config.rounded ?? 0, notchDepth) };
  }) : [];
  const fillBoundaries = [0, ...zones.flatMap(zone => [zone.from, zone.to]), 100]
    .filter((n, index, values) => values.indexOf(n) === index).sort((a, b) => a - b);

  return <figure className={gauge.dial}>
    <svg className={gauge.arc} width={fixed ? 160 : undefined} height={fixed ? 160 : undefined}
      viewBox={fixed ? "0 0 160 160" : "0 -10 260 208"} role="img" aria-roledescription="chart" aria-label={label}
      aria-describedby={`${id}-reading`} data-gauge-dial={index}>
      <desc id={`${id}-reading`}>{config.readout ? `${Math.round(target)}% · ${config.readout(target)}` : `${number.format(target)}%`}</desc>
      <defs>
        {config.gradient && trackGradient(`${id}-track`, theme, cx - radius, cx + radius)}
        {config.sector === "conic" && <clipPath id={`${id}-wedge`}><path d={wedge} /></clipPath>}
        {config.sector === "radial" && <radialGradient id={`${id}-radial`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={sectorRadius}>
          <stop offset="0" stopColor={color} stopOpacity="0" /><stop offset=".36" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} />
        </radialGradient>}
        {config.sector === "pattern" && <pattern id={`${id}-stripes`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M-1 1 1 -1 M0 6 6 0 M5 7 7 5" stroke={color} strokeWidth="1.5" />
        </pattern>}
        {config.glow && <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="bloom" /><feMerge><feMergeNode in="bloom" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>}
        {config.needle === "gradient" && <linearGradient id={`${id}-needle`} gradientUnits="userSpaceOnUse" x1={needleStart} x2={needleRadius} y1="0" y2="0">
          <stop offset="0" stopColor={theme.text} stopOpacity="0" /><stop offset=".7" stopColor={theme.text} stopOpacity=".7" /><stop offset="1" stopColor={theme.text} />
        </linearGradient>}
      </defs>
      {value > 0 && config.sector === "conic" && <foreignObject x="0" y="0" width="260" height="198" clipPath={`url(#${id}-wedge)`} data-gauge-sector="conic" aria-hidden="true">
        <div className={gauge.sector} style={{ background: `conic-gradient(from ${start + 90}deg at ${cx}px ${cy}px, transparent 0deg, ${color} ${end - start}deg, transparent 0deg)` }} />
      </foreignObject>}
      {value > 0 && config.sector && config.sector !== "conic" &&
        <path data-gauge-sector={config.sector} d={wedge} fill={`url(#${id}-${config.sector === "pattern" ? "stripes" : "radial"})`} />}
      {dots.map((amount, ringIndex) => <g key={ringIndex} data-gauge-dot-ring={ringIndex}>
        {Array.from({ length: amount }, (_, dot) => {
          const progress = (dot + .5) * 100 / amount;
          const [x, y] = point(cx, cy, radius - 12 - (dots.length - ringIndex - 1) * 7, angle(progress));
          return <circle key={dot} cx={x} cy={y} r={ringIndex % 2 ? 1.45 : 1.15}
            fill={dotColor} opacity={progress <= value ? .86 : .15} />;
        })}
      </g>)}
      {mode === "notches" && <g data-gauge-track="notches">
        <g opacity=".8">{notches.map(({ path }, tick) => <path key={tick} d={path} fill={theme.grid} />)}</g>
        <g filter={config.glow ? `url(#${id}-glow)` : undefined}>
          {notches.map(({ a, path }, tick) => <path key={tick} d={path}
            fill={colorFill ? zoneAt(zones, (a - start) / sweep * 100) ?? color : activePaint} opacity={a <= end ? 1 : 0} />)}
        </g>
      </g>}
      {mode === "solid" && <g data-gauge-track="solid" fill="none" strokeWidth={thickness}>
        <path d={track(0, 100)} stroke={theme.grid} strokeLinecap="round" />
        {value > 0 && <g filter={config.glow ? `url(#${id}-glow)` : undefined}>
          <path d={track(0, value)} stroke={activePaint} strokeLinecap="round" />
          {colorFill && fillBoundaries.slice(0, -1).map((from, zoneIndex) => {
            const to = fillBoundaries[zoneIndex + 1];
            const paint = zoneAt(zones, (from + to) / 2);
            if (!paint || value <= from) return null;
            return <path key={from} data-gauge-zone-fill="" d={track(from, Math.min(to, value))} stroke={paint}
              strokeLinecap={to >= value ? "round" : "butt"} />;
          })}
        </g>}
      </g>}
      {config.ring && <g data-gauge-progress-ring="" fill="none" strokeWidth={config.ring}>
        {value < 100 && <path d={track(value, 100, radius + 5)} stroke={theme.muted} opacity=".35" />}
        {value > 0 && <path d={track(0, value, radius + 5)} stroke={color} />}
      </g>}
      {showBand && <g data-gauge-zone-band="">
        {zones.map(zone => <path key={zone.from} d={track(zone.from, zone.to, radius + 6)} stroke={zone.color} strokeWidth="3" fill="none" />)}
      </g>}
      {ruler && <g data-gauge-ruler={ruler.position}>
        {Array.from({ length: ruler.ticks + 1 }, (_, tick) => {
          const a = angle(tick * 100 / ruler.ticks);
          const outside = ruler.position === "outside";
          const r = outside ? radius + (showBand ? 13 : 8) : radius - (mode === "notches" ? thickness + 6 : 6);
          const major = tick % ruler.majorEvery === 0;
          const [x1, y1] = point(cx, cy, r, a);
          const [x2, y2] = point(cx, cy, r + (outside ? 1 : -1) * (major ? 8 : 4), a);
          const [tx, ty] = point(cx, cy, r + (outside ? 16 : -15), a);
          const index = ruler.labels?.length === 2 ? tick === 0 ? 0 : tick === ruler.ticks ? 1 : -1 : tick / ruler.majorEvery;
          return <g key={tick} opacity={a <= end ? .95 : .4}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeLinecap="round" strokeWidth={major ? "1.5" : "1"} />
            {major && ruler.labels?.[index] && <text x={tx} y={ty} dominantBaseline="central" fill={theme.text} fontSize="8.5" textAnchor="middle">{ruler.labels[index]}</text>}
          </g>;
        })}
      </g>}
      {config.needle && <g data-gauge-needle={config.needle} data-gauge-tip={config.tip} transform={`translate(${cx} ${cy}) rotate(${end})`}>
        {config.needle === "line" && <line x1={needleStart} x2={needleRadius} y1="0" y2="0" stroke={theme.text}
          strokeWidth={config.tip ? 4 : 2.5} strokeLinecap="round" />}
        {config.needle === "gradient" && <path d={`M${needleStart},-.8 L${needleRadius - 2},-2 Q${needleRadius + 2},0 ${needleRadius - 2},2 L${needleStart},.8 Z`}
          fill={`url(#${id}-needle)`} />}
        {config.needle === "triangle" && <polygon points={`${needleStart},-4 ${needleRadius},0 ${needleStart},4`} fill={theme.text} />}
        {config.needle === "polygon" && <polygon points={`${needleStart},0 ${needleStart + 12},-4 ${needleRadius},0 ${needleStart + 12},4`} fill={theme.text} />}
      </g>}
      {config.disc && <circle data-gauge-center-disc="" cx={cx} cy={cy} r={discRadius} fill={theme.surface} stroke={theme.text} strokeOpacity=".7" strokeWidth="2" />}
      <g aria-hidden="true" textAnchor="middle" transform={`translate(${cx} ${cy + (config.sweep === 180 ? 4 : 10)})`}>
        <text data-gauge-readout="" y={fixed ? 2 : 0} fill={theme.text} fontWeight="650" fontSize={fixed ? 24 : 32}>{readout}</text>
        <text data-gauge-label="" y="16" fill={theme.muted} fontSize={fixed ? 9 : 11}>{config.name}</text>
      </g>
    </svg>
    {config.subtitle && !compact && <figcaption className={gauge.caption}>{config.subtitle}</figcaption>}
  </figure>;
}

function LinearGauge({ gradient, title, dataValue, compact }: { gradient: boolean; title: string; dataValue: number; compact?: boolean }) {
  const theme = useChartTheme();
  const id = useId();
  const useFixture = !Number.isFinite(dataValue);
  const target = clamp(useFixture ? gradient ? 72 : 42 : dataValue);
  const value = useSweepingValue(target, !compact);
  const count = gradient ? 72 : 30;
  const gap = 20;
  const xScale = count * 100;
  const x = (tick: number) => tick * 100 + gap / 2;
  return <div className={gauge.linear}>
    {!gradient && <p className={gauge.linearValue}><strong>{useFixture ? "4.2K" : `${number.format(target)}%`}</strong>
      <span>{useFixture ? "Downloads" : "Progress"}</span></p>}
    <svg width="100%" height="24" viewBox={`0 0 ${xScale} 24`} preserveAspectRatio="none" role="img"
      aria-roledescription="chart" aria-label={title} aria-describedby={`${id}-reading`} data-gauge-linear={gradient ? "gradient" : "notches"}>
      <desc id={`${id}-reading`}>{number.format(target)}%</desc>
      {gradient && <defs>{trackGradient(`${id}-track`, theme, 0, xScale)}</defs>}
      <g opacity={gradient ? ".4" : ".8"}>
        {Array.from({ length: count }, (_, tick) => <rect key={tick} x={x(tick)} y={gradient ? 7.5 : 0} width={100 - gap}
          height={gradient ? 9 : 24} rx={gradient ? 22 : 0} ry={gradient ? 3 : 0} fill={gradient ? tone(theme, 0) : theme.grid} />)}
      </g>
      <g>
        {Array.from({ length: count }, (_, tick) => <rect key={tick} x={x(tick)} y={gradient ? 7.5 : 0} width={100 - gap}
          height={gradient ? 9 : 24} rx={gradient ? 22 : 0} ry={gradient ? 3 : 0}
          fill={gradient ? `url(#${id}-track)` : tone(theme, 0)} opacity={(tick + .5) * 100 / count <= value ? 1 : 0} />)}
      </g>
    </svg>
    {gradient && useFixture && <p className={styles.hint}>1.44 TB of 2 TB used (72%)</p>}
  </div>;
}

export function Gauge({ example, compact, data }: Props) {
  const variant = example.id;
  const interactive = variant === "gauge-interactive";
  const dial = variant === "gauge-dial";
  const live = variant === "gauge-live-load";
  const fixed = variant === "gauge-fixed";
  const [selected, setSelected] = useState(interactive ? 2 : 0);
  const [sample, setSample] = useState({ count: 1, current: liveValues[0], sum: liveValues[0], peak: liveValues[0] });
  const items = dialFixtures[variant] ?? dialFixtures["gauge-default"];
  const dataValue = numeric(data?.rows?.[0]?.value ?? data?.series?.[0]?.values[0], Number.NaN);
  const useFixture = !Number.isFinite(dataValue);
  const value = clamp(!useFixture ? dataValue : live ? sample.current : interactive ? quarterValues[selected] : dial ? dialValues[selected] : items[0].value);
  useEffect(() => {
    if (!live || compact || !useFixture) return;
    const timer = setInterval(() => setSample(previous => {
      const current = liveValues[previous.count % liveValues.length];
      return { count: previous.count + 1, current, sum: previous.sum + current, peak: Math.max(previous.peak, current) };
    }), 1800);
    return () => clearInterval(timer);
  }, [compact, live, useFixture]);

  const gradient = variant === "gauge-linear-gradient";
  const metrics = live ? [
    ["Now", `${value}%`], ["Average", `${useFixture ? Math.round(sample.sum / sample.count) : value}%`], ["Peak", `${useFixture ? sample.peak : value}%`],
  ] : useFixture ? gaugeMetrics[variant] : undefined;

  return <div className={gauge.frame}>
    {!compact && interactive && <Controls label="Revenue quarter" items={["Q1", "Q2", "Q3", "Q4"]} value={selected} onChange={setSelected} />}
    {gradient || variant === "gauge-linear" ? <LinearGauge gradient={gradient} title={example.title} dataValue={dataValue} compact={compact} />
      : <div className={gauge.grid} data-compact={!!compact} data-fixed={fixed && !compact} data-amount={items.length}>
        {items.map((item, index) => {
          const reading = items.length === 1 ? value : clamp(numeric(data?.rows?.[index]?.value ?? data?.series?.[0]?.values[index],
            fixed || useFixture ? item.value : dataValue));
          const config: DialOptions = {
            ...item,
            name: dial ? `Load at 14:${String(selected * 5).padStart(2, "0")}` : interactive ? `Closed in Q${selected + 1}` : item.name,
            readout: interactive && useFixture ? progress => `$${(Math.round(1.5 * progress) / 100).toFixed(2)}M` : !useFixture && variant === "gauge-default" ? undefined : item.readout,
          };
          return <Dial key={item.subtitle ?? item.name} config={config} target={reading} index={index}
            label={items.length > 1 ? `${example.title}: ${item.subtitle ?? item.name}` : example.title} fixed={fixed && !compact}
            compact={compact} />;
        })}
      </div>}
    {!compact && interactive && <p className={styles.hint}>{value}% of quota in Q{selected + 1}</p>}
    {!compact && dial && <div className={styles.controls}><Button className={styles.control} type="button" onClick={() => setSelected(previous => (previous + 1) % dialValues.length)}>Next reading</Button>
      <span className={styles.hint}>Reading {selected + 1} of {dialValues.length}</span></div>}
    {!compact && metrics && <dl className={styles.gaugeSummary} aria-label={live ? "CPU sample summary" : `${example.title} metrics`}>
      {metrics.map(([label, reading]) => <div key={label}><dt>{label}</dt><dd>{reading}</dd></div>)}
    </dl>}
  </div>;
}
