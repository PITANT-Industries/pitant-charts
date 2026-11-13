import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { EChartsOption, EChartsType } from "echarts";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import type { ChartPreviewProps } from "../../types";
import { Choices } from "../../ui/Choices";
import { EChart } from "../EChart";
import { useChartTheme } from "../theme";
import { ShadcnBasics } from "./ShadcnBasics";
import { AreaDetail, detailedAreas } from "./AreaDetail";
import { AreaCatalog, isCatalogArea } from "./AreaCatalog";
import { SparklineExamples } from "./Sparkline";
import { AdvancedCartesian } from "./AdvancedCartesian";
import { Candles } from "./Candles";
import { LiveLine } from "./LiveLine";
import { ComposedDetail } from "./ComposedDetail";
import { ReferenceBar } from "./ReferenceBar";
import { detailedLines, LineDetail } from "./LineDetail";
import { isLineTable, LineTableDetail } from "./LineTableDetail";
import { LineSyncExportDetail } from "./LineSyncExportDetail";
import { LineZoomDetail } from "./LineZoomDetail";
import { isLineBrushVariant, LineBrushDetail } from "./LineBrushDetail";
import { LineLargeDetail } from "./LineLargeDetail";
import { DeadlineFills, downloadLineChart, LineLegend, LineLoadToggle, LineSkeleton } from "./LineExtras";
import { buildGantt, buildStream } from "./comparisons";
import { buildDiverging, buildDumbbell, buildLollipop, buildRanking, buildWaterfall, divergingColor } from "./comparison-options";
import { initialLargeCount, minuteLatency, resolveData, type CartesianData } from "./data";
import { buildLine, categoryAxis, colorFor, initialControls, up, down, valueFormat, type ChartTheme, type Controls } from "./options";
import { buildArea } from "./area-options";
import { clampBrush, RangeBrush, type BrushRange } from "./Brush";
import "./styles.css";
import "./area-styles.css";

const basics = new Set(["area-default", "bar-default", "line-default"]);
const connected = new Set(["line-synced", "area-small-multiples"]);
const brushExamples = new Set(["line-segment", "area-selection"]);
const overviewExamples = new Set(["line-brush", "line-linked-brush", "line-date-highlights-brush"]);
const countChoices = [10000, 50000, 100000].map(count => ({ value: String(count), label: `${count / 1000}k points` }));
const fillChoices = ["Solid", "Gradient", "Pattern"].map(value => ({ value, label: value }));
const trendChoices = ["Dashed", "Solid", "Gradient"].map(value => ({ value, label: value }));
const loadChoices = ["Pulse", "Sweep", "Loaded"].map(value => ({ value, label: value }));
const areaTotals = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const lineRangeChoices = [7, 30, 90].map(days => ({ value: String(days), label: `${days}d`, ariaLabel: `${days} days` }));

function sliceRange(data: CartesianData, [start, end]: BrushRange): CartesianData {
  return {
    categories: data.categories.slice(start, end + 1),
    series: data.series.map(item => ({ ...item, values: item.values.slice(start, end + 1) })),
    rows: data.rows?.slice(start, end + 1),
  };
}

function getOption(example: ChartPreviewProps["example"], data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls, loading = false): EChartsOption {
  switch (example.family) {
    case "area": return buildArea(example, data, theme, compact, controls, loading);
    case "diverging": return buildDiverging(example, data, theme, compact, controls.activeLegend, loading);
    case "dumbbell": return buildDumbbell(example, data, theme, compact, controls.activeLegend, loading);
    case "gantt": return buildGantt(example, data, theme, compact, loading);
    case "lollipop": return buildLollipop(example, data, theme, compact, loading);
    case "slope":
    case "bump": return buildRanking(example, data, theme, compact, controls.activeLegend, loading);
    case "stream": return buildStream(example, data, theme, compact, loading);
    case "waterfall": return buildWaterfall(example, data, theme, compact, loading);
    default: return buildLine(example, data, theme, compact, controls, loading);
  }
}

export default function Cartesian(props: ChartPreviewProps) {
  const theme = useChartTheme();
  const { example, compact = false } = props;
  const denseDemo = !props.data && example.id === "line-large-data";
  const source = useMemo(() => denseDemo ? null : resolveData(example, props.data), [denseDemo, example, props.data]);
  if (source === null) return <LineLargeDetail key={example.id} label={example.title} compact={compact} theme={theme} />;
  if (example.family === "candlestick") return <Candles key={example.id} example={example} data={source} compact={compact} theme={theme} />;
  if (example.family === "live-line") return <LiveLine key={example.id} example={example} data={source} compact={compact} theme={theme} demo={!props.data} />;
  if (example.family === "composed") return <ComposedDetail key={example.id} example={example} data={source} compact={compact} theme={theme} demo={!props.data} />;
  if (example.id === "bar-stacked" || example.id === "line-threshold") return <AdvancedCartesian key={example.id} variant={example.id} label={example.title} data={source} compact={compact} theme={theme} />;
  if (example.family === "bar" && example.id !== "bar-default") return <ReferenceBar key={example.id} example={example} data={source} compact={compact} theme={theme} demo={!props.data} />;
  if (!props.data && isLineTable(example.id)) return <LineTableDetail key={example.id} variant={example.id} label={example.title} data={source} compact={compact} theme={theme} />;
  if (example.id === "line-synced" || example.id === "line-export") return <LineSyncExportDetail key={example.id} example={example} data={source} compact={compact} theme={theme} demo={!props.data} />;
  if (!props.data && example.id === "line-zoom") return <LineZoomDetail key={example.id} label={example.title} compact={compact} theme={theme} />;
  if (!props.data && isLineBrushVariant(example.id)) return <LineBrushDetail key={example.id} variant={example.id} label={example.title} compact={compact} theme={theme} />;
  if (!props.data && Object.hasOwn(detailedLines, example.id)) return <LineDetail key={example.id} variant={example.id as keyof typeof detailedLines} label={example.title} data={source} compact={compact} theme={theme} fixture />;
  const area = example.id as keyof typeof detailedAreas;
  if (!props.data && Object.hasOwn(detailedAreas, area)) return <AreaDetail key={area} variant={area} label={example.title} data={source} compact={compact} theme={theme} />;
  if (!props.data && isCatalogArea(example.id)) return <AreaCatalog key={example.id} variant={example.id} label={example.title} data={source} compact={compact} theme={theme} />;
  return <CartesianExample key={example.id} example={example} compact={compact} data={props.data} source={source} theme={theme} />;
}

function CartesianExample({ example, compact = false, data, theme, source }: ChartPreviewProps & { theme: ChartTheme; source: CartesianData }) {
  const [controls, setControls] = useState<Controls>(() => example.id === "line-time-range" ? { ...initialControls, range: 90 } : initialControls);
  const [isLoading, setLoading] = useState(example.id.endsWith("-loading") || example.id === "line-loading-placeholder");
  const [placeholder, setPlaceholder] = useState(example.id === "area-loading" ? "Pulse" : "Sweep");
  const [viewTable, setViewTable] = useState(false);
  const [focusedRow, setFocusedRow] = useState(-1);
  const [exportFailed, setExportFailed] = useState(false);
  const chartRef = useRef<EChartsType>(null);
  const [pointCrosshair, setPointCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ left: number; right: number } | null>(null);
  const selectionDrag = useRef<{ pointer: number; position: number; index: number } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const overview = overviewExamples.has(example.id);
  const [rangeOverride, setRangeOverride] = useState<BrushRange | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const connection = useId();
  const { id, family } = example;
  const startLoading = id.endsWith("-loading") || id === "line-loading-placeholder";
  const split = connected.has(id) || id === "line-linked-brush";
  const linked = id === "line-table";
  const tableToggle = id === "chart-data-table";
  const range = id === "line-time-range";
  const brushes = brushExamples.has(id);
  const pointOnly = id === "line-crosshair-point";
  const emphasizePoint = id === "line-points" || id === "line-glow";
  const powerUser = id === "line-large-data";
  const zoom = id === "line-zoom";
  const renderer = powerUser ? "canvas" : "svg";
  const lineLegend = id === "line-legend" || id === "line-export";
  const comparisonLegend = id === "dumbbell-legend" || id === "bump-ascending" || id === "diverging-legend";
  const sideLegend = id === "line-legend" || comparisonLegend;
  const chartLegend = lineLegend || comparisonLegend;
  const comparisonFamily = ["waterfall", "lollipop", "dumbbell", "bump", "slope", "diverging", "stream"].includes(family);
  const comparisonLoading = isLoading && comparisonFamily;
  const loadingMessage = family === "waterfall" ? "Fetching cash flows…" : family === "lollipop" ? "Fetching sessions…" : family === "bump" ? "Fetching standings…"
    : family === "diverging" ? "Fetching answers…" : family === "stream" ? "Fetching traffic…" : "Fetching survey results…";
  const lineLoading = id === "line-loading" || id === "line-loading-placeholder";
  const lastCategory = Math.max(0, source.categories.length - 1);
  const firstVisible = id === "line-linked-brush" ? Math.round(lastCategory * 0.66) : 0;
  const [brushStart, brushEnd] = clampBrush(rangeOverride ?? [firstVisible, lastCategory], lastCategory);

  useEffect(() => {
    const host = plotRef.current;
    if (!zoom || compact || !host) return;
    function zoomFromWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.deltaY) return;
      const chart = chartRef.current;
      const bounds = host?.getBoundingClientRect();
      if (!chart || !bounds) return;
      const position = [event.clientX - bounds.left, event.clientY - bounds.top];
      if (!chart.containPixel({ gridIndex: 0 }, position)) return;
      event.preventDefault();
      const windows = chart.getOption().dataZoom as { start?: number; end?: number }[] | undefined;
      const start = windows?.[0]?.start ?? 0, end = windows?.[0]?.end ?? 100;
      const origin = Math.min(end, Math.max(start, Number(chart.convertFromPixel({ xAxisIndex: 0 }, position[0])) / Math.max(1, lastCategory) * 100));
      const factor = event.deltaY < 0 ? 0.82 : 1 / 0.82;
      const nextStart = Math.max(0, origin + (start - origin) * factor), nextEnd = Math.min(100, origin + (end - origin) * factor);
      if (nextEnd - nextStart >= 1) chart.dispatchAction({ type: "dataZoom", start: nextStart, end: nextEnd });
    }
    host.addEventListener("wheel", zoomFromWheel, { passive: false, capture: true });
    return () => host.removeEventListener("wheel", zoomFromWheel, true);
  }, [compact, lastCategory, zoom]);

  useEffect(() => {
    if (id !== "line-date-highlights-brush" || compact) return;
    const host = split ? panelsRef.current : plotRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(host);
    return () => observer.disconnect();
  }, [compact, id, split]);

  const optionsData = useMemo((): CartesianData => {
    if (range) {
      return {
        categories: source.categories.slice(-controls.range),
        series: source.series.map(item => ({ ...item, values: item.values.slice(-controls.range) })),
        rows: source.rows?.slice(-controls.range),
      };
    }
    if (overview && !compact) return sliceRange(source, [brushStart, brushEnd]);
    if (powerUser && !data) return controls.count === initialLargeCount ? source : minuteLatency(controls.count);
    return source;
  }, [brushEnd, brushStart, compact, controls.count, controls.range, data, overview, powerUser, range, source]);

  const view = useMemo(() => overview ? { ...controls, brushOffset: compact ? 0 : brushStart, brushLength: source.categories.length, chartWidth }
    : controls, [overview, controls, compact, brushStart, source.categories.length, chartWidth]);
  const option = useMemo(() => getOption(example, optionsData, theme, compact, view, isLoading), [example, optionsData, theme, compact, view, isLoading]);

  const splitOptions = useMemo(() => {
    if (!split) return [];
    let low = 0, high = 10;
    if (id === "area-small-multiples") for (const item of optionsData.series) {
      for (const value of item.values) if (typeof value === "number" && Number.isFinite(value)) {
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
    }
    return optionsData.series.map((item, index) => {
      const panel = getOption(example, { ...optionsData, series: [{ ...item, color: colorFor(item, index, theme) }] }, theme, compact, view);
      if (id === "area-small-multiples") panel.yAxis = { ...(Array.isArray(panel.yAxis) ? panel.yAxis[0] : panel.yAxis), min: Math.floor(low / 10) * 10, max: Math.ceil(high / 10) * 10 };
      if ((id === "line-linked-brush" || id === "line-synced") && index !== optionsData.series.length - 1) {
        const axis = categoryAxis(optionsData.categories, theme);
        panel.xAxis = { ...axis, axisLabel: { ...axis.axisLabel, show: false } };
        panel.grid = { top: 8, bottom: 6, left: compact ? 29 : 48, right: 15 };
      }
      return { item, panel };
    });
  }, [split, optionsData, id, example, theme, compact, view]);

  function update<Value extends keyof Controls>(name: Value, value: Controls[Value]) {
    setControls(previous => ({ ...previous, [name]: value }));
  }

  function showRow(index: number) {
    setFocusedRow(index);
    if (index >= 0) chartRef.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
    else chartRef.current?.dispatchAction({ type: "hideTip" });
  }

  async function exportFile(format: "svg" | "png") {
    const chart = chartRef.current;
    if (!chart) return;
    setExportFailed(false);
    try {
      await downloadLineChart(chart, format, theme.surface);
    } catch {
      setExportFailed(true);
    }
  }

  function updatePointCrosshair(index: number | undefined) {
    const chart = chartRef.current;
    const value = index === undefined ? undefined : optionsData.series[0]?.values[index];
    if (!chart || typeof value !== "number") {
      setPointCrosshair(null);
      return;
    }
    const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, [index, value]) as number[];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      setPointCrosshair(previous => previous?.x === x && previous.y === y ? previous : { x, y });
    }
  }

  function selectionPoint(event: PointerEvent<HTMLDivElement>, clamp = false) {
    const chart = chartRef.current;
    const bounds = plotRef.current?.getBoundingClientRect();
    if (!chart || !bounds || lastCategory < 1) return;
    const position = [event.clientX - bounds.left, event.clientY - bounds.top];
    if (!clamp && !chart.containPixel({ gridIndex: 0 }, position)) return;
    const index = Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, position[0]) as number);
    if (!Number.isFinite(index)) return;
    const safeIndex = Math.max(0, Math.min(lastCategory, index));
    return { index: safeIndex, position: chart.convertToPixel({ xAxisIndex: 0 }, safeIndex) as number };
  }

  function beginSelection(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const point = selectionPoint(event);
    if (!point) return;
    selectionDrag.current = { ...point, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragSelection(event: PointerEvent<HTMLDivElement>) {
    const start = selectionDrag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const end = selectionPoint(event, true);
    if (end) setDragRange({ left: Math.min(start.position, end.position), right: Math.max(start.position, end.position) });
  }

  function clearSelectionDrag() {
    selectionDrag.current = null;
    setDragRange(null);
  }

  function commitSelection(event: PointerEvent<HTMLDivElement>) {
    const start = selectionDrag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const end = selectionPoint(event, true);
    clearSelectionDrag();
    if (end && end.index !== start.index) update("selection", [Math.min(start.index, end.index), Math.max(start.index, end.index)]);
  }

  function selectionKey(event: KeyboardEvent<HTMLDivElement>) {
    const drag = selectionDrag.current;
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      event.stopPropagation();
      clearSelectionDrag();
      if (event.currentTarget.hasPointerCapture(drag.pointer)) event.currentTarget.releasePointerCapture(drag.pointer);
    }
  }

  const activePointIndex = useRef<number | undefined>(undefined);
  const onEvents: Record<string, (event: any) => void> | undefined = pointOnly || emphasizePoint ? {
    updateAxisPointer(event: { axesInfo?: { value: number; axisDim?: string }[] }) {
      const position = event.axesInfo?.find(axis => axis.axisDim === "x")?.value;
      if (pointOnly) updatePointCrosshair(position);
      if (!emphasizePoint || activePointIndex.current === position) return;
      activePointIndex.current = position;
      requestAnimationFrame(() => {
        if (position !== activePointIndex.current) return;
        chartRef.current?.dispatchAction({ type: "downplay", seriesIndex: 0 });
        if (position !== undefined) chartRef.current?.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: position });
      });
    },
    globalout() {
      if (pointOnly) updatePointCrosshair(undefined);
      activePointIndex.current = undefined;
      if (emphasizePoint) chartRef.current?.dispatchAction({ type: "downplay", seriesIndex: 0 });
    },
  } : linked ? {
    updateAxisPointer(event: { axesInfo?: { value: number }[] }) {
      const value = event.axesInfo?.[0]?.value;
      if (typeof value === "number") setFocusedRow(value);
    },
    globalout() { setFocusedRow(-1); },
  } : id === "line-markers" ? {
    updateAxisPointer(event: { axesInfo?: { value: number; axisDim?: string }[] }) {
      const position = event.axesInfo?.find(axis => axis.axisDim === "x")?.value;
      const events = typeof position === "number" ? optionsData.rows?.[position]?.events : undefined;
      const next = Array.isArray(events) && events.length > 1 ? position : undefined;
      if (controls.activeMarker !== next) requestAnimationFrame(() => update("activeMarker", next));
    },
    globalout() { if (controls.activeMarker !== undefined) update("activeMarker", undefined); },
  } : undefined;

  if (family === "sparkline") return <SparklineExamples example={example} data={source} compact={compact} theme={theme} />;
  if (basics.has(id)) return <ShadcnBasics family={family} data={source} theme={theme} label={example.title} compact={compact} fixture={!data} />;
  if (id === "line-deadline-fills") return <DeadlineFills example={example} data={source} theme={theme} compact={compact} controls={controls} />;

  const legends = id === "line-profit-loss-legend" ? [{ name: "Profit", color: up }, { name: "Loss", color: down }]
    : [];
  const selectionText = controls.selection ? controls.selection.map(index => optionsData.categories[index]).join(" – ") : "";
  const areaLoading = id === "area-loading" && isLoading;
  const liveLineLoading = id === "line-loading" && isLoading;
  const skeleton = isLoading && startLoading && family !== "gantt" && !areaLoading && !comparisonLoading && id !== "line-loading";
  const showControls = !compact && (range || brushes || startLoading && id !== "line-loading-placeholder" || tableToggle || id === "line-band-fill" || id === "line-trend"
    || id === "line-export" || powerUser || legends.length > 0);

  return (
    <div className={`cartesian-example${id === "area-small-multiples" ? " cartesian-area-multiples" : ""}`}>
      {showControls && <div className="cartesian-controls">
        {range && <Choices label="Time range" className="cartesian-choice-group" options={lineRangeChoices} value={String(controls.range)} onChange={days => update("range", Number(days))} />}
        {brushes && <>
          <span className="cartesian-muted">Drag across the chart to select a range</span>
          <Button disabled={!controls.selection} onClick={() => update("selection", null)}>Clear</Button>
          {selectionText && <output className="cartesian-muted" aria-live="polite">{selectionText}</output>}
        </>}
        {startLoading && !lineLoading && id !== "area-loading" && <Toggle pressed={isLoading} onPressedChange={setLoading}>{(id === "gantt-loading" || comparisonFamily) ? "Loading" : isLoading ? "Show data" : "Show loading"}</Toggle>}
        {id === "line-loading" && <LineLoadToggle loading={isLoading} onChange={setLoading} />}
        {id === "area-loading" && <Choices label="Chart state" className="cartesian-choice-group" options={loadChoices} value={isLoading ? placeholder : "Loaded"} onChange={mode => { setLoading(mode !== "Loaded"); if (mode !== "Loaded") setPlaceholder(mode); }} />}
        {id === "line-band-fill" && <Choices label="Band fill" className="cartesian-choice-group" options={fillChoices} value={controls.fill} onChange={fill => update("fill", fill)} />}
        {id === "line-trend" && <Choices label="Trend stroke" className="cartesian-choice-group" options={trendChoices} value={controls.trend} onChange={trend => update("trend", trend)} />}
        {id === "line-export" && <>
          <Button aria-label="Download SVG" onClick={() => void exportFile("svg")}>SVG</Button>
          <Button aria-label="Download PNG" onClick={() => void exportFile("png")}>PNG</Button>
          {exportFailed && <span role="status" className="cartesian-muted">Chart download failed. Try again.</span>}
        </>}
        {powerUser && !data && <Choices label="Points per series" className="cartesian-choice-group" options={countChoices} value={String(controls.count)} onChange={count => update("count", Number(count))} />}
        {tableToggle && <Toggle pressed={viewTable} onPressedChange={setViewTable}>{viewTable ? "View chart" : "View as table"}</Toggle>}
        {legends.map((item, index) => <Toggle key={index} pressed={index === controls.activeLegend} onMouseEnter={() => update("activeLegend", index)} onMouseLeave={() => update("activeLegend", undefined)} onFocus={() => update("activeLegend", index)} onBlur={() => update("activeLegend", undefined)} onPressedChange={pressed => update("activeLegend", pressed ? index : undefined)}><i className="cartesian-swatch" style={{ backgroundColor: item.color }} />{item.name}</Toggle>)}
      </div>}
      {skeleton ? lineLoading ? <LineSkeleton />
        : <ChartSkeleton family={family} label={example.title} effect={placeholder} /> : (
        <>
          {!viewTable && (family === "gantt" ? <div className={`cartesian-gantt-scroll${compact ? " cartesian-gantt-scroll--compact" : ""}`} data-gantt-layout={id} aria-busy={isLoading}>
            <div className={`cartesian-gantt-plot${isLoading ? " cartesian-gantt-plot--loading" : ""}`}>
              <EChart key={isLoading ? "loading" : "ready"} option={option} label={example.title} compact={compact} />
            </div>
          </div> : split ? <div className={`cartesian-panels ${id === "area-small-multiples" ? `cartesian-panels--multiples${compact ? " cartesian-panels--multiples-compact" : ""}` : ""}`} ref={panelsRef}>
            {(compact && id === "area-small-multiples" ? splitOptions.slice(0, 4) : splitOptions).map(({ item, panel }, index) => (
              <div className="cartesian-panel" key={index}>
                {id === "area-small-multiples" ? <div className="cartesian-area-region"><span>{item.name}</span><span>{areaTotals.format(item.values.reduce<number>((total, value) => total + (value ?? 0), 0))}</span></div> : <span>{item.name}</span>}
                <EChart option={panel} label={`${example.title}, ${item.name}`} compact={compact} group={connection} />
              </div>
            ))}
          </div> : <div className={chartLegend && !compact ? sideLegend ? "line-with-side-legend" : "line-with-footer-legend" : "line-single-plot"}>
          <div className={`cartesian-plot${liveLineLoading ? " line-chart-loading" : ""}${comparisonLoading ? " cartesian-comparison-loading" : ""}${brushes && !compact ? " cartesian-plot--selection" : ""}${id === "area-selection" ? " cartesian-area-selection" : ""}${areaLoading ? ` cartesian-area-loading cartesian-area-loading--${placeholder.toLowerCase()}` : ""}`} aria-busy={areaLoading || comparisonLoading || liveLineLoading || undefined} ref={plotRef}
            onDoubleClick={zoom && !compact ? () => chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 }) : undefined}
            onPointerDown={brushes && !compact ? beginSelection : undefined} onPointerUp={brushes && !compact ? commitSelection : undefined}
            onPointerCancel={brushes && !compact ? clearSelectionDrag : undefined} onLostPointerCapture={brushes && !compact ? clearSelectionDrag : undefined}
            onKeyDown={brushes && !compact ? selectionKey : pointOnly ? event => { if (event.key === "Escape") setPointCrosshair(null); } : undefined}
            onPointerMove={brushes && !compact ? dragSelection : undefined} onBlur={pointOnly ? () => setPointCrosshair(null) : undefined}>
            <EChart option={option} label={liveLineLoading ? "Loading chart" : example.title} compact={compact || areaLoading || comparisonLoading || liveLineLoading} chartRef={chartRef} renderer={renderer}
              mergeUpdates={range || id === "line-loading" || (startLoading && comparisonFamily)} onEvents={onEvents} />
            {liveLineLoading && <span className="line-skeleton-label" role="status">Loading revenue</span>}
            {areaLoading && <span className="cartesian-area-loading-status" role="status">Loading orders</span>}
            {comparisonLoading && <span className="cartesian-area-loading-status" role="status">{loadingMessage}</span>}
            {dragRange && <div className="cartesian-selection" aria-hidden="true" style={{ left: dragRange.left, width: dragRange.right - dragRange.left }} />}
            {pointOnly && pointCrosshair && <div className="cartesian-point-crosshair" aria-hidden="true"
              style={{ left: pointCrosshair.x, top: pointCrosshair.y, height: Math.max(0, (plotRef.current?.clientHeight ?? 0) - pointCrosshair.y - 25) }} />}
          </div>
          {chartLegend && !compact && <LineLegend currency={id === "line-export"} title={id === "dumbbell-legend" ? "Average score" : id === "bump-ascending" ? "June, seconds" : id === "diverging-legend" ? "Customers" : undefined}
            metric={id === "bump-ascending" ? item => item.values.at(-1) ?? 0 : id === "dumbbell-legend" ? item => {
              const values = item.values.filter((value): value is number => typeof value === "number");
              return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
            } : undefined} active={view.activeLegend}
            series={source.series.map((item, index) => ({ ...item, color: id === "diverging-legend" ? divergingColor(index, false, item.color) : colorFor(item, index, theme),
              name: id === "dumbbell-legend" && !data ? `${item.name} survey` : item.name }))}
            onActive={index => update("activeLegend", index)} />}
          </div>)}
          {overview && !compact && <RangeBrush data={source} range={[brushStart, brushEnd]} change={setRangeOverride} theme={theme} showLaunch={id === "line-date-highlights-brush"} />}
          {powerUser && !compact && <div className="cartesian-status">{valueFormat.format(optionsData.categories.length)} points per series{!data ? ` · ${Math.ceil(optionsData.categories.length / 1440)} days at one sample per minute` : ""}</div>}
          {zoom && !compact && <div className="cartesian-status">Ctrl or ⌘ and scroll to zoom · Drag to pan · Double-click to reset</div>}
          {id === "gantt-loading" && isLoading && !compact && <div className="cartesian-status" role="status">Loading schedule</div>}
          {!compact && (tableToggle || linked) && <DataTable data={optionsData} active={focusedRow} onActive={linked ? showRow : undefined} linked={linked} hidden={tableToggle && !viewTable} />}
        </>
      )}
    </div>
  );
}

function ChartSkeleton({ family, label, effect }: { family: string; label: string; effect: string }) {
  const columns = [28, 43, 34, 57, 46, 61, 52, 69, 60, 75, 66, 82];
  const discrete = ["bar", "gantt", "waterfall", "diverging", "dumbbell", "lollipop"].includes(family);
  return (
    <div className={`cartesian-skeleton ${effect === "Pulse" ? "cartesian-skeleton--pulse" : ""}`} aria-busy="true" role="status" aria-label={`Loading ${label}`}>
      <svg viewBox="0 0 380 124" preserveAspectRatio="none" aria-hidden="true">
        {[19, 48, 77, 106].map(y => <path key={y} d={`M12 ${y}H369`} fill="none" stroke="var(--border)" strokeDasharray="4 4" />)}
        {family === "gantt" ? columns.slice(0, 5).map((height, index) => <rect key={index} x={20 + index * 49} y={13 + index * 19} width={height * 1.8} height={10} rx={4} fill="var(--chart-2)" opacity={0.34} />)
          : discrete ? columns.map((height, index) => <rect key={index} x={20 + index * 29} y={108 - height} width={15} height={height} rx={4} fill="var(--chart-2)" opacity={0.31} />)
            : <>
              <path d="M12 93 C40 92 53 49 79 60 S114 92 142 72 175 37 199 57 233 85 264 49 303 67 327 40 352 46 369 30" fill="none" stroke="var(--chart-2)" opacity={0.47} strokeWidth="2.5" />
              {family === "area" || family === "stream" ? <path d="M12 93 C40 92 53 49 79 60 S114 92 142 72 175 37 199 57 233 85 264 49 303 67 327 40 352 46 369 30 L369 110H12Z" fill="var(--chart-2)" opacity={0.19} /> : null}
            </>}
      </svg>
      <span className="cartesian-muted">Loading data…</span>
    </div>
  );
}

function DataTable({ data, active, onActive, linked, hidden }: { data: CartesianData; active: number; onActive?: (index: number) => void; linked: boolean; hidden: boolean }) {
  const activeRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (!onActive || !activeRow.current) return;
    const row = activeRow.current;
    const container = row.closest(".cartesian-table");
    if (!container) return;
    const { top, bottom } = row.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    if (top < bounds.top || bottom > bounds.bottom) container.scrollTop += top - bounds.top - 33;
  }, [active, onActive]);

  return (
    <div className={`cartesian-table${hidden ? " line-table-screen-reader" : ""}`} tabIndex={hidden ? undefined : 0} role="region" aria-label="Chart data">
      <table>
        <thead><tr><th scope="col">{linked ? "Week of" : "Period"}</th>{data.series.map((item, index) => <th scope="col" key={index}>{item.name}</th>)}{linked && data.series.length >= 2 && <th scope="col">Conversion</th>}</tr></thead>
        <tbody>{data.categories.map((category, index) => <tr key={index} className={active === index ? "cartesian-row-active" : undefined}
          ref={active === index ? activeRow : undefined} tabIndex={onActive ? 0 : undefined}
          onPointerEnter={onActive ? () => onActive(index) : undefined} onPointerLeave={onActive ? () => onActive(-1) : undefined}
          onFocus={onActive ? () => onActive(index) : undefined} onBlur={onActive ? () => onActive(-1) : undefined}>
          <th scope="row">{category}</th>{data.series.map((item, column) => <td key={column}>{typeof item.values[index] === "number" ? valueFormat.format(item.values[index]!) : "–"}</td>)}
          {linked && data.series.length >= 2 && <td>{conversion(data, index)}</td>}
        </tr>)}</tbody>
      </table>
    </div>
  );
}

const conversionFormat = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

function conversion(data: CartesianData, index: number) {
  const trials = data.series[0].values[index], paid = data.series[1].values[index];
  return typeof trials === "number" && trials > 0 && typeof paid === "number" ? conversionFormat.format(paid / trials) : "–";
}
