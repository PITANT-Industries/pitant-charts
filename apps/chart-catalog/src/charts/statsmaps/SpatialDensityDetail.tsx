import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle } from "lucide-react";
import { usePlotSize } from "../usePlotSize";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { contourPaths, densitySkeleton, designs, hexBins, hexPath, hexSkeleton, spatialFixture, type Bounds } from "./spatial-density-data";
import type { DemoProps } from "./primitives";
import "./spatial-density-detail.css";

export function isSpatialDensityVariant(id: string) {
  return Object.hasOwn(designs, id);
}

const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const palette = [2, 3, 4, 5].map(level => `var(--spatial-scale-${level})`);
const groupColor = (group: string) => `var(--chart-${group === "Gaming" ? 2 : group === "Workstation" ? 3 : 1})`;

type Readout = { title: string; entries: { name: string; value: string | number; color: string }[]; detail?: string };
type Mark = { x: number; y: number; index: number; color: string; value?: number; count?: number; group?: string };

function chartBounds(width: number, height: number, [left, right, top, bottom]: [number, number, number, number], compact: boolean): Bounds {
  return {
    left: Math.min(compact ? 19 : left, width * .22),
    right: width - Math.min(compact ? 13 : right, width * .18),
    top: Math.min(compact ? 9 : top, height * .23),
    bottom: height - Math.min(compact ? 22 : bottom, height * .39),
  };
}

function axisEntries(axis: { values: number[]; format: (value: number) => string } | undefined, scale: (n: number) => number) {
  return axis?.values.map(value => ({ value, position: scale(value), text: axis.format(value) })) ?? [];
}

export function SpatialDensityDetail({ example, compact = false }: DemoProps) {
  const id = useId();
  const variant = example.id;
  const design = designs[variant];
  const isHex = variant.startsWith("hexbin");
  const average = variant === "hexbin-average";
  const ticket = variant === "hexbin-custom-tooltip";
  const groupVariant = variant === "density-groups";
  const contoursOnly = variant === "density-contours";
  const canLoad = variant.endsWith("-loading");
  const [loading, setLoading] = useState(canLoad);
  const [selected, setSelected] = useState<number | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 409.5);
  const source = useMemo(() => spatialFixture(variant), [variant]);
  const bounds = useMemo(() => chartBounds(width, height, design.margins, compact), [compact, design, height, width]);
  const { left, right, top, bottom } = bounds;
  const model = useMemo(() => {
    const x = (value: number) => left + (value - design.x[0]) / (design.x[1] - design.x[0]) * (right - left);
    const y = (value: number) => bottom - (value - design.y[0]) / (design.y[1] - design.y[0]) * (bottom - top);
    const names = [...new Set(source.map(p => p.group ?? ""))];
    const points = isHex ? [] : source.map((p, index) => ({ ...p, x: x(p.x), y: y(p.y), index, color: groupColor(p.group ?? "") }));
    const hexWidth = design.binWidth ?? 22;
    const radius = hexWidth / Math.sqrt(3) - .75;
    const cells = isHex && !loading ? hexBins(source, x, y, hexWidth).map((bin, index) => {
      const value = average ? bin.sum / bin.count : bin.count;
      const band = design.thresholds?.findIndex(limit => value < limit) ?? -1;
      return { ...bin, index, color: palette[band < 0 ? palette.length - 1 : band], value };
    }) : [];
    const contours = !isHex && !loading ? contourPaths(points, names, bounds, design.bandwidth ?? 22, design.levels ?? 8) : [];
    const skeleton = loading && !isHex ? densitySkeleton(bounds) : undefined;
    const placeholders = loading && isHex ? hexSkeleton(bounds, hexWidth) : [];
    return { x, y, points, cells, contours, skeleton, placeholders, radius, names };
  }, [average, bottom, bounds, design, isHex, left, loading, right, source, top]);
  const { x, y, points, cells, contours, skeleton, placeholders, radius, names } = model;
  const marks: Mark[] = isHex ? cells : points;
  const visible = useMemo(() => (isolated ? marks.filter(mark => mark.group === isolated) : [...marks])
    .sort((a, b) => a.x - b.x || a.y - b.y), [isolated, marks]);
  const active = selected === null || loading ? undefined : marks[selected];
  const xTicks = axisEntries(design.xAxis, x);
  const yTicks = axisEntries(design.yAxis, y);
  const interactive = !loading && !compact && !contoursOnly;

  function readout(mark: Mark): Readout {
    if (isHex) {
      const rawX = design.x[0] + (mark.x - left) / (right - left) * (design.x[1] - design.x[0]);
      const rawY = design.y[0] + (bottom - mark.y) / (bottom - top) * (design.y[1] - design.y[0]);
      const formatX = design.xAxis?.format ?? decimal.format;
      const formatY = design.yAxis?.format ?? decimal.format;
      const count = mark.count ?? 0;
      if (ticket) return {
        title: `${count} ${count === 1 ? "ticket" : "tickets"}`, entries: [],
        detail: `${(count / source.length * 100).toFixed(1)}% of the quarter, around ${formatX(Math.round(rawX * 10) / 10)} and a score of ${Math.round(rawY)}`,
      };
      return {
        title: `${formatX(Math.round(rawX * 10) / 10)} · ${formatY(Math.round(rawY * 10) / 10)}`,
        entries: [{ name: average ? "Average fare" : "Sessions", value: average ? `$${Math.round(mark.value ?? 0)}` : count, color: mark.color },
          ...(average ? [{ name: "Count", value: count, color: "var(--spatial-skeleton)" }] : [])],
      };
    }
    const point = source[mark.index];
    return { title: point.group ?? "", entries: [
      { name: groupVariant ? "Weight" : "Booked ahead", value: groupVariant ? `${point.x} kg` : `${point.x}d`, color: mark.color },
      { name: groupVariant ? "Battery" : "Fare", value: groupVariant ? `${point.y}h` : `$${point.y}`, color: mark.color },
    ] };
  }

  function inspect(event: PointerEvent<SVGSVGElement>) {
    const frame = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - frame.left, y = event.clientY - frame.top;
    if (x < left || x > right || y < top || y > bottom) { setSelected(null); return; }
    let best = (isHex ? (design.binWidth ?? 22) / Math.sqrt(3) : 14) ** 2;
    let nearest: Mark | undefined;
    for (const mark of visible) {
      const distance = (mark.x - x) ** 2 + (mark.y - y) ** 2;
      if (distance <= best) { nearest = mark; best = distance; }
    }
    setSelected(nearest?.index ?? null);
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const last = visible.length - 1;
    if (last < 0) return;
    const index = visible.findIndex(mark => mark.index === selected);
    const choices: Record<string, number> = { Home: 0, End: last, ArrowRight: Math.min(last, index + 1), ArrowDown: Math.min(last, index + 1),
      ArrowLeft: Math.max(0, index - 1), ArrowUp: Math.max(0, index - 1) };
    if (!Object.hasOwn(choices, event.key)) return;
    event.preventDefault();
    setSelected(visible[choices[event.key]].index);
  }

  const hint = active && readout(active);
  const showSteps = isHex && !canLoad && !ticket;
  const showGroups = groupVariant;
  const steps = average ? ["$0–$15", "$15–$25", "$25–$40", "$40+"] : ["1–4", "5–15", "16–34", "35+"];
  const summary = canLoad ? isHex
    ? [loading ? "Fetching sessions…" : "900 sessions in October", "Turn loading off to reveal the hexagons"]
    : [loading ? "Fetching bookings…" : "360 bookings in September", "Turn loading off to reveal the contours"]
    : design.summary;

  return <div className="spatial-detail" data-compact={compact} data-loading={loading} data-spatial-variant={variant}>
    {!compact && canLoad && <div className="spatial-controls"><Toggle className="spatial-loading-button" pressed={loading} onPressedChange={pressed => { setSelected(null); setLoading(pressed); }}>
      <LoaderCircle size={14} aria-hidden="true" /> Loading
    </Toggle></div>}
    <div className="spatial-detail-plot" ref={plot}>
      <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title} aria-roledescription="chart"
        aria-busy={loading || undefined} tabIndex={interactive ? 0 : undefined} aria-describedby={interactive ? `${id}-keys` : undefined}
        onKeyDown={interactive ? keyboard : undefined} onPointerMove={interactive ? inspect : undefined} onPointerDown={interactive ? inspect : undefined}
        onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
        onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)}>
        {interactive && <desc id={`${id}-keys`}>Use arrow keys to inspect the chart. Home and End select the first and last points. Escape clears the selection.</desc>}
        <defs><clipPath id={`${id}-contours`}><rect x="0" y="0" width={right - left} height={bottom - top} /></clipPath></defs>
        <g aria-hidden="true" stroke="var(--border)" strokeDasharray="4 4" data-spatial-grid="">
          {design.vertical && xTicks.map(({ value, position }) => <line key={`x${value}`} x1={position} x2={position} y1={top} y2={bottom} />)}
          {yTicks.map(({ value, position }) => <line key={`y${value}`} x1={left} x2={right} y1={position} y2={position} />)}
        </g>
        <g aria-hidden="true" transform={`translate(${left} ${top})`} clipPath={`url(#${id}-contours)`}>
          {contours.map(({ group, value, path }, index) => <path key={`${group}:${value}`} d={path} data-spatial-contour={group}
            fill={groupColor(group)} fillOpacity={contoursOnly ? .1 : .14} stroke={groupColor(group)} strokeOpacity={contoursOnly ? .4 : .55}
            opacity={isolated && group !== isolated ? .13 : active && groupVariant && group !== active.group ? .5 : 1}
            className={canLoad ? "spatial-reveal" : undefined} style={{ "--spatial-delay": `${index * 48}ms` } as CSSProperties} />)}
        </g>
        <g aria-hidden="true">
          {cells.map(mark => <path key={mark.index} data-spatial-bin={mark.count} data-spatial-bin-value={mark.value}
            d={hexPath(mark.x, mark.y, radius)} fill={mark.color} opacity={active && active !== mark ? ticket ? .5 : .35 : 1}
            className={canLoad ? "spatial-reveal" : undefined} style={{ "--spatial-delay": `${mark.x / width * 210}ms` } as CSSProperties} />)}
          {placeholders.map(({ x, y, opacity }, index) => <path key={index} data-spatial-hex-skeleton="" d={hexPath(x, y, radius)}
            fill="var(--spatial-skeleton)" fillOpacity={opacity} className="spatial-skeleton" style={{ "--spatial-delay": `${(index % 16) * 45}ms` } as CSSProperties} />)}
          {skeleton?.bands.map((d, index) => <path key={index} d={d} data-spatial-density-skeleton="" fill="var(--spatial-skeleton)" fillOpacity=".14"
            stroke="var(--spatial-skeleton)" strokeOpacity=".55" className="spatial-skeleton" style={{ "--spatial-delay": `${index * 130}ms` } as CSSProperties} />)}
          {skeleton?.dots.map((p, index) => <circle key={index} cx={p.x} cy={p.y} r={design.pointRadius} data-spatial-dot-skeleton=""
            fill="var(--spatial-skeleton)" fillOpacity=".7" className="spatial-skeleton" style={{ "--spatial-delay": `${(index % 15) * 50}ms` } as CSSProperties} />)}
          {!isHex && !contoursOnly && !loading && points.map(mark => <circle key={mark.index} data-spatial-point={mark.group ?? ""}
            cx={mark.x} cy={mark.y} r={design.pointRadius} fill={mark.color} fillOpacity=".7"
            opacity={isolated && mark.group !== isolated ? .12 : active && groupVariant && mark !== active ? .35 : 1} />)}
          {active && (isHex ? <path d={hexPath(active.x, active.y, radius * 1.18)} fill={active.color} stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinejoin="round" />
            : <circle cx={active.x} cy={active.y} r={(design.pointRadius ?? 2.5) * 1.9} fill={active.color} stroke="var(--background)" strokeWidth="2" />)}
        </g>
        <g aria-hidden="true" fill="var(--muted-foreground)" fontSize={compact ? 9 : 12} data-spatial-axis="">
          {xTicks.map(({ value, position, text }, i) => (!compact || i % 2 === 0) && <text key={value} x={position} y={compact ? height - 3 : height - (design.xTitle ? 26 : 8)} textAnchor="middle">{text}</text>)}
          {!compact && design.xTitle && <text x={(left + right) / 2} y={height - 18} textAnchor="middle" dominantBaseline="hanging">{design.xTitle}</text>}
          {!compact && yTicks.map(({ value, position, text }) => <text key={value} x="36" y={position} dominantBaseline="middle" textAnchor="end">{text}</text>)}
        </g>
      </svg>
      {!compact && loading && <output className="spatial-loading-label">{isHex ? "Loading sessions" : "Loading bookings"}</output>}
      {active && hint && <div className="spatial-detail-tooltip" style={{
        top: Math.max(3, Math.min(height - 86, active.y - 30)),
        ...(active.x > width * .5 ? { right: width - active.x + 12 } : { left: active.x + 12 }),
      }}>
        {hint.detail ? <div className="cartesian-focus-readout" role="status"><strong>{hint.title}</strong><small>{hint.detail}</small></div>
          : <CartesianReadout label={hint.title} entries={hint.entries} />}
      </div>}
    </div>
    {!compact && showSteps && <div className="spatial-legend"><strong>{average ? "Average fare" : "Sessions"}</strong>
      {steps.map((step, index) => <span key={step}><i style={{ background: palette[index] }} />{step}</span>)}
    </div>}
    {!compact && showGroups && <div className="spatial-legend" aria-label="Laptop segments">
      {names.map(group => <Toggle key={group} pressed={isolated === group} onPressedChange={pressed => { setSelected(null); setIsolated(pressed ? group : null); }}>
        <i style={{ background: groupColor(group) }} />{group}
      </Toggle>)}
    </div>}
    {!compact && <div className="spatial-summary"><strong>{summary[0]}</strong><span>{summary[1]}</span></div>}
  </div>;
}
