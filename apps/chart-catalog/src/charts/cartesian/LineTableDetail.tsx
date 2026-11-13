import { curveNatural, line } from "d3-shape";
import { Button } from "@ui-sdk/react/button";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import type { CartesianData } from "./data";
import { toLocalTime } from "./line-detail-data";
import { lineDateLabel } from "./line-format";
import { colorFor, valueFormat, type ChartTheme } from "./options";
import "./line-table-detail.css";

type Variant = "line-table" | "chart-data-table";
type Selection = { index: number; source: "chart" | "hover" | "row" };
type Point = { x: number; y: number };
type Props = { variant: Variant; label: string; data: CartesianData; compact: boolean; theme: ChartTheme };

const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const percent = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const weeklyGrid = [0, 500, 1000, 1500, 2000];
const monthlyGrid = [0, 5000, 10_000, 15_000, 20_000];
const drawLine = line<Point>().x(point => point.x).y(point => point.y).curve(curveNatural);
const round = (value: number) => Number(value.toFixed(2));

export function isLineTable(id: string): id is Variant {
  return id === "line-table" || id === "chart-data-table";
}

export function LineTableDetail({ variant, label, data: { categories, series }, compact, theme }: Props) {
  const id = useId();
  const weekly = variant === "line-table";
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);

  function clear(source: Selection["source"], index?: number) {
    setSelected(current => current?.source === source && (index === undefined || current.index === index) ? null : current);
  }

  return <div className="line-table-detail" data-line-table={variant} data-compact={compact || undefined}>
    <div className="line-table-plot" data-table-open={open || undefined}>
      <TablePlot {...{ label, compact, theme, series, weekly, open, selected, setSelected }}
        categories={categories} onLeave={() => clear("chart")} />
      {!compact && !weekly && <>
        <Button className="line-table-toggle" aria-expanded={open} aria-controls={`${id}-table`}
          onClick={() => { setSelected(null); setOpen(value => !value); }}>
          {open ? "View as chart" : "View as table"}
        </Button>
        <div className={open ? "line-table-scroll" : "line-table-sr-only"} id={`${id}-table`}
          tabIndex={open ? 0 : undefined} role={open ? "region" : undefined} aria-label={open ? "Chart data" : undefined}>
          <table className="line-table-monthly">
            <caption className="line-table-sr-only">{label}</caption>
            <thead><tr><th scope="col">Month</th>{series.map(item => <th scope="col" key={item.name}>{item.name}</th>)}</tr></thead>
            <tbody>{categories.map((category, index) => <tr key={category}>
              <th scope="row">{category}</th>
              {series.map(item => <td key={item.name}>{valueFormat.format(item.values[index]!)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
    {!compact && weekly && <table className="line-table-weekly">
      <caption className="line-table-sr-only">Weekly trials and paid conversions</caption>
      <thead><tr><th scope="col">Week of</th><th scope="col">Trials</th><th scope="col">Paid</th><th scope="col">Conversion</th></tr></thead>
      <tbody>{categories.map((category, index) => {
        const trials = series[0].values[index]!;
        const paid = series[1].values[index]!;
        return <tr key={category} tabIndex={0} data-active={selected?.index === index || undefined}
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
          <th scope="row">{category}</th><td>{valueFormat.format(trials)}</td><td>{valueFormat.format(paid)}</td><td>{percent.format(paid / trials)}</td>
        </tr>;
      })}</tbody>
    </table>}
  </div>;
}

function TablePlot({ label, compact, theme, categories, series, weekly, open, selected, setSelected, onLeave }: {
  label: string;
  compact: boolean;
  theme: ChartTheme;
  categories: string[];
  series: CartesianData["series"];
  weekly: boolean;
  open: boolean;
  selected: Selection | null;
  setSelected: (value: Selection | null) => void;
  onLeave: () => void;
}) {
  const id = useId();
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(728, weekly ? 291.2 : 364);
  const height = weekly ? Number(measuredHeight.toFixed(1)) : measuredHeight;
  const left = Math.min(compact ? 16 : weekly ? 48 : 40, width * .23);
  const right = width - Math.min(compact ? 16 : 40, width * .2);
  const top = Math.min(compact ? 12 : 40, height * .37);
  const bottom = height - Math.min(compact ? 22 : 40, height * .37);
  const max = weekly ? 2000 : 24_000;
  const grid = weekly ? weeklyGrid : monthlyGrid;
  const times = categories.map(category => toLocalTime(category)!);
  const last = times.length - 1;
  const duration = times[last] - times[0];
  const x = (index: number) => left + (right - left) * ((times[index] - times[0]) / duration);
  const y = (value: number) => bottom - (bottom - top) * value / max;
  const ticks = weekly ? (width < 330 ? [0, last] : [0, 3, 6, last]) : [0, 1, 2, 3, 4, 5];
  const colors = series.map((item, index) => colorFor(item, index, theme));
  const paths = series.map(item => drawLine(item.values.map((value, index) => ({ x: x(index), y: y(value!) }))) ?? undefined);
  const active = selected?.index ?? 0;
  const showFocus = selected !== null && !open && !compact;
  const focusX = x(active);
  const focusDate = monthDay.format(times[active]);
  const pillWidth = cartesianPillWidth(focusDate);
  const pillX = Math.min(width - pillWidth / 2, Math.max(pillWidth / 2, Math.round(focusX)));
  const tooltipWidth = Math.min(140, width - 8);
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

  return <div className="line-table-surface" ref={plot}>
    {!open && <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={label} aria-describedby={compact ? undefined : `${id}-keys`} tabIndex={compact ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") onLeave(); }}
      onPointerCancel={onLeave} onBlur={onLeave} onKeyDown={compact ? undefined : inspectKey}>
      {!compact && <desc id={`${id}-keys`}>Use the arrow keys to inspect values. Home and End jump to the first and last dates. Escape clears the selection.</desc>}
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
        <g className="line-table-grid">{grid.map(value =>
          <line key={value} x1={left} x2={right} y1={round(y(value))} y2={round(y(value))} stroke={theme.grid} strokeDasharray="4 4" />)}</g>
        {showFocus && <rect x={focusX - .5} y={top} width="1" height={bottom - top} fill={`url(#${id}-guide)`} />}
        <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {paths.map((path, index) => <g key={index}>
            <path data-line-table-stroke={index} d={path} stroke={`url(#${id}-stroke-${index})`} opacity={showFocus ? .6 : 1} />
            {showFocus && <path d={path} stroke={colors[index]} clipPath={`url(#${id}-focus)`} />}
          </g>)}
        </g>
        <g fill={theme.muted} fontSize={compact ? 9 : 12}>
          {ticks.map(index => <text key={index} x={round(x(index))} y={bottom + (compact ? 15 : 24)} textAnchor="middle"
            opacity={showFocus && Math.abs(x(index) - pillX) < pillWidth / 2 + 14 ? 0 : 1}>{categories[index]}</text>)}
          {weekly && !compact && grid.map(value => <text key={value} x={left - 4} y={round(y(value))} dominantBaseline="middle" textAnchor="end">
            {value < 1000 ? value : `${value / 1000}k`}
          </text>)}
        </g>
        {showFocus && <>
          {series.map((item, index) => <CartesianFocusPoint key={index} x={focusX} y={y(item.values[active]!)} color={colors[index]} />)}
          <CartesianDatePill x={pillX} y={bottom + 4} label={focusDate} text={theme.text} surface={theme.surface} width={pillWidth} />
        </>}
      </g>
    </svg>}
    {!compact && <div className="line-table-tooltip" role="status" style={{ top, left: tipX }}>
      {showFocus && <CartesianReadout label={lineDateLabel(categories[active])}
        entries={series.map((item, index) => ({ name: item.name, value: item.values[active]!, color: colors[index] }))} live={false} />}
    </div>}
  </div>;
}
