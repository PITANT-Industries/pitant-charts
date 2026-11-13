import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { CartesianReadout } from "./CartesianFocus";
import { LineLegend } from "./LineExtras";
import { comparisonMarksData, comparisonMarksDesign, dumbbellPlaceholder, lollipopPlaceholder, markRows, markTickValues, visibleCategoryIndices, waterfallLabel, waterfallPlaceholder, type ComparisonMarksVariant } from "./comparison-marks-data";
import type { ChartTheme } from "./options";
import "./comparison-marks-detail.css";

export { isComparisonMarksVariant } from "./comparison-marks-data";

const positive = "var(--chart-positive, #279873)";
const negative = "var(--chart-negative, #dc5149)";
type PlotProps = {
  variant: ComparisonMarksVariant;
  label: string;
  compact: boolean;
  theme: ChartTheme;
  loading: boolean;
  activeSeries: number | undefined;
  source: ReturnType<typeof comparisonMarksData>;
};

function ComparisonMarksPlot({ variant, label, compact, theme, loading, activeSeries, source }: PlotProps) {
  const id = useId();
  const { marks, series } = source;
  const design = comparisonMarksDesign(variant);
  const horizontal = Boolean(design.horizontal);
  const ratio = design.ratio ?? (horizontal ? 1.5 : 2);
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, 728 / ratio);
  const [selected, setSelected] = useState<number | null>(null);
  const active = loading || compact ? null : selected;
  const left = compact ? 14 : design.left ?? 40;
  const right = Math.max(left + 1, width - (compact ? 14 : design.right ?? 40));
  const top = compact ? 10 : 40;
  // The reference uses the unrounded aspect ratio for scales even when layout rounds to device pixels.
  const plotHeight = compact ? height : width / ratio;
  const bottom = Math.max(top + 1, plotHeight - (compact ? 20 : 40));
  // The score labels need room to the left of the lowest endpoint at narrower widths.
  const widthForValues = right - left;
  const labelSpace = widthForValues < 250 ? 856 : 858;
  const minimum = variant === "dumbbell-legend" ? Math.min(50, 52 - labelSpace / Math.max(1, widthForValues - 27.2)) : design.min;
  const length = horizontal ? bottom - top : right - left;
  const categoryPadding = design.padding;
  const size = length / (marks.length + categoryPadding);
  const center = (index: number) => (horizontal ? top : left) + size * (index + .5 + categoryPadding / 2);
  const scale = (value: number) => {
    const fraction = (value - minimum) / (design.max - minimum);
    return horizontal ? left + fraction * (right - left) : bottom - fraction * (bottom - top);
  };
  const selectedMark = active === null ? undefined : marks[active];
  const showBarLabels = !compact && design.labelAfter !== undefined && width >= design.labelAfter;
  const legended = variant === "dumbbell-legend";
  const waterfall = design.kind === "waterfall";
  const lollipop = design.kind === "lollipop";
  const cash = variant === "waterfall-cash-flow";
  const paint = theme.colors[design.color];
  const radius = design.radius ?? 6;
  const highlightValue = selectedMark ? scale(design.kind === "dumbbell" ? selectedMark.first : selectedMark.second) : 0;
  const selectedCenter = active === null ? 0 : center(active);
  const anchorX = horizontal ? highlightValue : selectedCenter;
  const panelRight = anchorX + 190 > width;
  const rows = selectedMark ? markRows(variant, selectedMark, series.map(item => item.name)).map((row, index) => ({
    ...row, color: design.kind === "dumbbell" && index === 0 ? theme.muted : waterfall && index === 0 && !selectedMark.total
      ? selectedMark.value < 0 ? negative : positive : paint,
  })) : [];
  const tipTop = horizontal ? Math.max(0, Math.min(plotHeight - 24 - rows.length * 24, selectedCenter - (rows.length === 1 ? 32 : 58))) : top;
  const tickValues = markTickValues(variant, width);
  const indices = visibleCategoryIndices(variant, width, marks.length);

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (loading || compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (x < left - 4 || x > right + 6 || y < top || y > bottom) {
      setSelected(null);
      return;
    }
    const position = horizontal ? y : x;
    setSelected(Math.max(0, Math.min(marks.length - 1, Math.round((position - center(0)) / size))));
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const previous = Math.max(0, (active ?? marks.length) - 1);
    const next = Math.min(marks.length - 1, (active ?? -1) + 1);
    const index = { Home: 0, End: marks.length - 1, ArrowLeft: previous, ArrowRight: next, ArrowUp: previous, ArrowDown: next }[event.key];
    if (index !== undefined) {
      event.preventDefault();
      setSelected(index);
    }
  }

  function rectangle(category: number, a: number, b: number, breadth: number, r: number, color: string, opacity?: number, placeholder = false) {
    const start = Math.min(a, b);
    const span = Math.abs(a - b);
    return <rect data-comparison-mark={placeholder ? "skeleton" : "body"} x={horizontal ? start : category - breadth / 2}
      y={horizontal ? category - breadth / 2 : start} width={horizontal ? span : breadth} height={horizontal ? breadth : span}
      rx={r} fill={color} fillOpacity={opacity} />;
  }

  function dot(category: number, value: number, color: string, endpoint: "first" | "second", opacity = 1, placeholder = false) {
    return <circle data-comparison-mark={placeholder ? "skeleton" : endpoint}
      cx={horizontal ? value : category} cy={horizontal ? category : value} r={radius}
      fill={color} fillOpacity={opacity} stroke={placeholder ? undefined : theme.surface} strokeWidth={placeholder ? undefined : 2} />;
  }

  return <div className="comparison-marks-plot" ref={plot} data-comparison-kind={design.kind} data-horizontal={horizontal} data-loading={loading}
    style={{ aspectRatio: ratio }} aria-busy={loading || undefined}>
    <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${compact ? height : plotHeight}`} role="img" aria-roledescription="chart" aria-label={label}
      aria-describedby={compact || loading ? undefined : `${id}-help`} tabIndex={compact || loading ? undefined : 0}
      onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
      onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)} onKeyDown={inspectKey}>
      {!compact && !loading && <desc id={`${id}-help`}>Use arrow keys to inspect categories. Home and End jump to the first and last categories. Escape clears the selection.</desc>}
      <g className="comparison-marks-grid" aria-hidden="true">
        {tickValues.map(value => {
          const at = scale(value);
          return <line data-comparison-grid="" key={value} x1={horizontal ? at : left} x2={horizontal ? at : right}
            y1={horizontal ? top : at} y2={horizontal ? bottom : at} stroke={theme.grid} strokeDasharray="4 4" />;
        })}
      </g>
      <g aria-hidden="true" className={loading ? "comparison-marks-skeleton" : undefined}>
        {marks.map((mark, index) => {
          const category = center(index);
          const a = scale(mark.first);
          const b = scale(mark.second);
          const activeMark = index === active;
          const opacity = active === null || activeMark ? 1 : .28;
          if (loading) {
            if (waterfall) {
              const [from, to] = waterfallPlaceholder[index];
              const y = (portion: number) => bottom - portion * (bottom - top);
              return <g key={mark.category}>{rectangle(category, y(from), y(to), size * (1 - design.padding), 4, theme.text, .45, true)}</g>;
            }
            if (lollipop) {
              const y = bottom - lollipopPlaceholder[index] * (bottom - top);
              return <g key={mark.category}>{rectangle(category, y, bottom, 2, 1, theme.text, .27, true)}{dot(category, y, theme.text, "second", .45, true)}</g>;
            }
            const [start, end] = dumbbellPlaceholder[index];
            const x1 = left + start * (right - left), x2 = left + end * (right - left);
            return <g key={mark.category}>{rectangle(category, x1, x2, 6, 3, theme.text, .25, true)}
              {dot(category, x1, theme.text, "first", .32, true)}{dot(category, x2, theme.text, "second", .45, true)}</g>;
          }
          if (waterfall) {
            const barWidth = size * (1 - design.padding);
            const color = mark.total ? paint : mark.value < 0 ? negative : positive;
            return <g key={mark.category} className="comparison-marks-group" opacity={opacity}>
              {!cash && index < marks.length - 1 && <line data-comparison-connector="" x1={category + barWidth / 2} x2={center(index + 1) - barWidth / 2}
                y1={b} y2={b} stroke={theme.muted} strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" />}
              {rectangle(category, a, b, barWidth, cash ? 6 : 4, color)}
              {!cash && (showBarLabels || activeMark) && <text data-comparison-label="" x={category} y={Math.min(a, b) - 10}
                fill={theme.muted} fontSize="12" fontWeight="500" textAnchor="middle" dominantBaseline="middle">{waterfallLabel(mark)}</text>}
            </g>;
          }
          if (lollipop) return <g key={mark.category} className="comparison-marks-group" opacity={opacity}>
            {rectangle(category, a, b, 2, 1, paint, .45)}{dot(category, b, paint, "second")}
            {horizontal && !compact && <text data-comparison-label="" x={b + 14} y={category} fill={theme.muted}
              fontSize="12" fontWeight="500" dominantBaseline="middle">{design.format(mark.value)}</text>}
          </g>;
          const direction = mark.delta >= 0 ? 1 : -1;
          return <g key={mark.category} className="comparison-marks-group" opacity={opacity}>
            {rectangle(category, a, b, 6, 3, paint, activeMark ? .55 : .3)}
            {dot(category, a, theme.muted, "first", activeSeries === 1 ? .24 : 1)}
            {dot(category, b, paint, "second", activeSeries === 0 ? .24 : 1)}
            {legended && !compact && <>
              <text data-comparison-label="" x={a - direction * 12} y={category} fill={theme.muted} opacity={activeSeries === 1 ? .24 : 1}
                fontSize="12" fontWeight="500" textAnchor={direction > 0 ? "end" : "start"} dominantBaseline="middle">{mark.first}</text>
              <text data-comparison-label="" x={b + direction * 12} y={category} fill={theme.muted} opacity={activeSeries === 0 ? .24 : 1}
                fontSize="12" fontWeight="500" textAnchor={direction > 0 ? "start" : "end"} dominantBaseline="middle">{mark.second}</text>
            </>}
          </g>;
        })}
      </g>
      {!compact && <g data-comparison-axis="" aria-hidden="true" fill={theme.muted} fontSize="12">
        {indices.map(index => <text key={marks[index].category} data-comparison-category="" x={horizontal ? left - 10 : center(index)}
          y={horizontal ? center(index) : bottom + 24} textAnchor={horizontal ? "end" : "middle"}
          dominantBaseline={horizontal ? "middle" : undefined}>{marks[index].category}</text>)}
        {tickValues.map(value => <text key={value} data-comparison-value="" x={horizontal ? scale(value) : left - 8}
          y={horizontal ? bottom + 24 : scale(value)} textAnchor={horizontal ? "middle" : "end"}
          dominantBaseline={horizontal ? undefined : "middle"}>{design.axis(value)}</text>)}
      </g>}
    </svg>
    {loading && <div className="comparison-marks-loading" role="status">{design.loadingLabel}</div>}
    {selectedMark && <div className="comparison-marks-tooltip" style={{ top: tipTop,
      left: panelRight ? undefined : anchorX + 16, right: panelRight ? width - anchorX + 16 : undefined }}>
      <CartesianReadout label={selectedMark.category} entries={rows} />
    </div>}
  </div>;
}

export function ComparisonMarksDetail({ variant, label, compact, theme }: { variant: ComparisonMarksVariant; label: string; compact: boolean; theme: ChartTheme }) {
  const design = comparisonMarksDesign(variant);
  const [loading, setLoading] = useState(Boolean(design.loadingLabel));
  const [activeSeries, setActiveSeries] = useState<number>();
  const [source] = useState(() => comparisonMarksData(variant));
  const legend = variant === "dumbbell-legend" && !compact;
  const legendSeries = source.series.map((item, index) => ({ ...item, name: `${item.name} survey`, color: index === 0 ? theme.muted : theme.colors[design.color] }));

  return <div className="comparison-marks-detail" data-comparison-marks={variant} data-compact={compact} data-legend={legend}>
    {!compact && design.loadingLabel && <div className="comparison-marks-controls">
      <Toggle pressed={loading} onPressedChange={setLoading} className="cartesian-action-button">Loading</Toggle>
    </div>}
    <div className="comparison-marks-body">
      <ComparisonMarksPlot variant={variant} label={label} compact={compact} theme={theme} loading={loading} activeSeries={activeSeries} source={source} />
      {legend && <LineLegend title="Average score" currency={false} series={legendSeries}
        metric={item => Math.round(item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / item.values.length)}
        active={activeSeries} onActive={setActiveSeries} />}
    </div>
  </div>;
}
