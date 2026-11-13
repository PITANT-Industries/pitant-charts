import { useState } from "react";
import { useChartTheme } from "../theme";
import { Legend, metrics, number, seriesData, sum, tone, type Metric, type Props } from "./shared";
import { hierarchyShare, selectMark, useChartLoading } from "./hierarchy-interaction";
import { waffleFixtures, mekkoFixtures } from "./quantity-fixtures";
import styles from "./styles.module.css";
import charts from "./hierarchy-charts.module.css";

export { Funnel } from "./funnel";

function allocateCells(rows: Metric[], capacity: number, total: number) {
  if (!total) return rows.map(() => 0);
  let accrued = 0;
  let assigned = 0;
  return rows.map(row => {
    accrued += Math.max(0, row.value);
    const next = Math.min(capacity, Math.round(capacity * accrued / total));
    const count = next - assigned;
    assigned = next;
    return count;
  });
}

export function Waffle({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, hasDemo, control } = useChartLoading(example.id, compact);
  const [active, setActive] = useState<number | null>(null);
  const fixture = waffleFixtures[example.id as keyof typeof waffleFixtures] ?? waffleFixtures["waffle-default"];
  const progress = example.id === "waffle-progress";
  const byColumn = example.id === "waffle-columns";
  const width = byColumn || progress ? 25 : 10;
  const height = byColumn ? 8 : progress ? 6 : 10;
  const rows = metrics(data, fixture.names, fixture.values);
  const total = sum(rows);
  const isUnsold = (index: number) => progress && index === rows.length - 1 && (!data || rows[index].name === "Still on sale");
  const sold = rows.reduce((value, row, index) => value + (isUnsold(index) ? 0 : Math.max(0, row.value)), 0);
  const hasLegend = !compact && !progress && !byColumn && !hasDemo;
  const categories = allocateCells(rows, width * height, total).flatMap((count, category) => Array.from({ length: count }, () => category));
  const gap = byColumn ? 1 : 1.3;
  const size = 12;
  const step = size + gap;
  const activeRow = active === null ? undefined : rows[active];
  const plot = <div className={styles.graph}>
    <svg className={`${styles.native} ${charts.plot}`} viewBox={`0 0 ${width * step - gap} ${height * step - gap}`}
      role="img" aria-roledescription="chart" aria-label={example.title} aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0}
      onKeyDown={event => selectMark(event, active, rows.length, setActive)} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}>
      {Array.from({ length: width * height }, (_, index) => {
        const category = categories[index] ?? -1;
        const item = rows[category];
        const x = (byColumn ? Math.floor(index / height) : index % width) * step;
        const y = (byColumn ? index % height : Math.floor(index / width)) * step;
        const color = loading || !item || isUnsold(category) ? theme.grid : tone(theme, category, item.color);
        const attributes = {
          fill: color, opacity: active === null || category === active ? 1 : .28,
          className: loading ? charts.bone : hasDemo ? charts.reveal : undefined,
          style: hasDemo ? { animationDelay: `${index * (loading ? 10 : 4)}ms` } : undefined,
          "data-mark": "waffle-cell", "data-category": loading ? undefined : item?.name,
          onPointerEnter: !loading && !compact && item ? () => setActive(category) : undefined,
        };
        return progress ? <circle key={`${loading}-${index}`} cx={x + size / 2} cy={y + size / 2} r={size / 2} {...attributes} /> :
          <rect key={`${loading}-${index}`} x={x} y={y} width={size} height={size} rx={byColumn ? 1 : 2} {...attributes} />;
      })}
    </svg>
    {!compact && !loading && activeRow && <div className={`${charts.tip} ${charts.floating}`} role="status">
      <strong>{activeRow.name}</strong><span>{isUnsold(active!) ? "Available" : fixture.label}</span>{number.format(activeRow.value)}{fixture.unit}
      <span>Share</span>{hierarchyShare(activeRow.value, total)}
    </div>}
  </div>;
  return <div className={`${styles.frame} ${charts.wrap}`}>
    {control}
    {hasLegend ? <div className={charts.sideBySide}>{plot}<div className={charts.sideLegend}><p>{fixture.label}</p>
      <Legend items={rows} active={active} onActive={setActive} theme={theme} />
    </div></div> : plot}
    {!compact && <p className={styles.hint}>{loading ? "Fetching payments…" : progress ? `${number.format(sold)} of ${number.format(total)} seats sold, ${hierarchyShare(sold, total)} of capacity` : !data ? fixture.foot : null}</p>}
  </div>;
}

export function Marimekko({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, hasDemo, control } = useChartLoading(example.id, compact);
  const [column, setColumn] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const legend = example.id === "marimekko-legend";
  const money = !data && example.id === "marimekko-default";
  const fixture = mekkoFixtures[example.id as keyof typeof mekkoFixtures] ?? mekkoFixtures["marimekko-default"];
  const { categories, series } = seriesData(data, fixture.categories, fixture.series);
  const totals = categories.map((_, index) => series.reduce((total, row) => total + Math.max(0, row.values[index] ?? 0), 0));
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const items: Metric[] = series.map(row => ({ name: row.name, color: row.color, value: row.values.reduce<number>((total, value) => total + Math.max(0, value ?? 0), 0) }));
  const format = (value: number) => money ? `$${number.format(value)}M` : number.format(value);
  const plotLeft = legend ? 4 : 41;
  const plotWidth = 590 - plotLeft;
  const plotHeight = 268;
  const base = 278;
  let x = plotLeft;
  const plot = <div className={styles.graph}>
    <svg className={`${styles.native} ${charts.plot}`} viewBox="0 0 600 322" role="img" aria-roledescription="chart" aria-label={example.title}
      aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0}
      onPointerLeave={() => setColumn(null)} onBlur={() => setColumn(null)} onKeyDown={event => selectMark(event, column, categories.length, setColumn)}>
      {!legend && [0, 25, 50, 75, 100].map(value => <g key={value}>
        <line data-mekko-grid="" x1={plotLeft} y1={base - value / 100 * plotHeight} x2="590" y2={base - value / 100 * plotHeight} stroke={theme.grid} />
        {!loading && <text x={plotLeft - 5} y={base - value / 100 * plotHeight + 3} textAnchor="end" fontSize="10" fill={theme.muted}>{value}%</text>}
      </g>)}
      {loading ? Array.from({ length: 25 }, (_, index) => <rect key={`skeleton-${index}`} data-mark="mekko-placeholder" x={plotLeft + index % 5 * plotWidth / 5}
        y={10 + Math.floor(index / 5) * plotHeight / 5} width={plotWidth / 5 - 2} height={plotHeight / 5 - 2}
        rx="3" fill={theme.grid} className={charts.bone} style={{ animationDelay: `${index * 32}ms` }} />) : categories.map((name, index) => {
        const left = x;
        const width = grandTotal > 0 ? plotWidth * totals[index] / grandTotal : 0;
        x += width;
        let y = base;
        return <g key={index} data-mekko-column={name} onPointerEnter={!compact ? () => setColumn(index) : undefined}>
          {series.map((row, layer) => {
            const value = Math.max(0, row.values[index] ?? 0);
            const height = totals[index] > 0 ? plotHeight * value / totals[index] : 0;
            y -= height;
            if (width <= 0 || height <= 0) return null;
            const color = tone(theme, layer, row.color);
            const opacity = (active === null || active === layer) && (column === null || column === index) ? 1 : .31;
            return <g key={layer} opacity={opacity} className={hasDemo ? charts.grow : undefined} style={hasDemo ? { animationDelay: `${index * 36 + layer * 13}ms` } : undefined}>
              <rect data-mark="mekko-cell" data-series={row.name} x={left + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx="3"
                fill={`color-mix(in oklab, ${color} 60%, ${theme.surface})`} stroke={color} strokeOpacity=".44" />
              {width > 21 && height > 18 && <text x={left + width / 2} y={y + height / 2 + 3 - (legend && height > 30 ? 6 : 0)} textAnchor="middle" fontSize="11" fill={theme.text}>
                {hierarchyShare(value, totals[index])}
                {legend && height > 30 && <tspan x={left + width / 2} dy="13" fontSize="9">{format(value)}</tspan>}
              </text>}
            </g>;
          })}
          {width > 20 && <text x={left + width / 2} y="294" textAnchor="middle" fontSize="10" fill={theme.text}>
            {name.length * 5.4 > width ? `${name.slice(0, Math.max(1, Math.floor(width / 5.4) - 1))}…` : name}
            <tspan x={left + width / 2} dy="13" fill={theme.muted}>{hierarchyShare(totals[index], grandTotal)}</tspan>
          </text>}
        </g>;
      })}
    </svg>
    {!compact && !loading && column !== null && categories[column] && <div className={`${charts.tip} ${charts.floating}`} role="status">
      <strong>{categories[column]} · {hierarchyShare(totals[column], grandTotal)} of the total</strong>
      {series.map((row, index) => <div key={index} style={{ display: "contents" }}><span>{row.name}</span><b>{format(Math.max(0, row.values[column] ?? 0))} · {hierarchyShare(Math.max(0, row.values[column] ?? 0), totals[column])}</b></div>)}
    </div>}
  </div>;
  return <div className={`${styles.frame} ${charts.wrap}`}>
    {control}
    {legend && !compact ? <div className={charts.sideBySide}>{plot}<div className={charts.sideLegend}><p>Sessions</p><Legend items={items} active={active} onActive={setActive} theme={theme} /></div></div> : plot}
    {!compact && <p className={styles.hint}>{loading ? "Fetching tickets…" : !data ? fixture.foot : null}</p>}
  </div>;
}
