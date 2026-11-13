import { curveMonotoneX, line as makeLine } from "d3-shape";
import { Activity, Gauge, Pause, Play, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import type { ChartExample, LiveLineStream } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { livePreset, liveValue } from "./live-fixtures";
import { LiveBuffer, summarizeTrace } from "./live-buffer";
import { useLiveBuffer } from "./useLiveBuffer";
import { PitantLiveTrace } from "./PitantLiveTrace";
import { down, up, type ChartTheme } from "./options";
import "./live-line.css";

const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const sampleTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false,
});
const skeletonShape = [.59375, .7875, .83125, .725, .61875, .6625, .85625];
const diagonalTile = "M-2 1L1 -2M-1 6L6 -1M4 7L7 4";
type Reading = number | null;
type Selection = { mode: "keyboard"; sequence: number } | { mode: "pointer"; portion: number };
type Frozen = { ring: LiveBuffer; data: CartesianData };
const isReading = (value: Reading | undefined): value is number => value != null && Number.isFinite(value);
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function liveTicks(minimum: number, maximum: number, step: number) {
  const first = Math.ceil(minimum / step);
  const count = Math.min(14, Math.floor(maximum / step) - first + 1);
  return Array.from({ length: Math.max(0, count) }, (_, i) => (first + i) * step);
}

export function LiveLine({ example, data, theme, compact, demo, stream }: { example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean; demo: boolean; stream?: LiveLineStream }) {
  const { id, title } = example;
  const uid = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(560, 260);
  const [reset, setReset] = useState(0);
  const [phase, setPhase] = useState(1);
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const loadingVariant = id === "live-line-loading";
  const [connecting, setConnecting] = useState(loadingVariant);
  const preset = livePreset(id);
  const { ring, frame, seedCount } = useLiveBuffer({ demo, preset, compact, connecting, reset, stream });
  const pauseVariant = id === "live-line-paused";
  const momentum = id === "live-line-momentum";
  const axisRight = id === "live-line-right-axis";
  const texture = id === "live-line-dots" ? "dots" : id === "live-line-background" ? "lines" : null;
  const bandPattern = id === "live-line-pattern-band";
  const band = bandPattern || id === "live-line-reference-band";
  const left = Math.min(compact ? 12 : axisRight ? 16 : momentum ? 64 : 56, width * .32);
  const right = Math.max(left + 1, width - (compact ? 13 : axisRight ? 64 : momentum ? 80 : pauseVariant ? 16 : 72));
  const top = Math.min(compact ? 8 : 16, height / 4);
  const bottom = Math.max(top + 1, height - (compact ? 20 : 40));
  const plotWidth = right - left;
  const span = plotWidth * (pauseVariant ? .75 : 1);
  const end = left + span;
  const view = frozen?.data ?? data;
  const buffer = frozen?.ring ?? ring;
  const buffered = demo || Boolean(stream);
  const count = buffered ? buffer.count : view.categories.length;
  const firstSequence = buffered ? buffer.firstSequence : 0;
  const revision = buffered ? buffer.nextSequence : 0;
  const firstTime = count && buffered ? buffer.timestamp(0) : 0;
  const latestTime = count && buffered ? buffer.timestamp(count - 1) : 0;
  const timed = Boolean(stream) && latestTime > firstTime;
  const x = useCallback((index: number) => count === 1 ? end : left + (timed
    ? (buffer.timestamp(index) - firstTime) / (latestTime - firstTime)
    : index / Math.max(1, count - 1)) * span, [buffer, count, end, firstTime, latestTime, left, span, timed]);
  const raw = useCallback((index: number) => {
    const value = buffered ? buffer.value(index) : view.series[0]?.values[index];
    return isReading(value) ? value : null;
  }, [buffer, buffered, view]);
  const rendered = useCallback((index: number) => {
    const value = raw(index);
    if (!demo || frozen || revision <= seedCount || phase >= 1 || value === null) return value;
    const previous = index > 0 ? raw(index - 1) : liveValue(firstSequence - 1, preset);
    return previous === null ? value : blend(previous, value, phase);
  }, [raw, demo, frozen, revision, seedCount, phase, firstSequence, preset]);
  const trace = useMemo(() => summarizeTrace(count, span, rendered), [count, span, rendered, revision]);
  const hasValues = Number.isFinite(trace.minimum);
  const dataMin = band ? Math.min(hasValues ? trace.minimum : 141, 141) : hasValues ? trace.minimum : 0;
  const dataMax = band ? Math.max(hasValues ? trace.maximum : 144, 144) : hasValues ? trace.maximum : 1;
  const pad = Math.max(preset.digits ? .35 : 1, (dataMax - dataMin) * .13);
  const minimum = demo ? Math.min(preset.range[0], dataMin - pad / 2) : dataMin - pad;
  const maximum = demo ? Math.max(preset.range[1], dataMax + pad / 2) : dataMax + pad;
  const y = useCallback((value: number) => bottom - (value - minimum) / Math.max(.01, maximum - minimum) * (bottom - top), [bottom, minimum, maximum, top]);
  const axisStep = demo ? pauseVariant ? 100 : momentum || axisRight ? 20 : 4 : Math.max(.01, (maximum - minimum) / 4);
  const seriesName = view.series[0]?.name ?? preset.name;
  const digits = demo ? preset.digits : 2;
  const unit = demo ? preset.unit : "number";
  const formatter = useMemo(() => new Intl.NumberFormat("en-US", {
    style: unit === "usd" ? "currency" : "decimal", currency: "USD", minimumFractionDigits: demo ? digits : 0, maximumFractionDigits: digits,
  }), [demo, digits, unit]);
  const display = (value: number) => formatter.format(value) + (unit === "ms" ? " ms" : "");
  const exactDisplay = (value: number) => demo || Number.isInteger(value) ? display(value) : String(value);
  const valueNow = buffered ? ring.value(ring.count - 1) : data.series[0]?.values.at(-1);
  const last = rendered(count - 1);
  const previous = raw(count - 2);
  const momentumStart = raw(Math.max(0, count - 20));
  const momentumLast = raw(count - 1);
  const change = isReading(momentumStart) && momentumStart !== 0 && isReading(momentumLast) ? (momentumLast - momentumStart) / Math.abs(momentumStart) : 0;
  const flat = Math.abs(change) < .0001;
  const color = momentum && demo ? flat ? theme.muted : change > 0 ? `var(--chart-positive, ${up})` : `var(--chart-negative, ${down})`
    : data.series[0]?.color ?? (axisRight ? theme.colors[1] : theme.colors[0]);
  const tipColor = momentum || !demo || !isReading(last) || !isReading(previous) ? color
    : last < previous ? theme.colors[4] : axisRight ? theme.colors[1] : theme.colors[0];
  const clockTime = demo && !frozen && revision > seedCount ? latestTime - (1 - phase) * preset.period : latestTime;
  const category = (index: number) => {
    const i = clamp(Math.round(index), 0, Math.max(0, count - 1));
    return buffered ? buffer.label(i) ?? time.format(buffer.timestamp(i)) : view.categories[i];
  };
  const tickCount = compact ? 3 : axisRight ? 4 : 5;
  const xTicks = Array.from({ length: Math.min(tickCount, count) }, (_, i) => i / Math.max(1, Math.min(tickCount, count) - 1));
  const selectedIndex = selection?.mode === "keyboard" ? selection.sequence - firstSequence
    : selection?.mode === "pointer" ? timed ? buffer.nearest(blend(firstTime, latestTime, selection.portion))
      : Math.round(selection.portion * Math.max(0, count - 1)) : -1;
  const selected = raw(selectedIndex);
  const focusX = selected !== null ? x(selectedIndex) : left;
  const focusLabel = selected === null ? "" : category(selectedIndex);
  const exactTime = (index: number) => `${buffer.timestamp(index)} ms since Unix epoch`;
  const tooltipLabel = selected !== null && stream
    ? buffer.label(selectedIndex) ? `${buffer.label(selectedIndex)} · ${exactTime(selectedIndex)}` : exactTime(selectedIndex)
    : selected !== null && demo ? sampleTime.format(buffer.timestamp(selectedIndex)) : focusLabel;
  const pillWidth = 70;
  const pillX = clamp(focusX, pillWidth / 2, width - pillWidth / 2);
  const badgeText = isReading(last) ? display(last) : "";
  const badgeWidth = Math.max(48, badgeText.length * 7.5 + 16);
  const badgeX = Math.min(end + 12, width - badgeWidth - 1);
  const rawReadoutWidth = axisRight ? 177 : momentum ? 146 : pauseVariant ? 143 : 140;
  const readoutWidth = Math.min(rawReadoutWidth, width - 8);
  const pointerX = selection?.mode === "pointer" ? focusX : x(Math.round(selectedIndex));
  const readoutX = clamp(pointerX + 16, 4, width - readoutWidth - 4);

  const skeleton = makeLine<number>().x((_, i) => blend(Math.min(40, width / 4), width - Math.min(40, width / 4), i / (skeletonShape.length - 1)))
    .y(value => blend(height - 40, 40, value)).curve(curveMonotoneX)(skeletonShape);
  let high = -Infinity, sum = 0, recent = 0;
  if (demo) {
    const start = Math.max(0, ring.nextSequence - Math.ceil(60_000 / preset.period) - 1);
    for (let i = start; i < ring.nextSequence; i++) {
      const value = liveValue(i, preset);
      high = Math.max(high, value);
      sum += value;
      recent++;
    }
  }
  const average = sum / Math.max(1, recent);
  const TrendIcon = change < 0 ? TrendingDown : TrendingUp;

  useEffect(() => {
    if (!connecting || compact) return;
    const timer = window.setTimeout(() => { setReset(value => value + 1); setConnecting(false); }, 2200);
    return () => window.clearTimeout(timer);
  }, [compact, connecting]);

  useEffect(() => {
    if (!demo || compact || connecting || frozen || !frame.startedAt) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let id = 0;
    function finish() {
      cancelAnimationFrame(id);
      setPhase(1);
    }
    function step(now: number) {
      const fraction = clamp((now - frame.startedAt) / 180, 0, 1);
      setPhase(fraction * (2 - fraction));
      if (fraction < 1) id = requestAnimationFrame(step);
    }
    if (preference.matches) finish();
    else {
      setPhase(0);
      id = requestAnimationFrame(step);
    }
    preference.addEventListener("change", finish);
    return () => { preference.removeEventListener("change", finish); cancelAnimationFrame(id); };
  }, [compact, connecting, demo, frame.startedAt, frozen]);

  function pointer(event: PointerEvent<SVGSVGElement>) {
    if (connecting || compact || !count) return;
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    if (point.x < left || point.x > right || point.y < top || point.y > bottom) { setSelection(null); return; }
    setSelection({ mode: "pointer", portion: clamp((point.x - left) / span, 0, 1) });
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (connecting || !count) return;
    if (event.key === "Escape" && selection) {
      event.preventDefault();
      event.stopPropagation();
      setSelection(null);
      setAnnouncement("");
      return;
    }
    const outside = selectedIndex < 0 || selectedIndex >= count;
    const before = outside ? count - 1 : Math.max(0, Math.floor(selectedIndex) - 1);
    const after = outside ? 0 : Math.min(count - 1, Math.ceil(selectedIndex) + 1);
    const next = { ArrowLeft: before, ArrowUp: before, ArrowRight: after, ArrowDown: after, Home: 0, End: count - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setSelection({ mode: "keyboard", sequence: firstSequence + next });
    const reading = raw(next);
    const label = stream ? `${category(next)}, ${exactTime(next)}` : demo ? sampleTime.format(buffer.timestamp(next)) : category(next);
    setAnnouncement(isReading(reading) ? `${label}, ${seriesName}: ${exactDisplay(reading)}` : `${label}, no reading`);
  }

  function togglePause() {
    setFrozen(frozen ? null : { ring: ring.copy(), data });
    setSelection(null);
    setAnnouncement("");
  }

  function reconnect() {
    setReset(value => value + 1);
    setPhase(1);
    setFrozen(null);
    setSelection(null);
    setAnnouncement("");
    setConnecting(true);
  }

  const pauseControl = !compact && !connecting && (demo || stream || pauseVariant) && <Button className="live-line-action" onClick={togglePause}>
    {frozen ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{frozen ? "Resume" : "Pause"}
  </Button>;
  const summary = connecting ? "Connecting to the stream" : !isReading(valueNow) ? null : pauseVariant && demo
    ? `${display(valueNow)} watching now` : axisRight && demo ? `${display(valueNow)} now, ${display(average)} on average`
    : momentum && demo ? `${flat ? "Flat" : change > 0 ? "Up" : "Down"} ${Math.abs(change * 100).toFixed(2)}% in 30 seconds`
    : `${demo ? "Last trade" : seriesName} ${display(valueNow)}`;
  const note = connecting ? "Waiting for the initial trade history" : frozen ? "Paused: new samples are still recorded" : !demo ? null
    : pauseVariant ? "One sample a second" : axisRight ? "Checkout API p95, sampled every 800 ms"
    : momentum ? "The last 20 quotes determine the trend color"
    : texture ? `${texture === "dots" ? "A dot grid" : "A diagonal pattern"} fades at the edges`
    : band ? `${bandPattern ? "Hatching marks" : "Shading marks"} the $141 to $144 target`
    : loadingVariant ? "Live trades arrive every 600 ms"
    : Number.isFinite(high) ? `High of ${display(high)} in the last minute` : null;

  return <div className="cartesian-example live-line-example" data-live-window={preset.window} data-live-period={preset.period} data-live-paused={Boolean(frozen)}
    data-live-retained={buffered ? ring.count : undefined} data-live-capacity={buffered ? ring.capacity : undefined}
    data-live-evicted={buffered ? ring.firstSequence : undefined}>
    {!compact && (pauseVariant || loadingVariant) && <div className="live-line-controls">
      {pauseVariant && pauseControl}
      {loadingVariant && <Button className="live-line-action" disabled={connecting} onClick={reconnect}>Reconnect</Button>}
    </div>}
    <div className="cartesian-plot cartesian-live-plot" ref={plot}>
      <svg role="img" aria-roledescription="chart" aria-label={connecting ? `Loading ${title}` : title} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
        tabIndex={compact || connecting ? undefined : 0} onKeyDown={key} onPointerMove={pointer} onPointerDown={pointer}
        onPointerLeave={event => { if (event.pointerType !== "touch") setSelection(null); }} onBlur={() => { setSelection(null); setAnnouncement(""); }}>
        <defs>
          <linearGradient id={`${uid}-live-edges`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
            <stop stopColor="white" stopOpacity="0" /><stop offset=".1" stopColor="white" /><stop offset=".9" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-live-texture-fade`}><stop stopColor="white" /><stop offset=".68" stopColor="white" stopOpacity=".72" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
          <mask id={`${uid}-live-edges-mask`}><rect x={left} y={top - 2} width={plotWidth} height={bottom - top + 4} fill={`url(#${uid}-live-edges)`} /></mask>
          <mask id={`${uid}-live-texture-mask`}><rect x={left} y={top} width={plotWidth} height={bottom - top} fill={`url(#${uid}-live-texture-fade)`} /></mask>
          <linearGradient id={`${uid}-live-focus`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}>
            <stop stopColor={theme.muted} stopOpacity="0" /><stop offset=".1" stopColor={theme.muted} stopOpacity=".75" /><stop offset=".9" stopColor={theme.muted} stopOpacity=".75" /><stop offset="1" stopColor={theme.muted} stopOpacity="0" />
          </linearGradient>
          <pattern id={`${uid}-live-texture`} x={left} y={top} width="6" height="6" patternUnits="userSpaceOnUse" viewBox="0 0 6 6">
            {texture === "dots" ? <rect x="5" y="5" width="1" height="1" fill={theme.grid} /> : <path d={diagonalTile} fill="none" stroke={theme.grid} />}
          </pattern>
          <pattern id={`${uid}-live-band`} width="6" height="6" patternUnits="userSpaceOnUse" viewBox="0 0 6 6">
            <path d={diagonalTile} fill="none" stroke={theme.grid} />
          </pattern>
        </defs>
        {connecting ? <g data-live-skeleton>
          {[0, 1, 2, 3].map(i => <line key={i} x1={Math.min(40, width / 4)} x2={width - Math.min(40, width / 4)}
            y1={blend(height - 40, 40, i / 3)} y2={blend(height - 40, 40, i / 3)} stroke={theme.muted} strokeOpacity=".22" strokeDasharray="4 4" />)}
          <path className="live-line-skeleton" d={skeleton ?? undefined} fill="none" stroke={theme.muted} strokeOpacity=".45" strokeWidth="2.5" />
        </g> : <>
          {texture && <rect data-live-texture={texture} x={left} y={top} width={plotWidth} height={bottom - top}
            fill={`url(#${uid}-live-texture)`} mask={`url(#${uid}-live-texture-mask)`} opacity={texture === "dots" ? ".85" : "1"} />}
          {axisRight && <g mask={`url(#${uid}-live-edges-mask)`}>{liveTicks(minimum, maximum, demo ? 10 : axisStep).map(value =>
            <line key={value} data-live-grid="" x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={theme.grid} strokeDasharray="4 4" />)}</g>}
          {!compact && liveTicks(minimum, maximum, axisStep).filter(value => y(value) > top + 7 && y(value) < bottom - 7).map(value =>
            <text key={value} data-live-y-tick="" x={axisRight ? right + 8 : left - (pauseVariant ? 8 : 6)} y={y(value)}
              textAnchor={axisRight ? "start" : "end"} dominantBaseline="central" fill={theme.muted} fontSize="12">{display(value)}</text>)}
          {xTicks.map(progress => {
            const tickX = left + progress * plotWidth;
            const label = demo ? time.format(clockTime - (1 - progress) * preset.window + (pauseVariant ? .25 * preset.window : 0))
              : timed ? time.format(blend(firstTime, latestTime, progress)) : category(progress * (count - 1));
            return <text key={progress} data-live-x-tick="" x={tickX} y={bottom + (compact ? 13 : 25)} fill={theme.muted}
              opacity={selected !== null && Math.abs(tickX - focusX) < pillWidth / 2 + 10 ? 0 : 1}
              textAnchor={tickX < 24 ? "start" : tickX > width - 24 ? "end" : "middle"} fontSize={compact ? 8 : 11}>{label}</text>;
          })}
          {band && <g data-live-target-band="" mask={`url(#${uid}-live-edges-mask)`}>
            <rect x={left} y={y(144)} width={plotWidth} height={y(141) - y(144)}
              fill={bandPattern ? `url(#${uid}-live-band)` : theme.muted} fillOpacity={bandPattern ? ".85" : ".12"} />
            {[144, 141].map((value, index) => <g key={value} data-live-target={value}>
              <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={theme.grid} strokeDasharray="4 4" />
              {!bandPattern && <path data-live-band-marker="" d={`M${left + plotWidth / 2 - 3},${y(value)}h6l-3,${index === 0 ? 6 : -6}Z`} fill={theme.colors[0]} />}
            </g>)}
          </g>}
          <PitantLiveTrace width={width} height={height} top={top} bottom={bottom} color={color} theme={theme} fill={!axisRight}
            indices={trace.indices} valueAt={rendered} x={x} y={y} />
          {isReading(last) && <g data-live-badge="">
            <line data-live-endpoint-rule="" x1={left} x2={end} y1={y(last)} y2={y(last)} stroke={color} strokeOpacity=".25" strokeDasharray="4 4" />
            <g transform={`translate(${end} ${y(last)})`}>
              {!compact && !frozen && demo && <circle className="live-line-pulse" r="6" fill="none" stroke={tipColor} strokeOpacity=".22" />}
              <circle data-live-endpoint="" r="4" fill={tipColor} stroke={theme.surface} strokeWidth="2" />
            </g>
            {!compact && <><rect x={badgeX} y={y(last) - 12} width={badgeWidth} height="24" rx="6" fill={theme.surface} fillOpacity=".95" />
              <text x={badgeX + 8} y={y(last) + 4} fill={theme.text} fontSize="11" fontWeight="500">{badgeText}</text></>}
          </g>}
          {selected !== null && <g data-live-cursor="" aria-hidden="true">
            <rect x={focusX - .5} y={top} width="1" height={bottom - top} fill={`url(#${uid}-live-focus)`} />
            <circle cx={focusX} cy={y(selected)} r="5" fill={color} stroke={theme.surface} strokeWidth="2" />
            <rect x={pillX - pillWidth / 2} y={bottom + 8} width={pillWidth} height="24" rx="12" fill={`var(--chart-focus-pill, ${theme.text})`} />
            <text x={pillX} y={bottom + 20} fill={`var(--chart-focus-pill-text, ${theme.surface})`}
              dominantBaseline="central" textAnchor="middle" fontSize="12">{focusLabel}</text>
          </g>}
        </>}
      </svg>
      {selected !== null && !connecting && <div className="live-line-readout" style={{ left: readoutX, top, width: readoutWidth }}>
        <CartesianReadout label={tooltipLabel} entries={[{ name: seriesName, value: exactDisplay(selected), color }]} live={false} />
      </div>}
      {!compact && <span className="live-line-announcement" role="status">{announcement}</span>}
    </div>
    {!compact && (summary || note || !pauseVariant && pauseControl) && <div className="live-line-summary" data-live-summary="">
      <div>{summary && <strong data-live-summary-value="">{summary}
        {!connecting && !pauseVariant && (axisRight ? <Gauge size={15} aria-hidden="true" /> : momentum ? <TrendIcon size={15} aria-hidden="true" /> : <Activity size={15} aria-hidden="true" />)}</strong>}
        {note && <p>{note}</p>}</div>
      {!pauseVariant && pauseControl}
    </div>}
  </div>;
}
