import { arc as arcPath } from "d3-shape";
import NumberFlow, { type Format } from "@number-flow/react";
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { useChartTheme } from "../theme";
import { metrics, nextChartFocus, number, numeric, percent, point, sum, tone, type Props } from "./shared";
import { ringFixtures } from "./ring-fixtures";
import styles from "./ring.module.css";
import shared from "./styles.module.css";

const ringArc = arcPath().digits(3);
const roundedRingArc = arcPath().digits(3).cornerRadius(({ innerRadius, outerRadius }) => (outerRadius - innerRadius) / 2);
const numberFormat: Format = { maximumFractionDigits: 1 };
const bookingsFormat: Format = { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 };

export function Ring({ example, compact, data, renderCenter }: Props) {
  const theme = useChartTheme();
  const instance = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [skipEntrance, setSkipEntrance] = useState(false);
  const id = example.id;
  const bookings = id === "ring-center-custom";
  const half = id === "ring-semicircle";
  const showLegend = !compact && id === "ring-legend";
  const fixture = ringFixtures[id] ?? ringFixtures["ring-default"];
  const rows = metrics(data, fixture.names, fixture.values);
  const selection = hovered ?? focused ?? pinned;
  const active = selection !== null && selection < rows.length ? selection : null;
  const current = active === null ? undefined : rows[active];
  const customMaximum = Math.max(200, ...rows.map(row => row.value));
  const goals = rows.map((_, index) => {
    const goal = numeric(data?.rows?.[index]?.target ?? data?.rows?.[index]?.maximum);
    if (goal > 0) return goal;
    return data ? customMaximum : typeof fixture.maximum === "number" ? fixture.maximum : fixture.maximum[index] ?? customMaximum;
  });
  const target = active === null ? undefined : goals[active];
  const total = sum(rows);
  const value = current?.value ?? total;
  const label = current?.name ?? (data ? "Total" : fixture.label);
  const unit = data ? "" : fixture.unit ?? "";
  const status = current && target !== undefined
    ? `${current.name}: ${number.format(current.value)}${unit} of ${number.format(target)}${unit}, ${Math.round(percent(current.value, target))}% progress`
    : `${number.format(total)}${unit === "%" ? "" : unit} ${data ? "total" : fixture.label}`;
  const [first, outer, nominalWidth] = fixture.radii;
  const pitch = (outer - first) / Math.max(1, rows.length - 1);
  const ringWidth = rows.length > 1 ? Math.min(nominalWidth, pitch * .8) : nominalWidth;
  const radiusAt = (index: number) => rows.length === 1 ? outer : first + index * pitch;
  const center = fixture.size / 2;
  const start = fixture.start * Math.PI / 180;
  const sweep = fixture.sweep * Math.PI / 180;
  const centerSize = Math.max(62, (first - ringWidth - 8) * 2);
  const percentCenter = bookings && current;
  const animated = !compact && !data && !skipEntrance;

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

  return <div className={styles.frame} data-ring-legend={showLegend || undefined} data-ring-compact={compact || undefined}
    style={{ "--ring-size": `${fixture.size}px` } as CSSProperties}>
    <svg className={styles.plot} viewBox={`0 0 ${fixture.size} ${fixture.size}`} role="img"
      aria-label={example.title} aria-roledescription="chart" aria-describedby={compact ? undefined : `${instance}-value`}
      tabIndex={compact || !rows.length ? undefined : 0} onKeyDown={inspect} onBlur={() => setFocused(null)}
      onFocus={() => setSkipEntrance(true)} onPointerEnter={() => setSkipEntrance(true)}>
      <g transform={`translate(${center} ${center})`} aria-hidden="true">
        {fixture.grid?.map(tick => {
          const angle = fixture.start + tick * fixture.sweep / 100 - 90;
          const [x1, y1] = point(0, 0, 60, angle);
          const [x2, y2] = point(0, 0, 112, angle);
          const [x, y] = point(0, 0, tick === 0 ? half ? 123.15 : 121.77 : tick === 100 ? 130.31 : tick === 50 && half ? 121.77 : tick === 75 ? 125.44 : tick === 25 ? 128.12 : 127.66, angle);
          return <g key={tick} data-ring-guide="">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeOpacity=".2" strokeLinecap="round" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11.54" fill={theme.muted}>{tick}%</text>
          </g>;
        })}
        {rows.map((row, index) => {
          const outerRadius = radiusAt(index);
          const geometry = { outerRadius, innerRadius: outerRadius - ringWidth, startAngle: start };
          const track = (fixture.roundedTrack ? roundedRingArc : ringArc)({ ...geometry, endAngle: start + sweep }) ?? undefined;
          const hit = ringArc({ ...geometry, endAngle: start + sweep }) ?? undefined;
          const progress = Math.max(0, Math.min(1, row.value / goals[index]));
          const selected = active === index;
          const fill = (id === "ring-arc" ? ringArc : roundedRingArc)({ ...geometry, endAngle: start + progress * sweep }) ?? undefined;
          const color = tone(theme, index, row.color);
          const mid = outerRadius - ringWidth / 2;
          const x = half ? -mid : 6.48;
          const y = half ? 6.48 : mid;
          return <g key={index} data-ring={row.name} data-active={selected} data-goal={goals[index]}>
            <g className={animated ? styles.entrance : undefined} style={{ animationDelay: `${index * 80}ms` }}>
              <g className={styles.mark} opacity={current && !selected ? .35 : 1} transform={selected ? "scale(1.03)" : undefined}>
                <path data-ring-track="" d={track} fill={theme.grid} />
                {progress > 0 && <path data-ring-value="" d={fill} fill={color} />}
              </g>
            </g>
            <path className={styles.hit} d={hit} fill="transparent"
              onPointerEnter={event => { if (!compact && event.pointerType !== "touch") setHovered(index); }}
              onPointerLeave={() => setHovered(null)}
              onClick={() => { if (!compact) setPinned(previous => previous === index ? null : index); }} />
            {fixture.grid && <text data-ring-label="" x={x} y={y} textAnchor={half ? "end" : "start"} dominantBaseline="middle"
              transform={half ? `rotate(-90 ${x} ${y})` : undefined} fontSize="10.8" fill={half ? theme.muted : color} pointerEvents="none">{row.name}</text>}
          </g>;
        })}
      </g>
      {(renderCenter || !half) && <foreignObject x={center - centerSize / 2} y={center - centerSize / 2} width={centerSize} height={centerSize} pointerEvents="none"
        aria-hidden={renderCenter ? undefined : true}>
        <div className={styles.center} data-circular-center="">
          {renderCenter ? renderCenter({ name: current?.name ?? null, value, total, target, share: percent(value, target ?? total) / 100 }) : <>
            <span className={styles.value} data-circular-value="" style={{ fontSize: fixture.fontSize, color: percentCenter ? tone(theme, active ?? 0, current.color) : undefined }}>
              {percentCenter ? `${Math.round(percent(value, target ?? 1))}%` : compact ? value.toLocaleString("en-US", bookings && !data ? bookingsFormat : numberFormat) + unit
                : <NumberFlow value={value} locales="en-US" format={bookings && !data ? bookingsFormat : numberFormat} suffix={unit} respectMotionPreference />}
            </span>
            <span className={styles.label} style={{ fontSize: 10 }}>{label}</span>
          </>}
        </div>
      </foreignObject>}
    </svg>
    {!compact && <span className={shared.screenReader} id={`${instance}-value`} role="status">{status}</span>}
    {showLegend && <div className={styles.key}>
      <h3>{data ? "Progress by category" : "Signups by channel"}</h3>
      <ul aria-label={data ? "Progress by category" : "Signups by channel"}>
        {rows.map((row, index) => {
          const share = percent(row.value, goals[index]);
          const color = tone(theme, index, row.color);
          return <li key={index}><Toggle pressed={pinned === index} className={styles.legendItem} data-active={active === index}
            onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }} onPointerLeave={() => setHovered(null)}
            onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
            onPressedChange={pressed => setPinned(pressed ? index : null)} style={{ "--ring-color": color } as CSSProperties}>
            <span className={styles.swatch} aria-hidden="true" />
            <span>{row.name}</span><strong>{number.format(row.value)}</strong><span>{Math.round(share)}%</span>
            <meter min={0} max={100} value={Math.min(100, Math.max(0, share))} aria-label={`${row.name} progress`} />
          </Toggle></li>;
        })}
      </ul>
    </div>}
  </div>;
}
