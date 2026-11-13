import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import type { EChartsOption, EChartsType } from "echarts";
import type { ChartPreviewProps } from "../../types";
import { EChart } from "../EChart";
import { useChartTheme } from "../theme";
import { ShadcnBasics } from "./ShadcnBasics";
import { SparklineExamples } from "./Sparkline";
import { buildBar, buildCandlestick, buildComposed, buildDiverging, buildDumbbell, buildGantt, buildLollipop, buildRanking, buildStream, buildWaterfall } from "./comparisons";
import { curve, resolveData, type CartesianData } from "./data";
import { buildLine, colorFor, down, initialControls, up, valueFormat, type ChartTheme, type Controls } from "./options";
import "./styles.css";

const basics = new Set(["area-default", "bar-default", "line-default"]);
const selectedRange = new Set(["line-time-range", "candlestick-range"]);
const connected = new Set(["line-synced", "line-linked-brush", "bar-synced", "area-small-multiples"]);
const brushExamples = new Set(["line-segment", "area-selection"]);

function getOption(example: ChartPreviewProps["example"], data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls): EChartsOption {
  switch (example.family) {
    case "bar": return buildBar(example, data, theme, compact);
    case "candlestick": return buildCandlestick(example, data, theme, compact);
    case "composed": return buildComposed(example, data, theme, compact);
    case "diverging": return buildDiverging(example, data, theme, compact);
    case "dumbbell": return buildDumbbell(example, data, theme, compact, controls);
    case "gantt": return buildGantt(example, data, theme, compact);
    case "lollipop": return buildLollipop(example, data, theme, compact);
    case "slope":
    case "bump": return buildRanking(example, data, theme, compact);
    case "stream": return buildStream(example, data, theme, compact);
    case "waterfall": return buildWaterfall(example, data, theme, compact);
    default: return buildLine(example, data, theme, compact, controls);
  }
}

export default function Cartesian(props: ChartPreviewProps) {
  return <CartesianExample key={props.example.id} {...props} />;
}

function CartesianExample({ example, compact = false, data }: ChartPreviewProps) {
  const theme = useChartTheme();
  const source = useMemo(() => resolveData(example, data), [example, data]);
  const [controls, setControls] = useState<Controls>(initialControls);
  const [isLoading, setLoading] = useState(example.id.endsWith("-loading") || example.id === "line-loading-placeholder");
  const [placeholder, setPlaceholder] = useState("Sweep");
  const [viewTable, setViewTable] = useState(false);
  const [focusedRow, setFocusedRow] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [frozenTick, setFrozenTick] = useState(0);
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("svg");
  const chartRef = useRef<EChartsType>(null);
  const candleDirection = useRef<boolean | undefined>(undefined);
  const [pointCrosshair, setPointCrosshair] = useState<{ x: number; y: number } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const connection = useId();
  const { id, family } = example;
  const live = family === "live-line";
  const startLoading = id.endsWith("-loading") || id === "line-loading-placeholder";
  const split = connected.has(id);
  const linked = id === "line-table";
  const tableToggle = id === "chart-data-table";
  const range = selectedRange.has(id);
  const brushes = brushExamples.has(id);
  const candleCrosshair = id === "candlestick-crosshair";
  const pointOnly = id === "line-crosshair-point";
  const powerUser = id === "line-large-data";
  const renderer = powerUser || id === "line-export" && exportFormat === "png" ? "canvas" : "svg";

  useEffect(() => {
    if (!live || compact || isLoading || data) return;
    const timer = window.setInterval(() => setTicks(value => value + 1), 600);
    return () => window.clearInterval(timer);
  }, [compact, data, isLoading, live]);

  useEffect(() => {
    if (id !== "live-line-loading" || compact || !isLoading) return;
    const timer = window.setTimeout(() => setLoading(false), 2500);
    return () => window.clearTimeout(timer);
  }, [compact, id, isLoading]);

  const optionsData = useMemo((): CartesianData => {
    if (range) {
      return {
        categories: source.categories.slice(-controls.range),
        series: source.series.map(item => ({ ...item, values: item.values.slice(-controls.range) })),
        rows: source.rows?.slice(-controls.range),
      };
    }
    const activeTick = paused ? frozenTick : ticks;
    if (live && activeTick > 0 && !data) {
      const count = source.categories.length;
      return {
        categories: Array.from({ length: count }, (_, index) => {
          const clock = 10 * 60 + activeTick + index;
          return `${Math.floor(clock / 60) % 24}:${String(clock % 60).padStart(2, "0")}`;
        }),
        series: source.series.map((item, index) => ({
          ...item, values: Array.from({ length: count }, (_, position) => {
            const sample = activeTick + position;
            return Math.round((143 + Math.sin(sample * 0.3 + index) * 1.03 + Math.sin(sample * 1.34) * 0.46) * 100) / 100;
          }),
        })),
      };
    }
    if (powerUser && controls.count !== 10_000 && !data) {
      return { categories: Array.from({ length: controls.count }, (_, index) => String(index + 1)),
        series: source.series.map((item, index) => ({ ...item, values: curve(controls.count, index, 65, 33, 0.00001) })) };
    }
    return source;
  }, [controls.count, controls.range, data, frozenTick, live, paused, powerUser, range, source, ticks]);

  const option = useMemo(() => getOption(example, optionsData, theme, compact, controls), [example, optionsData, theme, compact, controls]);
  const splitOptions = useMemo(() => {
    if (!split) return [];
    const high = Math.ceil(Math.max(10, ...optionsData.series.flatMap(item => item.values.map(value => value ?? 0))) / 10) * 10;
    return optionsData.series.map((item, index) => {
      const panelExample = id === "line-linked-brush" && index !== optionsData.series.length - 1
        ? { ...example, id: "line-synced" } : example;
      const panel = getOption(panelExample, { ...optionsData, series: [{ ...item, color: colorFor(item, index, theme) }] }, theme, compact, controls);
      if (id === "area-small-multiples") panel.yAxis = { ...(Array.isArray(panel.yAxis) ? panel.yAxis[0] : panel.yAxis), max: high };
      if (id === "line-linked-brush" && index !== optionsData.series.length - 1 && !compact) {
        panel.dataZoom = [{ type: "inside", start: 25, end: 100, disabled: true }];
      }
      return { item, panel };
    });
  }, [split, optionsData, id, example, theme, compact, controls]);

  function update<Value extends keyof Controls>(name: Value, value: Controls[Value]) {
    setControls(previous => ({ ...previous, [name]: value }));
  }

  function showRow(index: number) {
    setFocusedRow(index);
    if (index >= 0) chartRef.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
    else chartRef.current?.dispatchAction({ type: "hideTip" });
  }

  function armBrush(chart: EChartsType) {
    requestAnimationFrame(() => {
      if (!chart.isDisposed()) chart.dispatchAction({ type: "takeGlobalCursor", key: "brush", brushOption: { brushType: "lineX", brushMode: "single" } });
    });
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

  const onEvents: Record<string, (event: any) => void> | undefined = linked ? {
    updateAxisPointer(event: { axesInfo?: { value: number }[] }) {
      const value = event.axesInfo?.[0]?.value;
      if (typeof value === "number") setFocusedRow(value);
    },
    globalout() { setFocusedRow(-1); },
  } : brushes ? {
    brushEnd(event: { areas?: { coordRange?: [number, number] }[] }) {
      const coordinate = event.areas?.[0]?.coordRange;
      if (coordinate) update("selection", [Math.min(...coordinate), Math.max(...coordinate)]);
    },
  } : candleCrosshair ? {
    updateAxisPointer(event: { axesInfo?: { value: number; axisDim?: string }[] }) {
      const index = event.axesInfo?.find(axis => axis.axisDim === "x")?.value;
      const row = typeof index === "number" ? optionsData.rows?.[index] : undefined;
      if (row && typeof row.close === "number" && typeof row.open === "number") {
        const direction = row.close >= row.open;
        if (direction !== candleDirection.current) {
          candleDirection.current = direction;
          const chart = chartRef.current;
          if (chart && !chart.isDisposed()) {
            requestAnimationFrame(() => {
              if (!chart.isDisposed()) chart.setOption({ tooltip: { axisPointer: { crossStyle: { color: direction ? up : down } } } });
            });
          }
        }
      }
    },
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
  const rangeValues = family === "candlestick" ? [14, 30, 90] : [7, 30, 90];
  const latest = optionsData.series[0]?.values.at(-1);
  const selectionText = controls.selection ? controls.selection.map(index => optionsData.categories[index]).join(" – ") : "";
  const skeleton = isLoading && startLoading;
  const showControls = !compact && (range || brushes || startLoading || tableToggle || id === "line-band-fill" || id === "line-trend"
    || id === "line-export" || powerUser || id === "live-line-paused" || legends.length > 0);

  return (
    <div className="cartesian-example">
      {showControls && <div className="cartesian-controls">
        {range && rangeValues.map(days => <button type="button" aria-pressed={controls.range === days} key={days} onClick={() => update("range", days)}>{days} days</button>)}
        {brushes && <>
          <button type="button" onClick={() => { if (chartRef.current) armBrush(chartRef.current); }}>Select range</button>
          <button type="button" disabled={!controls.selection} onClick={() => {
            update("selection", null);
            chartRef.current?.dispatchAction({ type: "brush", areas: [] });
          }}>Clear</button>
          {selectionText && <span className="cartesian-muted">{selectionText}</span>}
        </>}
        {startLoading && id !== "line-loading-placeholder" && <button type="button" aria-pressed={isLoading} onClick={() => setLoading(value => !value)}>{isLoading ? "Show data" : "Show loading"}</button>}
        {id === "area-loading" && ["Pulse", "Sweep"].map(mode => <button key={mode} type="button" aria-pressed={mode === placeholder} onClick={() => { setPlaceholder(mode); setLoading(true); }}>{mode}</button>)}
        {id === "line-band-fill" && ["Solid", "Gradient", "Hatched"].map(fill => <button key={fill} type="button" aria-pressed={fill === controls.fill} onClick={() => update("fill", fill)}>{fill}</button>)}
        {id === "line-trend" && ["Dashed", "Solid", "Gradient"].map(trend => <button key={trend} type="button" aria-pressed={trend === controls.trend} onClick={() => update("trend", trend)}>{trend}</button>)}
        {id === "line-export" && <>
          <label>Format <select value={exportFormat} onChange={event => setExportFormat(event.target.value === "png" ? "png" : "svg")}><option value="svg">SVG</option><option value="png">PNG</option></select></label>
          <button type="button" onClick={exportFile}>Download chart</button>
        </>}
        {powerUser && !data && [10000, 50000, 100000].map(count => <button key={count} type="button" aria-pressed={count === controls.count} onClick={() => update("count", count)}>{count / 1000}k points</button>)}
        {tableToggle && <button type="button" aria-pressed={viewTable} onClick={() => setViewTable(value => !value)}>{viewTable ? "View chart" : "View as table"}</button>}
        {id === "live-line-paused" && <button type="button" aria-pressed={paused} onClick={() => { if (!paused) setFrozenTick(ticks); setPaused(value => !value); }}>{paused ? "Resume" : "Pause"}</button>}
        {legends.map((item, index) => <button key={index} type="button" aria-pressed={index === controls.activeLegend} onMouseEnter={() => update("activeLegend", index)} onMouseLeave={() => update("activeLegend", undefined)} onFocus={() => update("activeLegend", index)} onBlur={() => update("activeLegend", undefined)} onClick={() => update("activeLegend", index === controls.activeLegend ? undefined : index)}><i className="cartesian-swatch" style={{ backgroundColor: item.color }} />{item.name}</button>)}
      </div>}
      {live && !skeleton && <div className="cartesian-live" aria-label={paused ? "Stream paused" : "Live stream"}><i className={paused ? "" : "cartesian-pulse"} />{paused ? "Paused" : "Live"} {typeof latest === "number" && <strong>{valueFormat.format(latest)}</strong>}</div>}
      {skeleton ? <ChartSkeleton family={family} label={example.title} effect={placeholder} /> : (
        <>
          {!viewTable && (split ? <div className={`cartesian-panels ${id === "area-small-multiples" ? "cartesian-panels--multiples" : ""}`}>
            {(compact && id === "area-small-multiples" ? splitOptions.slice(0, 4) : splitOptions).map(({ item, panel }, index) => (
              <div className="cartesian-panel" key={index}>
                <span>{item.name}</span>
                <EChart option={panel} label={`${example.title}, ${item.name}`} compact={compact} group={connection} />
              </div>
            ))}
          </div> : <div className="cartesian-plot" ref={plotRef}
            onPointerMove={pointOnly ? movePointCrosshair : undefined} onPointerLeave={pointOnly ? () => setPointCrosshair(null) : undefined}>
            <EChart option={option} label={example.title} compact={compact} chartRef={chartRef} renderer={renderer}
              onEvents={onEvents} onReady={brushes && !compact ? armBrush : undefined} />
            {pointOnly && pointCrosshair && <div className="cartesian-point-crosshair" aria-hidden="true"
              style={{ left: pointCrosshair.x, top: pointCrosshair.y, height: Math.max(0, (plotRef.current?.clientHeight ?? 0) - pointCrosshair.y - 25) }} />}
          </div>)}
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
