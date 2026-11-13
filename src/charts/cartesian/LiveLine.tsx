import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import type { ChartExample } from "../../types";
import { livePreset, liveValue, type CartesianData } from "./data";
import { down, up, type ChartTheme } from "./options";

const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function LiveLine({ example, data, theme, compact, demo }: { example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean; demo: boolean }) {
  const { id, title } = example;
  const uid = useId();
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, height: 260 });
  const [epoch, setEpoch] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [frozen, setFrozen] = useState<{ tick: number; data: CartesianData } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(id === "live-line-loading");
  const preset = livePreset(id);
  const canPause = id === "live-line-paused";
  const momentum = id === "live-line-momentum";
  const axisRight = id === "live-line-right-axis";
  const texture = id === "live-line-dots" ? "dots" : id === "live-line-background" ? "lines" : null;
  const band = id === "live-line-reference-band" || id === "live-line-pattern-band";
  const bandPattern = id === "live-line-pattern-band";
  const { width, height } = size;
  const left = axisRight || texture ? 14 : 55;
  const right = Math.max(left + 25, width - (axisRight ? 55 : 13));
  const top = 14, bottom = Math.max(top + 24, height - 30);
  const view = frozen?.data ?? data;
  const count = view.categories.length;
  const viewTick = frozen?.tick ?? tick;
  const categories = useMemo(() => demo ? view.categories.map((_, i) => time.format(epoch + (i - count + 1 + viewTick) * preset.period)) : view.categories,
    [count, view.categories, demo, epoch, preset.period, viewTick]);
  const values = useMemo(() => demo ? Array.from({ length: count }, (_, i) => liveValue(i + viewTick, preset)) : Array.from({ length: count }, (_, i) => view.series[0]?.values[i] ?? null),
    [count, view.series, demo, preset, viewTick]);
  const currentValues = frozen === null ? values : demo ? Array.from({ length: count }, (_, i) => liveValue(i + tick, preset)) : data.series[0]?.values ?? [];
  const last = values.at(-1) ?? null;
  const liveValueNow = currentValues.at(-1) ?? null;
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const recent = currentValues.filter((value): value is number => value !== null && Number.isFinite(value));
  const dataMin = Math.min(...numeric, ...(band ? [141] : []));
  const dataMax = Math.max(...numeric, ...(band ? [144] : []));
  const pad = Math.max(preset.digits ? .35 : 4, (dataMax - dataMin) * .13);
  const minimum = Number.isFinite(dataMin) ? dataMin - pad : 0;
  const maximum = Number.isFinite(dataMax) ? dataMax + pad : 1;
  const cursorRoom = canPause ? .84 : .92;
  const plotWidth = right - left;
  const x = (index: number) => left + index * plotWidth * cursorRoom / Math.max(1, count - 1);
  const y = (value: number) => bottom - (value - minimum) / Math.max(.01, maximum - minimum) * (bottom - top);
  const momentumStart = values[Math.max(0, values.length - 20)];
  const change = momentumStart && last !== null ? (last - momentumStart) / momentumStart : 0;
  const color = momentum ? change > .0001 ? up : change < -.0001 ? down : theme.muted : data.series[0]?.color ?? theme.colors[0];
  const selected = active === null ? undefined : values[active];
  const segments: number[][][] = [];
  let points: number[][] = [];
  values.forEach((value, index) => {
    if (value !== null && Number.isFinite(value)) points.push([x(index), y(value)]);
    else if (points.length) { segments.push(points); points = []; }
  });
  if (points.length) segments.push(points);
  const lines = segments.map(segment => segment.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" "));
  const line = lines.join(" ");
  const area = segments.map((segment, index) => `${lines[index]}L${segment.at(-1)![0]},${bottom}H${segment[0][0]}Z`).join(" ");
  const labels = Math.min(count, Math.max(2, Math.floor(plotWidth / 105)));
  const tickIndices = [...new Set(Array.from({ length: labels }, (_, i) => Math.round(i * (count - 1) / Math.max(1, labels - 1))))];
  const seriesName = view.series[0]?.name ?? preset.name;
  const unit = demo ? preset.unit : "number";
  const format = new Intl.NumberFormat("en-US", { style: unit === "usd" ? "currency" : "decimal", currency: "USD", minimumFractionDigits: demo ? preset.digits : 0, maximumFractionDigits: demo ? preset.digits : 2 });
  const display = (value: number) => `${format.format(value)}${unit === "ms" ? " ms" : ""}`;
  const badgeX = Math.max(left, Math.min(width - 67, x(count - 1) + 6));

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!demo || compact || connecting) return;
    const timer = window.setInterval(() => setTick(value => value + 1), preset.period);
    return () => window.clearInterval(timer);
  }, [compact, connecting, demo, preset.period]);

  useEffect(() => {
    if (!connecting || compact) return;
    const timer = window.setTimeout(() => { setEpoch(Date.now()); setConnecting(false); }, 2200);
    return () => window.clearTimeout(timer);
  }, [compact, connecting]);

  function pointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - rect.left;
    if (offset < left || offset > right || event.clientY - rect.top < top || event.clientY - rect.top > bottom || !count) { setActive(null); return; }
    setActive(Math.max(0, Math.min(count - 1, Math.round((offset - left) / (plotWidth * cursorRoom) * (count - 1)))));
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (connecting || !count) return;
    if (event.key === "Escape" && active !== null) { event.preventDefault(); setActive(null); return; }
    const before = Math.max(0, (active ?? 0) - 1);
    const after = Math.min(count - 1, (active ?? -1) + 1);
    const next = { ArrowLeft: before, ArrowUp: before, ArrowRight: after, ArrowDown: after, Home: 0, End: count - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); setActive(next); }
  }

  function reconnect() {
    setTick(0);
    setActive(null);
    setConnecting(true);
  }

  return <div className="cartesian-example" data-live-window={preset.window} data-live-period={preset.period}>
    {!compact && (canPause || id === "live-line-loading") && <div className="cartesian-controls">
      {canPause && <Toggle pressed={frozen !== null} onPressedChange={pressed => { setFrozen(pressed ? { tick, data } : null); setActive(null); }}>{frozen === null ? "Pause" : "Resume"}</Toggle>}
      {id === "live-line-loading" && <Button disabled={connecting} onClick={reconnect}>Reconnect</Button>}
    </div>}
    <div className="cartesian-plot cartesian-live-plot" ref={host}>
      <svg role="img" aria-roledescription="chart" aria-label={connecting ? `Loading ${title}` : title} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
        tabIndex={compact || connecting ? undefined : 0} onKeyDown={key} onPointerMove={pointer} onPointerDown={pointer} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}>
        <defs>
          <linearGradient id={`${uid}-live-fill`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity=".27" /><stop offset="1" stopColor={color} stopOpacity=".01" /></linearGradient>
          <radialGradient id={`${uid}-live-fade`}><stop stopColor="white" /><stop offset=".69" stopColor="white" stopOpacity=".75" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
          <mask id={`${uid}-live-mask`}><rect x={left} y={top} width={plotWidth} height={bottom - top} fill={`url(#${uid}-live-fade)`} /></mask>
          <pattern id={`${uid}-live-texture`} width={texture === "dots" ? 8 : 9} height={texture === "dots" ? 8 : 9} patternUnits="userSpaceOnUse" patternTransform={texture === "lines" ? "rotate(40)" : undefined}>
            {texture === "dots" ? <circle cx="2" cy="2" r="1.1" fill={theme.muted} /> : <path d="M1 0V9" fill="none" stroke={theme.muted} strokeWidth="1" />}
          </pattern>
          <pattern id={`${uid}-live-band`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(42)"><path d="M1 0V6" fill="none" stroke={theme.colors[1]} strokeWidth="1.2" /></pattern>
        </defs>
        {texture && !connecting && <rect data-live-texture={texture} x={left} y={top} width={plotWidth} height={bottom - top} fill={`url(#${uid}-live-texture)`} mask={`url(#${uid}-live-mask)`} opacity=".44" />}
        {!texture && Array.from({ length: 5 }, (_, index) => {
          const value = minimum + (maximum - minimum) * index / 4;
          return <g key={index} data-live-grid><path d={`M${left} ${y(value)}H${right}`} fill="none" stroke={theme.grid} strokeDasharray="3 5" />
            {!connecting && <text x={axisRight ? right + 6 : left - 7} y={y(value) + 3} textAnchor={axisRight ? "start" : "end"} fill={theme.muted} fontSize="9">{display(value)}</text>}</g>;
        })}
        {!connecting && tickIndices.map(i => <text key={i} x={x(i)} y={bottom + 17} fill={theme.muted} textAnchor="middle" fontSize="9">{categories[i]}</text>)}
        {band && !connecting && <g data-live-target-band>
          <rect x={left} y={y(144)} width={plotWidth} height={y(141) - y(144)} fill={bandPattern ? `url(#${uid}-live-band)` : theme.colors[1]} opacity={bandPattern ? .61 : .18} />
          {[141, 144].map(target => <g key={target} data-live-target={target}><path d={`M${left} ${y(target)}H${right}`} fill="none" stroke={theme.colors[1]} strokeDasharray="5 4" />
            <polygon points={`${right - 8},${y(target) - 3} ${right},${y(target)} ${right - 8},${y(target) + 3}`} fill={theme.colors[1]} /><title>{display(target)}</title></g>)}
        </g>}
        {connecting ? <path data-live-skeleton className="cartesian-live-skeleton" d={`M${left} ${bottom - 15}Q${left + plotWidth * .2} ${top} ${left + plotWidth * .4} ${bottom * .67}T${left + plotWidth * .73} ${bottom * .44}T${right} ${top + 25}`} fill="none" stroke={theme.grid} strokeWidth="3" /> : line && <>
          {!axisRight && <path data-live-area d={area} fill={`url(#${uid}-live-fill)`} />}
          <path data-live-line d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {last !== null && <g data-live-badge>
            {frozen === null && <circle className="cartesian-live-halo" cx={x(count - 1)} cy={y(last)} r="8" fill={color} opacity=".24" />}
            <circle cx={x(count - 1)} cy={y(last)} r="4" fill={color} stroke={theme.surface} strokeWidth="1.2" />
            <rect x={badgeX} y={y(last) - 9} width="64" height="18" rx="5" fill={theme.surface} stroke={color} />
            <text x={badgeX + 32} y={y(last) + 3} fill={color} fontSize="9" fontWeight="650" textAnchor="middle">{display(last)}</text>
          </g>}
          {typeof selected === "number" && active !== null && <g data-live-cursor><path d={`M${x(active)} ${top}V${bottom}`} fill="none" stroke={theme.muted} strokeDasharray="3 4" />
            <circle cx={x(active)} cy={y(selected)} r="4" fill={theme.surface} stroke={color} strokeWidth="2" /></g>}
        </>}
      </svg>
      {!connecting && typeof selected === "number" && active !== null && <div className="cl-tooltip cartesian-candle-tooltip" role="status" style={{ left: Math.max(2, Math.min(width - 124, x(active) + 9)), top: top + 4 }}><div className="cl-tooltip-heading">{categories[active]}</div>
        <div className="cl-tooltip-row"><span>{seriesName}</span><strong>{display(selected)}</strong></div></div>}
    </div>
    {!compact && <div className="cartesian-status" data-live-summary>
      {connecting ? <><strong>Connecting to the stream</strong><br />The last minute of trades arrives on connect</> : liveValueNow === null ? null : <>
        <strong>{canPause ? `${display(liveValueNow)} watching now` : axisRight ? `${display(liveValueNow)} now, ${display(recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length))} on average` : momentum ? `${change > 0 ? "Up" : change < 0 ? "Down" : "Flat"} ${Math.abs(change * 100).toFixed(2)}% in 30 seconds` : `Last trade ${display(liveValueNow)}`}</strong><br />
        {frozen !== null ? "Paused. New samples are still recorded." : canPause ? "One sample a second" : axisRight ? "p95 of checkout API requests, sampled every 800 ms" : momentum ? "The line takes the color of the last 20 quotes’ trend" : texture ? `${texture === "dots" ? "A dot grid" : "A diagonal pattern"} under the line, faded at the edges` : band ? `${bandPattern ? "A hatched band marks" : "The band holds"} the $141 to $144 target range` : id === "live-line-loading" ? "Live, a trade every 600 ms" : `High of ${display(Math.max(...recent))} in the last 30 seconds`}
      </>}
    </div>}
  </div>;
}
