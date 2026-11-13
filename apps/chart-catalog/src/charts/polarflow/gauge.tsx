import NumberFlow, { type Format } from "@number-flow/react";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { arc, Controls, number, numeric, point, sector, tone, type Props } from "./shared";
import { createNotchPath } from "./upstream/gauge-notch";
import { dialFixtures, gaugeMetrics, gaugeNotes, type DialOptions, type GaugeZone } from "./gauge-fixtures";
import gauge from "./gauge.module.css";
import styles from "./styles.module.css";

const quarterValues = [82, 94, 67, 41];
const dialValues = [38, 72, 91, 54, 18, 66];
const liveValues = [42, 58, 71, 64, 88, 93, 76, 55];
const initialSample = { count: 1, current: liveValues[0], sum: liveValues[0], peak: liveValues[0] };
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const round = { maximumFractionDigits: 0 };
const fraction = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const compactNumber: Format = { notation: "compact", maximumFractionDigits: 2 };
const currency: Format = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const compactCurrency: Format = { ...compactNumber, style: "currency", currency: "USD" };

function useSweepingValue(value: number, enabled: boolean) {
  const initialValue = enabled && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : value;
  const [position, setPosition] = useState(initialValue);
  const latest = useRef(initialValue);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const showStatic = () => {
      latest.current = value;
      setPosition(value);
    };
    if (!enabled || motion.matches) {
      showStatic();
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
    const onMotionChange = () => {
      if (!motion.matches) return;
      cancelAnimationFrame(frame);
      showStatic();
    };
    frame = requestAnimationFrame(update);
    motion.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [enabled, value]);
  return enabled ? position : value;
}

function zoneAt(zones: readonly GaugeZone[], value: number) {
  for (let index = zones.length - 1; index >= 0; index--) {
    const zone = zones[index];
    if (value >= zone.from && value < zone.to) return zone.color;
  }
}

function reading(value: number, kind: DialOptions["reading"]): { value: number; format: Format; suffix?: string } {
  switch (kind) {
    case "currency": return { value: value / 66 * 428_000, format: currency };
    case "revenue": return { value: value / 100 * 1_500_000, format: compactCurrency };
    case "rpm": return { value: value * .08, format: fraction };
    case "speed": return { value: value * 2.6, format: round };
    case "tonnage": return { value: value * 8, format: round };
    case "integer": return { value, format: round };
    default: return { value, format: round, suffix: "%" };
  }
}

function Dial({ config, target, label, compact, fixed, index, colorOverride }: {
  config: DialOptions; target: number; label: string; compact?: boolean; fixed?: boolean; index: number; colorOverride?: string;
}) {
  const theme = useChartTheme();
  const id = useId();
  const value = useSweepingValue(target, !compact);
  const { plot, width, height } = usePlotSize<HTMLDivElement>(fixed ? 160 : 384, fixed ? 160 : 384 * 16 / 21);
  const unit = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const ruler = config.ruler;
  const labelFont = Math.max(9, unit * .034);
  const outsideLabelSpace = ruler?.position === "outside" && ruler.labels ? labelFont * 1.8 : 0;
  const radius = unit * (config.radius ?? .42) - outsideLabelSpace;
  const sweep = config.sweep ?? 270;
  const start = 270 - sweep / 2;
  const angle = (reading: number) => start + sweep * reading / 100;
  const end = angle(value);
  const mode = config.mode ?? "notches";
  const thickness = unit * (config.depth ?? (mode === "solid" ? .035 : .14));
  const trackRadius = radius - thickness / 2;
  const color = colorOverride ?? (config.paint === "foreground" ? theme.text : tone(theme, config.paint ?? 0));
  const activePaint = config.gradient ? `url(#${id}-track)` : color;
  const track = (from: number, to: number, r = trackRadius) => arc(cx, cy, r, angle(from), angle(to));
  const zones = config.zones ?? [];
  const colorFill = config.zoneDisplay === "fill" || config.zoneDisplay === "both";
  const showBand = config.zoneDisplay === "band" || config.zoneDisplay === "both";
  const count = config.count ?? 40;
  const dots = config.dots;
  const discRadius = unit * (config.disc ?? 0);
  const sectorRadius = unit * (config.sectorRadius ?? .42);
  const sectorInner = config.disc ? discRadius + (mode === "none" ? 1.5 : 1) : config.sector === "pattern" ? sectorRadius * .5
    : config.sector === "radial" ? sectorRadius * .3 : 0;
  const wedge = sector(cx, cy, sectorRadius, sectorInner, start, end);
  const needleRadius = unit * (config.needleEnd ?? .42) - outsideLabelSpace;
  const needleStart = unit * (config.needleBase ?? .2) - outsideLabelSpace;
  const needleWidth = config.needleWidth ?? (config.needle === "line" ? 2.5 : 4);
  const needleInset = config.tip === "inner" && config.needle === "line" ? needleWidth / 2 : config.needle === "line" ? 1.25 : 0;
  const targetReading = reading(target, config.reading);
  const readable = new Intl.NumberFormat("en-US", targetReading.format).format(targetReading.value) + (targetReading.suffix ?? "");
  const fontSize = Math.min(30, Math.max(19.36, unit * .076));
  const labelSize = Math.min(12, Math.max(10, unit * .029));
  const notches = mode === "notches" ? Array.from({ length: count }, (_, tick) => {
    const span = sweep / count * (1 - (config.gap ?? .4));
    const step = (sweep - span * 1.25) / (count - 1);
    const left = start + tick * step + span / 8;
    const right = left + span;
    const [x1, y1] = point(cx, cy, radius, left);
    const [x2, y2] = point(cx, cy, radius, right);
    const [x3, y3] = point(cx, cy, radius - thickness, right);
    const [x4, y4] = point(cx, cy, radius - thickness, left);
    return { path: createNotchPath({ x1, y1, x2, y2, x3, y3, x4, y4 }, config.rounded ?? 0, thickness),
      fill: colorFill ? zoneAt(zones, (tick + .5) * 100 / count) ?? activePaint : activePaint };
  }) : [];
  const fillBoundaries = Array.from(new Set(zones.flatMap(zone => [zone.from, zone.to]))).sort((a, b) => a - b);
  const visibleNotches = Math.round(count * value / 100);
  const ringRadius = unit * (.47 - (config.ring ?? 0) / 2);

  return <figure className={gauge.dial}>
    <div className={gauge.face} ref={plot}>
      {value > 0 && config.sector === "conic" && <div className={gauge.sector} aria-hidden="true" data-gauge-sector="conic"
        style={{ background: `conic-gradient(from ${start + 90}deg at ${cx}px ${cy}px, transparent 0deg, ${color} ${end - start}deg, transparent ${end - start}deg)`,
          clipPath: `path("${sector(cx, cy, sectorRadius, sectorInner, start, start + sweep)}")` }} />}
      <svg className={gauge.arc} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label}
        aria-describedby={`${id}-reading`} data-gauge-dial={index}>
        <desc id={`${id}-reading`}>{targetReading.suffix ? readable : `${Math.round(target)}% · ${readable}`}</desc>
        <defs>
          {config.gradient && <TrackGradient id={`${id}-track`} first={tone(theme, 0)} last={tone(theme, 4)} />}
          {config.sector === "radial" && <radialGradient id={`${id}-radial`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={sectorRadius}>
            <stop offset="0" stopColor={color} stopOpacity="0" /><stop offset=".3" stopColor={color} stopOpacity=".04" /><stop offset="1" stopColor={color} stopOpacity=".85" />
          </radialGradient>}
          {config.sector === "pattern" && <pattern id={`${id}-stripes`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6l6 -6M-1.5 1.5l3 -3M4.5 7.5l3 -3" stroke={color} strokeWidth="1.5" strokeLinecap="square" />
          </pattern>}
          {config.glow && <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={config.glow} result="blur" />
            <feComponentTransfer in="blur" result="glow"><feFuncA type="linear" slope="1.5" /></feComponentTransfer>
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>}
          {config.needle === "gradient" && <linearGradient id={`${id}-needle`} gradientUnits="userSpaceOnUse" x1={needleStart} x2={needleRadius} y1="0" y2="0">
            <stop offset="0" stopColor={theme.text} stopOpacity="0" /><stop offset=".7" stopColor={theme.text} stopOpacity=".7" /><stop offset="1" stopColor={theme.text} />
          </linearGradient>}
        </defs>
        {value > 0 && config.sector && config.sector !== "conic" &&
          <path data-gauge-sector={config.sector} d={wedge} fillOpacity="1" fill={`url(#${id}-${config.sector === "pattern" ? "stripes" : "radial"})`} />}
        {dots?.counts.map((amount, ringIndex) => <g key={ringIndex} data-gauge-dot-ring={ringIndex}>
          {Array.from({ length: amount }, (_, dot) => {
            const progress = dot * 100 / (amount - 1);
            const [x, y] = point(cx, cy, unit * (dots.outer - ringIndex * dots.gap), angle(progress));
            const opacity = (progress <= value ? .9 : .12) * (1 - ringIndex / dots.counts.length * .6);
            return <circle key={dot} cx={x} cy={y} r={dots.size} fill={dots.color ?? color} fillOpacity={opacity} />;
          })}
        </g>)}
        {mode === "notches" && <g data-gauge-track="notches">
          <g>{notches.map(({ path }, tick) => <path key={tick} d={path} fill={theme.grid} fillOpacity={config.trackOpacity ?? .8} />)}</g>
          <g filter={config.glow ? `url(#${id}-glow)` : undefined}>
            {notches.map(({ path, fill }, tick) => <path key={tick} d={path} fill={fill} fillOpacity={tick < visibleNotches ? 1 : 0} />)}
          </g>
        </g>}
        {mode === "solid" && <g data-gauge-track="solid" fill="none">
          <path d={track(0, 100)} stroke={theme.grid} strokeOpacity={config.trackOpacity ?? .6} strokeLinecap="round" strokeWidth={thickness} />
          {value > 0 && <g filter={config.glow ? `url(#${id}-glow)` : undefined}>
            <path d={track(0, value)} stroke={activePaint} strokeLinecap="round" strokeWidth={thickness} />
            {colorFill && fillBoundaries.slice(0, -1).map((from, zoneIndex) => {
              const to = fillBoundaries[zoneIndex + 1];
              const paint = zoneAt(zones, (from + to) / 2);
              if (!paint) return null;
              return <path key={from} data-gauge-zone-fill="" d={value > from ? track(from, Math.min(to, value)) : ""} stroke={paint} strokeWidth={thickness}
                strokeLinecap={from === 0 || to >= value ? "round" : "butt"} />;
            })}
          </g>}
        </g>}
        {config.ring && <g data-gauge-progress-ring="" fill="none">
          {value < 100 && <path d={track(value, 100, ringRadius)} stroke={theme.muted} strokeOpacity=".35" strokeWidth={unit * config.ring} />}
          {value > 0 && <path d={track(0, value, ringRadius)} stroke={color} strokeWidth={unit * config.ring} />}
        </g>}
        {showBand && <g data-gauge-zone-band="">
          {zones.map(zone => <path key={zone.from} d={track(zone.from, zone.to, radius + unit * .027)} stroke={zone.color} strokeOpacity=".9" strokeWidth={unit * .014} fill="none" />)}
        </g>}
        {ruler && <g data-gauge-ruler={ruler.position}>
          {Array.from({ length: ruler.ticks + 1 }, (_, tick) => {
            const a = angle(tick * 100 / ruler.ticks);
            const direction = ruler.position === "outside" ? 1 : -1;
            const major = tick % ruler.majorEvery === 0;
            const labelSpace = ruler.labels ? labelFont : 0;
            const outsideRadius = unit * .42 - labelSpace * 1.8;
            const lineRadius = direction === 1 ? outsideRadius : unit * ruler.radius;
            const [x1, y1] = point(cx, cy, lineRadius, a);
            const [x2, y2] = point(cx, cy, lineRadius + direction * unit * (major ? .05 : .028), a);
            const [tx, ty] = point(cx, cy, lineRadius + direction * (unit * .05 + labelSpace * (direction === -1 ? 1.1 : 1)), a);
            const index = ruler.labels?.length === 2 ? tick === 0 ? 0 : tick === ruler.ticks ? 1 : -1 : tick / ruler.majorEvery;
            const active = !ruler.static && a <= end;
            return <g key={tick}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeLinecap="round" strokeWidth={major ? 1.75 : 1}
                strokeOpacity={major ? active ? .95 : .32 : active ? .55 : .16} />
              {major && ruler.labels?.[index] && <text x={tx} y={ty} dominantBaseline="central" fill={theme.text} fillOpacity=".72"
                fontSize={labelFont} textAnchor="middle">{ruler.labels[index]}</text>}
            </g>;
          })}
        </g>}
        {config.needle && <g data-gauge-needle={config.needle} data-gauge-tip={config.tip} transform={`translate(${cx} ${cy}) rotate(${end})`}>
          {config.needle === "line" && <line x1={needleStart + needleInset} x2={needleRadius - needleInset} y1="0" y2="0" stroke={theme.text}
            strokeWidth={needleWidth} strokeLinecap="round" />}
          {config.needle === "gradient" && <path d={`M ${needleStart} -0.7 L ${needleRadius - 2} -2 A 2 2 0 0 1 ${needleRadius - 2} 2 L ${needleStart} 0.7 Z`}
            fill={`url(#${id}-needle)`} />}
          {config.needle === "triangle" && <polygon points={`${needleStart},${-needleWidth} ${needleRadius},0 ${needleStart},${needleWidth}`} fill={theme.text}
            stroke={theme.text} strokeLinejoin="round" strokeWidth="1.25" />}
          {config.needle === "polygon" && <polygon points={`${needleStart},0 ${needleStart + (needleRadius - needleStart) * .22},-4 ${needleRadius},0 ${needleStart + (needleRadius - needleStart) * .22},4`}
            fill={theme.text} stroke={theme.text} strokeLinejoin="round" strokeWidth="1.25" />}
        </g>}
        {config.disc && <circle data-gauge-center-disc="" cx={cx} cy={cy} r={discRadius} fill={theme.surface} stroke={mode === "none" ? theme.text : color}
          strokeOpacity={mode === "none" ? .75 : 1} strokeWidth={mode === "none" ? 3 : 2} />}
      </svg>
      <div className={gauge.center} aria-hidden="true" style={{ top: cy + unit * .04 }}>
        <span className={gauge.reading} data-gauge-readout={readable} style={{ fontSize }}>
          {compact ? readable : <NumberFlow {...targetReading} locales="en-US" respectMotionPreference />}
        </span>
        <span className={gauge.label} data-gauge-label="" style={{ fontSize: labelSize }}>{config.name}</span>
      </div>
    </div>
    {config.subtitle && !compact && <figcaption className={gauge.caption}>{config.subtitle}</figcaption>}
  </figure>;
}

function TrackGradient({ id, first, last }: { id: string; first: string; last: string }) {
  return <linearGradient id={id} x1="0%" x2="100%" y1="0%" y2="0%">
    <stop offset="0%" stopColor={first} /><stop offset="100%" stopColor={last} />
  </linearGradient>;
}

function LinearGauge({ gradient, title, dataValue, compact, color }: {
  gradient: boolean; title: string; dataValue: number; compact?: boolean; color?: string;
}) {
  const theme = useChartTheme();
  const id = useId();
  const useFixture = !Number.isFinite(dataValue);
  const target = clamp(useFixture ? gradient ? 72 : 42 : dataValue);
  const value = useSweepingValue(target, !compact);
  const { plot, width } = usePlotSize<HTMLDivElement>(560, 24);
  const count = gradient ? 72 : 30;
  const slot = width / count;
  const markWidth = (gradient ? .8 : .6) * slot;
  const inset = markWidth / 8;
  const step = (width - markWidth - 2 * inset) / (count - 1);
  const activePaint = color ?? tone(theme, 0);
  const paths = Array.from({ length: count }, (_, tick) => {
    const left = inset + tick * step;
    const right = left + markWidth;
    const top = gradient ? 7.44 : 0;
    const bottom = 24 - top;
    return createNotchPath({ x1: left, y1: top, x2: right, y2: top, x3: right, y3: bottom, x4: left, y4: bottom },
      gradient ? 3 : 0, bottom - top);
  });
  return <div className={gauge.linear}>
    {!gradient && <p className={gauge.linearValue}>
      <strong>{useFixture ? <NumberFlow value={4200} format={compactNumber} respectMotionPreference /> : `${number.format(target)}%`}</strong>
      <span>{useFixture ? "Downloads" : "Progress"}</span>
    </p>}
    <div ref={plot}>
      <svg width="100%" height="24" viewBox={`0 0 ${width} 24`} role="img" aria-roledescription="chart"
        aria-label={title} aria-describedby={`${id}-reading`} data-gauge-linear={gradient ? "gradient" : "notches"}>
        <desc id={`${id}-reading`}>{number.format(target)}%</desc>
        {gradient && <defs><TrackGradient id={`${id}-track`} first={activePaint} last={tone(theme, 4)} /></defs>}
        <g>{paths.map((d, tick) => <path key={tick} d={d} fill={gradient ? activePaint : theme.grid} fillOpacity={gradient ? .4 : .8} />)}</g>
        <g>{paths.map((d, tick) => <path key={tick} d={d} fill={gradient ? `url(#${id}-track)` : activePaint}
          fillOpacity={tick < Math.round(count * value / 100) ? 1 : 0} />)}</g>
      </svg>
    </div>
  </div>;
}

export function Gauge({ example, compact, data }: Props) {
  const variant = example.id;
  const interactive = variant === "gauge-interactive";
  const dial = variant === "gauge-dial";
  const live = variant === "gauge-live-load";
  const fixed = variant === "gauge-fixed";
  const [selected, setSelected] = useState(interactive ? 2 : 0);
  const [sample, setSample] = useState(initialSample);
  const [paused, setPaused] = useState(false);
  const items = dialFixtures[variant] ?? dialFixtures["gauge-default"];
  const dataValue = numeric(data?.rows?.[0]?.value ?? data?.series?.[0]?.values[0], Number.NaN);
  const useFixture = !Number.isFinite(dataValue);
  const value = clamp(!useFixture ? dataValue : live ? sample.current : interactive ? quarterValues[selected] : dial ? dialValues[selected] : items[0].value);
  useEffect(() => {
    if (!live || compact || !useFixture || paused) return;
    const timer = setInterval(() => setSample(previous => {
      const current = liveValues[previous.count % liveValues.length];
      return { count: previous.count + 1, current, sum: previous.sum + current, peak: Math.max(previous.peak, current) };
    }), 1800);
    return () => clearInterval(timer);
  }, [compact, live, paused, useFixture]);

  const gradient = variant === "gauge-linear-gradient";
  const max = live || gaugeMetrics[variant] ? 320 : items.length === 1 ? 384 : 560;
  const metrics = live ? [
    ["Now", `${value}%`], ["Average", `${useFixture ? Math.round(sample.sum / sample.count) : value}%`], ["Peak", `${useFixture ? sample.peak : value}%`],
  ] : useFixture ? gaugeMetrics[variant] : undefined;
  const notes = useFixture ? interactive
    ? [`${value}% of quota in Q${selected + 1} 2026`, "Q4 is quarter to date, through November 8"]
    : dial ? ["Each reading sweeps on from the last, without a bounce"] : gaugeNotes[variant] : undefined;

  return <div className={gauge.frame} style={{ "--gauge-max": `${max}px` } as CSSProperties}>
    {!compact && interactive && useFixture && <Controls label="Revenue quarter" items={["Q1", "Q2", "Q3", "Q4"]} value={selected} onChange={setSelected} />}
    {gradient || variant === "gauge-linear" ? <LinearGauge gradient={gradient} title={example.title} dataValue={dataValue} compact={compact}
      color={data?.series?.[0]?.color} />
      : <div className={gauge.grid} data-compact={!!compact} data-fixed={fixed && !compact} data-amount={items.length}>
        {items.map((item, index) => {
          const row = data?.rows?.[index];
          const readingValue = items.length === 1 ? value : clamp(numeric(row?.value ?? data?.series?.[0]?.values[index],
            fixed || useFixture ? item.value : dataValue));
          const callerName = row?.name ?? row?.label ?? data?.categories?.[index];
          const name = typeof callerName === "string" ? callerName : dial ? `Load at 14:${String(selected * 5).padStart(2, "0")}`
            : interactive ? `Closed in Q${selected + 1}` : item.name;
          const config = { ...item, name, reading: useFixture ? item.reading : undefined };
          return <Dial key={item.subtitle ?? item.name} config={config} target={readingValue} index={index}
            label={items.length > 1 ? `${example.title}: ${item.subtitle ?? name}` : example.title} fixed={fixed && !compact}
            compact={compact} colorOverride={typeof row?.color === "string" ? row.color : data?.series?.[0]?.color} />;
        })}
      </div>}
    {!compact && dial && useFixture && <div className={styles.controls}>
      <Button className={styles.control} type="button" onClick={() => setSelected(previous => (previous + 1) % dialValues.length)}>Next reading</Button>
      <span className={styles.hint} role="status">Reading {selected + 1} of {dialValues.length} · {value}%</span>
    </div>}
    {!compact && notes && <p className={gauge.summary} role={interactive ? "status" : undefined}>
      <strong>{notes[0]}</strong>{notes[1] && <span>{notes[1]}</span>}
    </p>}
    {!compact && metrics && <dl className={styles.gaugeSummary} aria-label={live ? "CPU sample summary" : `${example.title} metrics`}>
      {metrics.map(([label, reading]) => <div key={label}><dt>{label}</dt><dd>{reading}</dd></div>)}
    </dl>}
    {!compact && live && useFixture && <div className={styles.controls}>
      <Button className={styles.control} type="button" onClick={() => setPaused(previous => !previous)}>{paused ? "Resume samples" : "Pause samples"}</Button>
    </div>}
  </div>;
}
