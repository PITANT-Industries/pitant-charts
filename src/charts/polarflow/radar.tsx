import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { nextChartFocus, number, point, seriesData, tone, type Props } from "./shared";
import styles from "./styles.module.css";
import flow from "./flow.module.css";

const engagement = ["Engagement", "Pages/Session", "Session Duration", "Conversion", "Retention"];
const scooters = ["Speed", "Reliability", "Comfort", "Efficiency", "Safety"];
const campaigns = [[72, 68, 70, 75, 65], [85, 45, 40, 30, 88], [45, 90, 92, 88, 42], [95, 35, 25, 55, 78]];
const fixtureById: Record<string, { categories: string[]; names: string[]; values: number[][]; colors?: number[] }> = {
  "radar-default": { categories: engagement, names: ["Google Search", "Display Ads", "Newsletter", "Social"], values: campaigns },
  "radar-hover": { categories: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Node"], names: ["Web team", "Platform team"], values: [[90, 80, 85, 70, 75, 40], [60, 55, 90, 88, 65, 85]], colors: [0, 2] },
  "radar-minimal": { categories: ["Test coverage", "Security", "Accessibility", "Performance", "Docs"], names: ["Release readiness"], values: [[85, 90, 78, 72, 60]] },
  "radar-hover-legend": { categories: [...engagement.slice(0, 2), "Duration", ...engagement.slice(3)], names: ["Search", "Display", "Newsletter", "Social"], values: campaigns },
  "radar-triangle": { categories: ["Speed", "Uptime", "Value"], names: ["Edge", "Starter"], values: [[90, 75, 30], [35, 40, 95]], colors: [0, 3] },
  "radar-fill-only": { categories: ["JS", "TS", "React", "CSS", "Node", "SQL"], names: ["Team A", "Team B"], values: [[95, 90, 88, 75, 82, 70], [70, 50, 65, 80, 40, 35]], colors: [0, 2] },
  "radar-single": { categories: scooters, names: ["E-scooter"], values: [[95, 40, 20, 90, 55]], colors: [1] },
  "radar-levels": { categories: scooters, names: ["Model A", "Model B"], values: [[85, 78, 92, 70, 88], [72, 90, 65, 88, 75]], colors: [0, 2] },
  "radar-grid-only": { categories: ["Response time", "Resolution", "Satisfaction"], names: ["Tier 1", "Tier 2"], values: [[92, 62, 78], [48, 90, 84]], colors: [0, 3] },
};

export function Radar({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const glowId = useId();
  const [hovered, setHover] = useState<number | null>(null);
  const [focused, setFocus] = useState<number | null>(null);
  const [pinned, setPin] = useState<number | null>(null);
  const [metric, setMetric] = useState<number | null>(null);
  const active = hovered ?? focused ?? pinned;
  const minimal = id === "radar-minimal";
  const fillOnly = id === "radar-fill-only";
  const controlled = id === "radar-hover";
  const levels = id === "radar-levels";
  const noSpokes = minimal || fillOnly || levels || id === "radar-grid-only";
  const showRingValues = !minimal && !fillOnly && !levels && !controlled;
  const showDots = !fillOnly && !levels && id !== "radar-single";
  const fixture = fixtureById[id] ?? fixtureById["radar-default"];
  const { categories, series } = seriesData(data, fixture.categories, fixture.names.map((name, index) => ({ name, values: fixture.values[index] })));
  const count = categories.length;
  const max = series.reduce((outer, row) => row.values.reduce<number>((inner, value) => Math.max(inner, Number(value ?? 0)), outer), 100);
  const radius = minimal ? 88 : 85;
  const origin = [210, 119] as const;
  const gridLevels = levels ? 3 : controlled ? 4 : 5;
  const coords = (index: number, r: number) => point(...origin, r, -90 + index * 360 / Math.max(1, count));
  const points = (values: readonly (number | null)[]) => categories.map((_, index) => coords(index, Math.max(0, Number(values[index] ?? 0)) / max * radius).join(",")).join(" ");
  const ring = (level: number) => categories.map((_, index) => coords(index + .5, radius * level / gridLevels).join(",")).join(" ");
  const colors = series.map((row, index) => tone(theme, data ? index : fixture.colors?.[index] ?? index, row.color));
  const summary = metric === null ? "" : `${categories[metric]}: ${series.map((row) => `${row.name} ${number.format(Number(row.values[metric] ?? 0))}`).join(", ")}`;
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (active !== null || metric !== null)) {
      event.preventDefault(); setHover(null); setFocus(null); setPin(null); setMetric(null); return;
    }
    if ((event.key === "Enter" || event.key === " ") && active !== null) {
      event.preventDefault(); setPin(pinned === active ? null : active); return;
    }
    const next = nextChartFocus(event.key, controlled ? focused : metric, controlled ? series.length : count);
    if (next !== undefined) {
      event.preventDefault(); setHover(null);
      if (controlled) { setFocus(next); setMetric(metric ?? 0); } else setMetric(next);
    }
  }
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-roledescription="chart" aria-label={example.title}
      tabIndex={compact ? undefined : 0} onKeyDown={key} onFocus={() => { if (count) setMetric(0); if (controlled && series.length) setFocus(0); }}
      onBlur={() => { setFocus(null); setMetric(null); }} onPointerLeave={() => { setHover(null); setMetric(null); }}>
      {id === "radar-default" && <defs>{colors.map((color, index) => <filter key={index} id={`${glowId}-${index}`} x="-45%" y="-45%" width="190%" height="190%">
        <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor={color} floodOpacity=".7" />
      </filter>)}</defs>}
      {!minimal && Array.from({ length: gridLevels }, (_, i) => <g key={i}>
        <polygon data-radar-ring="" points={ring(i + 1)} fill="none" stroke={theme.grid} />
        {showRingValues && <text data-radar-ring-value="" x="214" y={120 - (i + 1) * radius / gridLevels}
          fill={theme.muted} fontSize="6.5">{number.format((i + 1) * max / gridLevels)}</text>}
      </g>)}
      {categories.map((category, index) => {
        const [x, y] = coords(index, radius);
        const [tx, ty] = coords(index, radius + 15);
        return <g key={index} onPointerEnter={() => setMetric(index)}>
          {!noSpokes && <line data-radar-spoke="" x1={origin[0]} y1={origin[1]} x2={x} y2={y} stroke={theme.grid} />}
          <text data-radar-label={category} x={tx} y={ty + 2.5} fontSize="7" textAnchor="middle"
            fontWeight={controlled && metric === index ? "650" : undefined} fill={controlled && metric === index ? theme.text : theme.muted}>{category}</text>
        </g>;
      })}
      {series.map((row, index) => {
        const color = colors[index];
        const highlighted = active === index && !minimal;
        return <g key={index} data-radar-series={row.name} data-active={active === index} data-dimmed={active !== null && active !== index && !minimal}
          className={`${flow.radarSeries} ${!minimal && !compact ? flow.radarEntrance : ""}`}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") setHover(index); }} onPointerLeave={() => setHover(null)}
          onPointerDown={(event) => { if (event.pointerType === "touch") setPin(pinned === index ? null : index); }}>
          <polygon className={minimal ? undefined : flow.radarShape} points={points(row.values)} fill={color} fillOpacity={highlighted ? .34 : fillOnly ? .38 : .21}
            stroke={fillOnly ? "none" : color} strokeWidth="1.25"
            filter={highlighted && id === "radar-default" ? `url(#${glowId}-${index})` : undefined} />
          {showDots && categories.map((_, position) => {
            const value = row.values[position];
            if (value == null || (controlled && metric !== position)) return null;
            const [x, y] = coords(position, Math.max(0, value) / max * radius);
            return <circle data-radar-dot="" key={position} cx={x} cy={y} r={metric === position ? 3.5 : 2.4} fill={color} stroke={theme.surface} strokeWidth=".8" />;
          })}
        </g>;
      })}
      {controlled && categories.map((label, index) => {
        const [x, y] = coords(index, radius + 12);
        return <circle key={label} data-radar-metric={label} cx={x} cy={y} r="11" fill="transparent" onPointerEnter={() => setMetric(index)} />;
      })}
    </svg>
    {!compact && controlled && <div className={flow.flowFooter} role="status">{active === null ? "Hover a shape to highlight a team" : `Highlighting the ${series[active]?.name}`}</div>}
    {!compact && id === "radar-hover-legend" && <div className={flow.radarLegend} aria-label="Average score">
      <span>Average score</span>
      {series.map((row, index) => {
        const average = row.values.slice(0, count).reduce<number>((total, value) => total + Number(value ?? 0), 0) / Math.max(1, count);
        return <Toggle key={index} pressed={pinned === index} data-active={active === index} data-dimmed={active !== null && active !== index}
          onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)} onFocus={() => setFocus(index)} onBlur={() => setFocus(null)}
          onPressedChange={(pressed) => setPin(pressed ? index : null)}><i style={{ backgroundColor: colors[index] }} />{row.name} <strong>{Math.round(average)}%</strong></Toggle>;
      })}
    </div>}
    {!compact && <div className={styles.screenReader} role="status" aria-atomic="true">{summary}</div>}
  </div>;
}
