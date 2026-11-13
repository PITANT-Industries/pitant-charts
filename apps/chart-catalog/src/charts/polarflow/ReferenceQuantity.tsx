import { useLayoutEffect, useMemo, useState } from "react";
import { usePlotSize } from "../usePlotSize";
import { useChartTheme } from "../theme";
import { QuantityCaption, QuantityGrid, QuantityLegend, QuantityLoading, QuantityTip,
  qtyColor, qtyContrast, qtyMix, qtyNumber, qtyPercent, qtyRound, quantityStyles as styles, useQuantitySelection } from "../QuantityDetail";
import { referenceMarimekkoData, referenceWaffleData } from "./reference-caller-data";
import { mekkoFixtures, waffleFixtures } from "./quantity-fixtures";
import type { Props } from "./shared";

const gridCaptions: Record<string, [string, string]> = {
  "waffle-default": ["Chrome brings 52 of every 100 visitors", "35,200 visitors this month, one cell per percentage point"],
  "waffle-progress": ["4,260 of 6,000 seats sold, 71% of capacity", "Each dot is 40 seats; 1,740 are still on sale"],
  "waffle-columns": ["Renewables made 62% of the quarter's power", "100 TWh in all, each cell half a terawatt-hour"],
  "waffle-loading": ["11,200 payments, 55% by card", "Turn loading off to fill the cells in from the skeleton"],
  "marimekko-default": ["North America is 37% of revenue, half of it enterprise", "$2.22B across five regions and three segments"],
  "marimekko-legend": ["Mobile is 51% of sessions, and 79% in India", "22,200 sessions from five countries"],
  "marimekko-loading": ["11,290 tickets, 40% by email", "Turn loading off to grow the columns from the skeleton"],
};

function waffleCounts(values: readonly number[], cells: number, total: number) {
  if (total <= 0) return values.map(() => 0);
  const shares = values.map(value => value / total * cells);
  const counts = shares.map(Math.floor);
  const capacity = Math.round(shares.reduce((a, b) => a + b, 0));
  const remaining = capacity - counts.reduce((a, b) => a + b, 0);
  shares.map((share, i) => ({ i, remainder: share - counts[i] })).sort((a, b) => b.remainder - a.remainder)
    .slice(0, remaining).forEach(({ i }) => { counts[i]++; });
  return counts;
}

export function ReferenceWaffle({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const id = example.id;
  const fixture = waffleFixtures[id as keyof typeof waffleFixtures] ?? waffleFixtures["waffle-default"];
  const model = useMemo(() => referenceWaffleData(data, fixture), [data, fixture]);
  const color = (index: number) => model.colors[index] ?? qtyColor(data ? index % theme.colors.length : index);
  const progress = id === "waffle-progress";
  const columns = id === "waffle-columns";
  const loadingVariant = id === "waffle-loading";
  const legend = id === "waffle-default" && !compact;
  const square = !progress && !columns;
  const [loading, setLoading] = useState(loadingVariant);
  const selection = useQuantitySelection();
  useLayoutEffect(() => {
    selection.setActive(null);
    selection.setEmphasis(null);
    selection.setPinned(null);
  }, [model]);
  const { plot, width, height } = usePlotSize<SVGSVGElement>(square ? 288 : 576, square ? 288 : columns ? 184.32 : 138.24);
  const cols = square ? 10 : 25;
  const rows = progress ? 6 : columns ? 8 : 10;
  const gap = progress ? 4 : columns ? 2 : 3;
  const size = Math.max(0, Math.min((width - (cols - 1) * gap) / cols, (height - (rows - 1) * gap) / rows));
  const step = size + gap;
  const offsetX = (width - (cols * step - gap)) / 2;
  const offsetY = (height - (rows * step - gap)) / 2;
  const capacity = cols * rows;
  const total = model.values.reduce<number>((sum, value) => sum + value, 0);
  const unsold = progress && (!data || model.names.at(-1) === "Still on sale");
  const values = unsold ? model.values.slice(0, -1) : model.values;
  const marks = waffleCounts(values, capacity, total).flatMap((count, index) => Array.from({ length: count }, () => index));
  const position = (index: number) => ({
    x: offsetX + (columns ? Math.floor(index / rows) : index % cols) * step,
    y: offsetY + (columns ? index % rows : Math.floor(index / cols)) * step,
  });
  const requested = selection.active ?? selection.emphasis;
  const active = total > 0 && requested !== null && requested < values.length ? requested : null;
  const hovered = active === null ? null : position(marks.indexOf(active) + Math.floor(marks.filter(v => v === active).length / 2));
  const stage = <div className={styles.stage} data-square={square || undefined}>
    <svg ref={plot} viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: `${cols} / ${rows}` }}
      role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading} tabIndex={compact || loading ? undefined : 0}
      onBlur={() => selection.setActive(null)} onPointerLeave={event => { if (event.pointerType !== "touch") selection.setActive(null); }}
      onKeyDown={event => selection.keyboard(event, values.length, true)}>
      {[...Array.from({ length: capacity - marks.length }, (_, i) => marks.length + i), ...marks.keys()].map(index => {
        const item = marks[index];
        const { x, y } = position(index);
        const fill = loading ? "var(--foreground)" : item === undefined ? "var(--muted)" : color(item);
        const attrs = {
          fill, "data-mark": loading ? "waffle-bone" : "waffle-cell", "data-index": index,
          "data-category": !loading ? model.names[item] : undefined,
          opacity: loading ? .7 : active === null || active === item ? 1 : .24,
          fillOpacity: loading ? .2 : undefined,
          className: loading ? styles.bone : loadingVariant ? styles.reveal : undefined,
          onPointerEnter: !compact && !loading && item !== undefined ? () => selection.setActive(item) : undefined,
          onPointerDown: !compact && !loading && item !== undefined ? () => selection.setActive(item) : undefined,
        };
        return progress ? <circle key={index} {...attrs} cx={qtyRound(x + size / 2)} cy={qtyRound(y + size / 2)} r={qtyRound(size / 2)} />
          : <rect key={index} {...attrs} x={qtyRound(x)} y={qtyRound(y)} width={qtyRound(size)} height={qtyRound(size)} rx={qtyRound(size * (columns ? .15 : .2))} />;
      })}
    </svg>
    {!compact && !loading && active !== null && hovered && <QuantityTip label={model.names[active]} x={hovered.x + size / 2} y={hovered.y + size} width={width} height={height}
      rows={[{ name: fixture.label, value: columns ? `${values[active].toFixed(1)} TWh` : `${qtyNumber.format(values[active])}${fixture.unit}`, color: color(active) },
        { name: "Share", value: qtyPercent(values[active], total), color: "transparent" }]} />}
  </div>;
  const caption = data ? [progress ? `${qtyNumber.format(values.reduce((sum, value) => sum + value, 0))} of ${qtyNumber.format(total)} seats sold` : `${qtyNumber.format(total)} ${fixture.label.toLowerCase()} in total`, `${model.values.length} categories · ${capacity} cells`] : gridCaptions[id] ?? gridCaptions["waffle-default"];
  return <div className={styles.frame} data-compact={compact || undefined}>
    {loadingVariant && !compact && <QuantityLoading pressed={loading} onChange={value => { selection.setActive(null); setLoading(value); }} />}
    {legend ? <div className={styles.layout}>{stage}
      <QuantityLegend title={fixture.label} items={values.map((value, index) => ({ name: model.names[index], value, color: color(index) }))}
        focus={selection.active} emphasized={selection.emphasis} pinned={selection.pinned} onFocus={selection.setEmphasis}
        onSelect={index => selection.setPinned(selection.pinned === index ? null : index)} />
    </div> : stage}
    {!loading && total <= 0 && !compact && <div role="status">No data available</div>}
    {!compact && <QuantityCaption headline={loading ? data ? "Fetching data…" : "Fetching payments…" : caption[0]} trend={!data && (progress || columns)}>{caption[1]}</QuantityCaption>}
  </div>;
}

const mekkoGhosts = {
  widths: [.14030, .19176, .32106, .34688],
  heights: [
    [.23415, .35326, .41259], [.44386, .35562, .20052],
    [.27258, .21590, .51152], [.31764, .36320, .31916],
  ],
};

function clip(text: string, width: number, font: string, ctx: CanvasRenderingContext2D | null, size = 12) {
  const measure = (value: string) => {
    if (!ctx) return value.length * size * .5;
    ctx.font = `500 ${size}px ${font}`;
    return ctx.measureText(value).width;
  };
  if (measure(text) <= width) return text;
  let end = text.length - 1;
  while (end >= 3 && measure(text.slice(0, end) + "…") > width) end--;
  return end >= 3 ? text.slice(0, end).trimEnd() + "…" : "";
}

export function ReferenceMarimekko({ example, compact, data }: Props) {
  const id = example.id;
  const fixture = mekkoFixtures[id as keyof typeof mekkoFixtures] ?? mekkoFixtures["marimekko-default"];
  const model = useMemo(() => referenceMarimekkoData(data, fixture), [data, fixture]);
  const legend = id === "marimekko-legend";
  const loadingVariant = id === "marimekko-loading";
  const theme = useChartTheme();
  const [loading, setLoading] = useState(loadingVariant);
  const [measure] = useState(() => typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d"));
  const selection = useQuantitySelection();
  useLayoutEffect(() => {
    selection.setActive(null);
    selection.setEmphasis(null);
    selection.setPinned(null);
  }, [model]);
  const { plot, width, height: measuredHeight } = usePlotSize<SVGSVGElement>(576, 324);
  const height = compact ? measuredHeight : width * (legend ? 2 / 3 : 9 / 16);
  const { categories, series } = model;
  const gap = legend ? 3 : 2;
  const left = legend || compact ? 0 : 44;
  const top = 6;
  const bottom = height - (compact ? 4 : 40);
  const totals = categories.map((_, index) => series.reduce((sum, row) => sum + row.values[index], 0));
  const total = totals.reduce((sum, value) => sum + value, 0);
  const format = (value: number) => !data && id === "marimekko-default" ? `$${qtyNumber.format(value)}M` : qtyNumber.format(value);
  const color = (index: number) => {
    const paletteIndex = loadingVariant ? series.length - 1 - index : index;
    return series[index]?.color ?? qtyColor(data ? paletteIndex % theme.colors.length : paletteIndex);
  };
  const plotWidth = Math.max(0, width - left - (categories.length - 1) * gap);
  const plotHeight = Math.max(0, bottom - top - (series.length - 1) * gap);
  const geometry = categories.map((name, index) => {
    const w = plotWidth * (loading ? data ? 1 / categories.length : mekkoGhosts.widths[index] : total > 0 ? totals[index] / total : 0);
    return { name, w, index };
  });
  let running = left;
  const bars = geometry.map(column => {
    const x = running;
    running += column.w + gap;
    return { ...column, x };
  });
  const active = selection.active !== null && selection.active < categories.length && totals[selection.active] > 0 ? selection.active : null;
  const tick = (value: number) => bottom - value * (bottom - top);
  const stage = <div className={styles.stage}>
    <svg ref={plot} viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: legend ? "3 / 2" : "16 / 9" }}
      role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading} tabIndex={compact || loading ? undefined : 0}
      onBlur={() => selection.setActive(null)} onPointerLeave={event => { if (event.pointerType !== "touch") selection.setActive(null); }}
      onKeyDown={event => selection.keyboard(event, categories.length, true)}>
      {!legend && !compact && [0, .25, .5, .75, 1].map(value => <g key={value}>
        <QuantityGrid horizontal at={tick(value)} from={left} to={width} />
        {loading ? <rect className={styles.bone} data-mark="mekko-bone" x={left - 32} y={tick(value) - 4} width={22} height={8} rx={4} fill="var(--foreground)" fillOpacity={.2} opacity={.7} />
          : <text x={left - 10} y={tick(value)} textAnchor="end" dominantBaseline="middle" fill="var(--muted-foreground)" fontSize={12}>{value * 100}%</text>}
      </g>)}
      {bars.map(({ name, x, w, index }) => {
        let y = bottom;
        const text = clip(name, w - 3, theme.fontFamily, measure);
        return <g key={name} data-mekko-column={name}
          onPointerEnter={() => { if (!loading && !compact) selection.setActive(index); }}
          onPointerDown={() => { if (!loading && !compact) selection.setActive(index); }}>
          {series.map((row, layer) => {
            const ratio = loading ? data ? 1 / series.length : mekkoGhosts.heights[index][layer] : totals[index] > 0 ? row.values[index] / totals[index] : 0;
            const h = plotHeight * ratio;
            y -= h;
            const topY = y;
            y -= gap;
            const fill = qtyMix(color(layer), 62);
            const valueLabel = clip(format(row.values[index]), w - 12, theme.fontFamily, measure, 11);
            return <g key={row.name} opacity={loading || (active === null || active === index) && (selection.emphasis === null || selection.emphasis === layer) ? 1 : .28}>
              <rect x={qtyRound(x)} y={qtyRound(topY)} width={qtyRound(w)} height={qtyRound(h)} rx={qtyRound(Math.min(4, h / 2, w / 2))} data-mark={loading ? "mekko-bone" : "mekko-cell"} data-series={!loading ? row.name : undefined}
                fill={loading ? "var(--foreground)" : fill} fillOpacity={loading ? .2 : undefined} opacity={loading ? .7 : undefined}
                stroke={loading ? undefined : qtyMix(color(layer), 88)} className={loading ? styles.bone : loadingVariant ? styles.growColumn : undefined} />
              {!compact && !loading && w >= 34 && h >= 22 && <text x={x + 7} y={topY + 13} dominantBaseline="middle" fontSize={12} fontWeight={600} fill={qtyContrast(fill)}>
                {qtyPercent(row.values[index], totals[index])}
              </text>}
              {!compact && !loading && legend && valueLabel && h >= 42 && <text x={x + 7} y={topY + 28} dominantBaseline="middle" fontSize={11} fontWeight={500} fill={qtyContrast(fill)}>
                {valueLabel}
              </text>}
            </g>;
          })}
          {!compact && (loading ? <g className={styles.bone} fill="var(--foreground)" fillOpacity={.2} opacity={.7}>
            <rect data-mark="mekko-bone" x={x + (w - Math.min(44, w * .6)) / 2} y={bottom + 10} width={Math.min(44, w * .6)} height={8} rx={4} />
            <rect data-mark="mekko-bone" x={x + (w - Math.min(26, w * .4)) / 2} y={bottom + 27} width={Math.min(26, w * .4)} height={6} rx={3} />
          </g> : w >= 28 && text && <g textAnchor="middle" dominantBaseline="middle">
            <text x={x + w / 2} y={bottom + 14} fontSize={12} fontWeight={500} fill="var(--foreground)">{text}</text>
            <text x={x + w / 2} y={bottom + 30} fontSize={11} fill="var(--muted-foreground)">{qtyPercent(totals[index], total)}</text>
          </g>)}
        </g>;
      })}
    </svg>
    {!compact && !loading && active !== null && <QuantityTip label={`${categories[active]} · ${qtyPercent(totals[active], total)} of the total`}
      x={bars[active].x + bars[active].w / 2} y={top + 8} width={width} height={height}
      rows={series.map((row, index) => ({ name: row.name, value: `${format(row.values[active])} · ${qtyPercent(row.values[active], totals[active])}`, color: color(index) }))} />}
  </div>;
  const caption = data ? [`${format(total)} in total`, `${categories.length} categories across ${series.length} series`] : gridCaptions[id] ?? gridCaptions["marimekko-default"];
  return <div className={styles.frame} data-compact={compact || undefined}>
    {loadingVariant && !compact && <QuantityLoading pressed={loading} onChange={value => { selection.setActive(null); setLoading(value); }} />}
    {legend && !compact ? <div className={styles.layout}>{stage}
      <QuantityLegend title="Sessions" items={series.map((row, index) => ({ name: row.name, value: row.values.reduce<number>((sum, v) => sum + v, 0), color: color(index) }))}
        focus={null} emphasized={selection.emphasis} pinned={selection.pinned} onFocus={selection.setEmphasis}
        onSelect={index => selection.setPinned(selection.pinned === index ? null : index)} />
    </div> : stage}
    {!loading && total <= 0 && !compact && <div role="status">No data available</div>}
    {!compact && <QuantityCaption headline={loading ? data ? "Fetching data…" : "Fetching tickets…" : caption[0]} trend={!data && !legend && !loadingVariant}>{caption[1]}</QuantityCaption>}
  </div>;
}
