import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle } from "lucide-react";
import { useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartPreviewProps } from "../../types";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { usePlotSize } from "../usePlotSize";
import { distributionLayout, quantileMarks, swarmPoints } from "./reference-distribution-layout";
import "./reference-distributions.css";

const footers: Record<string, [headline: string, note: string]> = {
  "beeswarm-default": ["Search's deploys cluster under 10 minutes", "32 production deploys per team, July to September"],
  "beeswarm-series": ["The after-rollout requests pack in left of 300 ms", "90 requests from each week; slower ones past 1 s left out"],
  "beeswarm-vertical": ["360 loads, each one a dot", "90 sampled page loads per region"],
  "violin-default": ["Asia Pacific and South America have the longest tails", "90 sampled page loads per region; the bar marks the middle half"],
  "violin-horizontal": ["Mobile deploys spread widest, from 7 to 34 minutes", "32 production deploys per team, July to September"],
  "violin-grouped": ["Mobile loads sit higher and spread wider everywhere", "60 sampled loads per region and device"],
  "box-plot-default": ["South America loads twice as slow as US East", "90 sampled page loads per region; dots are loads past the whiskers"],
  "box-plot-horizontal": ["Search ships fastest, Mobile takes twice as long", "32 production deploys per team, July to September"],
  "box-plot-grouped": ["Mobile loads take about 1.5x as long in every region", "60 sampled loads per region and device"],
};
const loadingFooters: Record<string, [placeholder: string, note: string]> = {
  "beeswarm-loading": ["Fetching deploys…", "Turn loading off to pop the deploys in from the skeleton"],
  "violin-loading": ["Fetching page loads…", "Turn loading off to unfold the violins from the skeleton"],
  "box-plot-loading": ["Fetching page loads…", "Turn loading off to unfold the boxes from the skeleton"],
};
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const neutral = "var(--card)";

function segment(start: readonly [number, number], end: readonly [number, number]) {
  return { x1: start[0], y1: start[1], x2: end[0], y2: end[1] };
}

export function ReferenceDistributions({ example, compact = false }: ChartPreviewProps) {
  const variant = example.id;
  const loader = Boolean(loadingFooters[variant]);
  const [loading, setLoading] = useState(loader);
  const [active, setActive] = useState<number | null>(null);
  const { plot, width, height: observedHeight } = usePlotSize<HTMLDivElement>(577, 288.5);
  const height = compact ? observedHeight : width / 2;
  const layout = useMemo(() => distributionLayout(variant, width, height, compact, loading), [variant, width, height, compact, loading]);
  const { swarm, violin, shared, horizontal, grouped, left, right, top, bottom, names, positions, grid, value } = layout;
  const dots = useMemo(() => swarm ? swarmPoints(layout, compact, loading) : [], [swarm, layout, compact, loading]);
  const marks = useMemo(() => !swarm ? quantileMarks(layout, loading) : [], [swarm, layout, loading]);
  const unit = horizontal && !shared ? "min" : "ms";
  const label = (v: number, digits = number) => `${digits.format(v)} ${unit}`;
  const selectedDot = active === null || !swarm ? undefined : dots[active];
  const selectedMarks = active === null || swarm ? [] : marks.filter(mark => mark.group === active);
  const summary = selectedMarks[0];
  const count = swarm ? dots.length : names.length;
  const tipName = selectedDot?.name ?? (active === null ? "" : names[active]);
  const fields = selectedDot ? [{ name: shared ? selectedDot.name : horizontal ? "Deploy" : "Page load", value: label(selectedDot.value), color: selectedDot.color }]
    : !summary ? [] : grouped ? selectedMarks.map(mark => ({ name: mark.second ? "Mobile median" : "Desktop median", value: label(mark.median, integer), color: mark.color }))
    : violin ? [
      { name: "Median", value: label(summary.median, horizontal ? oneDecimal : integer), color: summary.color },
      { name: "Middle half", value: `${label(summary.q1, horizontal ? oneDecimal : integer)} – ${label(summary.q3, horizontal ? oneDecimal : integer)}`, color: summary.color },
      { name: "Range", value: `${label(summary.min, horizontal ? oneDecimal : integer)} – ${label(summary.max, horizontal ? oneDecimal : integer)}`, color: summary.color },
      { name: "Observations", value: summary.count, color: summary.color },
    ] : horizontal ? [
      { name: "Median", value: label(summary.median, oneDecimal), color: summary.color },
      { name: "Middle half", value: `${integer.format(summary.q1)}-${label(summary.q3, integer)}`, color: summary.color },
      { name: "Deploys", value: summary.count, color: summary.color },
    ] : [
      { name: "High", value: label(summary.high), color: summary.color }, { name: "Q3", value: label(summary.q3), color: summary.color },
      { name: "Median", value: label(summary.median), color: summary.color }, { name: "Q1", value: label(summary.q1), color: summary.color },
      { name: "Low", value: label(summary.low), color: summary.color }, { name: "Outliers", value: summary.outliers.length, color: summary.color },
    ];
  const anchorX = selectedDot?.x ?? (horizontal ? summary?.marker[0] : active === null ? undefined : positions[active]) ?? left;
  const anchorY = selectedDot?.y ?? (horizontal && active !== null ? positions[active] : top);
  const panelWidth = Math.min(width - 12, swarm ? 156 : grouped ? 207 : violin ? 244 : horizontal ? 182 : 150);
  const panelHeight = 38 + 26 * fields.length;
  const tooltipX = anchorX + panelWidth + 16 > width ? anchorX - panelWidth - 16 : anchorX + 16;
  const tooltipY = selectedDot || horizontal ? anchorY - panelHeight / 2 : top;
  const footer = footers[variant.replace(/-loading$/, "-default")];
  const loaderText = loadingFooters[variant];
  const nextLabel = loading ? loaderText[0] : footer[0];
  const note = loaderText?.[1] ?? footer[1];
  const tickLabels = names.length && !horizontal && (width < 345 || compact) ? [0, names.length - 1] : names.map((_, i) => i);
  const axisColor = "var(--muted-foreground)";
  const stroke = "var(--border)";
  const orderedDots = useMemo(() => dots.map((_, i) => i).sort((a, b) => horizontal
    ? dots[a].along - dots[b].along : dots[a].x - dots[b].x || dots[a].y - dots[b].y), [dots, horizontal]);

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || loading || event.type === "pointermove" && event.pointerType === "touch") return;
    const matrix = event.currentTarget.getScreenCTM()?.inverse();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    if (p.x < left || p.x > right || p.y < top || p.y > bottom) {
      setActive(null);
      return;
    }
    if (swarm) {
      const distance = (i: number) => (dots[i].x - p.x) ** 2 + (dots[i].y - p.y) ** 2;
      const nearest = dots.reduce((best, _, i) => distance(i) < distance(best) ? i : best, 0);
      setActive(distance(nearest) <= (event.pointerType === "touch" ? 18 : 12) ** 2 ? nearest : null);
      return;
    }
    const cross = horizontal ? p.y : p.x;
    setActive(positions.reduce((best, value, i) => Math.abs(value - cross) < Math.abs(positions[best] - cross) ? i : best, 0));
  }

  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact || !count) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
      return;
    }
    const position = active === null ? -1 : swarm ? orderedDots.indexOf(active) : active;
    const next: Record<string, number> = { Home: 0, End: count - 1, ArrowRight: position + 1, ArrowDown: position + 1,
      ArrowLeft: position < 0 ? count - 1 : position - 1, ArrowUp: position < 0 ? count - 1 : position - 1 };
    if (next[event.key] === undefined) return;
    event.preventDefault();
    const index = Math.max(0, Math.min(count - 1, next[event.key]));
    setActive(swarm ? orderedDots[index] : index);
  }

  return <div className="reference-distributions" data-distribution-variant={variant} data-compact={compact}>
    {loader && !compact && <div className="reference-distribution-controls">
      <Toggle pressed={loading} onPressedChange={next => { setLoading(next); setActive(null); }}>
        <LoaderCircle size={16} aria-hidden="true" />Loading
      </Toggle>
    </div>}
    <div className="reference-distribution-plot" ref={plot}>
      <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
        aria-label={example.title} aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0}
        onPointerMove={inspect} onPointerDown={inspect} onPointerCancel={() => setActive(null)} onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }}
        onKeyDown={navigate} onBlur={() => setActive(null)}>
        {!compact && <desc>{loading ? nextLabel : "Use the arrow keys to inspect each data point. Home and End select the first and last points. Escape clears the selection."}</desc>}
        <g aria-hidden="true" data-distribution-grid={horizontal ? "vertical" : "horizontal"}>
          {grid.map(tick => <line key={tick} {...(horizontal
            ? { x1: value(tick), x2: value(tick), y1: top, y2: bottom }
            : { x1: left, x2: right, y1: value(tick), y2: value(tick) })}
            stroke={stroke} strokeDasharray="4 4" />)}
        </g>
        <g aria-hidden="true" data-distribution-axes="" fontSize={compact ? 9 : 12} fill={axisColor}>
          {grid.map(tick => horizontal
            ? <text key={tick} x={value(tick)} y={bottom + (compact ? 14 : 24)} textAnchor="middle">{shared ? `${tick} ms` : label(tick, integer)}</text>
            : !compact && <text key={tick} x={left - 4} y={value(tick)} textAnchor="end" dominantBaseline="middle">{label(tick, integer)}</text>)}
          {tickLabels.map(i => horizontal
            ? <text key={i} x={left - 4} y={positions[i]} textAnchor="end" dominantBaseline="middle">{compact ? names[i].slice(0, 1) : names[i]}</text>
            : <text key={i} x={positions[i]} y={bottom + (compact ? 14 : 24)} textAnchor="middle">{names[i]}</text>)}
        </g>
        <g aria-hidden="true" className="reference-distribution-marks" data-loading={loading} data-ready={loader && !loading}>
          {swarm && <g opacity={active !== null ? .3 : 1}>
            {(shared ? [...dots].sort((a, b) => a.group - b.group || a.index - b.index) : dots).map(dot => <circle key={dot.index}
              data-swarm={dot.name} data-swarm-index={dot.index} cx={dot.x} cy={dot.y} r={dot.radius} fill={dot.color}
              style={{ "--distribution-delay": `${dot.index * 3}ms` } as CSSProperties} />)}
          </g>}
          {marks.map((mark, i) => {
            const { at, color, thickness, rect, marker } = mark;
            const lowCap = thickness / 4;
            const inset = Math.max(0, thickness / 2 - 3);
            const animation = violin === horizontal ? "y" : "x";
            return <g key={i} data-distribution-group={mark.group} data-distribution-series={mark.second ? 1 : 0}
              data-unfold={animation} opacity={active === null || active === mark.group ? 1 : .3}
              style={{ "--distribution-origin": `${marker[0]}px ${marker[1]}px`, "--distribution-delay": `${mark.group * 65}ms` } as CSSProperties}>
              {violin ? <>
                <path data-violin="" d={mark.path} fill={color} />
                {!loading && <line data-range="" {...segment(at(mark.min), at(mark.max))} stroke={neutral} strokeOpacity=".7" strokeLinecap="round" />}
                <rect data-quartiles="" {...rect} fill={neutral} rx={thickness / 2} />
                {!loading && <circle data-median="" cx={marker[0]} cy={marker[1]} r={Math.max(2, thickness / 2 - 1)} fill={color} />}
              </> : <>
                <line data-whisker-low="" {...segment(at(mark.low), at(mark.q1))} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                <line data-whisker-high="" {...segment(at(mark.q3), at(mark.high))} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                <line data-cap-low="" {...segment(at(mark.low, -lowCap), at(mark.low, lowCap))} stroke={color} strokeWidth="2" strokeLinecap="round" />
                <line data-cap-high="" {...segment(at(mark.high, -lowCap), at(mark.high, lowCap))} stroke={color} strokeWidth="2" strokeLinecap="round" />
                <rect data-quartiles="" {...rect} fill={color} rx={Math.min(6, rect.width / 2, rect.height / 2)} />
                <line data-median="" {...segment(at(mark.median, -inset), at(mark.median, inset))} stroke={neutral} strokeWidth="2" strokeLinecap="round" />
                {mark.outliers.map((outlier, i) => {
                  const [cx, cy] = at(outlier);
                  return <circle key={i} data-outlier="" cx={cx} cy={cy} r="3" fill={color} opacity=".55" />;
                })}
              </>}
            </g>;
          })}
          {selectedDot && <circle data-distribution-focus="" cx={selectedDot.x} cy={selectedDot.y} r={selectedDot.radius + 1.5} fill={selectedDot.color} />}
        </g>
      </svg>
      {loading && !compact && <output className="reference-distribution-loading" style={{
        inset: `${top}px ${width - right}px ${height - bottom}px ${left}px`,
      }}>{swarm ? "Loading deploys" : "Loading page loads"}</output>}
      {!compact && !loading && <div className="reference-distribution-readout" role="status" style={{
        left: Math.max(4, Math.min(width - panelWidth - 4, tooltipX)),
        top: Math.max(4, Math.min(height - panelHeight - 4, tooltipY)),
        maxWidth: Math.max(0, width - 12),
      }}>
        {active !== null && fields.length > 0 && <CartesianReadout label={tipName} entries={fields} live={false} />}
      </div>}
    </div>
    {!compact && <div className="reference-distribution-footer">
      <strong>{nextLabel}</strong><span>{note}</span>
    </div>}
  </div>;
}
