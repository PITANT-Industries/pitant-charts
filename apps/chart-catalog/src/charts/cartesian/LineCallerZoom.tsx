import { Button } from "@ui-sdk/react/button";
import { curveNatural, line } from "d3-shape";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CartesianData } from "./data";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { colorFor, type ChartTheme } from "./options";
import { finiteLineValue, lineFormatValue, lineValueScale } from "./line-input";
import { clampCallerZoom, lineRangeLabel, lineRangeModel, lineRangeTicks, type LineRangeModel } from "./line-range-data";
import { selectLineSamples } from "./line-samples";
import "./line-range-caller.css";

type Domain = readonly [number, number];
type Props = { label: string; data: CartesianData; compact: boolean; theme: ChartTheme };


function CallerZoomContent({ data, model, label, compact, theme }: Props & { model: LineRangeModel }) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 364);
  const fullSpan = model.full[1] - model.full[0];
  const smallestGap = model.coordinates.reduce((minimum, value, index) => index ? Math.min(minimum, value - model.coordinates[index - 1]) : minimum, fullSpan);
  const minimumSpan = model.count > 1 ? Math.max(fullSpan * Number.EPSILON * 8, smallestGap / 2) : fullSpan;
  const [storedDomain, setDomain] = useState<Domain>(model.full);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null), [focused, setFocused] = useState<number | null>(null);
  const drag = useRef<{ pointer: number; from: number; domain: Domain; moved: boolean } | null>(null);
  const oldFull = useRef(model.full);
  const schema = JSON.stringify([data.categories, model.coordinates, data.series.map(series => series.name)]);
  useEffect(() => {
    const previous = oldFull.current;
    oldFull.current = model.full;
    setDomain(domain => domain[0] === previous[0] && domain[1] === previous[1] ? model.full : clampCallerZoom(domain, model.full, minimumSpan));
    setSelected(null); setHovered(null); setFocused(null); drag.current = null;
  }, [schema, minimumSpan]);
  const domain = clampCallerZoom(storedDomain, model.full, minimumSpan), span = domain[1] - domain[0];
  const zoomed = model.count > 1 && span < fullSpan * (1 - 1e-10);
  const left = Math.min(compact ? 20 : 48, width * .2), right = Math.max(left + 1, width - Math.min(compact ? 16 : 40, width * .2));
  const inset = Math.min(compact ? 16 : 40, height * .29), bottom = Math.max(inset + 1, height - inset), plotWidth = right - left;
  const scale = lineValueScale(data.series.map(series => series.values), { includeZero: true });
  const x = (index: number) => left + (model.at(index) - domain[0]) / span * plotWidth;
  const y = (value: number) => scale.position(value, bottom, inset);
  const visible = model.coordinates.flatMap((time, index) => time >= domain[0] && time <= domain[1] ? [index] : []);
  const first = visible[0] ?? model.nearest(domain[0]), last = visible.at(-1) ?? model.nearest(domain[1]);
  const ticks = lineRangeTicks(first, last, compact || width < 450 ? 3 : 5);
  const focus = selected !== null && selected >= 0 && selected <= model.last && x(selected) >= left - 1 && x(selected) <= right + 1 ? selected : null;
  const focusX = focus === null ? 0 : x(focus), focusLabel = focus === null ? "" : data.categories[focus];
  const pillWidth = cartesianPillWidth(focusLabel), pillX = Math.max(pillWidth / 2, Math.min(width - pillWidth / 2, focusX));
  const entries = focus === null ? [] : data.series.map((series, index) => { const value = series.values[focus]; return { name: series.name, value: finiteLineValue(value) ? lineFormatValue(value) : "–", color: colorFor(series, index, theme), y: finiteLineValue(value) ? y(value) : undefined }; });
  const emphasis = hovered ?? focused;
  const sampleStart = Math.max(0, first - 1), sampleEnd = Math.min(model.last, last + 1);
  const paths = data.series.map(series => {
    const count = sampleEnd - sampleStart + 1;
    const samples = new Set(selectLineSamples(count, plotWidth, i => { const value = series.values[i + sampleStart]; return finiteLineValue(value) ? scale.unit(value) : 0; }).map(index => index + sampleStart));
    // Retain gap boundaries when downsampling: disconnected caller runs never bridge.
    for (let index = sampleStart; index <= sampleEnd; index++) if (!finiteLineValue(series.values[index]) && (finiteLineValue(series.values[index - 1]) || finiteLineValue(series.values[index + 1]))) samples.add(index);
    return line<number>().defined(index => finiteLineValue(series.values[index])).x(x).y(index => y(series.values[index] as number)).curve(curveNatural)([...samples].sort((a, b) => a - b)) ?? undefined;
  });
  function changeZoom(factor: number, anchor: number) {
    if (model.count < 2) return;
    setDomain(previous => {
      const current = clampCallerZoom(previous, model.full, minimumSpan), currentSpan = current[1] - current[0];
      const nextSpan = Math.max(minimumSpan, Math.min(fullSpan, currentSpan * factor));
      return clampCallerZoom([anchor - (anchor - current[0]) * nextSpan / currentSpan, anchor - (anchor - current[0]) * nextSpan / currentSpan + nextSpan], model.full, minimumSpan);
    });
  }
  useEffect(() => {
    const host = plot.current;
    if (!host || compact) return;
    function wheel(event: WheelEvent) {
      if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return;
      const bounds = host!.getBoundingClientRect(), px = event.clientX - bounds.left, py = event.clientY - bounds.top;
      if (px < left || px > right || py < inset || py > bottom) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      changeZoom(2 ** (Math.max(-400, Math.min(400, event.deltaY * unit)) / 250), domain[0] + (px - left) / plotWidth * span);
    }
    host.addEventListener("wheel", wheel, { passive: false });
    return () => host.removeEventListener("wheel", wheel);
  }, [bottom, compact, inset, left, right, plot, plotWidth, domain[0], domain[1], minimumSpan, fullSpan, model]);
  function pointAt(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect(), px = event.clientX - box.left, py = event.clientY - box.top;
    if (px < left || px > right || py < inset || py > bottom) return null;
    return model.nearest(domain[0] + (px - left) / plotWidth * span);
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = pointAt(event);
    if (point === null) return;
    setSelected(point);
    if (zoomed) { drag.current = { pointer: event.pointerId, from: event.clientX, domain, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (current?.pointer === event.pointerId) {
      const delta = event.clientX - current.from;
      if (!current.moved && Math.abs(delta) < 3) return;
      current.moved = true;
      const span = current.domain[1] - current.domain[0], offset = delta / plotWidth * span;
      setDomain(clampCallerZoom([current.domain[0] - offset, current.domain[1] - offset], model.full, minimumSpan)); setSelected(null);
    } else setSelected(pointAt(event));
  }
  function reset() { setDomain(model.full); setSelected(null); drag.current = null; }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (selected !== null || zoomed)) { event.preventDefault(); event.stopPropagation(); if (selected !== null) setSelected(null); else reset(); return; }
    if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); changeZoom(event.key === "-" ? 1.25 : .8, focus === null ? (domain[0] + domain[1]) / 2 : model.at(focus)); return; }
    const keys: Record<string, number> = { Home: first, End: last, ArrowLeft: Math.max(first, (focus ?? last + 1) - 1), ArrowRight: Math.min(last, (focus ?? first - 1) + 1), ArrowUp: Math.max(first, (focus ?? last + 1) - 1), ArrowDown: Math.min(last, (focus ?? first - 1) + 1) };
    if (Object.hasOwn(keys, event.key)) {
      event.preventDefault();
      const index = keys[event.key], coordinate = model.at(index);
      // Sparse calendars can have a window between samples; keyboard inspection
      // brings the nearest endpoint into view without inventing an observation.
      if (coordinate < domain[0]) setDomain(clampCallerZoom([coordinate, coordinate + span], model.full, minimumSpan));
      else if (coordinate > domain[1]) setDomain(clampCallerZoom([coordinate - span, coordinate], model.full, minimumSpan));
      setSelected(index);
    }
  }
  const caption = (coordinate: number, index: number) => model.calendar.times
    ? new Date(model.calendar.times[0] + coordinate).toISOString().slice(0, 10) : data.categories[index];
  return <div className="line-zoom-detail" data-compact={compact} data-caller-range="" data-line-zoom-caller="">
    <div className="line-zoom-plot" ref={plot} data-zoomed={zoomed} data-zoom-domain={`${domain[0]},${domain[1]}`}>
      <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label} aria-describedby={compact ? undefined : `${id}-instructions`} tabIndex={compact ? undefined : 0}
        onPointerMove={compact ? undefined : pointerMove} onPointerDown={compact ? undefined : pointerDown} onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onPointerCancel={() => { if (drag.current) setDomain(drag.current.domain); drag.current = null; setSelected(null); }} onPointerLeave={event => { if (!drag.current && event.pointerType !== "touch") setSelected(null); }}
        onBlur={() => setSelected(null)} onKeyDown={compact ? undefined : keyboard} onDoubleClick={compact ? undefined : reset}>
        <defs><clipPath id={`${id}-clip`}><rect x={left} y={inset} width={plotWidth} height={bottom - inset} /></clipPath>
          {data.series.map((series, index) => <linearGradient key={index} id={`${id}-stroke-${index}`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
            <stop stopColor={colorFor(series, index, theme)} stopOpacity="0" /><stop offset=".15" stopColor={colorFor(series, index, theme)} /><stop offset=".85" stopColor={colorFor(series, index, theme)} /><stop offset="1" stopColor={colorFor(series, index, theme)} stopOpacity="0" />
          </linearGradient>)}
        </defs>
        <g aria-hidden="true" data-line-zoom-grid="">{scale.ticks.map((value, index) => <line key={index} x1={left} x2={right} y1={scale.positionUnit(value, bottom, inset)} y2={scale.positionUnit(value, bottom, inset)} stroke={theme.grid} strokeDasharray="4 4" />)}</g>
        {paths.map((path, index) => <g key={index}>{path && <path key={index} data-line-zoom-path={index} aria-hidden="true" d={path} clipPath={`url(#${id}-clip)`} fill="none" stroke={`url(#${id}-stroke-${index})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={emphasis !== null && emphasis !== index ? .3 : focus === null ? 1 : .48} />}
          {data.series[index].values.map((value, sample) => finiteLineValue(value) && !finiteLineValue(data.series[index].values[sample - 1]) && !finiteLineValue(data.series[index].values[sample + 1]) ? <circle key={sample} data-line-zoom-single-point={index} cx={x(sample)} cy={y(value)} r={3} fill={colorFor(data.series[index], index, theme)} clipPath={`url(#${id}-clip)`} /> : null)}
        </g>)}
        <g aria-hidden="true" fill={theme.muted} fontSize={compact ? 9 : 12} data-line-zoom-ticks="">
          {ticks.map(index => <text key={index} x={x(index)} y={bottom + (compact ? 12 : 24)} textAnchor="middle" opacity={focus !== null && Math.abs(x(index) - pillX) < pillWidth / 2 + 20 ? 0 : 1}>{data.categories[index]}</text>)}
          {!compact && scale.ticks.map((value, index) => <text key={index} data-line-zoom-value-tick="" x={left - 4} y={scale.positionUnit(value, bottom, inset)} textAnchor="end" dominantBaseline="middle">{scale.format(value)}</text>)}
        </g>
        {focus !== null && <g aria-hidden="true" pointerEvents="none"><line x1={focusX} x2={focusX} y1={inset} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />
          {entries.map((entry, index) => entry.y === undefined ? null : <CartesianFocusPoint key={index} x={focusX} y={entry.y} color={entry.color} surface={theme.surface} />)}
          <CartesianDatePill x={pillX} y={Math.min(height - 32, bottom + 5)} label={focusLabel} width={pillWidth} text={theme.text} surface={theme.surface} />
        </g>}
      </svg>
      {!compact && focus !== null && entries.length > 0 && <div className="line-zoom-tip" style={focusX > width / 2 ? { right: width - focusX + 8, top: inset } : { left: focusX + 8, top: inset }}><CartesianReadout label={lineRangeLabel(model, data.categories, focus)} entries={entries} /></div>}
    </div>
    {!compact && <><div className="line-range-legend" aria-label="Chart series">{data.series.map((series, index) => <Button key={index} type="button" data-range-legend={index} onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }} onPointerLeave={() => setHovered(null)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}><i aria-hidden="true" style={{ backgroundColor: colorFor(series, index, theme) }} />{series.name}</Button>)}</div>
      <div className="line-zoom-caption"><output data-line-zoom-window="">Showing {caption(domain[0], first)} to {caption(domain[1], last)}</output><span id={`${id}-instructions`}>Ctrl or Cmd and scroll to zoom, drag to pan, double-click to reset<span className="line-zoom-keyboard">. Use plus and minus to zoom, arrow keys to read values, and Escape to clear or reset.</span></span></div></>}
  </div>;
}

export function LineCallerZoom(props: Props) {
  const model = useMemo(() => lineRangeModel(props.data), [props.data]);
  return model.isEmpty ? <div className="chart-render-message" role="status">No line data</div> : <CallerZoomContent {...props} model={model} />;
}
