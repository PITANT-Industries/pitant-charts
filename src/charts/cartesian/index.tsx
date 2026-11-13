import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { EChartsOption, EChartsType } from "echarts";
import { Button } from "@ui-sdk/react/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { Toggle } from "@ui-sdk/react/toggle";
import type { ChartPreviewProps } from "../../types";
import { Choices } from "../../ui/Choices";
import { EChart } from "../EChart";
import { useChartTheme } from "../theme";
import { ShadcnBasics } from "./ShadcnBasics";
import { SparklineExamples } from "./Sparkline";
import { Candles } from "./Candles";
import { LiveLine } from "./LiveLine";
import { buildBar, buildComposed, buildDiverging, buildDumbbell, buildGantt, buildLollipop, buildRanking, buildStream, buildWaterfall } from "./comparisons";
import { initialLargeCount, minuteLatency, resolveData, type CartesianData } from "./data";
import { buildLine, categoryAxis, colorFor, initialControls, up, down, valueFormat, type ChartTheme, type Controls } from "./options";
import { clampBrush, RangeBrush, type BrushRange } from "./Brush";
import "./styles.css";

const basics = new Set(["area-default", "bar-default", "line-default"]);
const connected = new Set(["line-synced", "bar-synced", "area-small-multiples"]);
const brushExamples = new Set(["line-segment", "area-selection"]);
const overviewExamples = new Set(["line-brush", "line-linked-brush", "line-date-highlights-brush"]);
const rangeChoices = [7, 30, 90].map(days => ({ value: String(days), label: `${days} days` }));
const countChoices = [10000, 50000, 100000].map(count => ({ value: String(count), label: `${count / 1000}k points` }));
const fillChoices = ["Solid", "Gradient", "Hatched"].map(value => ({ value, label: value }));
const trendChoices = ["Dashed", "Solid", "Gradient"].map(value => ({ value, label: value }));
const loadChoices = ["Pulse", "Sweep", "Loaded"].map(value => ({ value, label: value }));
const exportFormats: { value: "svg" | "png"; label: string }[] = [{ value: "svg", label: "SVG" }, { value: "png", label: "PNG" }];

function sliceRange(data: CartesianData, [start, end]: BrushRange): CartesianData {
  return {
    categories: data.categories.slice(start, end + 1),
    series: data.series.map(item => ({ ...item, values: item.values.slice(start, end + 1) })),
    rows: data.rows?.slice(start, end + 1),
  };
}

function getOption(example: ChartPreviewProps["example"], data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls, loading = false): EChartsOption {
  switch (example.family) {
    case "bar": return buildBar(example, data, theme, compact);
    case "composed": return buildComposed(example, data, theme, compact);
    case "diverging": return buildDiverging(example, data, theme, compact);
    case "dumbbell": return buildDumbbell(example, data, theme, compact, controls);
    case "gantt": return buildGantt(example, data, theme, compact, loading);
    case "lollipop": return buildLollipop(example, data, theme, compact);
    case "slope":
    case "bump": return buildRanking(example, data, theme, compact);
    case "stream": return buildStream(example, data, theme, compact);
    case "waterfall": return buildWaterfall(example, data, theme, compact);
    default: return buildLine(example, data, theme, compact, controls);
  }
}

export default function Cartesian(props: ChartPreviewProps) {
  const theme = useChartTheme();
  const { example, compact = false } = props;
  const source = useMemo(() => resolveData(example, props.data), [example, props.data]);
  if (example.family === "candlestick") return <Candles key={example.id} example={example} data={source} compact={compact} theme={theme} />;
  if (example.family === "live-line") return <LiveLine key={example.id} example={example} data={source} compact={compact} theme={theme} demo={!props.data} />;
  return <CartesianExample key={example.id} example={example} compact={compact} data={props.data} source={source} theme={theme} />;
}

function CartesianExample({ example, compact = false, data, theme, source }: ChartPreviewProps & { theme: ChartTheme; source: CartesianData }) {
  const [controls, setControls] = useState<Controls>(initialControls);
  const [isLoading, setLoading] = useState(example.id.endsWith("-loading") || example.id === "line-loading-placeholder");
  const [placeholder, setPlaceholder] = useState("Sweep");
  const [pulsePaused, setPulsePaused] = useState(false);
  const [viewTable, setViewTable] = useState(false);
  const [focusedRow, setFocusedRow] = useState(-1);
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("svg");
  const chartRef = useRef<EChartsType>(null);
  const [pointCrosshair, setPointCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ left: number; right: number } | null>(null);
  const selectionDrag = useRef<{ pointer: number; position: number; index: number } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const overview = overviewExamples.has(example.id);
  const [rangeOverride, setRangeOverride] = useState<BrushRange | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [pulsePosition, setPulsePosition] = useState<[number, number] | null>(null);
  const connection = useId();
  const { id, family } = example;
  const startLoading = id.endsWith("-loading") || id === "line-loading-placeholder";
  const split = connected.has(id) || id === "line-linked-brush";
  const linked = id === "line-table";
  const tableToggle = id === "chart-data-table";
  const range = id === "line-time-range";
  const brushes = brushExamples.has(id);
  const pointOnly = id === "line-crosshair-point";
  const powerUser = id === "line-large-data";
  const zoom = id === "line-zoom";
  const barPulse = id === "bar-depth";
  const renderer = powerUser || id === "line-export" && exportFormat === "png" ? "canvas" : "svg";
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

  useEffect(() => {
    if (!barPulse) return;
    const chart = chartRef.current;
    const last = optionsData.categories.length - 1;
    const value = optionsData.series[0]?.values[last];
    if (!chart || typeof value !== "number") return;
    function placePulse() {
      const result = chart?.convertToPixel({ seriesIndex: 0 }, [last, value]) as number[] | undefined;
      if (!result || result.length !== 2 || result.some(position => !Number.isFinite(position))) return;
      setPulsePosition(current => current?.[0] === result[0] && current[1] === result[1] ? current : [result[0], result[1]]);
    }
    chart.on("finished", placePulse);
    placePulse();
    return () => { chart.off("finished", placePulse); };
  }, [barPulse, optionsData]);
  const splitOptions = useMemo(() => {
    if (!split) return [];
    const high = Math.ceil(Math.max(10, ...optionsData.series.flatMap(item => item.values.map(value => value ?? 0))) / 10) * 10;
    return optionsData.series.map((item, index) => {
      const panel = getOption(example, { ...optionsData, series: [{ ...item, color: colorFor(item, index, theme) }] }, theme, compact, view);
      if (id === "area-small-multiples") panel.yAxis = { ...(Array.isArray(panel.yAxis) ? panel.yAxis[0] : panel.yAxis), max: high };
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

  function exportFile() {
    const chart = chartRef.current;
    if (!chart) return;
    const url = exportFormat === "svg" ? chart.getSvgDataURL()
      : chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: theme.surface });
    if (!url) return;
    const link = document.createElement("a");
    link.download = `${id}.${exportFormat}`;
    link.href = url;
    link.click();
  }

  function movePointCrosshair(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;
    const host = plotRef.current;
    if (!chart || !host) return;
    const bounds = host.getBoundingClientRect();
    const position = [event.clientX - bounds.left, event.clientY - bounds.top];
    if (!chart.containPixel({ gridIndex: 0 }, position)) {
      setPointCrosshair(null);
      return;
    }
    const index = Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, position[0]) as number);
    const value = optionsData.series[0]?.values[index];
    if (typeof value !== "number") {
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

  const onEvents: Record<string, (event: any) => void> | undefined = linked ? {
    updateAxisPointer(event: { axesInfo?: { value: number }[] }) {
      const value = event.axesInfo?.[0]?.value;
      if (typeof value === "number") setFocusedRow(value);
    },
    globalout() { setFocusedRow(-1); },
  } : id === "line-markers" ? {
    updateAxisPointer(event: { axesInfo?: { value: number; axisDim?: string }[] }) {
      const position = event.axesInfo?.find(axis => axis.axisDim === "x")?.value;
      const next = position === 13 ? position : undefined;
      if (controls.activeMarker !== next) requestAnimationFrame(() => update("activeMarker", next));
    },
    globalout() { if (controls.activeMarker !== undefined) update("activeMarker", undefined); },
  } : undefined;

  if (family === "sparkline") return <SparklineExamples example={example} data={source} compact={compact} theme={theme} />;
  if (basics.has(id)) return <ShadcnBasics family={family} data={source} theme={theme} label={example.title} />;

  const legends = id === "line-profit-loss-legend" ? [{ name: "Profit", color: up }, { name: "Loss", color: down }]
    : id === "dumbbell-legend" ? source.series.slice(0, 2).map((item, index) => ({ name: item.name, color: colorFor(item, index, theme) })) : [];
  const selectionText = controls.selection ? controls.selection.map(index => optionsData.categories[index]).join(" – ") : "";
  const skeleton = isLoading && startLoading && family !== "gantt";
  const showControls = !compact && (range || brushes || startLoading || tableToggle || id === "line-band-fill" || id === "line-trend"
    || id === "line-export" || powerUser || id === "bar-depth" || legends.length > 0);

  return (
    <div className={`cartesian-example${id === "bar-depth" ? ` cartesian-depth${pulsePaused ? " cartesian-depth--paused" : ""}` : ""}`}>
      {showControls && <div className="cartesian-controls">
        {range && <Choices label="Time range" className="cartesian-choice-group" options={rangeChoices} value={String(controls.range)} onChange={days => update("range", Number(days))} />}
        {brushes && <>
          <span className="cartesian-muted">Drag across the chart to select a range</span>
          <Button disabled={!controls.selection} onClick={() => update("selection", null)}>Clear</Button>
          {selectionText && <output className="cartesian-muted" aria-live="polite">{selectionText}</output>}
        </>}
        {startLoading && !["line-loading-placeholder", "area-loading"].includes(id) && <Toggle pressed={isLoading} onPressedChange={setLoading}>{id === "gantt-loading" ? "Loading" : isLoading ? "Show data" : "Show loading"}</Toggle>}
        {id === "area-loading" && <Choices label="Chart state" className="cartesian-choice-group" options={loadChoices} value={isLoading ? placeholder : "Loaded"} onChange={mode => { setLoading(mode !== "Loaded"); if (mode !== "Loaded") setPlaceholder(mode); }} />}
        {id === "bar-depth" && <Toggle pressed={pulsePaused} onPressedChange={setPulsePaused}>{pulsePaused ? "Resume pulse" : "Pause pulse"}</Toggle>}
        {id === "line-band-fill" && <Choices label="Band fill" className="cartesian-choice-group" options={fillChoices} value={controls.fill} onChange={fill => update("fill", fill)} />}
        {id === "line-trend" && <Choices label="Trend stroke" className="cartesian-choice-group" options={trendChoices} value={controls.trend} onChange={trend => update("trend", trend)} />}
        {id === "line-export" && <>
          <span className="cartesian-muted">Format</span>
          <Select value={exportFormat} items={exportFormats} onValueChange={(next) => { if (next !== null) setExportFormat(next); }}>
            <SelectTrigger aria-label="Format"><SelectValue /><span aria-hidden="true">▾</span></SelectTrigger>
            <SelectContent className="cartesian-format-menu">
              {exportFormats.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportFile}>Download chart</Button>
        </>}
        {powerUser && !data && <Choices label="Points per series" className="cartesian-choice-group" options={countChoices} value={String(controls.count)} onChange={count => update("count", Number(count))} />}
        {tableToggle && <Toggle pressed={viewTable} onPressedChange={setViewTable}>{viewTable ? "View chart" : "View as table"}</Toggle>}
        {legends.map((item, index) => <Toggle key={index} pressed={index === controls.activeLegend} onMouseEnter={() => update("activeLegend", index)} onMouseLeave={() => update("activeLegend", undefined)} onFocus={() => update("activeLegend", index)} onBlur={() => update("activeLegend", undefined)} onPressedChange={pressed => update("activeLegend", pressed ? index : undefined)}><i className="cartesian-swatch" style={{ backgroundColor: item.color }} />{item.name}</Toggle>)}
      </div>}
      {skeleton ? <ChartSkeleton family={family} label={example.title} effect={placeholder} /> : (
        <>
          {!viewTable && (family === "gantt" ? <div className={`cartesian-gantt-scroll${compact ? " cartesian-gantt-scroll--compact" : ""}`} data-gantt-layout={id} aria-busy={isLoading}>
            <div className={`cartesian-gantt-plot${isLoading ? " cartesian-gantt-plot--loading" : ""}`}>
              <EChart key={isLoading ? "loading" : "ready"} option={option} label={example.title} compact={compact} />
            </div>
          </div> : split ? <div className={`cartesian-panels ${id === "area-small-multiples" ? "cartesian-panels--multiples" : ""}`} ref={panelsRef}>
            {(compact && id === "area-small-multiples" ? splitOptions.slice(0, 4) : splitOptions).map(({ item, panel }, index) => (
              <div className="cartesian-panel" key={index}>
                <span>{item.name}</span>
                <EChart option={panel} label={`${example.title}, ${item.name}`} compact={compact} group={connection} />
              </div>
            ))}
          </div> : <div className={`cartesian-plot${brushes && !compact ? " cartesian-plot--selection" : ""}`} ref={plotRef}
            onDoubleClick={zoom && !compact ? () => chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 }) : undefined}
            onPointerDown={brushes && !compact ? beginSelection : undefined} onPointerUp={brushes && !compact ? commitSelection : undefined}
            onPointerCancel={brushes && !compact ? clearSelectionDrag : undefined} onLostPointerCapture={brushes && !compact ? clearSelectionDrag : undefined}
            onKeyDown={brushes && !compact ? selectionKey : undefined}
            onPointerMove={brushes && !compact ? dragSelection : pointOnly ? movePointCrosshair : undefined} onPointerLeave={pointOnly ? () => setPointCrosshair(null) : undefined}>
            <EChart option={option} label={example.title} compact={compact} chartRef={chartRef} renderer={renderer}
              onEvents={onEvents} />
            {barPulse && pulsePosition && <span className="cartesian-bar-pulse" aria-hidden="true" style={{ left: pulsePosition[0] + 3, top: pulsePosition[1] - 3 }} />}
            {dragRange && <div className="cartesian-selection" aria-hidden="true" style={{ left: dragRange.left, width: dragRange.right - dragRange.left }} />}
            {pointOnly && pointCrosshair && <div className="cartesian-point-crosshair" aria-hidden="true"
              style={{ left: pointCrosshair.x, top: pointCrosshair.y, height: Math.max(0, (plotRef.current?.clientHeight ?? 0) - pointCrosshair.y - 25) }} />}
          </div>)}
          {overview && !compact && <RangeBrush data={source} range={[brushStart, brushEnd]} change={setRangeOverride} theme={theme} showLaunch={id === "line-date-highlights-brush"} />}
          {powerUser && !compact && <div className="cartesian-status">{valueFormat.format(optionsData.categories.length)} points per series{!data ? ` · ${Math.ceil(optionsData.categories.length / 1440)} days at one sample per minute` : ""}</div>}
          {zoom && !compact && <div className="cartesian-status">Ctrl or ⌘ and scroll to zoom · Drag to pan · Double-click to reset</div>}
          {id === "gantt-loading" && isLoading && !compact && <div className="cartesian-status" role="status">Loading schedule</div>}
          {!compact && (viewTable || linked) && <DataTable data={optionsData} active={focusedRow} onActive={linked ? showRow : undefined} />}
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

function DataTable({ data, active, onActive }: { data: CartesianData; active: number; onActive?: (index: number) => void }) {
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
    <div className="cartesian-table" tabIndex={0} role="region" aria-label="Chart data">
      <table>
        <thead><tr><th scope="col">Period</th>{data.series.map((item, index) => <th scope="col" key={index}>{item.name}</th>)}</tr></thead>
        <tbody>{data.categories.map((category, index) => <tr key={index} className={active === index ? "cartesian-row-active" : undefined}
          ref={active === index ? activeRow : undefined} tabIndex={onActive ? 0 : undefined}
          onPointerEnter={onActive ? () => onActive(index) : undefined} onPointerLeave={onActive ? () => onActive(-1) : undefined}
          onFocus={onActive ? () => onActive(index) : undefined} onBlur={onActive ? () => onActive(-1) : undefined}>
          <th scope="row">{category}</th>{data.series.map((item, column) => <td key={column}>{typeof item.values[index] === "number" ? valueFormat.format(item.values[index]!) : "–"}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  );
}
