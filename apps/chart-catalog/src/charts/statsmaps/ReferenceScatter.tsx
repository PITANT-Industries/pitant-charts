import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CartesianDatePill, CartesianReadout, cartesianPillWidth } from "../cartesian/CartesianFocus";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { scatterFixtures, type ScatterKind } from "./scatter-fixtures";
import type { DemoProps } from "./primitives";
import "./reference-scatter.css";

const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const dayMs = 86_400_000;
const seriesGeometry = {
  default: { radius: 4, ring: 8, stroke: 2, inset: 15, dim: .5, blur: true },
  rings: { radius: 5, ring: 10, stroke: 2, inset: 16, dim: .4, blur: true },
  solid: { radius: 4, ring: 0, stroke: 0, inset: 14, dim: .3, blur: false },
  outline: { radius: 4.25, ring: 7.75, stroke: 1.5, inset: 15, dim: .3, blur: false },
};

export function ReferenceScatter({ example, compact, kind }: DemoProps & { kind: ScatterKind }) {
  const { plot, width, height } = usePlotSize<SVGSVGElement>(728, 364);
  const theme = useChartTheme();
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const fixture = scatterFixtures[kind];
  const geometry = seriesGeometry[kind];
  const count = fixture.series[0].values.length;
  const left = Math.min(compact ? 20 : 40, width / 5);
  const right = Math.max(left + 1, width - left);
  const top = Math.min(compact ? 14 : 40, height / 3);
  const bottom = Math.max(top + 1, height - (compact ? 25 : 40));
  const inset = Math.min(geometry.inset, (right - left) / 4);
  // The reference spaces dates by elapsed time across the October clock change.
  const time = (i: number) => i * fixture.dayStep + (fixture.clockChangeAt !== undefined && i >= fixture.clockChangeAt ? 1 / 24 : 0);
  const x = (i: number) => left + inset + time(i) / time(count - 1) * (right - left - 2 * inset);
  const y = (v: number) => bottom - v / fixture.cap * (bottom - top);
  const xDate = (i: number) => Date.UTC(2026, fixture.start[0] - 1, fixture.start[1]) + i * fixture.dayStep * dayMs;
  const label = (i: number) => dateLabel.format(xDate(i));
  const yLabel = (v: number) => kind === "solid" ? `${v} ms` : `${v}%`;
  const ticks = Array.from({ length: 1 + Math.floor(fixture.cap / fixture.interval) }, (_, i) => i * fixture.interval);
  const tickIndices = compact && fixture.ticks.length > 4 ? [fixture.ticks[0], fixture.ticks[2], fixture.ticks.at(-1)!] : fixture.ticks;
  const focusX = active === null ? 0 : x(active);
  const focusLabel = active === null ? "" : label(active);
  const pillWidth = cartesianPillWidth(focusLabel);
  const pillX = Math.max(pillWidth / 2, Math.min(width - pillWidth / 2, focusX));
  const select = (event: PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    if (point.x < left || point.x > right || point.y < top || point.y > bottom) {
      setActive(null);
      return;
    }
    let index = 0;
    for (let i = 1; i < count; i++) if (Math.abs(x(i) - point.x) < Math.abs(x(index) - point.x)) index = i;
    setActive(index);
  };
  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    const next = { Home: 0, End: count - 1, ArrowRight: active === null ? 0 : active + 1, ArrowDown: active === null ? 0 : active + 1,
      ArrowLeft: active === null ? count - 1 : active - 1, ArrowUp: active === null ? count - 1 : active - 1 }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(Math.max(0, Math.min(count - 1, next)));
    } else if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
    }
  };
  const color = (i: number) => theme.colors[i];
  const panelWidth = kind === "solid" ? 177 : kind === "outline" ? 170 : 140;
  const anchor = focusX + panelWidth + 20 <= width ? focusX + 16 : focusX - panelWidth - 16;
  const panelLeft = Math.max(4, Math.min(width - panelWidth - 4, anchor));
  const outlineStroke = `color-mix(in oklab, ${theme.muted} 35%, ${theme.surface})`;

  return <div className="reference-scatter">
    <svg ref={plot} className="reference-scatter-plot cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={example.title}
      tabIndex={compact ? undefined : 0} onFocus={() => setActive(current => current ?? 0)} onBlur={() => setActive(null)} onKeyDown={keyboard}
      onPointerMove={select} onPointerUp={event => { if (event.pointerType === "touch") select(event); }}
      onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }}>
      <defs>
        <linearGradient id={`${uid}-grid`} gradientUnits="userSpaceOnUse" x1={left} x2={right}><stop stopColor={theme.grid} stopOpacity="0" /><stop offset=".1" stopColor={theme.grid} /><stop offset=".9" stopColor={theme.grid} /><stop offset="1" stopColor={theme.grid} stopOpacity="0" /></linearGradient>
        <linearGradient id={`${uid}-guide`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}><stop stopColor={theme.muted} stopOpacity="0" /><stop offset=".1" stopColor={theme.muted} stopOpacity=".8" /><stop offset=".9" stopColor={theme.muted} stopOpacity=".8" /><stop offset="1" stopColor={theme.muted} stopOpacity="0" /></linearGradient>
      </defs>
      <g aria-hidden="true" fontSize={compact ? 9 : 12} fill={theme.muted}>
        {ticks.map(v => <g key={v}>
          <line data-scatter-grid="" x1={left} x2={right} y1={y(v)} y2={y(v)} stroke={`url(#${uid}-grid)`} strokeDasharray="4 4" />
          {(kind === "solid" || kind === "outline") && !compact && <text x={left - 4} y={y(v)} textAnchor="end" dominantBaseline="central">{yLabel(v)}</text>}
        </g>)}
        {tickIndices.map(i => <text key={i} x={x(i)} y={bottom + (compact ? 17 : 24)} textAnchor="middle"
          opacity={active !== null && Math.abs(x(i) - pillX) < pillWidth / 2 + 13 ? 0 : 1}>{label(i)}</text>)}
      </g>
      {active !== null && <line data-scatter-guide="" x1={focusX} x2={focusX} y1={top} y2={bottom} stroke={`url(#${uid}-guide)`} aria-hidden="true" />}
      {fixture.series.map(row => <g key={row.name} aria-hidden="true">
        {row.values.map((value, index) => {
          const inactive = active !== null && active !== index;
          const cx = x(index);
          const cy = y(value);
          const scale = compact ? .7 : 1;
          const tone = color(row.color);
          return <g key={index} data-scatter-sample={index} data-series={row.name} className="reference-scatter-mark" opacity={inactive ? geometry.dim : 1}
            style={{ filter: inactive && geometry.blur ? "blur(2px)" : undefined }}>
            {kind === "outline" && <circle cx={cx} cy={cy} r={9 * scale} fill="none" stroke={outlineStroke} />}
            <circle data-scatter-dot="" cx={cx} cy={cy} r={geometry.radius * scale} fill={tone} stroke={geometry.stroke ? tone : undefined} strokeWidth={geometry.stroke * scale} />
            {geometry.ring > 0 && <circle data-scatter-ring="" cx={cx} cy={cy} r={geometry.ring * scale} fill="none" stroke={tone} strokeWidth={geometry.stroke * scale} />}
          </g>;
        })}
      </g>)}
      {active !== null && !compact && <CartesianDatePill x={pillX} y={bottom + 4} label={focusLabel} text={theme.text} surface={theme.surface} />}
    </svg>
    {!compact && <div role="status" className="reference-scatter-readout" style={{ left: panelLeft, top, width: panelWidth }}>
      {active !== null && <CartesianReadout live={false} label={fullDate.format(xDate(active))} entries={fixture.series.map(row => ({
        name: row.name, color: color(row.color), value: kind === "solid" || kind === "outline" ? yLabel(row.values[active]) : row.values[active],
      }))} />}
    </div>}
  </div>;
}
