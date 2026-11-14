import { area, curveMonotoneX, curveNatural, line } from "d3-shape";
import { Button } from "@ui-sdk/react/button";
import { Download } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { ChartExample, ChartSeries } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { toLocalTime } from "./line-detail-data";
import { lineCalendar, lineFormatTotal, lineFormatValue, lineValueScale } from "./line-input";
import { lineDateLabel } from "./line-format";
import { exportFixture, syncedFixture } from "./line-sync-export-fixtures";
import { downloadRevenueChart, type ExportFormat } from "./line-svg-download";
import { colorFor, type ChartTheme } from "./options";
import "./line-sync-export-detail.css";

const syncedDomains = [[1800, 500], [450, 200], [2, .5]] as const;
const compactMoney = new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const focusNames = ["Requests", "p95 latency", "Error rate"];
const isFiniteValue = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

type Focus = { panel: number; index: number };
type Point = { x: number; y: number; value: number | null };
type PlotProps = {
  label: string;
  categories: string[];
  series: ChartSeries[];
  rows?: CartesianData["rows"];
  theme: ChartTheme;
  compact: boolean;
  demo: boolean;
  panel?: number;
  bottomPanel?: boolean;
  focus: Focus | null;
  onFocusChange: (focus: Focus | null) => void;
  activeSeries?: number;
  svgRef?: RefObject<SVGSVGElement | null>;
};

function MetricPlot({ label, categories, series, rows, theme, compact, demo, panel, bottomPanel, focus, onFocusChange, activeSeries, svgRef }: PlotProps) {
  const id = useId();
  const synced = panel !== undefined;
  const panelIndex = panel ?? 0;
  const errors = panel === 2;
  const showDates = !synced || bottomPanel;
  const ratio = !synced ? 2 : bottomPanel ? 4 : 5;
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(577, 577 / ratio);
  const height = compact ? measuredHeight : width / ratio;
  const left = Math.min(compact ? 12 : synced ? 48 : 40, width * .24);
  const right = width - Math.min(compact ? 12 : synced ? 16 : 40, width * .24);
  const top = Math.min(compact ? 12 : synced ? 12 : 40, height * .36);
  const bottom = height - Math.min(compact ? 20 : synced ? bottomPanel ? 36 : 8 : 40, height * .51);
  const limits = synced ? syncedDomains[panelIndex] ?? [1, .25] : [40000, 10000];
  const domain = [0, limits[0]], tick = limits[1];
  const callerScale = useMemo(() => demo ? undefined : lineValueScale(series.map(item => item.values)), [demo, series]);
  const count = categories.length;
  const last = count - 1;
  const times = demo ? categories.map(toLocalTime) : lineCalendar({ categories, series, rows }).times ?? categories.map(() => undefined);
  const chronological = times.every((value, index) => value !== undefined && (index === 0 || value > times[index - 1]!));
  const start = chronological ? times[0] ?? 0 : 0;
  const end = chronological ? times[last] ?? start : Math.max(0, last);
  const x = (index: number) => start === end ? (left + right) / 2
    : left + ((chronological ? times[index]! : index) - start) / (end - start) * (right - left);
  const y = (value: number) => callerScale ? callerScale.position(value, bottom, top) : bottom - (value - domain[0]) / (domain[1] - domain[0]) * (bottom - top);
  const tickY = (value: number) => callerScale ? callerScale.positionUnit(value, bottom, top) : y(value);
  const coordinates = series.map(item => categories.map((_, index) => {
    const value = item.values[index];
    return { x: x(index), y: isFiniteValue(value) ? y(value) : NaN, value: isFiniteValue(value) ? value : null };
  }));
  const colors = series.map((item, index) => colorFor(item, synced ? errors ? 4 : panelIndex : index, theme));
  const curve = errors ? curveMonotoneX : curveNatural;
  const trace = line<Point>().defined(point => point.value !== null).x(point => point.x).y(point => point.y).curve(curve);
  const fill = area<Point>().defined(point => point.value !== null).x(point => point.x).y0(y(0)).y1(point => point.y).curve(curve);
  const ticks = callerScale?.ticks ?? Array.from({ length: Math.floor((domain[1] - domain[0]) / tick) + 1 }, (_, index) => domain[0] + index * tick);
  const sparse = compact || width < 324;
  const dateCount = Math.min(count, sparse ? 3 : 5);
  const dates = showDates ? demo ? synced ? sparse ? [0, 22, 44] : [0, 11, 22, 33, 44]
    : sparse ? [0, 6, 11] : [0, 3, 6, 9, 11] : Array.from({ length: dateCount }, (_, i) => Math.round(last * i / Math.max(1, dateCount - 1))) : [];
  const selection = focus && focus.index < count ? focus : null;
  const ownFocus = selection?.panel === panelIndex;
  const activeX = selection ? x(selection.index) : 0;
  const selectedCategory = selection ? categories[selection.index] : "";
  const pillWidth = cartesianPillWidth(selectedCategory);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, Math.round(activeX)));
  const entries = selection ? coordinates.flatMap((points, index) => {
    const point = points[selection.index];
    if (point.value === null) return [];
    const value = !demo ? lineFormatValue(point.value) : errors ? `${number.format(point.value)}%` : point.value;
    return [{ name: demo && synced ? focusNames[panelIndex] : series[index].name, value, color: colors[index], y: point.y }];
  }) : [];
  const readoutEntries = !demo && selection ? series.map((item, index) => {
    const value = item.values[selection.index];
    return { name: item.name, value: isFiniteValue(value) ? lineFormatValue(value) : "—", color: colors[index] };
  }) : entries;
  const tickLabel = (value: number) => {
    if (!demo) return callerScale!.format(value);
    if (!synced) return `$${number.format(value / 1000)}k`;
    if (panel === 0) return value === 0 ? "0" : `${number.format(value / 1000)}k`;
    return panel === 1 ? `${number.format(value)} ms` : `${number.format(value)}%`;
  };
  const tipWidth = Math.min(160, width - 8);
  const tipRight = activeX + 16 + tipWidth <= width || activeX - 16 < tipWidth;
  const readoutStyle = {
    top, left: tipRight ? Math.max(4, Math.min(width - tipWidth - 4, activeX + 16)) : undefined,
    right: tipRight ? undefined : width - activeX + 16,
  };

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || !count || event.type === "pointermove" && event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    if (px < left - 4 || px > right + 4 || py < top || py > bottom) {
      onFocusChange(null);
      return;
    }
    let nearest = 0;
    for (let index = 1; index < count; index++) {
      if (Math.abs(x(index) - px) < Math.abs(x(nearest) - px)) nearest = index;
    }
    onFocusChange({ panel: panelIndex, index: nearest });
  }

  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || !count) return;
    if (event.key === "Escape" && selection) {
      event.preventDefault();
      event.stopPropagation();
      onFocusChange(null);
      return;
    }
    const moves: Record<string, number> = {
      Home: 0, End: last,
      ArrowLeft: (selection?.index ?? count) - 1, ArrowUp: (selection?.index ?? count) - 1,
      ArrowRight: (selection?.index ?? -1) + 1, ArrowDown: (selection?.index ?? -1) + 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onFocusChange({ panel: panelIndex, index: Math.max(0, Math.min(last, next)) });
  }

  return <div className="line-sync-export-plot" data-line-layout={synced ? bottomPanel ? "bottom" : "metric" : "export"} ref={plot}>
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="cartesian-focus-surface" role="img" aria-roledescription="chart"
      aria-label={label} aria-describedby={compact ? undefined : `${id}-instructions`} tabIndex={!compact && count ? 0 : undefined}
      onPointerDown={inspect} onPointerMove={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") onFocusChange(null); }}
      onPointerCancel={() => onFocusChange(null)} onKeyDown={navigate} onBlur={() => onFocusChange(null)}>
      {!compact && <desc id={`${id}-instructions`}>Use the arrow keys to inspect each date. Home and End select the first and last. Escape clears the selection.</desc>}
      <defs>
        <linearGradient id={`${id}-grid`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
          {[0, 10, 90, 100].map(offset => <stop key={offset} offset={`${offset}%`} stopColor={theme.grid} stopOpacity={offset === 0 || offset === 100 ? 0 : 1} />)}
        </linearGradient>
        <linearGradient id={`${id}-guide`} x2="0%" y2="100%">
          {[0, 10, 90, 100].map(offset => <stop key={offset} offset={`${offset}%`} stopColor={theme.muted} stopOpacity={offset === 0 || offset === 100 ? 0 : 1} />)}
        </linearGradient>
        {errors && <linearGradient id={`${id}-area`} x2="0%" y2="100%">
          <stop stopColor={colors[0]} stopOpacity=".4" /><stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
        </linearGradient>}
        {!errors && colors.map((color, index) => <linearGradient key={index} id={`${id}-line-${index}`}>
          {[0, 15, 85, 100].map(offset => <stop key={offset} offset={`${offset}%`} stopColor={color} stopOpacity={offset === 0 || offset === 100 ? 0 : 1} />)}
        </linearGradient>)}
      </defs>
      <g aria-hidden="true">
        {ticks.map((value, index) => <line key={index} data-line-grid="" x1={left} x2={right} y1={tickY(value)} y2={tickY(value)}
          stroke={`url(#${id}-grid)`} strokeDasharray="4 4" />)}
        {coordinates.map((points, index) => <g key={index} data-line-metric={index}
          opacity={activeSeries !== undefined && activeSeries !== index ? .3 : 1}>
          {errors && <path data-line-error-fill="" d={fill(points) ?? undefined} fill={`url(#${id}-area)`} />}
          <path data-line-sync-export-trace="" d={trace(points) ?? undefined} fill="none" vectorEffect="non-scaling-stroke"
            stroke={errors ? colors[index] : `url(#${id}-line-${index})`} strokeWidth={errors ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
          {!demo && points.map((point, at) => point.value !== null && points[at - 1]?.value == null && points[at + 1]?.value == null
            ? <circle key={at} data-line-isolated-point={`${index}-${at}`} cx={point.x} cy={point.y} r={compact ? 2 : 3} fill={colors[index]} pointerEvents="none" /> : null)}
        </g>)}
        <g fontSize={compact ? 10 : 12} fill={theme.muted}>
          {dates.map(index => <text key={index} x={x(index)} y={bottom + (compact ? 13 : 24)} textAnchor="middle">{categories[index]}</text>)}
          {!compact && ticks.map((value, index) => <text key={index} x={left - 4} y={tickY(value)} textAnchor="end" dominantBaseline="middle">{tickLabel(value)}</text>)}
        </g>
      </g>
      {selection && <g data-line-sync-export-focus="" aria-hidden="true" pointerEvents="none">
        <rect x={activeX - .5} y={top} width={1} height={bottom - top} fill={`url(#${id}-guide)`} />
        {entries.map(({ y, color }, index) => <CartesianFocusPoint key={index} x={activeX} y={y} color={color} />)}
        {showDates && <CartesianDatePill x={pillX} y={bottom} label={selectedCategory} text={theme.text} surface={theme.surface} />}
      </g>}
    </svg>
    {!compact && <div className="line-sync-export-readout" role="status" aria-atomic="true" style={readoutStyle}>
      {ownFocus && readoutEntries.length > 0 && <CartesianReadout label={demo ? lineDateLabel(selectedCategory) : selectedCategory} entries={readoutEntries} live={false} />}
    </div>}
  </div>;
}

export function LineSyncExportDetail({ example, data, compact, theme, demo }: {
  example: ChartExample; data: CartesianData; compact: boolean; theme: ChartTheme; demo: boolean;
}) {
  const synced = example.id === "line-synced";
  const source = demo ? synced ? syncedFixture : exportFixture : data;
  const panels = useMemo(() => synced && !compact && source.series.length ? source.series.map(item => [item]) : [source.series], [compact, source, synced]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [hovered, setHovered] = useState<number>();
  const [focused, setFocused] = useState<number>();
  const [format, setFormat] = useState<ExportFormat>();
  const [exportFailed, setExportFailed] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const seriesFocus = hovered ?? focused;
  const totals = synced ? [] : source.series.map(item => demo ? compactMoney.format(item.values.reduce<number>((total, value) =>
    total + (isFiniteValue(value) ? value : 0), 0)).toLowerCase() : lineFormatTotal(item.values));
  useEffect(() => {
    if (!demo) { setFocus(null); setHovered(undefined); setFocused(undefined); }
  }, [demo, source]);

  async function save(next: ExportFormat) {
    if (format || !svg.current || !legend.current) return;
    setFormat(next);
    setExportFailed(false);
    try {
      await downloadRevenueChart(svg.current, legend.current, next, theme, example.title);
    } catch {
      setExportFailed(true);
    } finally {
      setFormat(undefined);
    }
  }

  return <div className="line-sync-export" data-line-example={example.id} data-compact={compact}>
    {!compact && !synced && <div className="line-export-actions">
      {(["svg", "png"] as const).map(kind => <Button key={kind} type="button" aria-label={`Download ${kind.toUpperCase()}`}
        aria-busy={format === kind || undefined} disabled={Boolean(format)} onClick={() => void save(kind)}>
        <Download size={16} aria-hidden="true" />{kind.toUpperCase()}
      </Button>)}
    </div>}
    {panels.map((series, index) => <div className="line-sync-export-panel" key={index}>
      {synced && !compact && panels.length > 1 && <div className="line-synced-title">{series[0]?.name}</div>}
      <MetricPlot label={synced && panels.length > 1 ? `${example.title}, ${series[0]?.name}` : example.title}
        categories={source.categories} series={series} rows={source.rows} compact={compact} theme={theme} demo={demo}
        panel={synced ? index : undefined} bottomPanel={synced && index === panels.length - 1}
        focus={focus} onFocusChange={setFocus} activeSeries={seriesFocus} svgRef={synced ? undefined : svg} />
    </div>)}
    {!compact && !synced && <div className="line-export-legend" ref={legend} aria-label={demo ? "Revenue by plan" : "Series totals"}>
      {source.series.map((series, index) => <Button key={index} type="button" className="line-export-legend-item"
        data-dimmed={seriesFocus !== undefined && seriesFocus !== index} onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }}
        onPointerLeave={() => setHovered(undefined)} onFocus={() => setFocused(index)} onBlur={() => setFocused(undefined)}>
        <i aria-hidden="true" style={{ backgroundColor: colorFor(series, index, theme) }} />
        <span>{series.name}</span><span>{totals[index]}</span>
      </Button>)}
    </div>}
    {exportFailed && <p className="line-export-status" role="status">The chart could not be downloaded. Try again.</p>}
    {!compact && synced && demo && <div className="line-synced-footer">
      <strong>Latency and errors spiked together on October 2</strong>
      <span>Hover any chart: the other two follow the same day</span>
    </div>}
  </div>;
}
