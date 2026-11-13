import { area, curveBasis, curveMonotoneX, stack, stackOffsetExpand, stackOffsetWiggle, stackOrderInsideOut, stackOrderNone } from "d3-shape";
import { useMemo, useState, type CSSProperties } from "react";
import { QuantityCaption, QuantityGrid, QuantityLegend, QuantityLoading, QuantityTip, qtyColor, qtyContrast,
  qtyMix, qtyNumber, qtyPercent, qtyRound, quantityStyles as styles, useQuantitySelection } from "../QuantityDetail";
import { usePlotSize } from "../usePlotSize";
import { useChartTheme } from "../theme";
import type { ChartPreviewProps } from "../../types";
import { comparisonFixture } from "./comparison-fixtures";
import { streamGhosts } from "./reference-stream-ghosts";

const captions: Record<string, [string, string]> = {
  "stream-default": ["Hip-hop led every genre from March to July 2026", "Jazz swells every December, then settles back"],
  "stream-expand": ["Social rose from 15% to 26% of sessions", "Paid fell from 27% to 14% over the same twelve weeks"],
  "stream-loading": ["API traffic more than doubled since January", "Turn loading off to sweep the layers in from the skeleton"],
  "diverging-default": ["Clear expectations score +67, fair pay only +3", "240 employees answered; neutral answers split across the line"],
  "diverging-legend": ["Enterprise customers are the happiest: 93% satisfied", "1,240 customers surveyed across four plans"],
  "diverging-loading": ["230 customers answered all four", "Turn loading off to grow the bars out from the centre line"],
};
const streamSeries = {
  default: ["Pop", "Hip-hop", "Rock", "Electronic", "Jazz"],
  loading: ["Web", "API", "Mobile"],
};
const month = new Map(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name, index) => [name, index]));
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });
const ghostPaint = { fill: "var(--foreground)", fillOpacity: .2, opacity: .7, className: styles.bone };

function dateNumber(label: string) {
  const [short, year] = label.split(" ");
  const index = month.get(short) ?? 0;
  // Demo dates are first-of-month Pacific timestamps.
  const daylightSaving = index >= 3 && index <= 10 && !(Number(year) === 2026 && index === 10);
  return Date.UTC(Number(year), index, 1, daylightSaving ? 7 : 8);
}

export function ReferenceStream({ example, compact = false }: ChartPreviewProps) {
  const id = example.id;
  const expand = id === "stream-expand";
  const hasLoading = id === "stream-loading";
  const [loading, setLoading] = useState(hasLoading);
  const selection = useQuantitySelection();
  const { plot, width, height } = usePlotSize<SVGSVGElement>(576, 288);
  const { categories, series } = useMemo(() => comparisonFixture(id), [id]);
  const keys = expand ? series.map(item => item.name) : hasLoading ? streamSeries.loading : streamSeries.default;
  const seriesByName = new Map(series.map(row => [row.name, row]));
  const data = categories.map((_, index) => keys.map(key => seriesByName.get(key)?.values[index] ?? 0));
  const layers = stack<number[], number>()
    .keys(keys.map((_, index) => index))
    .order(expand ? stackOrderNone : stackOrderInsideOut)
    .offset(expand ? stackOffsetExpand : stackOffsetWiggle)(data);
  const extrema = layers.flatMap(layer => layer.flatMap(point => [point[0], point[1]]));
  const min = expand ? 0 : Math.min(...extrema);
  const max = expand ? 1 : Math.max(...extrema);
  const ticks = expand ? categories.map((_, index) => index) : categories.map(dateNumber);
  const left = expand && !compact ? 48 : 0;
  const right = width - 2;
  const top = 6;
  const bottom = height - (compact ? 3 : 28);
  const x = (index: number) => left + (ticks[index] - ticks[0]) / (ticks.at(-1)! - ticks[0]) * (right - left);
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const step = width < 410 ? expand || hasLoading ? 4 : 8 : expand || hasLoading ? 2 : 4;
  const visibleTicks = categories.map((_, index) => index).filter(index => index % step === 0);
  const ghostTicks = width < 410 ? [0, .5, 1] : [0, .2, .4, .6, .8, 1];
  const ribbon = area<ArrayLike<number>>().x((_, index) => x(index)).y0(point => y(point[0])).y1(point => y(point[1])).curve(expand ? curveMonotoneX : curveBasis);
  const ghostRibbon = area<readonly [number, number]>().x((_, index) => left + index / 9 * (right - left))
    .y0(point => top + point[0] * (bottom - top)).y1(point => top + point[1] * (bottom - top)).curve(curveBasis);
  const labelSample = hasLoading ? [9, 2, 9] : [23, 21, 0, 12, 17];
  const labelWidth = hasLoading ? [22.23, 18, 28.34] : [20.1, 32, 21.38, 35, 18];
  const paint = (key: number) => qtyMix(qtyColor(key), 78);
  const active = selection.active;
  const format = (value: number) => expand ? qtyNumber.format(value)
    : `${compactNumber.format(value).replace(/K$/, "k")} ${hasLoading ? "requests" : "hours"}`;
  const [headline, caption] = captions[id] ?? captions["stream-default"];
  return <div className={styles.frame} data-compact={compact || undefined}>
    {hasLoading && !compact && <QuantityLoading pressed={loading} onChange={value => { selection.setActive(null); setLoading(value); }} />}
    <div className={styles.stage}>
      <svg ref={plot} role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading}
        viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: "2 / 1" }} tabIndex={compact || loading ? undefined : 0}
        onKeyDown={event => selection.keyboard(event, categories.length, true)}
        onBlur={() => selection.setActive(null)} onPointerLeave={event => { if (event.pointerType !== "touch") selection.setActive(null); }}
        onPointerMove={event => {
          if (compact || loading) return;
          const point = event.clientX - event.currentTarget.getBoundingClientRect().left;
          selection.setActive(categories.reduce((nearest, _, index) => Math.abs(x(index) - point) < Math.abs(x(nearest) - point) ? index : nearest, 0));
        }}
        onPointerDown={event => {
          if (compact || loading || event.pointerType !== "touch") return;
          const point = event.clientX - event.currentTarget.getBoundingClientRect().left;
          selection.setActive(categories.reduce((nearest, _, index) => Math.abs(x(index) - point) < Math.abs(x(nearest) - point) ? index : nearest, 0));
        }}>
        {!compact && (expand ? [0, .25, .5, .75, 1].map(value => <g key={value}>
          <QuantityGrid horizontal at={y(value)} from={left} to={right} />
          <text x={left - 10} y={y(value)} fill="var(--muted-foreground)" fontSize={12} textAnchor="end" dominantBaseline="middle">{value * 100}%</text>
        </g>) : (loading ? ghostTicks.map(value => left + value * (right - left)) : visibleTicks.map(x)).map(at =>
          <QuantityGrid key={at} at={at} from={top} to={bottom} />))}
        {loading ? streamGhosts.map((points, index) => <path key={index} data-mark="stream-bone-layer" d={ghostRibbon(points) ?? undefined} {...ghostPaint} />)
          : layers.map(layer => {
            const key = layer.index;
            const index = labelSample[key] ?? 0;
            const inset = labelWidth[key] ?? 20;
            const labelX = Math.min(width - inset, Math.max(left + inset, x(index)));
            const [start, end] = layer[index] ?? [0, 0];
            return <g key={layer.key}>
              <path data-mark="stream-layer" data-series={keys[key]} d={ribbon(layer) ?? undefined}
                fill={paint(key)} className={hasLoading ? styles.sweep : undefined} />
              {!expand && !compact && (width >= 410 || keys[key] !== "Electronic") &&
                <text x={qtyRound(labelX)} y={qtyRound((y(start) + y(end)) / 2)} fill={qtyContrast(paint(key))} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600}>
                  {keys[key]}
                </text>}
            </g>;
          })}
        {!compact && (loading ? ghostTicks.map((value, index) => {
          const center = left + value * (right - left);
          const at = index === 0 ? center : index === ghostTicks.length - 1 ? center - 28 : center - 14;
          return <rect key={value} data-mark="stream-bone-label" x={at} y={bottom + 12} width={28} height={8} rx={4} {...ghostPaint} />;
        }) : visibleTicks.map(index => <text key={index} x={x(index)} y={bottom + 16} dominantBaseline="middle" textAnchor={index === 0 ? "start" : "middle"} fill="var(--muted-foreground)" fontSize={12}>
          {expand || categories[index].startsWith("Jan") ? categories[index] : categories[index].slice(0, 3)}
        </text>))}
        {active !== null && !loading && <line x1={x(active)} x2={x(active)} y1={top} y2={bottom} stroke="var(--foreground)" strokeOpacity={.35} />}
      </svg>
      {!compact && !loading && active !== null && <QuantityTip label={categories[active]} width={width} height={height} x={x(active)} y={height / 2 - 18}
        rows={keys.map((name, index) => ({ name, color: qtyColor(index), value: format(data[active][index]) }))} />}
    </div>
    {!compact && <QuantityCaption headline={loading ? "Fetching traffic…" : headline} trend={!hasLoading}>{caption}</QuantityCaption>}
  </div>;
}

const divergingGhosts = [
  { label: .56929, sizes: [.40902, .2871, .44352, .25872] },
  { label: .65481, sizes: [.6406, .2348, .5853, .26252] },
  { label: .77291, sizes: [.41652, .1851, .5063, .40518] },
  { label: .52173, sizes: [.26531, .27148, .629, .32183] },
];

function roundedBar(x: number, right: number, top: number, height: number, leftEnd: boolean, rightEnd: boolean) {
  const limit = Math.min(4, (right - x) / 2, height / 2);
  const a = leftEnd ? limit : 0;
  const b = rightEnd ? limit : 0;
  const p = qtyRound;
  const bottom = top + height;
  return `M${p(x + a)},${p(top)}H${p(right - b)}A${p(b)},${p(b)} 0 0 1 ${p(right)},${p(top + b)}V${p(bottom - b)}A${p(b)},${p(b)} 0 0 1 ${p(right - b)},${p(bottom)}H${p(x + a)}A${p(a)},${p(a)} 0 0 1 ${p(x)},${p(bottom - a)}V${p(top + a)}A${p(a)},${p(a)} 0 0 1 ${p(x + a)},${p(top)}Z`;
}

function shrink(text: string, width: number, measure: (text: string, size: number) => number) {
  if (measure(text, 12) <= width) return text;
  let end = text.length;
  while (end > 2 && measure(text.slice(0, end) + "…", 12) > width) end--;
  return text.slice(0, end).trimEnd() + "…";
}

export function ReferenceDiverging({ example, compact = false }: ChartPreviewProps) {
  const id = example.id;
  const legend = id === "diverging-legend";
  const hasLoading = id === "diverging-loading";
  const [loading, setLoading] = useState(hasLoading);
  const [context] = useState(() => typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d"));
  const theme = useChartTheme();
  const selection = useQuantitySelection();
  const { plot, width, height } = usePlotSize<SVGSVGElement>(576, 324);
  const { categories, series } = useMemo(() => comparisonFixture(id), [id]);
  const order = hasLoading ? [1, 2, 0, 3] : categories.map((_, index) => index);
  const neutral = legend ? -1 : 2;
  const format = (value: number) => `${qtyNumber.format(value)} ${legend ? "customers" : "answers"}`;
  const color = (index: number) => {
    if (legend) return qtyMix(qtyColor([4, 3, 1, 0][index]), 82);
    return ["var(--chart-negative)", qtyMix("var(--chart-negative)", 55), "var(--quantity-neutral)",
      qtyMix("var(--chart-positive)", 55), "var(--chart-positive)"][index];
  };
  const measure = (text: string, size: number) => {
    if (!context) return text.length * size * .54;
    context.font = `400 ${size}px ${theme.fontFamily}`;
    return context.measureText(text).width;
  };
  const measuredLeft = legend ? 69.74 : hasLoading ? 146.13 : 190.88;
  const left = compact ? 0 : Math.min(measuredLeft, width * .38);
  const right = width - 4;
  const top = 4;
  const bottom = height - (compact ? 4 : 24);
  const minimum = loading ? 0 : legend ? -.25 : -.5;
  const x = (value: number) => left + (value - minimum) / (1 - minimum) * (right - left);
  const zero = x(loading ? .5 : 0);
  const band = (bottom - top) / order.length;
  const barHeight = band * (legend ? .56 : .62);
  const ghostLabelWidth = left - (width < 410 ? 16.37 : 12);
  const ticks = loading ? [0, .25, .5, .75, 1] : width < 410 ? legend ? [0, .5, 1] : [-.5, 0, .5, 1]
    : (legend ? [-.25, 0, .25, .5, .75, 1] : [-.5, -.25, 0, .25, .5, .75, 1]);
  const active = selection.active;
  const values = order.map(index => series.map(item => item.values[index] ?? 0));
  const totals = values.map(row => row.reduce((sum, item) => sum + item, 0));
  const net = active === null ? 0 : Math.round(values[active].reduce((score, value, index) => score + value * (index === neutral ? 0 : index < 2 ? -1 : 1), 0) / totals[active] * 100);
  const [headline, caption] = captions[id] ?? captions["diverging-default"];
  const stage = <div className={styles.stage}>
    <svg ref={plot} role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading} tabIndex={compact || loading ? undefined : 0}
      viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: legend ? "3 / 2" : "16 / 9" }}
      onKeyDown={event => selection.keyboard(event, categories.length, true)}
      onPointerLeave={event => { if (event.pointerType !== "touch") selection.setActive(null); }} onBlur={() => selection.setActive(null)}>
      {!compact && ticks.map((value, index) => {
        const at = x(value);
        const first = value === minimum;
        const last = index === ticks.length - 1;
        return <g key={value}>
          {!legend && value !== (loading ? .5 : 0) && <QuantityGrid at={at} from={top} to={bottom} />}
          {loading ? <rect x={first ? at : last ? at - 26 : at - 13} y={bottom + 10} width={26} height={8} rx={4} data-mark="diverging-bone" {...ghostPaint} />
            : <text x={at} y={bottom + 14} fontSize={12} fill="var(--muted-foreground)" dominantBaseline="middle" textAnchor={first ? "start" : last ? "end" : "middle"}>{Math.abs(value) * 100}%</text>}
        </g>;
      })}
      {order.map((index, row) => {
        const center = top + (row + .5) * band;
        const barTop = center - barHeight / 2;
        const data = values[row];
        const total = totals[row];
        const label = categories[index];
        let start = -(data[0] + data[1] + (data[neutral] ?? 0) / 2) / total;
        return <g key={label} data-diverging-row={label}
          onPointerEnter={() => { if (!compact && !loading) selection.setActive(row); }}
          onPointerDown={() => { if (!compact && !loading) selection.setActive(row); }}>
          {!loading && <rect x={0} y={center - band / 2} width={width} height={band} fill="transparent" />}
          {!compact && (loading ? <rect data-mark="diverging-bone" x={(left - 12) - ghostLabelWidth * divergingGhosts[row].label}
            y={center - 4} width={ghostLabelWidth * divergingGhosts[row].label} height={8} rx={4} {...ghostPaint} />
            : <text x={left - 12} y={center} fill="var(--foreground)" textAnchor="end" dominantBaseline="middle" fontSize={12}>
              {shrink(label, left - 12, measure)}
            </text>)}
          {loading ? divergingGhosts[row].sizes.map((value, layer, all) => {
            const span = (right - left) / 2;
            const cellWidth = Math.max(0, value * span - (layer % 2 ? 2 : .5));
            const at = layer === 0 ? zero - cellWidth : layer === 1 ? zero - (all[0] + value) * span + .5 : layer === 2 ? zero : zero + all[2] * span + 1.5;
            return <rect key={layer} data-mark="diverging-bone" x={qtyRound(at)} y={qtyRound(barTop)} width={qtyRound(cellWidth)} height={qtyRound(barHeight)} rx={4} {...ghostPaint} />;
          }) : data.map((value, layer) => {
            const end = start + value / total;
            const x0 = x(start);
            const x1 = Math.max(x0, x(end) - (layer === data.length - 1 ? 0 : 1));
            const fill = color(layer);
            const text = qtyPercent(value, total);
            const labelFits = !legend && !compact && x1 - x0 >= measure(text, 11) + (width < 410 ? 8 : 10);
            start = end;
            return <g key={layer} opacity={(active === null || active === row) && (selection.emphasis === null || selection.emphasis === layer) ? 1 : .30}>
              <path data-mark="diverging-cell" data-series={series[layer].name} d={roundedBar(x0, x1, barTop, barHeight, layer === 0, layer === data.length - 1)}
                fill={fill} className={hasLoading ? styles.centerOut : undefined}
                style={hasLoading ? { "--diverging-zero": `${zero / width * 100}%` } as CSSProperties : undefined} />
              {labelFits && <text x={(x0 + x1) / 2} y={center + 1} fill={qtyContrast(fill)} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600}>{text}</text>}
            </g>;
          })}
        </g>;
      })}
      <line data-mark="diverging-zero" x1={zero} x2={zero} y1={top - 2} y2={bottom + 2} stroke="var(--foreground)" pointerEvents="none" />
    </svg>
    {!compact && !loading && active !== null && <QuantityTip label={categories[order[active]]}
      width={width} height={height} x={zero} y={top + active * band}
      rows={[...series.map((item, index) => ({ name: item.name, color: color(index), value: `${format(values[active][index])} · ${qtyPercent(values[active][index], totals[active])}` })),
        { name: "Net", color: "transparent", value: `${net > 0 ? "+" : net < 0 ? "−" : ""}${Math.abs(net)} pts` }]} />}
  </div>;
  return <div className={styles.frame} data-compact={compact || undefined}>
    {hasLoading && !compact && <QuantityLoading pressed={loading} onChange={value => { selection.setActive(null); setLoading(value); }} />}
    {legend && !compact ? <div className={styles.layout}>{stage}
      <QuantityLegend title="Customers" items={series.map((item, index) => ({ name: item.name, color: color(index), value: item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0) }))}
        focus={null} emphasized={selection.emphasis} pinned={selection.pinned} onFocus={selection.setEmphasis}
        onSelect={index => selection.setPinned(selection.pinned === index ? null : index)} />
    </div> : stage}
    {!compact && <QuantityCaption headline={loading ? "Fetching answers…" : headline} trend={!legend && !hasLoading}>{caption}</QuantityCaption>}
  </div>;
}
