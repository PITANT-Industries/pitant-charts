import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { Button } from "@ui-sdk/react/button";
import { area, curveNatural, line } from "d3-shape";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CartesianData } from "./data";
import type { BrushRange } from "./Brush";
import { usePlotSize } from "../usePlotSize";
import { CartesianDatePill, CartesianFocusPoint, CartesianReadout, cartesianPillWidth } from "./CartesianFocus";
import { colorFor, type ChartTheme } from "./options";
import { finiteLineValue, lineFormatValue, lineValueScale } from "./line-input";
import { clampLineBrush, lineRangeLabel, lineRangeModel, lineRangeTicks, type LineRangeModel } from "./line-range-data";
import "./line-range-caller.css";

type Selection = { index: number; panel: number };
type Props = { variant: string; label: string; data: CartesianData; compact: boolean; theme: ChartTheme };
type Point = { x: number; y: number; value: number | null };
const trace = line<Point>().defined(point => point.value !== null).x(point => point.x).y(point => point.y).curve(curveNatural);

function CallerHighlights({ data, model, x, top, bottom, id }: { data: CartesianData; model: LineRangeModel; x: (index: number) => number; top: number; bottom: number; id: string }) {
  return <g aria-hidden="true" clipPath={`url(#${id}-clip)`}>
    {data.rows?.map((row, index) => {
      if (index >= model.count) return null;
      const center = x(index);
      const left = index ? (x(index - 1) + center) / 2 : center - (model.count > 1 ? (x(1) - center) / 2 : 4);
      const right = index < model.last ? (x(index + 1) + center) / 2 : center + (model.count > 1 ? (center - x(index - 1)) / 2 : 4);
      return <g key={index}>
        {row.highlight === true && <rect data-brush-highlight={index} x={left} y={top} width={Math.max(1, right - left)} height={bottom - top} fill="var(--muted-foreground)" fillOpacity=".12" />}
        {row.deadline === true && <line data-brush-launch={index} data-brush-deadline={index} x1={center} x2={center} y1={top} y2={bottom} stroke="var(--chart-negative, var(--destructive))" />}
      </g>;
    })}
  </g>;
}

function CallerBrushPlot({ data, model, seriesIndices, panel, range, selection, setSelection, compact, linked, highlights, theme, label, emphasis }: {
  data: CartesianData; model: LineRangeModel; seriesIndices: number[]; panel: number; range: BrushRange; selection: Selection | null; setSelection: (value: Selection | null) => void;
  compact: boolean; linked: boolean; highlights: boolean; theme: ChartTheme; label: string; emphasis: number | null;
}) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, linked ? 182 : 300);
  const [start, end] = range;
  const left = Math.min(compact ? 16 : linked ? 48 : 40, width * .2), right = Math.max(left + 1, width - Math.min(compact ? 16 : linked ? 16 : 40, width * .2));
  const top = Math.min(compact || linked ? 12 : 40, height * .3), bottom = Math.max(top + 1, height - (compact ? 18 : linked ? 8 : 40));
  const domainStart = start === end ? model.full[0] : model.at(start), domainEnd = start === end ? model.full[1] : model.at(end);
  const x = (index: number) => left + (model.at(index) - domainStart) / (domainEnd - domainStart || 1) * (right - left);
  const scale = lineValueScale(seriesIndices.map(index => data.series[index].values.slice(start, end + 1)), { includeZero: true });
  const y = (value: number) => scale.position(value, bottom, top);
  const points = seriesIndices.map(index => data.categories.map((_, i) => {
    const value = data.series[index].values[i];
    return { x: x(i), y: finiteLineValue(value) ? y(value) : 0, value: finiteLineValue(value) ? value : null };
  }));
  const selected = selection && selection.index >= start && selection.index <= end ? selection.index : null;
  const focusX = selected === null ? 0 : x(selected);
  const focusLabel = selected === null ? "" : data.categories[selected];
  const pillWidth = cartesianPillWidth(focusLabel);
  const entries = selected === null ? [] : seriesIndices.map(index => {
    const value = data.series[index].values[selected];
    return { name: data.series[index].name, value: finiteLineValue(value) ? lineFormatValue(value) : "–", color: colorFor(data.series[index], index, theme), y: finiteLineValue(value) ? y(value) : undefined };
  });
  const ticks = linked ? [] : lineRangeTicks(start, end, Math.min(end - start + 1, width >= 356 ? 5 : width > 300 ? 4 : width > 245 ? 3 : 2));
  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (compact || event.pointerType === "touch" && event.type === "pointermove") return;
    const box = event.currentTarget.getBoundingClientRect(), px = event.clientX - box.left, py = event.clientY - box.top;
    if (px < left || px > right || py < top || py > bottom) { setSelection(null); return; }
    const index = Math.max(start, Math.min(end, model.nearest(domainStart + (px - left) / (right - left) * (domainEnd - domainStart))));
    setSelection({ panel, index });
  }
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (compact) return;
    if (event.key === "Escape" && selection) { event.preventDefault(); event.stopPropagation(); setSelection(null); return; }
    const index = event.key === "Home" ? start : event.key === "End" ? end
      : event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(end, (selected ?? start - 1) + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(start, (selected ?? end + 1) - 1) : null;
    if (index !== null) { event.preventDefault(); setSelection({ panel, index }); }
  }
  return <div ref={plot} className="line-brush-plot" data-brush-panel={panel}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label} tabIndex={compact ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setSelection(null); }} onPointerCancel={() => setSelection(null)}
      onKeyDown={key} onFocus={() => { if (!compact) setSelection({ panel, index: Math.max(start, Math.min(end, selection?.index ?? start)) }); }} onBlur={() => setSelection(null)}>
      <defs>
        <clipPath id={`${id}-clip`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
        {seriesIndices.map(index => <linearGradient key={index} id={`${id}-stroke-${index}`} gradientUnits="userSpaceOnUse" x1={left} x2={right}>
          <stop stopColor={colorFor(data.series[index], index, theme)} stopOpacity="0" /><stop offset=".15" stopColor={colorFor(data.series[index], index, theme)} />
          <stop offset=".85" stopColor={colorFor(data.series[index], index, theme)} /><stop offset="1" stopColor={colorFor(data.series[index], index, theme)} stopOpacity="0" />
        </linearGradient>)}
      </defs>
      <g className="line-brush-grid" aria-hidden="true">{scale.ticks.map((value, index) => <line key={index} data-brush-grid="" x1={left} x2={right} y1={scale.positionUnit(value, bottom, top)} y2={scale.positionUnit(value, bottom, top)} stroke={theme.grid} strokeDasharray="4 4" />)}</g>
      {highlights && <CallerHighlights data={data} model={model} x={x} top={top} bottom={bottom} id={id} />}
      <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
        {selected !== null && <line data-brush-crosshair="" x1={focusX} x2={focusX} y1={top} y2={bottom} stroke={theme.muted} strokeOpacity=".55" />}
        {seriesIndices.map((index, i) => <g key={index} opacity={emphasis !== null && emphasis !== index ? .3 : 1}>
          {linked && panel > 0 && points[i].some(point => point.value !== null) && <path data-brush-area={index} d={area<Point>().defined(point => point.value !== null).x(point => point.x).y0(y(0)).y1(point => point.y).curve(curveNatural)(points[i]) ?? undefined} fill={colorFor(data.series[index], index, theme)} fillOpacity=".12" />}
          {points[i].some(point => point.value !== null) && <path data-brush-path={index} d={trace(points[i]) ?? undefined} fill="none" stroke={`url(#${id}-stroke-${index})`} strokeWidth={linked ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />}
          {points[i].map((point, sample) => point.value !== null && !finiteLineValue(data.series[index].values[sample - 1]) && !finiteLineValue(data.series[index].values[sample + 1]) ? <circle key={sample} data-brush-single-point={index} cx={point.x} cy={point.y} r={3} fill={colorFor(data.series[index], index, theme)} /> : null)}
        </g>)}
      </g>
      {!compact && <g aria-hidden="true" fill={theme.muted} fontSize="12">
        {ticks.map(index => <text key={index} data-brush-tick="" x={x(index)} y={bottom + 24} textAnchor="middle" opacity={selected === index ? 0 : 1}>{data.categories[index]}</text>)}
        {scale.ticks.map((value, index) => <text key={index} data-brush-value-tick="" x={left - 4} y={scale.positionUnit(value, bottom, top)} textAnchor="end" dominantBaseline="middle">{scale.format(value)}</text>)}
      </g>}
      {entries.map((entry, index) => entry.y === undefined ? null : <CartesianFocusPoint key={index} x={focusX} y={entry.y} color={entry.color} surface={theme.surface} />)}
      {!compact && !linked && selected !== null && <CartesianDatePill x={Math.max(pillWidth / 2, Math.min(width - pillWidth / 2, Math.round(focusX)))} y={bottom + 4} label={focusLabel} width={pillWidth} text={theme.text} surface={theme.surface} />}
    </svg>
    {!compact && selected !== null && selection?.panel === panel && entries.length > 0 && <div className="line-brush-tooltip" style={{ top, left: focusX + 170 < width ? focusX + 16 : undefined, right: focusX + 170 >= width ? width - focusX + 16 : undefined }}><CartesianReadout label={lineRangeLabel(model, data.categories, selected)} entries={entries} /></div>}
  </div>;
}

function CallerOverview({ data, model, range, setRange, linked, highlights, theme }: { data: CartesianData; model: LineRangeModel; range: BrushRange; setRange: (range: BrushRange) => void; linked: boolean; highlights: boolean; theme: ChartTheme }) {
  const id = useId();
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, linked ? 91 : 72);
  const [start, end] = range;
  const left = Math.min(linked ? 48 : 40, width * .2), inset = Math.min(linked ? 16 : 40, width * .2), right = Math.max(left + 1, width - inset), plotWidth = right - left;
  const top = 4, bottom = Math.max(top + 1, height - (linked ? 24 : 4)), fullSpan = model.full[1] - model.full[0];
  const x = (index: number) => left + (model.at(index) - model.full[0]) / fullSpan * plotWidth;
  const scale = lineValueScale([data.series[0].values], { includeZero: true });
  const points = data.categories.map((_, index) => { const value = data.series[0].values[index]; return { x: x(index), y: finiteLineValue(value) ? scale.position(value, bottom, top) : 0, value: finiteLineValue(value) ? value : null }; });
  const color = colorFor(data.series[0], 0, theme);
  const gesture = useRef<{ pointer: number; range: BrushRange; x: number; pan: boolean; canceled: boolean } | null>(null);
  const coordinateSchema = JSON.stringify(model.coordinates);
  useEffect(() => { gesture.current = null; }, [coordinateSchema]);
  const shift = (initial: BrushRange, offset: number): BrushRange => { const delta = Math.max(-initial[0], Math.min(model.last - initial[1], offset)); return [initial[0] + delta, initial[1] + delta]; };
  useEffect(() => {
    const release = (event: globalThis.PointerEvent) => { if (gesture.current?.pointer !== event.pointerId) return; if (event.type === "pointercancel") setRange(gesture.current.range); gesture.current = null; };
    window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);
    return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); gesture.current = null; };
  }, [setRange]);
  function rangeKey(event: KeyboardEvent<HTMLElement>, edge?: number) {
    if (event.key === "Escape" && gesture.current) { event.preventDefault(); event.stopPropagation(); gesture.current.canceled = true; setRange(gesture.current.range); return; }
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageUp: 7, PageDown: -7 };
    if (!(event.key in offsets) && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault(); event.stopPropagation();
    const delta = event.key === "Home" ? -model.last : event.key === "End" ? model.last : offsets[event.key] * (event.shiftKey && event.key.startsWith("Arrow") ? 7 : 1);
    if (edge === undefined) setRange(shift(range, delta));
    else if (edge === 0) setRange([Math.max(0, Math.min(end - 1, start + delta)), end]);
    else setRange([start, Math.max(start + 1, Math.min(model.last, end + delta))]);
  }
  const rangeText = `${model.caption(start)} – ${model.caption(end)}`;
  return <div ref={plot} className="line-brush-overview" onPointerDownCapture={event => { if (event.isPrimary && event.button === 0) gesture.current = { pointer: event.pointerId, range, x: event.clientX, pan: false, canceled: false }; }} onKeyDownCapture={event => { if (event.key === "Escape") rangeKey(event); }}>
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs><clipPath id={`${id}-clip`}><rect x={left} y={top} width={plotWidth} height={bottom - top} /></clipPath></defs>
      {highlights && <CallerHighlights data={data} model={model} x={x} top={top} bottom={bottom} id={id} />}
      {points.some(point => point.value !== null) && <path data-brush-path="overview" d={trace(points) ?? undefined} fill="none" stroke={color} strokeWidth="2" />}
      {points.map((point, index) => point.value !== null && !finiteLineValue(data.series[0].values[index - 1]) && !finiteLineValue(data.series[0].values[index + 1])
        ? <circle key={index} data-brush-overview-point={index} cx={point.x} cy={point.y} r={3} fill={color} pointerEvents="none" /> : null)}
      <rect data-brush-selection="" x={x(start)} y={top} width={Math.max(0, x(end) - x(start))} height={bottom - top} fill={color} fillOpacity=".12" stroke="var(--line-brush-border, var(--border))" strokeWidth="1.5" />
      {[start, end].map((index, edge) => <rect key={edge} data-brush-handle={edge ? "end" : "start"} x={x(index) - 3} y={top - 3} width="6" height={bottom - top + 6} fill={color} fillOpacity=".6" />)}
      {linked && lineRangeTicks(0, model.last, width < 320 ? 4 : 5).map(index => <text key={index} data-brush-tick="" x={x(index)} y={height} textAnchor="middle" fill={theme.muted} fontSize="12">{data.categories[index]}</text>)}
    </svg>
    {model.last > 0 && <Slider className="line-brush-slider" aria-label="Chart range overview" dir="ltr" min={0} max={model.at(model.last)} minStepsBetweenThumbs={0} step={1}
      value={[model.at(start), model.at(end)]} format={position => model.caption(model.nearest(position))} onValueChange={(value, details) => {
        if (gesture.current?.canceled) { details.cancel(); return; }
        let first = model.nearest(value[0]), last = model.nearest(value[1]);
        if (details.reason === "accessibility-adjust") {
          if (details.thumb === 0) first = start + Math.sign(value[0] - model.at(start));
          else last = end + Math.sign(value[1] - model.at(end));
        }
        if (first < 0 || last > model.last || first >= last) { details.cancel(); return; }
        setRange([first, last]);
      }} style={{ left, right: inset, top, height: bottom - top }}>
      <SliderControl className="line-brush-control"><SliderTrack className="line-brush-track">
        <SliderThumb className="line-brush-thumb" index={0} aria-label="Start of visible range" onKeyDownCapture={event => rangeKey(event, 0)} />
        <SliderThumb className="line-brush-thumb" index={1} aria-label="End of visible range" onKeyDownCapture={event => rangeKey(event, 1)} />
      </SliderTrack></SliderControl>
      <Button type="button" className="line-brush-pan" aria-label="Pan visible date window" disabled={end - start === model.last} style={{ left: `${(x(start) - left) / plotWidth * 100}%`, right: `${(right - x(end)) / plotWidth * 100}%` }}
        onKeyDown={event => rangeKey(event)} onPointerDown={event => { if (!event.isPrimary || event.button !== 0 || !gesture.current) return; gesture.current.pan = true; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const current = gesture.current; if (!current?.pan || current.canceled || current.pointer !== event.pointerId) return; const next = model.nearest(model.at(current.range[0]) + (event.clientX - current.x) / plotWidth * fullSpan); setRange(shift(current.range, next - current.range[0])); }}
        onClick={event => { if (event.detail === 0) setRange(shift(range, end < model.last ? 1 : -1)); }} />
    </Slider>}
    <output className="line-brush-sr-only" aria-live="polite" data-brush-range="">{rangeText}</output>
  </div>;
}

function CallerBrushContent({ data, model, variant, label, compact, theme }: Props & { model: LineRangeModel }) {
  const linked = variant === "line-linked-brush", highlights = variant === "line-date-highlights-brush";
  const [storedRange, setRange] = useState<BrushRange>([0, model.last]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hovered, setHovered] = useState<number | null>(null), [focused, setFocused] = useState<number | null>(null);
  const range = clampLineBrush(storedRange, model.last);
  const schema = JSON.stringify([data.categories, model.coordinates, data.series.map(series => series.name)]);
  const oldLast = useRef(model.last);
  useEffect(() => { const previousLast = oldLast.current; oldLast.current = model.last; setRange(previous => previous[0] === 0 && previous[1] === previousLast ? [0, model.last] : clampLineBrush(previous, model.last)); setSelection(null); setHovered(null); setFocused(null); }, [schema, model.last]);
  const panels = linked ? data.series.map((_, index) => [index]) : [data.series.map((_, index) => index)];
  return <div className="line-brush-detail" data-line-brush={variant} data-compact={compact} data-linked={linked} data-caller-range="" data-line-brush-caller="" data-brush-range-start={range[0]} data-brush-range-end={range[1]}>
    {panels.map((indices, panel) => <div className="line-caller-brush-panel" key={panel}>
      {linked && !compact && <div className="line-brush-caption">{data.series[indices[0]].name}</div>}
      <CallerBrushPlot data={data} model={model} seriesIndices={indices} panel={panel} range={range} selection={selection} setSelection={setSelection} compact={compact} linked={linked} highlights={highlights} theme={theme} label={linked ? `${label}, ${data.series[indices[0]].name}` : label} emphasis={hovered ?? focused} />
    </div>)}
    {!compact && <div className="line-range-legend" aria-label="Chart series">{data.series.map((series, index) => <Button key={index} type="button" data-range-legend={index} onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }} onPointerLeave={() => setHovered(null)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}>
      <i aria-hidden="true" style={{ backgroundColor: colorFor(series, index, theme) }} />{series.name}
    </Button>)}</div>}
    {!compact && <CallerOverview data={data} model={model} range={range} setRange={setRange} linked={linked} highlights={highlights} theme={theme} />}
  </div>;
}

export function LineCallerBrush(props: Props) {
  const model = useMemo(() => lineRangeModel(props.data), [props.data]);
  return model.isEmpty ? <div className="chart-render-message" role="status">No line data</div> : <CallerBrushContent {...props} model={model} />;
}
