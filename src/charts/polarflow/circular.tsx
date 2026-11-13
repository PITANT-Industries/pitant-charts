import { arc as arcPath } from "d3-shape";
import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { useChartTheme } from "../theme";
import { arc, Controls, dollars, metrics, nextChartFocus, number, numeric, percent, point, sector, sum, tone, type Props } from "./shared";
import { Donut, usesDonut } from "./Donut";
import { ReferencePie, isReferencePie } from "./ReferencePie";
import { CircularCenter } from "./CircularCenter";
import { useAnimatedNumber } from "./useAnimatedNumber";
import { pieFixtures, ringFixtures } from "./circular-fixtures";
import { PiePattern, piePatterns } from "./PiePattern";
import donutStyles from "./donut.module.css";
import styles from "./styles.module.css";

function CustomCenter({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <foreignObject x={x - 50} y={y - 34} width="100" height="68" pointerEvents="none">
    <div className={styles.customCenter}>{children}</div>
  </foreignObject>;
}

export function Pie(props: Props) {
  const id = props.example.id;
  if (isReferencePie(id)) return <ReferencePie {...props} id={id} />;
  return usesDonut(props.example.id) || props.renderCenter ? <Donut {...props} /> : <PieSlices {...props} />;
}

function PieSlices({ example, compact, data }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const instance = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [effect, setEffect] = useState(0);
  const active = hovered ?? focused ?? pinned;
  const patternTypes = piePatterns[id];
  const gradient = id === "pie-gradients";
  const fixture = pieFixtures[id as keyof typeof pieFixtures] ?? { names: ["Platform", "Services", "Marketplace", "Support", "Other"], values: [470, 285, 192, 140, 108] };
  const rows = metrics(data, fixture.names, fixture.values).filter(row => row.value > 0);
  const total = sum(rows);
  const item = active === null ? undefined : rows[active];
  const selectedEffect = id === "pie-hover-effects" ? effect : 0;
  const format = !data && id !== "pie-pattern-presets" && id !== "pie-hover-effects" ? dollars : number;
  let start = 180;
  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setHovered(null);
      setFocused(null);
      setPinned(null);
      return;
    }
    if (event.target !== event.currentTarget) return;
    const next = nextChartFocus(event.key, active, rows.length);
    if (next === undefined) return;
    event.preventDefault();
    setHovered(null);
    setFocused(next);
  }
  return <div className={styles.frame}>
    {!compact && id === "pie-hover-effects" && <Controls label="Pie hover effect" items={["Translate", "Grow", "None"]} value={effect} onChange={setEffect} />}
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}
      tabIndex={compact ? undefined : 0} aria-describedby={compact ? undefined : `${instance}-value`} onKeyDown={inspect} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null); }}>
      <defs>
        {rows.map((row, index) => {
          const color = tone(theme, index, row.color);
          const type = patternTypes?.[index];
          if (type) return <PiePattern key={index} id={`${instance}-pattern-${index}`} color={color} type={type} />;
          return gradient && <radialGradient key={index} id={`${instance}-gradient-${index}`} gradientUnits="userSpaceOnUse" cx="210" cy="120" r="105">
            <stop offset="0%" stopColor={color} stopOpacity=".23" />
            <stop offset="100%" stopColor={color} />
          </radialGradient>;
        })}
      </defs>
      {rows.map((row, index) => {
        const sweep = total > 0 ? 360 * row.value / total : 0;
        const from = start;
        start += sweep;
        const isActive = active === index;
        const [tx, ty] = point(0, 0, isActive && selectedEffect === 0 ? 6 : 0, from + sweep / 2);
        const color = patternTypes?.[index] ? `url(#${instance}-pattern-${index})`
          : gradient ? `url(#${instance}-gradient-${index})` : tone(theme, index, row.color);
        return <path key={index} className={donutStyles.slice} data-slice={row.name} data-active={isActive}
          d={sector(210, 120, 103 + (isActive && selectedEffect === 1 ? 6 : 0), 0, from, start)}
          transform={`translate(${tx} ${ty})`} fill={color} opacity={active === null || isActive || selectedEffect === 2 ? 1 : .48}
          stroke={theme.surface} strokeWidth=".6" strokeLinejoin="round"
          tabIndex={compact || id !== "pie-hover-effects" ? undefined : 0} aria-label={`${row.name}: ${format.format(row.value)}`}
          onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }} onPointerLeave={() => setHovered(null)}
          onClick={() => { if (!compact) setPinned(pinned === index ? null : index); }}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}>
          <title>{`${row.name} · ${format.format(row.value)} · ${percent(row.value, total).toFixed(1)}%`}</title>
        </path>;
      })}
      {!rows.length && <circle cx="210" cy="120" r="103" fill={theme.grid} />}
    </svg>
    {!compact && <span className={styles.screenReader} id={`${instance}-value`} role="status">{item
      ? `${item.name}: ${format.format(item.value)}, ${number.format(percent(item.value, total))}% of total` : `Total ${format.format(total)}`}</span>}
  </div>;
}

const ringArc = arcPath().digits(3);
const roundedRingArc = arcPath().digits(3).cornerRadius(({ innerRadius, outerRadius }) => (outerRadius - innerRadius) / 2);

export function Ring({ example, compact, data, renderCenter }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const instance = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [skipEntrance, setSkipEntrance] = useState(false);
  const active = hovered ?? focused ?? pinned;
  const fixture = ringFixtures[id];
  const rows = metrics(data, fixture?.names ?? ["Direct", "Organic", "Email", "Partners", "Social"], fixture?.values ?? [156, 135, 108, 82, 57]);
  const sweep = fixture?.sweep ?? 315;
  const start = fixture?.start ?? -90;
  const half = sweep === 180;
  const matched = id === "ring-default";
  const cy = half ? 157 : 120;
  const grid = id === "ring-grid" ? [0, 25, 50, 75, 100] : half ? [0, 50, 100] : [];
  const customMaximum = data ? Math.max(200, ...rows.map(row => row.value)) : 200;
  const goals = rows.map((_, index) => {
    const goal = data?.rows?.[index]?.target ?? data?.rows?.[index]?.maximum;
    if (goal != null && numeric(goal) > 0) return numeric(goal);
    if (id === "ring-center-custom") return 160 + index * 12;
    if (data) return customMaximum;
    return typeof fixture?.maximum === "number" ? fixture.maximum : fixture?.maximum[index] ?? 200;
  });
  const current = active === null ? undefined : rows[active];
  const target = current ? goals[active ?? 0] : undefined;
  const total = sum(rows);
  const ratio = Boolean(current && id === "ring-center-custom");
  const value = current?.value ?? total;
  const display = useAnimatedNumber(ratio && current ? percent(current.value, target ?? 1) : value, !compact && !ratio && !matched);
  const width = Math.min(id === "ring-arc" ? 14 : 10, 62 / Math.max(1, rows.length));
  const radiusAt = (index: number) => Math.max(22, 100 - (rows.length - index - 1) * width * 1.53);
  const unit = !data ? fixture?.unit ?? "" : "";
  const readout = ratio ? `${Math.round(display)}%` : `${number.format(Math.round(display))}${unit === "%" && !current ? "" : unit}`;
  const status = current && target !== undefined
    ? `${current.name}: ${number.format(current.value)}${unit} of ${number.format(target)}${unit}, ${Math.round(percent(current.value, target))}% progress`
    : `${number.format(total)}${unit === "%" ? "" : unit} ${fixture?.label ?? "total"}`;
  const showLegend = !compact && id === "ring-legend";
  const ringPitch = 71 / Math.max(1, rows.length - 1);
  const ringWidth = Math.min(71 / 6, ringPitch * 2 / 3);
  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setHovered(null);
      setFocused(null);
      setPinned(null);
      return;
    }
    const next = nextChartFocus(event.key, active, rows.length);
    if (next === undefined) return;
    event.preventDefault();
    setHovered(null);
    setFocused(next);
  }
  if (matched) return <div className={donutStyles.donut}>
    <svg className={`${donutStyles.plot} ${donutStyles.matchedRing}`} viewBox="0 0 300 300" role="img"
      aria-label={example.title} aria-roledescription="chart" aria-describedby={compact ? undefined : `${instance}-value`}
      tabIndex={compact ? undefined : 0} onKeyDown={inspect} onBlur={() => setFocused(null)}
      onFocus={() => setSkipEntrance(true)} onPointerEnter={() => setSkipEntrance(true)}>
      <g transform="translate(150 150)">
        {rows.map((row, index) => {
          const outerRadius = rows.length === 1 ? 142 : 71 + index * ringPitch;
          const geometry = { outerRadius, innerRadius: outerRadius - ringWidth, startAngle: -Math.PI / 2 };
          const track = ringArc({ ...geometry, endAngle: geometry.startAngle + 2 * Math.PI }) ?? undefined;
          const progress = Math.max(0, Math.min(1, row.value / goals[index]));
          const selected = active === index;
          const fill = roundedRingArc({ ...geometry, endAngle: geometry.startAngle + progress * 2 * Math.PI }) ?? undefined;
          return <g key={index} data-ring={row.name} data-active={selected} data-goal={goals[index]} aria-hidden="true">
            <g className={!compact && !data && !skipEntrance ? donutStyles.ringEntrance : undefined} style={{ animationDelay: `${index * 80}ms` }}>
              <g className={donutStyles.circularMark} opacity={current && !selected ? .35 : 1} transform={selected ? "scale(1.03)" : undefined}>
                <path data-ring-track="" d={track} fill={theme.grid} />
                {progress > 0 && <path data-ring-value="" d={fill} fill={tone(theme, index, row.color)} />}
              </g>
            </g>
            <path className={donutStyles.circularHit} d={track} fill="transparent"
              onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }}
              onPointerLeave={() => setHovered(null)}
              onClick={() => { if (!compact) setPinned(previous => previous === index ? null : index); }} />
          </g>;
        })}
      </g>
      <CircularCenter center={150} size={102 + 1 / 3} useCustom={Boolean(renderCenter)} value={value} label={current?.name ?? (data ? "Total" : fixture?.label ?? "Total")}
        animated={!compact} fontSize={22.51} labelSize={10}>
        {renderCenter?.({ name: current?.name ?? null, value, total, target, share: percent(value, target ?? total) / 100 })}
      </CircularCenter>
    </svg>
    {!compact && <span className={styles.screenReader} id={`${instance}-value`} role="status">{status}</span>}
  </div>;
  return <div className={showLegend ? `${donutStyles.donut} ${donutStyles.withLegend}` : styles.frame}>
    <svg className={styles.native} viewBox={half ? "0 38 420 160" : "0 0 420 240"} role="img" aria-label={example.title}
      tabIndex={compact ? undefined : 0} aria-describedby={compact ? undefined : `${instance}-value`} onKeyDown={inspect}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null); }}>
      {grid.map(value => {
        const angle = start + value * sweep / 100;
        const [x1, y1] = point(210, cy, 28, angle);
        const [x2, y2] = point(210, cy, 110, angle);
        const [x, y] = point(210, cy, 121, angle);
        return <g key={value}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.grid} strokeDasharray="3 4" />
          <text x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fill={theme.muted}>{value}%</text></g>;
      })}
      {rows.map((row, index) => {
        const radius = radiusAt(index);
        const end = start + sweep * Math.min(1, Math.max(0, row.value / goals[index]));
        const color = tone(theme, index, row.color);
        const [labelX, labelY] = point(210, cy, radius, start - (half ? 0 : 12));
        return <g key={index} tabIndex={compact || id !== "ring-center-custom" ? undefined : 0}
          data-ring={row.name} data-active={active === index} data-goal={goals[index]}
          aria-label={`${row.name}: ${row.value} of ${goals[index]}`}
          className={donutStyles.slice} opacity={active === null || active === index ? 1 : .4}
          onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }} onPointerLeave={() => setHovered(null)}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onClick={() => { if (!compact) setPinned(pinned === index ? null : index); }}>
          <title>{`${row.name} · ${number.format(row.value)} of ${number.format(goals[index])}`}</title>
          <path data-ring-track="" d={arc(210, cy, radius, start, start + sweep)} fill="none" stroke={theme.grid} strokeWidth={width} strokeLinecap={sweep === 360 || id === "ring-arc" ? "butt" : "round"} />
          {row.value > 0 && <path data-ring-value="" d={arc(210, cy, radius, start, end)} fill="none" stroke={color} strokeWidth={width} strokeLinecap={id === "ring-arc" ? "butt" : "round"} />}
          {grid.length > 0 && <text x={labelX} y={labelY + (half ? 7 : 3)} transform={half ? `rotate(80 ${labelX} ${labelY + 7})` : undefined} textAnchor={half ? "start" : "end"} fontSize="8" fill={color}>{row.name}</text>}
        </g>;
      })}
      {renderCenter ? <CustomCenter x={210} y={half ? cy - 12 : cy}>
        {renderCenter({ name: current?.name ?? null, value, total, target, share: percent(value, target ?? total) / 100 })}
      </CustomCenter> : (!half || current) && <g textAnchor="middle" pointerEvents="none" aria-hidden="true">
        <text x="210" y={cy - 3} fill={theme.text} fontSize="22" fontWeight="650">{readout}</text>
        <text x="210" y={cy + 15} fill={theme.muted} fontSize="10">{current?.name ?? (data ? "Total" : fixture?.label ?? "Total")}</text>
      </g>}
    </svg>
    {!compact && <span className={styles.screenReader} id={`${instance}-value`} role="status">{status}</span>}
    {showLegend && <ul className={donutStyles.legend} aria-label="Signups by channel">
      {rows.map((row, index) => {
        const share = Math.round(percent(row.value, goals[index]));
        return <li key={index}><Toggle pressed={pinned === index} className={donutStyles.ringLegend} data-active={active === index}
          onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
          onPressedChange={pressed => setPinned(pressed ? index : null)}>
          <span className={donutStyles.swatch} style={{ background: tone(theme, index, row.color) }} />
          <span>{row.name}</span><strong>{number.format(row.value)}</strong><span>{share}%</span>
          <meter min={0} max={100} value={Math.min(100, Math.max(0, share))} aria-label={`${row.name} progress`} />
        </Toggle></li>;
      })}
    </ul>}
  </div>;
}

export { Radar } from "./radar";
