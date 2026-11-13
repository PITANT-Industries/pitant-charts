import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import {
  afterTimes, beforeTimes, checkoutBins, ecdfSkeleton, histogramSkeleton, overlayBins, regionRidgeCurves,
  regionRidgeReadout, ridgeSkeletonCurves, sessionRidgeCurves, sessionRidgeReadout, stackedBins,
} from "./distribution-detail-fixtures";
import { linear, type DemoProps } from "./primitives";
import "./distribution-detail.css";

const variants = [
  "histogram-default", "histogram-overlay", "histogram-stacked", "histogram-loading",
  "ecdf-default", "ecdf-compare", "ecdf-loading",
  "ridgeline-default", "ridgeline-colors", "ridgeline-loading",
] as const;

export function isDistributionDetail(id: string) {
  return variants.some(variant => variant === id);
}

type Box = { left: number; right: number; top: number; bottom: number; width: number };
type Point = { x: number; y: number };
type Hint = { title: string; entries: { name: string; value: number | string; color: string }[]; x: number; y: number };
type Tick = { at: number; label: string };
type Theme = ReturnType<typeof useChartTheme>;
const rounded = (value: number, precision = 2) => Math.round(value * 10 ** precision) / 10 ** precision;
const point = (x: number, y: number) => `${rounded(x, 1)},${rounded(y, 1)}`;
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
const formatted = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const thresholds = [...new Set(afterTimes)].sort((a, b) => a - b);
const compareThresholds = [...new Set([...beforeTimes, ...afterTimes])].sort((a, b) => a - b);
const summaries: Record<string, string> = {
  "histogram-default": "Median response 208 ms, p90 354 ms",
  "histogram-overlay": "Median down 36% after the rollout",
  "histogram-stacked": "Median session length was 14 min on desktop and 7 min on mobile",
  "ecdf-default": "Half the requests finish within 208 ms, 90% within 354 ms",
  "ecdf-compare": "p90 fell from 591 ms to 354 ms",
  "ridgeline-default": "Typical long sessions grew from 18 to 27 minutes",
  "ridgeline-colors": "South America had the widest range of load times",
};

export function DistributionDetail({ example, compact }: DemoProps) {
  const uid = useId();
  const theme = useChartTheme();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const [active, setActive] = useState<number | null>(null);
  const [legend, setLegend] = useState<number | null>(null);
  const loadingVariant = example.id.endsWith("-loading");
  const [loading, setLoading] = useState(loadingVariant && !compact);
  const histogram = example.family === "histogram";
  const ridge = example.family === "ridgeline";
  const overlay = example.id === "histogram-overlay";
  const stacked = example.id === "histogram-stacked";
  const compare = example.id === "ecdf-compare";
  const colored = example.id === "ridgeline-colors";
  const left = histogram ? 28 : ridge ? colored ? 100 : 38 : 42;
  const box = {
    left: compact ? Math.min(left, 28) : Math.min(left, width * .42),
    right: width - Math.min(compact ? 14 : 16, width * .12),
    top: Math.min(16, height * .2),
    bottom: Math.max(height - Math.min(compact ? 22 : 36, height * .28), 17),
    width,
  };
  const design = histogram ? histogramDesign(box, theme, overlay, stacked, loading)
    : ridge ? ridgelineDesign(box, theme, colored, loading) : ecdfDesign(box, theme, compare, loading);
  const hint = active === null ? undefined : design.hints[active];
  const tipWidth = Math.min(ridge ? colored ? 254 : 240 : histogram && !stacked ? 149 : 140, width - 8);
  const tipStart = hint ? hint.x + 16 : 0;
  const tipX = Math.max(4, Math.min(width - tipWidth - 4, tipStart + tipWidth > width ? tipStart - tipWidth - 32 : tipStart));

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
      setActive(null);
      return;
    }
    setActive(design.nearest(x, y));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || loading) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
      return;
    }
    const last = design.hints.length - 1;
    const next = Math.min(last, (active ?? -1) + 1);
    const previous = Math.max(0, (active ?? last + 1) - 1);
    const index = { Home: 0, End: last, ArrowRight: next, ArrowDown: next, ArrowLeft: previous, ArrowUp: previous }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    setActive(index);
  }

  return <div className="distribution-detail" data-distribution={example.id} data-distribution-compact={compact || undefined}>
    {loadingVariant && !compact && <div className="distribution-control">
      <Toggle className="distribution-loading-toggle" pressed={loading} onPressedChange={pressed => { setLoading(pressed); setActive(null); }}>
        <span aria-hidden="true" />Loading
      </Toggle>
    </div>}
    <div className={overlay && !compact ? "distribution-layout distribution-layout--side" : "distribution-layout"}>
      <div className="distribution-plot" ref={plot} aria-busy={loading || undefined}>
        <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
          aria-label={example.title} aria-describedby={`${uid}-description`} tabIndex={compact || loading ? undefined : 0}
          onPointerMove={inspect} onPointerUp={event => { if (event.pointerType === "touch") inspect(event); }}
          onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }} onPointerCancel={() => setActive(null)}
          onKeyDown={onKeyDown} onBlur={() => setActive(null)}>
          <desc id={`${uid}-description`}>{loading ? "Loading distribution." : design.description} {!compact && !loading && "Use the arrow keys to inspect values. Home and End jump to the first and last values. Escape clears the selection."}</desc>
          <g aria-hidden="true">
            {(ridge || compare) && <g className="distribution-grid-vertical" stroke={theme.grid} strokeDasharray="4 4" data-distribution-grid="">
              {design.xTicks.map(tick => <line key={tick.label} x1={tick.at} x2={tick.at} y1={box.top} y2={box.bottom} />)}
            </g>}
            {!ridge && <g className="distribution-grid-horizontal" stroke={theme.grid} strokeDasharray="4 4" data-distribution-grid="">
              {design.yTicks.map(tick => <line key={tick.label} x1={box.left} x2={box.right} y1={tick.at} y2={tick.at} />)}
            </g>}
            {design.marks(active, legend, compact ?? false)}
            <g fill={theme.muted} fontSize={compact ? 9 : 12}>
              {design.xTicks.filter((_, index) => !compact || index % 2 === 0).map(tick => <text key={tick.label}
                x={tick.at} y={box.bottom + (compact ? 16 : 24)} textAnchor="middle">{tick.label}</text>)}
              {!compact && design.yTicks.map(tick => <text key={tick.label} x={box.left - 4} y={tick.at}
                textAnchor="end" dominantBaseline="middle">{tick.label}</text>)}
            </g>
          </g>
        </svg>
        {!compact && !loading && <div className="distribution-readout" role="status"
          style={{ inlineSize: tipWidth, insetInlineStart: tipX, insetBlockStart: hint?.y ?? box.top }}>
          {hint && <CartesianReadout label={hint.title} entries={hint.entries} live={false} />}
        </div>}
        {loading && <span className="distribution-loading-label" role="status">{ridge ? "Loading sessions" : "Loading requests"}</span>}
      </div>
      {overlay && !compact && <div className="distribution-median">
        <span>Median response</span>
        {[["Before", 323, theme.colors[2]], ["After", 208, theme.colors[0]]].map(([name, median, color], index) =>
          <Button key={name} className="distribution-median-item" onPointerEnter={() => setLegend(index)} onPointerLeave={() => setLegend(null)}
            onFocus={() => setLegend(index)} onBlur={() => setLegend(null)}>
            <i aria-hidden="true" style={{ background: String(color) }} />
            <span>{name}</span><strong>{median} ms</strong>
          </Button>)}
      </div>}
    </div>
    {!compact && <p className="distribution-summary">{loading ? (ridge ? "Fetching sessions…" : "Fetching requests…")
      : summaries[loadingVariant ? `${example.family}-default` : example.id]}</p>}
  </div>;
}

function histogramDesign(box: Box, theme: Theme, overlay: boolean, stacked: boolean, loading: boolean) {
  const [min, max, step, maximum, xStep, yStep] = stacked ? [0, 40, 2, 60, 10, 10]
    : overlay ? [50, 1300, 50, 70, 200, 10] : [60, 640, 20, 30, 100, 5];
  const bins = stacked ? stackedBins : overlay ? overlayBins : checkoutBins;
  const labels = stacked ? ["Mobile", "Desktop"] : overlay ? ["Before", "After"] : ["Requests"];
  const colors = stacked ? [theme.colors[1], theme.colors[0]] : overlay ? [theme.colors[2], theme.colors[0]] : [theme.colors[0]];
  const interval = (value: number) => `${value} ${stacked ? "min" : "ms"}`;
  const x = linear([min, max], [box.left, box.right]);
  const y = linear([0, maximum], [box.bottom, box.top]);
  const count = bins[0].length;
  const stride = (box.right - box.left) / count;
  const xTicks: Tick[] = [];
  for (let value = Math.ceil(min / xStep) * xStep; value <= max; value += xStep) xTicks.push({ at: rounded(x(value)), label: interval(value) });
  const yTicks = Array.from({ length: maximum / yStep + 1 }, (_, index) => ({ at: rounded(y(index * yStep)), label: String(index * yStep) }));
  const hints = Array.from({ length: count }, (_, index): Hint => ({
    title: `${interval(min + step * index)} – ${interval(min + step * (index + 1))}`,
    x: x(min + step * (index + .5)), y: box.top,
    entries: labels.map((name, j) => ({ name, value: bins[j][index], color: colors[j] })),
  }));
  const marks = (active: number | null, legend: number | null) => hints.map((_, index) => {
    const left = box.left + stride * index + 1;
    const right = box.left + stride * (index + 1) - 1;
    let base = 0;
    return <g key={index} opacity={active !== null && active !== index ? .3 : 1} className="distribution-bin"
      style={{ "--distribution-bottom": `${box.bottom}px`, "--distribution-delay": `${index * 11}ms` } as CSSProperties}>
      {loading ? <path className="distribution-loading-mark" data-distribution-bin={index} fill={theme.muted}
        d={barPath(left, right, box.bottom - histogramSkeleton[index] * (box.bottom - box.top), box.bottom, 4)} /> : bins.map((series, i) => {
        const value = series[index];
        if (!value) return null;
        const upper = y(value + base);
        const lower = y(base);
        if (stacked) base += value;
        const fill = overlay ? `color-mix(in srgb, ${colors[i]} 55%, transparent)` : colors[i];
        return <path key={i} data-distribution-bin={index} data-distribution-series={i} data-distribution-count={value}
          opacity={legend !== null && legend !== i ? .3 : 1} fill={fill}
          d={barPath(left, right, upper, lower, stacked && i === 0 && bins[1][index] ? 0 : 4)} />;
      })}
    </g>;
  });
  return {
    description: `Histogram with ${bins.flat().reduce((sum, value) => sum + value, 0)} observations across ${count} bins, from ${interval(min)} to ${interval(max)}.`,
    xTicks, yTicks, hints, marks, nearest: (px: number) => Math.min(count - 1, Math.floor((px - box.left) / stride)),
  };
}

function barPath(left: number, right: number, top: number, bottom: number, cap: number) {
  const l = rounded(left, 1);
  const x = rounded(right, 1);
  const y = rounded(top, 1);
  const b = rounded(bottom, 1);
  const r = Math.min(cap, rounded((right - left) / 2, 2), rounded(b - y, 2));
  const leftArc = rounded(l + r, 2);
  const rightArc = rounded(x - r, 2);
  const arcY = rounded(y + r, 2);
  return `M${leftArc},${y}H${rightArc}A${r},${r} 0 0 1 ${x},${arcY}V${b}A0,0 0 0 1 ${x},${b}H${l}A0,0 0 0 1 ${l},${b}V${arcY}A${r},${r} 0 0 1 ${leftArc},${y}Z`;
}

function empiricalPath(values: readonly number[], total: number, max: number, x: (value: number) => number, y: (value: number) => number) {
  let path = `M${point(x(0), y(0))}`;
  for (let first = 0; first < values.length;) {
    let end = first + 1;
    while (values[end] === values[first]) end++;
    const at = x(values[first]);
    path += `L${point(at, y(first / total))}`.repeat(end - first);
    path += `L${point(at, y(end / total))}`;
    first = end;
  }
  return `${path}L${point(x(max), y(values.length / total))}`;
}

function ecdfDesign(box: Box, theme: Theme, compare: boolean, loading: boolean) {
  const maximum = compare ? 1000 : 800;
  const x = linear([0, maximum], [box.left, box.right]);
  const y = linear([0, 1], [box.bottom, box.top]);
  const xTicks = Array.from({ length: maximum / 200 + 1 }, (_, index) => ({ at: rounded(x(index * 200)), label: `${index * 200} ms` }));
  const yTicks = Array.from({ length: 6 }, (_, index) => ({ at: rounded(y(index / 5)), label: `${index * 20}%` }));
  const sets = compare ? [{ name: "Before", values: beforeTimes, color: theme.colors[2] }, { name: "After", values: afterTimes, color: theme.colors[0] }]
    : [{ name: "Requests", values: afterTimes, color: theme.colors[0] }];
  const available = compare ? compareThresholds : thresholds;
  const paths = loading ? [empiricalPath(ecdfSkeleton.map(value => value * maximum), ecdfSkeleton.length, maximum, x, y)]
    : sets.map(({ values }) => empiricalPath(values, 240, maximum, x, y));
  const hints = available.map((threshold): Hint => ({
    title: `≤ ${threshold} ms`, x: x(threshold), y: box.top,
    entries: sets.map(({ name, values, color }) => ({ name, color, value: percent.format(values.filter(value => value <= threshold).length / 240) })),
  }));
  const marks = (active: number | null) => {
    const guide = active === null ? null : hints[active];
    return <>
      {!loading && (compare ? [.9] : [.5, .9]).map(value => <g key={value}>
        <line data-distribution-percentile={value} x1={box.left} x2={box.right} y1={rounded(y(value))} y2={rounded(y(value))} stroke={theme.muted} strokeDasharray="3 4" />
        <text x={box.right - 2} y={rounded(y(value) - 6, 1)} fill={theme.muted} stroke={theme.surface} strokeWidth="2.5"
          paintOrder="stroke" strokeLinejoin="round" textAnchor="end" fontSize="11">p{value * 100}</text>
      </g>)}
      {guide && <line x1={guide.x} x2={guide.x} y1={box.top} y2={box.bottom} stroke={theme.muted} strokeOpacity=".65" />}
      <g className={loading ? "distribution-loading-mark" : "distribution-ecdf-reveal"}>
        {paths.map((path, i) => <g key={i}>
          {!compare && <path data-distribution-ecdf-fill={i} d={`${path}L${point(box.right, box.bottom)}L${point(box.left, box.bottom)}Z`}
            fill={loading ? theme.muted : sets[i].color} fillOpacity={loading ? .16 : .1} />}
          <path data-distribution-ecdf-line={i} d={path} fill="none" stroke={loading ? theme.muted : sets[i].color}
            strokeWidth={loading ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
        </g>)}
      </g>
      {guide && sets.map(({ values, color }, i) => <circle key={i} cx={guide.x}
        cy={y(values.filter(value => value <= available[active!]).length / 240)} r="4.5" fill={color} stroke={theme.surface} strokeWidth="1.5" />)}
    </>;
  };
  return {
    description: compare ? "Empirical cumulative distributions comparing checkout requests before and after the cache rollout." :
      "Empirical cumulative distribution of 240 checkout requests, from 73 to 632 milliseconds.",
    xTicks, yTicks, hints, marks,
    // The curve reports the cumulative count at or below the pointer.
    nearest: (px: number) => {
      const next = hints.findIndex(hint => hint.x > px);
      return next === -1 ? hints.length - 1 : Math.max(0, next - 1);
    },
  };
}

function ridgelineDesign(box: Box, theme: Theme, colored: boolean, loading: boolean) {
  const curves = loading ? ridgeSkeletonCurves : colored ? regionRidgeCurves : sessionRidgeCurves;
  const stats = colored ? regionRidgeReadout : sessionRidgeReadout;
  const max = colored ? 4500 : 50;
  const step = colored ? 1000 : 10;
  const x = linear([0, max], [box.left, box.right]);
  const extent = box.bottom - box.top;
  const unit = colored ? "ms" : "min";
  const display = (value: number) => `${formatted.format(value)} ${unit}`;
  const xTicks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => ({ at: rounded(x(index * step)), label: display(index * step) }));
  const amplitude = (extent - 2) / (colored ? 4.15 : 6.6);
  const densityHeight = extent - 2;
  const baseline = (index: number) => box.bottom - 2 - (curves.length - 1 - index) * amplitude;
  const paths = curves.map(({ start, end, heights }, index) => {
    const base = baseline(index);
    const points = heights.map((value, i) => ({ x: x(max * (start + (end - start) * i / (heights.length - 1))), y: base - value * densityHeight }));
    const stroke = smoothRidge(points);
    return { stroke, fill: `${stroke}L${point(points.at(-1)!.x, base)}L${point(points[0].x, base)}Z` };
  });
  const hints = stats.map(({ name, median, low, high, count }, index): Hint => ({
    title: name, x: x(median), y: Math.max(box.top, baseline(index) - 81),
    entries: [
      { name: "Median", value: display(median), color: "transparent" },
      { name: "Middle half", value: `${display(low)} – ${display(high)}`, color: "transparent" },
      { name: "Observations", value: count, color: "transparent" },
    ],
  }));
  const marks = (active: number | null, _: number | null, compact: boolean) => <>
    {!compact && <g fill={theme.muted} fontSize="12">{stats.map(({ name }, i) =>
      <text key={name} x={box.left - 10} y={rounded(baseline(i), 1)} textAnchor="end" dominantBaseline="middle">{name}</text>)}</g>}
    {paths.map(({ stroke, fill }, index) => {
      const color = loading ? theme.muted : theme.colors[colored ? index : 0];
      return <g key={index} opacity={active !== null && active !== index ? .3 : 1} className={loading ? "distribution-loading-mark" : "distribution-ridge-reveal"}
        style={{ "--distribution-bottom": `${baseline(index)}px`, "--distribution-delay": `${index * 35}ms` } as CSSProperties}>
        <path data-distribution-ridge-fill={index} d={fill} fill={`color-mix(in oklab, ${color} ${loading ? 34 : 28}%, var(--background))`} />
        <path data-distribution-ridge-line={index} d={stroke ?? undefined} fill="none" stroke={color} strokeWidth={colored ? 2 : 1.5}
          strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    })}
  </>;
  return {
    description: `Ridgeline of ${stats.reduce((sum, item) => sum + item.count, 0)} observations across ${stats.length} groups.`,
    xTicks, yTicks: [], hints, marks,
    nearest: (px: number, py: number) => {
      for (let index = paths.length - 1; index >= 0; index--) {
        const shape = curves[index];
        const fraction = (px - x(max * shape.start)) / (x(max * shape.end) - x(max * shape.start));
        if (fraction < 0 || fraction > 1 || py > baseline(index)) continue;
        const value = shape.heights[Math.round(fraction * (shape.heights.length - 1))];
        if (py >= baseline(index) - value * densityHeight) return index;
      }
      return nearest(stats, (_, index) => Math.abs(baseline(index) - amplitude / 2 - py));
    },
  };
}

function smoothRidge(points: Point[]) {
  const last = points.length - 1;
  let path = `M${point(points[0].x, points[0].y)}`;
  for (let index = 0; index < last; index++) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(last, index + 2)];
    path += `C${point(start.x + (end.x - previous.x) / 6, start.y + (end.y - previous.y) / 6)}`;
    path += `,${point(end.x - (next.x - start.x) / 6, end.y - (next.y - start.y) / 6)},${point(end.x, end.y)}`;
  }
  return path;
}

function nearest<T>(values: readonly T[], distance: (value: T, index: number) => number) {
  let best = 0;
  for (let index = 1; index < values.length; index++) if (distance(values[index], index) < distance(values[best], best)) best = index;
  return best;
}
