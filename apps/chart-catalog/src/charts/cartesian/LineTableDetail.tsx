import { curveNatural, line } from "d3-shape";
import { Button } from "@ui-sdk/react/button";
import { useId, useLayoutEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { toLocalTime } from "./line-detail-data";
import { lineDateLabel } from "./line-format";
import { finiteLineValue, lineCalendar, lineFormatValue, lineValueScale } from "./line-input";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import "./line-table-detail.css";

type Variant = "line-table" | "chart-data-table";
type Selection = { index: number; source: "chart" | "hover" | "row" };
type Point = { x: number; y: number; defined: boolean };
type Props = { variant: Variant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme; demo?: boolean };

const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const utcMonthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const percent = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const weeklyGrid = [0, 500, 1000, 1500, 2000];
const monthlyGrid = [0, 5000, 10_000, 15_000, 20_000];
const drawLine = line<Point>().defined(point => point.defined).x(point => point.x).y(point => point.y).curve(curveNatural);
const round = (value: number) => Number(value.toFixed(2));

export function isLineTable(id: string): id is Variant {
  return id === "line-table" || id === "chart-data-table";
}

function tableValue(value: number | null | undefined, demo: boolean) {
  return finiteLineValue(value) ? demo ? valueFormat.format(value) : lineFormatValue(value) : "–";
}

function conversion(series: CartesianData["series"], index: number, demo: boolean) {
  const denominator = series[0]?.values[index];
  const numerator = series[1]?.values[index];
  if (!finiteLineValue(denominator) || denominator <= 0 || !finiteLineValue(numerator)) return "–";
  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio) || numerator !== 0 && ratio === 0) return "–";
  if (!demo && ratio !== 0 && Math.abs(ratio) < .0005) return `${lineFormatValue(ratio * 100)}%`;
  return percent.format(ratio);
}

export function LineTableDetail(props: Props) {
  // Mount the measured chart only when its ref can attach. Empty→valid restores
  // a new ResizeObserver rather than reusing a hook that saw an empty ref.
  if (!props.data.categories.length || !props.data.series.length) {
    return <div className="line-table-detail" data-line-table={props.variant} data-compact={props.compact || undefined} data-line-table-model={props.demo === false ? "caller" : undefined}>
      <div className="chart-render-message" role="status">No data to display.</div>
    </div>;
  }
  return <LineTableModel {...props} />;
}

function LineTableModel({ variant, label, data, compact, theme, demo = true }: Props) {
  const { categories, series } = data;
  const id = useId();
  const weekly = variant === "line-table";
  const [open, setOpen] = useState(false);
  const [selection, setSelected] = useState<Selection | null>(null);
  const selected = selection && selection.index >= 0 && selection.index < categories.length ? selection : null;
  const calendar = lineCalendar(data, demo);
  const dated = calendar.times !== undefined;
  const modelKey = JSON.stringify([demo, categories, series, calendar.times]);
  const tableOpen = demo ? open : open && !compact;
  useLayoutEffect(() => { if (!demo) setSelected(null); }, [modelKey, compact, demo]);

  function clear(source: Selection["source"], index?: number) {
    setSelected(current => current?.source === source && (index === undefined || current.index === index) ? null : current);
  }

  const weeklyTable = <table className="line-table-weekly">
    <caption className="line-table-sr-only">{demo ? "Weekly trials and paid conversions" : label}</caption>
    <thead><tr><th scope="col">{demo || dated ? "Week of" : "Category"}</th>
      {series.map((item, column) => <th scope="col" key={column}>{item.name}</th>)}
      <th scope="col">Conversion</th>
    </tr></thead>
    <tbody>{categories.map((category, index) => <tr key={index} data-line-table-row={demo ? undefined : index} tabIndex={0} data-active={selected?.index === index || undefined}
      onPointerEnter={event => {
        if (event.pointerType !== "touch") setSelected({ index, source: event.currentTarget === document.activeElement ? "row" : "hover" });
      }}
      onPointerLeave={() => clear("hover", index)}
      onFocus={() => setSelected({ index, source: "row" })}
      onBlur={() => clear("row", index)}
      onKeyDown={event => {
        if (event.key === "Escape" && selected?.index === index) {
          event.preventDefault();
          event.stopPropagation();
          setSelected(null);
        }
      }}>
      <th scope="row">{category}</th>
      {series.map((item, column) => <td key={column}>{tableValue(item.values[index], demo)}</td>)}
      <td>{conversion(series, index, demo)}</td>
    </tr>)}</tbody>
  </table>;

  return <div className="line-table-detail" data-line-table={variant} data-compact={compact || undefined} data-line-table-model={demo ? undefined : "caller"}>
    <div className="line-table-plot" data-table-open={tableOpen || undefined}>
      <TablePlot {...{ label, compact, theme, data, weekly, selected, setSelected, demo }}
        open={tableOpen} onLeave={() => clear("chart")} />
      {!compact && !weekly && <>
        <Button className="line-table-toggle" aria-expanded={open} aria-controls={`${id}-table`}
          onClick={() => { setSelected(null); setOpen(value => !value); }}>
          {open ? "View as chart" : "View as table"}
        </Button>
        <div className={open ? "line-table-scroll" : "line-table-sr-only"} id={`${id}-table`}
          tabIndex={open ? 0 : undefined} role={open ? "region" : undefined} aria-label={open ? "Chart data" : undefined}>
          <table className="line-table-monthly">
            <caption className="line-table-sr-only">{label}</caption>
            <thead><tr><th scope="col">{demo ? "Month" : dated ? "Date" : "Category"}</th>{series.map((item, index) => <th scope="col" key={index}>{item.name}</th>)}</tr></thead>
            <tbody>{categories.map((category, index) => <tr key={index} data-line-table-row={demo ? undefined : index}>
              <th scope="row">{category}</th>
              {series.map((item, column) => <td key={column}>{tableValue(item.values[index], demo)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
    {!compact && weekly && (demo ? weeklyTable : <div className="line-table-weekly-scroll" role="region" aria-label="Chart data" tabIndex={0}>{weeklyTable}</div>)}
  </div>;
}

function TablePlot({ label, compact, theme, data, weekly, open, selected, setSelected, onLeave, demo }: {
  label: string;
  compact: boolean;
  theme: ChartTheme;
  data: CartesianData;
  weekly: boolean;
  open: boolean;
  selected: Selection | null;
  setSelected: (value: Selection | null) => void;
  onLeave: () => void;
  demo: boolean;
}) {
  const { categories, series } = data;
  const id = useId();
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(728, weekly ? 291.2 : 364);
  const height = weekly ? Number(measuredHeight.toFixed(1)) : measuredHeight;
  const left = Math.min(compact ? 16 : weekly ? 48 : 40, width * .23);
  const right = width - Math.min(compact ? 16 : 40, width * .2);
  const top = Math.min(compact ? 12 : 40, height * .37);
  const bottom = height - Math.min(compact ? 22 : 40, height * .37);
  const max = weekly ? 2000 : 24_000;
  const calendar = lineCalendar(data, demo);
  const times = demo ? categories.map(category => toLocalTime(category)!) : calendar.times;
  const last = categories.length - 1;
  const duration = times && times.length > 1 ? times[last] - times[0] : 0;
  const x = (index: number) => left + (right - left) * (last === 0 ? .5 : times && duration > 0 ? (times[index] - times[0]) / duration : index / last);
  const scale = lineValueScale(series.map(item => item.values), { includeZero: true });
  const y = (value: number) => demo ? bottom - (bottom - top) * value / max : scale.position(value, bottom, top);
  const grid = demo ? weekly ? weeklyGrid : monthlyGrid : scale.ticks;
  const gridY = (value: number) => demo ? y(value) : scale.positionUnit(value, bottom, top);
  const tickCount = Math.min(categories.length, compact || weekly && width < 330 ? 2 : weekly ? 4 : 6);
  const ticks = demo ? weekly ? width < 330 ? [0, last] : [0, 3, 6, last] : [0, 1, 2, 3, 4, 5]
    : Array.from({ length: tickCount }, (_, index) => Math.round(index * last / Math.max(1, tickCount - 1)));
  const colors = series.map((item, index) => colorFor(item, index, theme));
  const paths = series.map(item => drawLine(item.values.slice(0, categories.length).map((value, index) => ({
    x: x(index), y: finiteLineValue(value) ? y(value) : 0, defined: finiteLineValue(value),
  }))) ?? undefined);
  const isolated = demo ? [] : series.flatMap((item, seriesIndex) => item.values.slice(0, categories.length).flatMap((value, index) =>
    finiteLineValue(value) && !finiteLineValue(item.values[index - 1]) && (index === last || !finiteLineValue(item.values[index + 1]))
      ? [{ series: seriesIndex, index, value }] : []));
  const active = selected?.index ?? 0;
  const showFocus = selected !== null && !open && !compact;
  const focusX = x(active);
  const focusDate = demo ? monthDay.format(times![active]) : times ? utcMonthDay.format(times[active]) : categories[active];
  const pillWidth = cartesianPillWidth(focusDate);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, Math.round(focusX)));
  const tooltipWidth = Math.max(0, Math.min(140, width - 8));
  const tipX = Math.max(4, Math.min(width - tooltipWidth - 4, focusX + tooltipWidth + 16 > width ? focusX - tooltipWidth - 16 : focusX + 16));

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || open) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    if (px < left - 3 || px > right + 3 || py < top || py > bottom) {
      onLeave();
      return;
    }
    let nearest = 0;
    for (let index = 1; index <= last; index++) if (Math.abs(x(index) - px) < Math.abs(x(nearest) - px)) nearest = index;
    setSelected({ index: nearest, source: "chart" });
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const previous = Math.max(0, (selected?.index ?? last + 1) - 1);
    const next = Math.min(last, (selected?.index ?? -1) + 1);
    const index = { Home: 0, End: last, ArrowLeft: previous, ArrowUp: previous, ArrowRight: next, ArrowDown: next }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    setSelected({ index, source: "chart" });
  }

  const readoutLabel = demo ? lineDateLabel(categories[active]) : categories[active];
  return <div className="line-table-surface" ref={plot} data-line-table-x={demo ? undefined : times ? "time" : "category"}>
    {!open && <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={label} aria-describedby={compact ? undefined : `${id}-keys`} tabIndex={compact ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") onLeave(); }}
      onPointerCancel={onLeave} onBlur={onLeave} onKeyDown={compact ? undefined : inspectKey}>
      {!compact && <desc id={`${id}-keys`}>Use the arrow keys to inspect values. Home and End jump to the first and last {demo || times ? "dates" : "categories"}. Escape clears the selection.</desc>}
      <defs>
        {colors.map((color, index) => <linearGradient key={index} id={`${id}-stroke-${index}`}>
          <stop offset="0" stopColor={color} stopOpacity="0" /><stop offset=".15" stopColor={color} />
          <stop offset=".85" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>)}
        {showFocus && <>
          <linearGradient id={`${id}-guide`} x2="0%" y2="100%">
            <stop offset="0" stopColor={theme.muted} stopOpacity="0" /><stop offset=".1" stopColor={theme.muted} stopOpacity=".8" />
            <stop offset=".9" stopColor={theme.muted} stopOpacity=".8" /><stop offset="1" stopColor={theme.muted} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-focus`}><rect x={x(Math.max(0, active - 1))} y={top}
            width={x(Math.min(last, active + 1)) - x(Math.max(0, active - 1))} height={bottom - top} /></clipPath>
        </>}
      </defs>
      <g aria-hidden="true">
        <g className="line-table-grid">{grid.map((value, index) =>
          <line key={index} x1={left} x2={right} y1={round(gridY(value))} y2={round(gridY(value))} stroke={theme.grid} strokeDasharray="4 4" />)}</g>
        {showFocus && <rect x={focusX - .5} y={top} width="1" height={bottom - top} fill={`url(#${id}-guide)`} />}
        <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {paths.map((path, index) => <g key={index}>
            <path data-line-table-stroke={index} d={path} stroke={`url(#${id}-stroke-${index})`} opacity={showFocus ? .6 : 1} />
            {showFocus && <path d={path} stroke={colors[index]} clipPath={`url(#${id}-focus)`} />}
          </g>)}
        </g>
        {isolated.map(point => <circle key={`${point.series}-${point.index}`} data-line-table-isolated={`${point.series}-${point.index}`}
          cx={x(point.index)} cy={y(point.value)} r={2.5} fill={colors[point.series]} opacity={showFocus ? .6 : 1} />)}
        <g fill={theme.muted} fontSize={compact ? 9 : 12}>
          {ticks.map(index => <text key={index} x={round(x(index))} y={bottom + (compact ? 15 : 24)} textAnchor="middle"
            opacity={showFocus && Math.abs(x(index) - pillX) < pillWidth / 2 + 14 ? 0 : 1}>{demo || !times ? categories[index] : utcMonthDay.format(times[index])}</text>)}
          {weekly && !compact && grid.map((value, index) => <text key={index} x={left - 4} y={round(gridY(value))} dominantBaseline="middle" textAnchor="end">
            {demo ? value < 1000 ? value : `${value / 1000}k` : scale.format(value)}
          </text>)}
        </g>
        {showFocus && <>
          {series.map((item, index) => finiteLineValue(item.values[active]) ? <CartesianFocusPoint key={index} x={focusX} y={y(item.values[active]!)} color={colors[index]} /> : null)}
          <CartesianDatePill x={pillX} y={bottom + 4} label={focusDate} text={theme.text} surface={theme.surface} width={pillWidth} />
        </>}
      </g>
    </svg>}
    {!compact && <div className="line-table-tooltip" role="status" data-line-table-active={!demo && showFocus ? active : undefined} style={{ top, left: tipX }}>
      {showFocus && <CartesianReadout label={readoutLabel}
        entries={series.map((item, index) => ({ name: item.name, value: demo ? item.values[active]! : tableValue(item.values[active], false), color: colors[index] }))} live={false} />}
    </div>}
  </div>;
}
