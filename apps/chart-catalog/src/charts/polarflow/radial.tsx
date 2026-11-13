import { arc as d3Arc, areaRadial, curveCatmullRom, curveCatmullRomClosed, lineRadial } from "d3-shape";
import NumberFlow from "@number-flow/react";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { useChartTheme } from "../theme";
import { Legend, nextChartFocus, number, numeric, seriesData, tone, type Props } from "./shared";
import { RadialDetail } from "./RadialDetail";
import { ClockAxis, dotStack, polarTurn, radialDots, radialPoint, radialRadius } from "./radial-geometry";
import { lastPullRequestBin, priorDayMerged, priorDayTotals, pullRequestLines, pullRequestStatuses, quarterHours } from "./radial-fixtures";
import styles from "./radial-detail.module.css";
import shared from "./styles.module.css";

const clockIds = new Set(["radial-default", "radial-line", "radial-bar-clock", "radial-area-clock"]);
const hours = ["00", "06", "12", "18"];

function QuarterHourClock({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const id = useId();
  const { plot, width } = usePlotSize<SVGSVGElement>(640, 640);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const line = example.id === "radial-line";
  const dots = example.id === "radial-default";
  const areas = example.id === "radial-area-clock";
  const { categories, series } = seriesData(data, quarterHours, line ? pullRequestLines : pullRequestStatuses);
  const count = categories.length;
  const indices = categories.map((_, index) => index);
  const selected = hover ?? focus;
  const active = selected !== null && selected < count ? selected : null;
  const radius = width / 2;
  const inner = radius * .408;
  const outer = radius * .83;
  const last = data ? count - 1 : lastPullRequestBin;
  const slice = polarTurn / Math.max(1, count);
  const angle = (index: number) => (index + .5) * slice;
  const readings = series.map(row => indices.map(i => row.values[i] ?? null));
  const totals = indices.map(i => readings.map(row => numeric(row[i])).reduce((sum, value) => sum + Math.max(0, value), 0));
  const yesterday = data ? undefined : line ? pullRequestLines[1].values : priorDayMerged;
  const ghost = data ? [] : priorDayTotals;
  const maximum = Math.max(1, ...(line ? readings.flatMap(row => row.map(v => numeric(v))) : [...totals, ...ghost]));
  const scale = (value: number) => radialRadius(value, 0, maximum, inner, outer);
  const colors = series.map((row, layer) => tone(theme, layer, row.color));
  const panel = series.slice(0, line ? 1 : series.length).map((row, layer) => ({
    name: row.name, color: row.color, value: readings[layer].slice(0, last + 1).reduce<number>((sum, value) => sum + numeric(value), 0),
  }));
  const currentEnd = categories[last + 1] ?? (data ? categories[last] : "24:00");
  const previous = active === null ? yesterday?.slice(0, last + 1).reduce((sum, value) => sum + value, 0) : yesterday?.[active];
  const future = active !== null && active > last;
  const currentValue = active === null ? panel[0]?.value ?? 0 : future ? previous ?? 0 : readings[0]?.[active] ?? 0;
  const delta = !data && !future ? currentValue - (previous ?? 0) : null;
  const levels = readings.map((_, layer) => indices.map(i => readings.slice(0, layer + 1).reduce((sum, row) => sum + Math.max(0, numeric(row[i])), 0)));
  const slots = dots ? radialDots(count, inner, outer, 14, false) : [];
  const spacing = (outer - inner) / 14;
  const padding = slice * .18;
  const arcs = d3Arc().padRadius(inner);
  const bar = (i: number, low: number, high: number, corner = 0) =>
    arcs.cornerRadius(corner)({ innerRadius: scale(low), outerRadius: scale(high), startAngle: i * slice, endAngle: (i + 1) * slice, padAngle: padding }) ?? undefined;

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!count || compact) return;
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const x = p.x - radius, y = p.y - radius;
    const distance = Math.hypot(x, y);
    const phase = (Math.atan2(x, -y) + polarTurn) % polarTurn;
    setHover(distance < radius * .355 || distance > radius * .98 ? null : Math.min(count - 1, Math.floor(phase / slice)));
  }

  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setHover(null);
      setFocus(null);
      return;
    }
    const next = nextChartFocus(event.key, active, count);
    if (next === undefined) return;
    event.preventDefault();
    setHover(null);
    setFocus(next);
  }

  function edge(values: readonly (number | null)[], visible: readonly number[], angleOffset = 0, loop = false) {
    return lineRadial<number>().angle(i => angle(i) + angleOffset).radius(i => scale(numeric(values[i])))
      .defined(i => values[i] != null).curve(loop ? curveCatmullRomClosed : curveCatmullRom)(visible) ?? undefined;
  }
  function areaRuns(values: readonly (number | null)[], below: readonly number[] | undefined, lineOnly = false) {
    type AreaPoint = { angle: number; inner: number; outer: number };
    const runs: AreaPoint[][] = [];
    const full = count > 0 && values.every(value => value !== null);
    let run: AreaPoint[] = [];
    for (let i = 0; i <= count; i++) {
      const value = values[i];
      if (value != null) {
        const lower = scale(below?.[i] ?? 0);
        const upper = scale(value);
        if (!run.length && !full) run.push({ angle: i * slice, inner: lower, outer: upper });
        run.push({ angle: angle(i), inner: lower, outer: upper });
      } else if (run.length) {
        if (!full) run.push({ ...run[run.length - 1], angle: i * slice });
        runs.push(run);
        run = [];
      }
    }
    const curve = full ? curveCatmullRomClosed : curveCatmullRom;
    const generator = lineOnly
      ? lineRadial<AreaPoint>().angle(p => p.angle).radius(p => p.outer).curve(curve)
      : areaRadial<AreaPoint>().angle(p => p.angle).innerRadius(p => p.inner).outerRadius(p => p.outer).curve(curve);
    return runs.map(points => generator(points) ?? undefined);
  }
  const arcValues = (i: number) => readings.map(row => numeric(row[i]));
  const centerWidth = radius * .68;
  const centerCaption = line || dots ? active === null ? `merged by ${currentEnd ?? "now"}` : `merged at ${categories[active]}${future ? " yesterday" : ""}`
    : active === null ? "Pull requests today" : categories[active];
  const activeEdges = active === null ? [] : line ? readings.flatMap((row, layer) => row[active] == null ? [] : [{ value: row[active]!, color: layer === 1 && !data ? theme.muted : colors[layer] }])
    : areas ? future ? [{ value: ghost[active], color: theme.muted }] : levels.flatMap((row, layer) => readings[layer][active] ? [{ value: row[active], color: colors[layer] }] : []) : [];

  return <div className={styles.frame} data-radial-compact={compact || undefined}>
    <svg ref={plot} className={styles.plot} viewBox={`0 0 ${width} ${width}`} role="img" aria-roledescription="chart" aria-label={example.title}
      aria-description="Use arrow keys to inspect adjacent times. Home and End move to the first and last times."
      tabIndex={compact || !count ? undefined : 0} onKeyDown={inspect} onBlur={() => setFocus(null)}
      onPointerMove={move} onPointerDown={move} onPointerLeave={event => { if (event.pointerType !== "touch") setHover(null); }}>
      <g transform={`translate(${radius} ${radius})`} aria-hidden="true">
        <ClockAxis radius={radius} theme={theme} labels={data ? hours.map((_, i) => categories[Math.floor(i * count / 4)] ?? "") : hours} />
        {line && readings.map((row, layer) => {
          const prior = !data && layer === 1;
          return <path key={layer} data-clock-line={layer} d={edge(row, indices, 0, prior)} fill="none"
            stroke={prior ? theme.muted : colors[layer]} strokeWidth={prior ? 1.5 : 2.25} strokeOpacity={prior ? .7 : 1}
            strokeDasharray={prior ? "1.5 4.5" : undefined} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {line && !data && readings[0]?.[last] != null && (() => {
          const [cx, cy] = radialPoint(scale(readings[0][last]!), angle(last));
          return <g data-clock-terminal=""><circle cx={cx} cy={cy} r={width * .016} fill={colors[0]} opacity=".16" />
            <circle cx={cx} cy={cy} r={width * .008} fill={colors[0]} stroke={theme.surface} strokeWidth={width * .004} /></g>;
        })()}
        {areas && <g className={!compact && !data && active === null ? styles.areaEntrance : undefined}>
          <defs>{[theme.text, ...colors].map((color, i) => <radialGradient key={i} id={`${id}-area-${i}`}
            gradientUnits="userSpaceOnUse" cx="0" cy="0" r={outer}>
            <stop offset={inner / outer} stopColor={color} stopOpacity={i === 0 ? ".04" : ".08"} />
            <stop offset="1" stopColor={color} stopOpacity={i === 0 ? ".1" : ".32"} />
          </radialGradient>)}</defs>
          {!data && <g data-clock-forecast="">
            {areaRuns(indices.map(i => i > last ? ghost[i] : null), undefined).map((path, i) =>
              <path key={i} data-clock-area-path="" d={path} fill={`url(#${id}-area-0)`} />)}
            {areaRuns(indices.map(i => i > last ? ghost[i] : null), undefined, true).map((path, i) =>
              <path key={i} data-clock-area-path="" d={path} fill="none" stroke={theme.text} strokeOpacity=".25" strokeWidth="1.5" strokeDasharray="3 4" />)}
          </g>}
          {levels.map((row, layer) => <g key={layer} data-clock-area={layer} opacity={highlight === null || highlight === layer ? 1 : .24}>
            {areaRuns(row.map((value, i) => i <= last ? value : null), levels[layer - 1]).map((path, i) =>
              <path key={i} data-clock-area-path="" d={path} fill={`url(#${id}-area-${layer + 1})`} />)}
            {areaRuns(row.map((value, i) => readings[layer][i] ? value : null), undefined, true).map((path, i) =>
              <path key={i} data-clock-area-path="" d={path} fill="none" stroke={colors[layer]} strokeWidth="1.5" />)}
          </g>)}
        </g>}
        {!areas && !line && indices.map(i => {
          const projected = i > last;
          const values = projected ? [ghost[i] ?? 0] : arcValues(i);
          const ends = dots ? dotStack(values, maximum, inner, outer, 14) : [];
          let cumulative = 0;
          const marks = dots ? slots[i].map(({ row, x, y }, j) => {
            const layer = ends.findIndex(end => row < end);
            if (layer === -1) return null;
            const opacity = projected ? .22 : (highlight === null || highlight === layer ? 1 : .2) * (layer === 0 ? .4 + .6 * Math.min(1, row / 7) : 1);
            return <circle key={j} data-clock-dot={projected ? "past" : layer} cx={x} cy={y} r={spacing * (projected ? .13 : .22)}
              fill={projected ? theme.text : colors[layer]} opacity={opacity} />;
          }) : values.map((value, layer) => {
            const low = cumulative;
            cumulative += Math.max(0, value);
            return value > 0 && <path key={layer} data-clock-bar={projected ? "past" : layer} d={bar(i, low, cumulative, values.filter(v => v > 0).length === 1 ? 4 : 0)}
              fill={projected ? theme.text : colors[layer]} fillOpacity={projected ? ".12" : highlight === null || highlight === layer ? 1 : .22} />;
          });
          return <g key={i} data-clock-time={categories[i]} opacity={!dots && active !== null && active !== i ? .35 : 1}>{marks}</g>;
        })}
        {dots && !data && (() => {
          const [x, y] = radialPoint(radius * .955 * 1.02, angle(8));
          return <text data-clock-annotation="" x={x} y={y} textAnchor="start" dominantBaseline="middle" fontSize={Math.max(10, radius * .045)} fill={colors[2]}>02:14</text>;
        })()}
        {active !== null && <g data-clock-cursor="" transform={`rotate(${angle(active) * 180 / Math.PI})`} pointerEvents="none">
          <line x1="0" y1={-radius * .38} x2="0" y2={-radius * .895} stroke={theme.text} strokeOpacity=".55"
            strokeDasharray={line ? undefined : "3 3"} />
          {activeEdges.map(({ value, color }, i) => <circle key={i} cx="0" cy={-scale(value)} r={Math.max(2.5, width * .008)} fill={color}
            stroke={theme.surface} strokeWidth={Math.max(1, width * .003)} />)}
        </g>}
      </g>
      {count > 0 && <foreignObject x={radius - centerWidth / 2} y={radius - centerWidth / 2} width={centerWidth} height={centerWidth}
        pointerEvents="none" aria-hidden="true">
        <div className={styles.center} style={{ "--radial-center-size": `${centerWidth}px` } as CSSProperties}>
          {(line || dots) && <strong>{compact ? number.format(currentValue) : <NumberFlow value={currentValue} locales="en-US" respectMotionPreference />}</strong>}
          <span>{centerCaption}</span>
          {delta !== null && <span><b style={{ color: delta > 0 ? "var(--chart-positive)" : delta < 0 ? "var(--chart-negative)" : theme.muted }}>
            {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{number.format(Math.abs(delta))}</b> vs yesterday</span>}
        </div>
      </foreignObject>}
    </svg>
    {!compact && <Legend items={panel} theme={theme} active={highlight} onActive={setHighlight} />}
    {!compact && count > 0 && <div className={shared.screenReader} role="status" aria-atomic="true">
      {active === null ? `${number.format(currentValue)} ${centerCaption}` : future ? `${categories[active]} yesterday: ${number.format(line || dots ? currentValue : ghost[active] ?? 0)}`
        : `${categories[active]}: ${(line && !data ? series.slice(0, 1) : series).map((row, layer) => `${row.name} ${number.format(numeric(readings[layer][active]))}`).join(", ")}`}
    </div>}
  </div>;
}

export function Radial(props: Props) {
  return clockIds.has(props.example.id) ? <QuarterHourClock {...props} /> : <RadialDetail {...props} />;
}
