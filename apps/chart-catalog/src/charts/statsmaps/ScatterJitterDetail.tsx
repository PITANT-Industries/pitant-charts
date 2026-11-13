import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { GitPullRequest } from "lucide-react";
import { CartesianDatePill, CartesianReadout } from "../cartesian/CartesianFocus";
import { usePlotSize } from "../usePlotSize";
import type { DemoProps } from "./primitives";
import { jitterKeyboardOrder, jitterMonths, jitterSamples } from "./scatter-jitter-fixture";
import "./scatter-jitter-detail.css";

const series = ["Auto-merged", "Reviewed"] as const;
const colors = ["var(--chart-1)", "var(--chart-2)"] as const;
const lineFormatter = new Intl.NumberFormat("en");
const tickValues = [0, 500, 1_000, 1_500, 2_000, 2_500];
const drawOrder = [0, 1].flatMap(group => jitterSamples.flatMap((sample, index) => sample[1] === group ? [index] : []));
const keyboardRank = new Map(jitterKeyboardOrder.map((index, rank) => [index, rank]));
const xPosition = (narrow: number, wide: number, width: number) => narrow + (wide - narrow) * (width - 286) / (728 - 286);

interface Selection {
  index: number;
  source: "keyboard" | "pointer";
}

export function ScatterJitterDetail({ compact }: DemoProps) {
  const id = useId();
  const { plot, width, height } = usePlotSize<SVGSVGElement>(728, 364);
  const [selected, setSelected] = useState<Selection | null>(null);
  const left = compact ? 24 : 56;
  const right = Math.max(left + 1, width - 8);
  const top = 8;
  const bottom = Math.max(top + 1, height - (compact ? 25 : 40));
  const points = useMemo(() => jitterSamples.map(([month, group, lines, narrowX, wideX]) => ({
    month,
    group,
    lines,
    x: xPosition(narrowX, wideX, width),
    y: bottom - lines * (bottom - top) / 2_800,
  })), [width, bottom]);
  const monthTicks = jitterMonths.map(([month, narrowX, wideX]) => ({
    month,
    x: xPosition(narrowX, wideX, width),
  }));
  const active = selected ? points[selected.index] : undefined;
  const activeMonth = active && monthTicks[active.month];
  const focusX = selected?.source === "keyboard" ? activeMonth?.x : active?.x;
  const tooltipWidth = active?.group === 0 ? 196 : 185;
  const readoutLeft = focusX === undefined ? 0 : focusX + tooltipWidth + 16 <= width
    ? focusX + 16
    : Math.max(0, focusX - tooltipWidth - 16);
  const tickY = (value: number) => bottom - value * (bottom - top) / 2_800;

  function selectAtPointer(event: PointerEvent<SVGSVGElement>) {
    if (compact) return;
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    if (x < left || x > right || y < top || y > bottom) {
      setSelected(null);
      return;
    }
    let nearest = 0;
    let nearestDistance = Infinity;
    for (const index of drawOrder) {
      const point = points[index];
      const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
      if (distance >= nearestDistance) continue;
      nearest = index;
      nearestDistance = distance;
    }
    setSelected(current => current?.index === nearest && current.source === "pointer" ? current : { index: nearest, source: "pointer" });
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    const rank = selected ? (keyboardRank.get(selected.index) ?? 0) : -1;
    const last = jitterKeyboardOrder.length - 1;
    const next = {
      Home: 0,
      End: last,
      ArrowRight: rank + 1,
      ArrowDown: rank + 1,
      ArrowLeft: rank < 0 ? last : rank - 1,
      ArrowUp: rank < 0 ? last : rank - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setSelected({ index: jitterKeyboardOrder[Math.min(last, Math.max(0, next))], source: "keyboard" });
    } else if (event.key === "Escape" && selected) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
    }
  }

  return <div className="scatter-jitter-detail" data-compact={compact || undefined}>
    {!compact && <header className="scatter-jitter-header">
      <div className="scatter-jitter-title" id={id + "-title"}>Scatter Chart - Jitter</div>
      <p>Lines changed per merged pull request, 2026</p>
    </header>}
    <div className="scatter-jitter-surface">
      <svg ref={plot} className="scatter-jitter-plot cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`}
        role="img" aria-roledescription="chart" aria-label={compact ? "Scatter Chart - Jitter" : undefined}
        aria-labelledby={compact ? undefined : id + "-title"} aria-describedby={id + "-description"}
        tabIndex={compact ? undefined : 0}
        onBlur={() => setSelected(null)}
        onKeyDown={handleKey}
        onPointerMove={selectAtPointer}
        onPointerUp={event => { if (event.pointerType === "touch") selectAtPointer(event); }}
        onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}>
        <desc id={id + "-description"}>Lines changed per merged pull request in 2026.{!compact && " Use the arrow keys to inspect each point."}</desc>
        <defs>
          <linearGradient id={id + "-grid"} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
            <stop stopColor="var(--border)" stopOpacity={0} />
            <stop offset=".1" stopColor="var(--border)" />
            <stop offset=".9" stopColor="var(--border)" />
            <stop offset="1" stopColor="var(--border)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g aria-hidden="true" fill="var(--muted-foreground)" fontSize={compact ? 9 : 12}>
          {tickValues.map(value => <g key={value}>
            <line x1={left} x2={right} y1={tickY(value)} y2={tickY(value)} stroke={`url(#${id}-grid)`} strokeDasharray="4 4" />
            {!compact && <text x={left - 4} y={tickY(value)} textAnchor="end" dominantBaseline="middle">
              {value < 1_000 ? value : value / 1_000 + "k"}
            </text>}
          </g>)}
          <line data-jitter-threshold="" x1={left} x2={right} y1={tickY(500)} y2={tickY(500)}
            stroke="color-mix(in oklab, var(--muted-foreground) 21%, var(--border))" strokeDasharray="4 4" />
          {monthTicks.map(({ month, x }, index) => (!compact || index % 3 === 0) && <text key={month} x={x}
            y={bottom + (compact ? 17 : 24)} textAnchor="middle"
            opacity={focusX === undefined ? 1 : Math.min(1, Math.max(0, (Math.abs(x - focusX) - 30) / 83))}>{month.slice(0, 3)}</text>)}
        </g>
        <g aria-hidden="true" opacity={active ? .3 : 1}>
          {drawOrder.map(index => {
            const point = points[index];
            return <circle key={index} data-jitter-point={index} data-jitter-series={series[point.group]}
              cx={point.x} cy={point.y} r={compact ? 1.5 : 3} fill={colors[point.group]} />;
          })}
        </g>
        {active && <circle data-jitter-active="" aria-hidden="true" cx={active.x} cy={active.y} r={4} fill={colors[active.group]} />}
        {focusX !== undefined && activeMonth && <CartesianDatePill x={Math.max(28, Math.min(width - 28, focusX))}
          y={bottom + 4} label={activeMonth.month.slice(0, 3)} text="var(--primary)" surface="var(--primary-foreground)" width={55} />}
      </svg>
      {!compact && <div role="status" className="scatter-jitter-readout" style={{ left: readoutLeft }}>
        {active && activeMonth && <CartesianReadout live={false} label={activeMonth.month + " 2026"} entries={[
          { name: series[active.group], value: lineFormatter.format(active.lines) + " lines", color: colors[active.group] },
        ]} />}
      </div>}
    </div>
    {!compact && <footer className="scatter-jitter-footer">
      <div>Every auto-merged PR stayed under 500 lines <GitPullRequest size={16} aria-hidden="true" /></div>
      <p>242 auto-merged and 280 reviewed pull requests</p>
    </footer>}
  </div>;
}
