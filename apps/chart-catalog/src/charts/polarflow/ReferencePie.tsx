import { arc as arcPath, pie as pieAngles } from "d3-shape";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { useChartTheme } from "../theme";
import { pieFixtures } from "./circular-fixtures";
import { CircularCenter } from "./CircularCenter";
import styles from "./donut.module.css";
import { dollars, metrics, nextChartFocus, number, point, sum, tone, type Props } from "./shared";
import { PiePaint, piePaints } from "./PiePaint";
import pie from "./pie.module.css";
import { Choices } from "../../ui/Choices";

const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const path = arcPath().digits(3);
const compactCurrency = { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 } as const;
const effects = ["Translate", "Grow", "None"].map(value => ({ value, label: value }));
const turn = 2 * Math.PI;
const entrance = { duration: 1100, stagger: 80, delay: 115 };

function revealProgress(time: number) {
  // Invert the x coordinate of cubic-bezier(.85, 0, .15, 1).
  let low = 0;
  let high = 1;
  for (let step = 0; step < 14; step++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * .85 + 3 * (1 - t) * t * t * .15 + t ** 3;
    if (x < time) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return (3 - 2 * t) * t * t;
}

function useSliceEntrance(enabled: boolean, uid: string, clipRadius: number) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = svg.current;
    if (!enabled || !node) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const wedgeClips = Array.from(node.querySelectorAll<SVGPathElement>("[data-entrance-slice]"));
    const marks = Array.from(node.querySelectorAll<SVGGElement>("[data-pie-motion]"));
    let frame = 0;
    let start: number | undefined;
    const cancel = () => {
      cancelAnimationFrame(frame);
      marks.forEach(mark => mark.removeAttribute("clip-path"));
    };
    function draw(now: number) {
      start ??= now;
      let finished = true;
      for (const [index, clip] of wedgeClips.entries()) {
        const elapsed = now - start - entrance.delay - index * entrance.stagger;
        if (elapsed >= entrance.duration) {
          marks[index].removeAttribute("clip-path");
          continue;
        }
        finished = false;
        const eased = elapsed <= 0 ? 0 : revealProgress(elapsed / entrance.duration);
        const from = Number(clip.dataset.from);
        const to = Number(clip.dataset.to);
        const sector = eased === 0 ? null : path({ startAngle: from, endAngle: from + eased * (to - from), innerRadius: 0, outerRadius: clipRadius });
        clip.setAttribute("d", sector ?? "M0 0Z");
        marks[index].setAttribute("clip-path", `url(#${uid}-entrance-${index})`);
      }
      if (!finished) frame = requestAnimationFrame(draw);
    }
    const stopIfReduced = () => { if (preference.matches) cancel(); };
    const skip = () => cancel();
    draw(performance.now());
    preference.addEventListener("change", stopIfReduced);
    node.addEventListener("pointerenter", skip, { once: true });
    node.addEventListener("focusin", skip, { once: true });
    return () => {
      cancel();
      preference.removeEventListener("change", stopIfReduced);
      node.removeEventListener("pointerenter", skip);
      node.removeEventListener("focusin", skip);
    };
  }, [enabled, uid, clipRadius]);
  return svg;
}

export function ReferencePie({ example, compact, data, renderCenter }: Props) {
  const { id } = example;
  const theme = useChartTheme();
  const uid = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [effect, setEffect] = useState("Translate");
  const fixture = pieFixtures[id] ?? pieFixtures["pie-default"];
  const size = fixture.size ?? 280;
  const center = size / 2;
  const outer = center - 10;
  const half = id === "pie-half-donut";
  const sweep = half ? Math.PI : turn;
  const solid = !fixture.label && !renderCenter;
  const inner = fixture.inner ?? (renderCenter ? 80 : .5);
  const allowsEffects = id === "pie-hover-effects";
  const grows = id === "pie-donut-grow" || half;
  const custom = id === "pie-center-custom" && !data && !renderCenter;
  const showsShare = id === "pie-center-share";
  const legend = id === "pie-hover-legend" && !compact;
  const glow = id === "pie-glow";
  const gradients = id === "pie-gradients";
  const paints = piePaints[id];
  const rows = metrics(data, fixture.names, fixture.values).filter(item => item.value > 0);
  const selection = hovered ?? focused ?? pinned;
  const active = selection !== null && selection < rows.length ? selection : null;
  const total = sum(rows);
  const row = active === null ? undefined : rows[active];
  const value = row?.value ?? total;
  const share = total ? value / total : 0;
  const currency = !data && fixture.currency === true;
  const format = currency ? dollars : number;
  const label = row?.name ?? (data ? "Total" : fixture.label ?? "Total");
  const readout = row ? `${row.name}: ${format.format(row.value)}, ${percentage.format(share)} of total` : `Total ${format.format(total)}`;

  function clear() {
    setFocused(null);
    setHovered(null);
    setPinned(null);
  }

  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      clear();
      return;
    }
    const next = nextChartFocus(event.key, active, rows.length);
    if (next === undefined) return;
    event.preventDefault();
    setHovered(null);
    setFocused(next);
  }

  const svg = useSliceEntrance(!compact && !data && rows.length > 0, uid, outer + 12);
  const geometry = { innerRadius: inner, outerRadius: outer };
  const slice = fixture.corner ? arcPath().digits(3).cornerRadius(fixture.corner) : path;
  const segments = pieAngles<(typeof rows)[number]>().sort(null).value(item => item.value)
    .startAngle(-Math.PI / 2).endAngle(-Math.PI / 2 + sweep).padAngle(fixture.padding ?? 0)(rows);

  return <div className={pie.frame} data-pie={id} data-legend={legend} data-compact={compact}>
    {!compact && allowsEffects && <Choices label="Pie hover effect" options={effects} value={effect} onChange={setEffect}
      className={pie.controls} itemClassName={pie.effect} />}
    <svg ref={svg} className={`${styles.plot} ${pie.plot}`} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={example.title} aria-roledescription="chart" aria-describedby={compact ? undefined : uid}
      tabIndex={compact ? undefined : 0} onKeyDown={inspect} onBlur={() => setFocused(null)}>
      <defs>
        {!compact && !data && segments.map(({ startAngle, endAngle }, index) => <clipPath key={index} id={`${uid}-entrance-${index}`}>
          <path data-entrance-slice="" data-from={startAngle} data-to={endAngle} d="M0 0Z" />
        </clipPath>)}
        {rows.map((item, index) => {
          const paint = paints?.[index];
          const color = tone(theme, id === "pie-pattern-tile" && index < 2 ? 1 - index : index, item.color);
          if (paint) return <PiePaint key={index} id={`${uid}-paint-${index}`} color={color} paint={paint} tinted={id === "pie-pattern-tile"} />;
          return gradients && <radialGradient key={index} id={`${uid}-paint-${index}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={tone(theme, index * 2, item.color)} />
            <stop offset="100%" stopColor={tone(theme, index * 2 + 1)} />
          </radialGradient>;
        })}
      </defs>
      <g transform={`translate(${center} ${center})`}>
        {!rows.length && <path d={slice({ ...geometry, startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + sweep }) ?? undefined} fill={theme.grid} />}
        {segments.map(({ data: item, startAngle, endAngle, padAngle }, index) => {
          const selected = active === index;
          const translate = selected && !grows && (!allowsEffects || effect === "Translate");
          const [x, y] = point(0, 0, translate ? 10 : 0, (startAngle + endAngle) * 90 / Math.PI - 90);
          const base = { ...geometry, startAngle, endAngle, padAngle };
          const scale = selected && allowsEffects && effect === "Grow" ? (outer + 10) / outer : 1;
          const grow = selected && grows;
          const color = tone(theme, index, item.color);
          const d = slice(base) ?? undefined;
          return <g key={index} data-slice={item.name} data-active={selected} data-grow={grow} aria-hidden="true">
            <g data-pie-motion="">
              <g className={`${styles.circularMark} ${pie.mark}`} opacity={row && !selected ? .4 : 1}
                transform={`translate(${x} ${y}) scale(${scale})`} style={{ filter: glow && selected ? `drop-shadow(0 0 12px ${color})` : undefined }}>
                <path data-pie-wedge="" d={grow ? slice({ ...base, outerRadius: outer + 10 }) ?? undefined : d}
                  fill={gradients || paints?.[index] ? `url(#${uid}-paint-${index})` : color} />
              </g>
            </g>
            <path className={styles.circularHit} d={d} fill="transparent"
              onPointerEnter={event => { if (!compact && event.pointerType !== "touch") setHovered(index); }}
              onPointerLeave={() => setHovered(null)}
              onClick={() => { if (!compact) setPinned(previous => previous === index ? null : index); }} />
          </g>;
        })}
      </g>
      {!solid && <CircularCenter center={center} size={2 * inner - 16} useCustom={Boolean(renderCenter) || custom} value={value}
        label={label} currency={currency} format={glow && !data ? compactCurrency : undefined}
        animated={!compact && !showsShare} fontSize={fixture.fontSize ?? 30} labelSize={fixture.labelSize}
        color={showsShare && row ? tone(theme, active ?? 0, row.color) : undefined}
        share={showsShare && row ? `${percentage.format(share)} of total` : undefined}>
        {renderCenter ? renderCenter({ name: row?.name ?? null, value, total, share })
          : custom && <span className={pie.custom}><span>{label}</span><strong>{number.format(value)}</strong><span>units sold</span></span>}
      </CircularCenter>}
    </svg>
    {!compact && <span className={styles.screenReader} id={uid} role="status">{readout}</span>}
    {legend && <div className={pie.legend}>
      <p>Sales</p>
      <ul aria-label="Sales channels" onKeyDown={event => {
        if (event.key !== "Escape" || active === null) return;
        event.preventDefault();
        event.stopPropagation();
        clear();
      }}>
        {rows.map((item, index) => <li key={index}><Toggle className={pie.legendItem} pressed={pinned === index}
          data-active={active === index} data-dimmed={row !== undefined && active !== index}
          onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }}
          onPointerLeave={() => setHovered(null)}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
          onPressedChange={pressed => setPinned(pressed ? index : null)}>
          <span className={styles.swatch} style={{ background: tone(theme, index, item.color) }} />
          <span>{item.name}</span><strong>{format.format(item.value)}</strong>
        </Toggle></li>)}
      </ul>
    </div>}
  </div>;
}
