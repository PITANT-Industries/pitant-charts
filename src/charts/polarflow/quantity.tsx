import { useId, useState } from "react";
import { useChartTheme } from "../theme";
import { Legend, metrics, number, Pattern, percent, seriesData, short, sum, tone, useLoading, type Metric, type Props } from "./shared";
import styles from "./styles.module.css";

const funnelLabels = ["Visitors", "Qualified", "Trial", "Proposal", "Won"];
const funnelValues = [12400, 8200, 4920, 2600, 1120];

export function Funnel({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const id = example.id;
  const rows = metrics(data, funnelLabels, funnelValues);
  const maximum = Math.max(1, ...rows.map(row => row.value));
  const vertical = id.includes("vertical");
  const straight = id === "funnel-vertical" || id === "funnel-straight";
  const grouped = id === "funnel-grouped" || id === "funnel-colors";
  const step = (vertical ? 188 : 368) / Math.max(1, rows.length);
  const width = vertical ? 134 : 66;
  const offset = vertical ? 21 : 26;
  const center = vertical ? 210 : 117;
  const current = active === null ? undefined : rows[active];
  const showHalo = !vertical && ["funnel-default", "funnel-pattern", "funnel-colors"].includes(id);
  const coords = (x: number, y: number) => vertical ? `${y} ${x}` : `${x} ${y}`;
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      <defs>{rows.map((row, index) => <g key={index}>
        <linearGradient id={`${uid}-gradient-${index}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0" stopColor={tone(theme, index, row.color)} />
          <stop offset="100%" stopColor={tone(theme, index + 1)} />
        </linearGradient>
        <Pattern id={`${uid}-pattern-${index}`} color={tone(theme, index, row.color)} />
      </g>)}</defs>
      {id === "funnel-grid" && rows.map((_, index) => <g key={index}>
        <rect x={offset + index * step} y="14" width={step} height="206" fill={theme.grid} opacity={index % 2 ? .46 : .18} />
        <line x1={offset + index * step} x2={offset + index * step} y1="14" y2="220" stroke={theme.grid} />
      </g>)}
      {rows.map((row, index) => {
        const a = offset + index * step + (vertical ? 1.8 : 2.8);
        const b = offset + (index + 1) * step - (vertical ? 1.8 : 2.8);
        const size = width * Math.max(.12, row.value / maximum);
        const next = width * Math.max(.08, (rows[index + 1]?.value ?? row.value * .62) / maximum);
        const middle = (a + b) / 2;
        const left = coords(a, center - size);
        const right = coords(b, center - next);
        const bottom = coords(b, center + next);
        const beginning = coords(a, center + size);
        const topEdge = straight ? `L ${right}` : `C ${coords(middle, center - size)} ${coords(middle, center - next)} ${right}`;
        const bottomEdge = straight ? `L ${beginning}` : `C ${coords(middle, center + next)} ${coords(middle, center + size)} ${beginning}`;
        const palette = id === "funnel-colors" ? ["#8a5df5", "#3a9fe9", "#36b18a", "#e7a33b", "#f27597"] : [];
        const color = tone(theme, index, row.color ?? palette[index]);
        const fill = id === "funnel-pattern" ? `url(#${uid}-pattern-${index})` :
          id === "funnel-gradient" || (id === "funnel-colors" && !index) ? `url(#${uid}-gradient-${index})` : color;
        return <g key={index} tabIndex={compact ? undefined : 0} aria-label={`${row.name}: ${row.value}`}
          onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}
          opacity={active === null || active === index ? 1 : .48} style={{ transition: "opacity 150ms" }}>
          <title>{`${row.name}: ${number.format(row.value)} (${percent(row.value, maximum).toFixed(1)}%)`}</title>
          <path d={`M ${left} ${topEdge} L ${bottom} ${bottomEdge} Z`} fill={fill} />
          {showHalo && [0, 1, 2].map(ring => <ellipse key={ring} cx={a + 2 + ring * 2.4} cy={center} rx={3 + ring * 1.9} ry={size - ring * 3} fill="none" stroke={theme.surface} strokeWidth="1" opacity=".33" />)}
          <g textAnchor="middle" pointerEvents="none" fontSize={vertical ? "11" : "9"} fill={theme.muted}>
            <text x={vertical ? center : grouped && id === "funnel-colors" ? a + 17 : middle} y={vertical ? middle + 4 : grouped ? 111 : 190}
              fill={vertical || grouped ? "#fff" : theme.text} fontSize={vertical ? 12 : 11} fontWeight="700">{short.format(row.value)}</text>
            <text x={vertical ? 365 : grouped && id === "funnel-colors" ? a + 17 : middle} y={vertical ? middle + 4 : grouped ? 123 : 205}
              fill={grouped ? "#fff" : theme.muted}>{row.name}</text>
            {(vertical || grouped) && <text x={vertical ? 42 : middle} y={vertical ? middle + 4 : 134} fill={vertical ? theme.muted : "#fff"}>{percent(row.value, maximum).toFixed(1)}%</text>}
          </g>
        </g>;
      })}
    </svg>
    {!compact && id === "funnel-interactive" && <div className={styles.hint}>
      {current && active !== null ? <><strong>{current.name}</strong> · {number.format(current.value)} · {active === 0 ? "First stage" : `${Math.max(0, 100 - percent(current.value, rows[active - 1]?.value ?? 0)).toFixed(1)}% drop-off`}</> : "Focus a stage to inspect drop-off"}
    </div>}
    {!compact && id === "funnel-legend" && <Legend items={rows} active={active} onActive={setActive} progress={maximum} theme={theme} />}
  </div>;
}

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
