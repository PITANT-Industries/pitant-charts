import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { nextChartFocus, number, point, seriesData, tone, type Props } from "./shared";
import styles from "./styles.module.css";
import radar from "./radar.module.css";

const engagement = ["Engagement", "Pages/Session", "Session Duration", "Conversion", "Retention"];
const scooters = ["Speed", "Reliability", "Comfort", "Efficiency", "Safety"];
const campaigns = [[72, 68, 70, 75, 65], [85, 45, 40, 30, 88], [45, 90, 92, 88, 42], [95, 35, 25, 55, 78]];
const scoreNote = "Scores range from 0 to 100";
const teamNote = "Self-assessed scores from 0 to 100";

type Fixture = {
  categories: string[];
  names: string[];
  values: number[][];
  colors?: number[];
  footer: readonly [headline: string, detail: string];
};

const fixtureById: Record<string, Fixture> = {
  "radar-default": {
    categories: engagement, names: ["Google Search", "Display Ads", "Newsletter", "Social"], values: campaigns,
    footer: ["The newsletter leads conversion at 88", scoreNote],
  },
  "radar-hover": {
    categories: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Node"], names: ["Web team", "Platform team"],
    values: [[90, 80, 85, 70, 75, 40], [60, 55, 90, 88, 65, 85]], colors: [0, 2],
    footer: ["Hover a shape to highlight a team", teamNote],
  },
  "radar-minimal": {
    categories: ["Test coverage", "Security", "Accessibility", "Performance", "Docs"], names: ["v4.2"], values: [[85, 90, 78, 72, 60]],
    footer: ["Security scores 90", "Documentation scores 60, the lowest of the five metrics"],
  },
  "radar-hover-legend": {
    categories: [...engagement.slice(0, 2), "Duration", ...engagement.slice(3)], names: ["Search", "Display", "Newsletter", "Social"], values: campaigns,
    footer: ["The newsletter leads with an average of 71", "Select a shape or a legend row to compare campaigns"],
  },
  "radar-triangle": {
    categories: ["Speed", "Uptime", "Value"], names: ["Edge plan", "Starter plan"], values: [[90, 75, 30], [35, 40, 95]], colors: [0, 3],
    footer: ["Edge scores 90 for speed, compared with Starter at 35", scoreNote],
  },
  "radar-fill-only": {
    categories: ["JS", "TS", "React", "CSS", "Node", "SQL"], names: ["Senior", "Junior"], values: [[95, 90, 88, 75, 82, 70], [70, 50, 65, 80, 40, 35]], colors: [0, 2],
    footer: ["Node has the widest gap at 42 points", teamNote],
  },
  "radar-single": {
    categories: scooters, names: ["Model S2"], values: [[95, 40, 20, 90, 55]], colors: [1],
    footer: ["Speed and efficiency lead the road test", "Speed scores 95 and comfort scores 20"],
  },
  "radar-levels": {
    categories: scooters, names: ["Model A", "Model B"], values: [[85, 78, 92, 70, 88], [72, 90, 65, 88, 75]], colors: [0, 2],
    footer: ["Model A leads in comfort and Model B in reliability", "Average owner scores from 0 to 100"],
  },
  "radar-grid-only": {
    categories: ["Response time", "Resolution", "Satisfaction"], names: ["Tier 1", "Tier 2"], values: [[92, 62, 78], [48, 90, 84]], colors: [0, 3],
    footer: ["Tier 2 scores 90 on resolution", scoreNote],
  },
};

function score(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function Radar({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const instructions = useId();
  const [hovered, setHover] = useState<number | null>(null);
  const [focused, setFocus] = useState<number | null>(null);
  const [pinned, setPin] = useState<number | null>(null);
  const [metric, setMetric] = useState<number | null>(null);
  const minimal = id === "radar-minimal";
  const fillOnly = id === "radar-fill-only";
  const controlled = id === "radar-hover";
  const levels = id === "radar-levels";
  const legend = id === "radar-hover-legend" && !compact;
  const noSpokes = minimal || fillOnly || levels || id === "radar-grid-only";
  const showRingValues = !minimal && !fillOnly && !levels && !controlled;
  const showDots = !fillOnly && !levels && id !== "radar-single";
  const limit = minimal ? 320 : 384;
  const { plot, width } = usePlotSize<SVGSVGElement>(limit, limit);
  const fixture = fixtureById[id] ?? fixtureById["radar-default"];
  const animate = !minimal && !compact;
  const { categories, series } = seriesData(data, fixture.categories, fixture.names.map((name, index) => ({ name, values: fixture.values[index] })));
  const count = categories.length;
  const gridLevels = minimal ? 0 : levels ? 3 : controlled ? 4 : 5;
  const max = series.reduce((outer, row) => row.values.reduce<number>((inner, value) => Math.max(inner, score(value) ?? 0), outer), 100);
  const center = width / 2;
  const radius = Math.max(0, center - (compact ? Math.min(28, width * .2) : Math.min(minimal ? 48 : 60, width * .24)));
  const labelRadius = radius + (compact ? 13 : 24);
  const coords = (index: number, r: number) => point(0, 0, r, -90 + index * 360 / Math.max(1, count));
  const ring = (level: number) => categories.map((_, index) => coords(-index - .5, radius * level / gridLevels).join(",")).join(" ");
  const shapes = series.map((row, index) => {
    const vertices = categories.map((_, position) => coords(position, Math.max(0, score(row.values[position]) ?? 0) / max * radius));
    return {
      row,
      vertices,
      points: vertices.map(vertex => vertex.join(",")).join(" "),
      color: tone(theme, data ? index : fixture.colors?.[index] ?? index, row.color),
    };
  });
  const candidate = hovered ?? focused ?? pinned;
  const active = candidate === null || candidate >= series.length ? null : candidate;
  const selectedMetric = metric === null || metric >= count ? null : metric;
  const summary = selectedMetric === null ? "" : `${categories[selectedMetric]}: ${series.map((row) => {
    const value = score(row.values[selectedMetric]);
    return `${row.name} ${value === null ? "unavailable" : number.format(value)}`;
  }).join(", ")}`;
  const footerHeadline = controlled && active !== null ? `Highlighting the ${series[active].name}` : fixture.footer[0];

  function clearInspection() {
    setHover(null);
    setFocus(null);
    setPin(null);
    setMetric(null);
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && (active !== null || selectedMetric !== null)) {
      event.preventDefault();
      event.stopPropagation();
      clearInspection();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && active !== null) {
      event.preventDefault();
      setPin(pinned === active ? null : active);
      return;
    }
    const next = nextChartFocus(event.key, event.shiftKey ? selectedMetric : active, event.shiftKey ? count : series.length);
    if (next === undefined) return;
    event.preventDefault();
    setHover(null);
    if (event.shiftKey) {
      setMetric(next);
    } else {
      setFocus(next);
      if (selectedMetric === null && count) setMetric(0);
    }
  }

  return <div className={radar.frame} data-radar-variant={id} data-compact={compact || undefined} style={{ "--radar-limit": `${limit}px` } as CSSProperties}>
    <div className={radar.layout} data-legend={legend || undefined}>
      <div className={radar.plotBounds}>
        <svg ref={plot} className={radar.plot} viewBox={`0 0 ${width} ${width}`} role="img" aria-roledescription="chart" aria-label={example.title}
          aria-describedby={compact ? undefined : instructions} tabIndex={compact ? undefined : 0}
          onKeyDown={key} onFocus={() => { if (count) setMetric(0); }}
          onBlur={() => { setFocus(null); setMetric(null); }} onPointerLeave={() => setHover(null)}>
          <g transform={`translate(${center} ${center})`} aria-hidden="true">
            {count > 0 && Array.from({ length: gridLevels }, (_, i) =>
              <polygon key={i} data-radar-ring="" points={ring(i + 1)} fill="none" stroke={theme.grid} strokeOpacity=".6" strokeLinejoin="round" />,
            )}
            {showRingValues && count > 0 && Array.from({ length: gridLevels }, (_, i) =>
              <text key={i} data-radar-ring-value="" className={`${radar.ringValue}${animate ? ` ${radar.ringValueEnter}` : ""}`}
                style={{ "--radar-order": i } as CSSProperties} x="4" y={-(i + 1) * radius / gridLevels}
                fill={theme.muted} stroke={theme.surface} fontSize={compact ? 7 : 9}>{number.format((i + 1) * max / gridLevels)}</text>,
            )}
            {!noSpokes && categories.map((_, index) => {
              const [x, y] = coords(index, radius);
              return <line key={index} data-radar-spoke="" x1="0" y1="0" x2={x} y2={y} stroke={theme.grid} strokeOpacity=".6" />;
            })}
            {shapes.map(({ row, vertices, points, color }, index) => {
              const highlighted = active === index;
              const dots = showDots && (!controlled || index === 0);
              return <g key={index} data-radar-series={row.name} data-active={highlighted} data-dimmed={active !== null && !highlighted}
                className={radar.series}>
                <polygon className={radar.shape} points={points} fill={color} fillOpacity={highlighted ? .35 : .15}
                  stroke={fillOnly ? "none" : color} strokeWidth={highlighted ? 3 : 2} strokeLinejoin="round"
                  filter={highlighted && id === "radar-default" ? `drop-shadow(0 0 12px ${color})` : undefined} />
                {dots && vertices.map(([x, y], position) => score(row.values[position]) !== null &&
                  <circle key={position} data-radar-dot="" cx={x} cy={y} r={compact ? 2.5 : 4} fill={color} stroke={theme.surface} strokeWidth={compact ? 1 : 2} />,
                )}
              </g>;
            })}
            {!compact && shapes.map(({ row, points }, index) =>
              <polygon key={index} data-radar-hit={row.name} className={radar.hit} points={points}
                onPointerEnter={(event) => { if (event.pointerType !== "touch") setHover(index); }} onPointerLeave={() => setHover(null)}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") { setFocus(null); setPin(pinned === index ? null : index); }
                }} />,
            )}
            {categories.map((category, index) => {
              const [x, y] = coords(index, labelRadius);
              const highlighted = controlled && selectedMetric === index;
              return <g key={index} onPointerEnter={() => setMetric(index)}>
                <text data-radar-label={category} className={animate ? radar.labelEnter : undefined}
                  style={animate ? {
                    "--radar-order": index, "--radar-start": controlled ? "160ms" : "200ms", "--radar-enter-x": `${-x}px`, "--radar-enter-y": `${-y}px`,
                  } as CSSProperties : undefined} x={x} y={y} fontSize={compact ? 8 : 11} textAnchor="middle" dominantBaseline="middle"
                  fontWeight={highlighted ? 650 : 500} fill={highlighted ? theme.text : theme.muted}>{category}</text>
                {controlled && !compact && <circle data-radar-metric={category} cx={x} cy={y} r="12" fill="transparent" />}
              </g>;
            })}
          </g>
        </svg>
      </div>
      {legend && <div className={radar.legend} aria-label="Average score">
        <span className={radar.legendTitle}>Average score</span>
        {shapes.map(({ row, color }, index) => {
          const values = row.values.slice(0, count).map(score).filter(value => value !== null);
          const average = values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
          return <Toggle key={index} pressed={pinned === index} data-active={active === index} data-dimmed={active !== null && active !== index}
            onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)} onFocus={() => setFocus(index)} onBlur={() => setFocus(null)}
            onPressedChange={(pressed) => setPin(pressed ? index : null)}>
            <i aria-hidden="true" style={{ backgroundColor: color }} /><span>{row.name}</span><strong>{average === null ? "—" : `${average}%`}</strong>
          </Toggle>;
        })}
      </div>}
    </div>
    {!compact && (!data || controlled) && <div className={radar.footer}>
      <strong role={controlled ? "status" : undefined}>{footerHeadline}</strong>
      {!data && <span>{fixture.footer[1]}</span>}
    </div>}
    {!compact && <>
      <p className={styles.screenReader} id={instructions}>Use arrow keys to select a series. Hold Shift with an arrow key to inspect a metric.</p>
      <div className={styles.screenReader} role="status" aria-atomic="true">{summary}</div>
    </>}
  </div>;
}
