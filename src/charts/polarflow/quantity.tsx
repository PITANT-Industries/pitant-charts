import { useId, useState } from "react";
import { useChartTheme } from "../theme";
import { Legend, metrics, number, percent, seriesData, sum, tone, useLoading, type Metric, type Props } from "./shared";
import styles from "./styles.module.css";

export { Funnel } from "./funnel";

export function Waffle({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, control } = useLoading(example.id, compact);
  const [active, setActive] = useState<number | null>(null);
  const progress = example.id === "waffle-progress";
  const columns = example.id === "waffle-columns";
  const width = columns ? 25 : 10;
  const height = columns ? 8 : 10;
  const rows = metrics(data, progress ? ["Seats sold", "Open seats"] : columns ? ["Solar", "Wind", "Hydro", "Gas"] : ["Chrome", "Safari", "Edge", "Firefox", "Other"], progress ? [4120, 1880] : columns ? [42, 30, 19, 9] : [58, 21, 11, 6, 4]);
  const total = sum(rows);
  const gap = columns ? 2.5 : 4;
  const size = columns ? 12 : 15;
  const x0 = (420 - width * (size + gap)) / 2;
  const y0 = progress ? 13 : (240 - height * (size + gap)) / 2;
  const thresholds = rows.map((_, index) => rows.slice(0, index + 1).reduce((value, row) => value + Math.max(0, row.value), 0));
  return <div className={styles.frame}>
    <svg className={`${styles.native} ${loading ? styles.loading : ""}`} viewBox="0 0 420 240" role="img" aria-label={loading ? `Loading ${example.title}` : example.title}>
      {Array.from({ length: width * height }, (_, index) => {
        const col = columns ? Math.floor(index / height) : index % width;
        const row = columns ? index % height : Math.floor(index / width);
        const category = thresholds.findIndex(threshold => (index + .5) / (width * height) * total <= threshold);
        const item = rows[category];
        const color = loading || !item || (progress && category === 1) ? theme.grid : tone(theme, category, item.color);
        return <rect key={index} x={x0 + col * (size + gap)} y={y0 + row * (size + gap)} width={size} height={size} rx={progress ? size / 2 : 3}
          fill={color} opacity={active === null || category === active ? 1 : .27} onMouseEnter={() => !loading && setActive(category)} onMouseLeave={() => setActive(null)}>
          {item && <title>{`${item.name} · ${percent(item.value, total).toFixed(1)}%`}</title>}
        </rect>;
      })}
      {progress && !loading && <text x="210" y="224" textAnchor="middle" fontSize="16" fill={theme.text} fontWeight="650">
        {number.format(rows[0]?.value ?? 0)} / {number.format(total)} seats
      </text>}
    </svg>
    {!compact && !loading && !progress && <Legend items={rows} active={active} onActive={setActive} theme={theme} />}
    {control}
  </div>;
}

export function Marimekko({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, control } = useLoading(example.id, compact);
  const [active, setActive] = useState<number | null>(null);
  const legend = example.id === "marimekko-legend";
  const { categories, series } = seriesData(data, legend ? ["US", "UK", "DE", "NL", "AU"] : ["North", "South", "East", "West", "Central"], [
    { name: legend ? "Mobile" : "Enterprise", values: [48, 38, 32, 19, 12] },
    { name: legend ? "Desktop" : "Mid-market", values: [26, 34, 31, 24, 15] },
    { name: legend ? "Tablet" : "Small business", values: [12, 18, 24, 18, 14] },
  ]);
  const totals = categories.map((_, index) => series.reduce((total, row) => total + Math.max(0, Number(row.values[index] ?? 0)), 0));
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const items: Metric[] = series.map(row => ({ name: row.name, color: row.color, value: row.values.reduce<number>((total, value) => total + Math.max(0, Number(value ?? 0)), 0) }));
  let x = 22;
  return <div className={styles.frame}>
    <svg className={`${styles.native} ${loading ? styles.loading : ""}`} viewBox="0 0 420 240" role="img" aria-label={loading ? `Loading ${example.title}` : example.title}>
      {categories.map((name, index) => {
        const left = x;
        const width = grandTotal > 0 ? 376 * totals[index] / grandTotal : 0;
        x += width;
        let y = 208;
        return <g key={index}>
          {series.map((row, layer) => {
            const value = Math.max(0, Number(row.values[index] ?? 0));
            const height = totals[index] > 0 ? 184 * value / totals[index] : 0;
            y -= height;
            return <rect key={layer} x={left + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx="2"
              fill={loading ? theme.grid : tone(theme, layer, row.color)} opacity={active === null || active === layer ? 1 : .28}
              tabIndex={compact || loading ? undefined : 0} aria-label={`${name} · ${row.name}: ${value}`}
              onMouseEnter={() => !loading && setActive(layer)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(layer)} onBlur={() => setActive(null)}>
              <title>{`${name} · ${row.name}: ${number.format(value)}`}</title>
            </rect>;
          })}
          {width > 34 && <text x={left + width / 2} y="225" textAnchor="middle" fontSize="10" fill={theme.muted}>{name}</text>}
        </g>;
      })}
    </svg>
    {!compact && legend && <Legend items={items} active={active} onActive={setActive} theme={theme} />}
    {control}
  </div>;
}
