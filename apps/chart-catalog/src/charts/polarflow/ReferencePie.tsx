import { arc as arcPath } from "d3-shape";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { donutFixtures, pieFixtures } from "./circular-fixtures";
import { CircularCenter } from "./CircularCenter";
import styles from "./donut.module.css";
import { dollars, metrics, nextChartFocus, number, point, sum, tone, type Props } from "./shared";

const fixtures = {
  "pie-default": { ...pieFixtures["pie-default"], label: "Total", innerRadius: 0.5, fontSize: 30 },
  "pie-center": { ...donutFixtures["pie-center"], innerRadius: 80, fontSize: 30 },
  "pie-center-share": { ...donutFixtures["pie-center-share"], innerRadius: 85, fontSize: 24 },
  "pie-donut-grow": { ...donutFixtures["pie-donut-grow"], innerRadius: 75, fontSize: 29.48 },
} as const;

type ReferencePieId = keyof typeof fixtures;

export function isReferencePie(id: string): id is ReferencePieId {
  return Object.hasOwn(fixtures, id);
}

const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const path = arcPath().digits(3);
const center = 140;
const outer = 130;
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

function useSliceEntrance(enabled: boolean, uid: string) {
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
        const sector = eased === 0 ? null : path({ startAngle: from, endAngle: from + eased * (to - from), innerRadius: 0, outerRadius: 142 });
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
  }, [enabled, uid]);
  return svg;
}

export function ReferencePie({ example, compact, data, renderCenter, id }: Props & { id: ReferencePieId }) {
  const theme = useChartTheme();
  const uid = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hovered ?? focused ?? pinned;
  const fixture = fixtures[id];
  const solid = id === "pie-default" && !renderCenter;
  const inner = id === "pie-default" && renderCenter ? 80 : fixture.innerRadius;
  const grows = id === "pie-donut-grow";
  const showsShare = id === "pie-center-share";
  const rows = metrics(data, fixture.names, fixture.values).filter(item => item.value > 0);
  const total = sum(rows);
  const row = active === null ? undefined : rows[active];
  const value = row?.value ?? total;
  const share = total ? value / total : 0;
  const currency = !data && (id === "pie-default" || id === "pie-center");
  const format = currency ? dollars : number;
  const label = row?.name ?? (data ? "Total" : fixture.label);
  const readout = row ? `${row.name}: ${format.format(row.value)}, ${percentage.format(share)} of total` : `Total ${format.format(total)}`;

  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      setFocused(null);
      setHovered(null);
      setPinned(null);
      return;
    }
    const next = nextChartFocus(event.key, active, rows.length);
    if (next === undefined) return;
    event.preventDefault();
    setHovered(null);
    setFocused(next);
  }

  const svg = useSliceEntrance(!compact && !data && rows.length > 0, uid);
  let angle = -Math.PI / 2;
  const segments = rows.map(item => {
    const startAngle = angle;
    angle += turn * item.value / total;
    return { item, startAngle, endAngle: angle };
  });
  return <div className={styles.donut}>
    <svg ref={svg} className={`${styles.plot} ${styles.matchedPie}`} viewBox="0 0 280 280" role="img"
      aria-label={example.title} aria-roledescription="chart" aria-describedby={compact ? undefined : uid}
      tabIndex={compact ? undefined : 0} onKeyDown={inspect} onBlur={() => setFocused(null)}>
      {!compact && !data && <defs>
        {segments.map(({ startAngle, endAngle }, index) => <clipPath key={index} id={`${uid}-entrance-${index}`}>
          <path data-entrance-slice="" data-from={startAngle} data-to={endAngle} d="M0 0Z" />
        </clipPath>)}
      </defs>}
      <g transform={`translate(${center} ${center})`}>
        {!rows.length && <path d={path({ startAngle: 0, endAngle: turn, innerRadius: inner, outerRadius: outer }) ?? undefined} fill={theme.grid} />}
        {segments.map(({ item, startAngle, endAngle }, index) => {
          const selected = active === index;
          const [x, y] = point(0, 0, selected && !grows ? 10 : 0, (startAngle + endAngle) * 90 / Math.PI - 90);
          const base = { startAngle, endAngle, innerRadius: inner, outerRadius: outer };
          return <g key={index} data-slice={item.name} data-active={selected} data-grow={grows && selected} aria-hidden="true">
            <g data-pie-motion="">
              <g className={styles.circularMark} opacity={row && !selected ? .4 : 1} transform={`translate(${x} ${y})`}>
                <path data-pie-wedge="" d={path({ ...base, outerRadius: outer + (grows && selected ? 10 : 0) }) ?? undefined} fill={tone(theme, index, item.color)} />
              </g>
            </g>
            <path className={styles.circularHit} d={path(base) ?? undefined} fill="transparent"
              onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }}
              onPointerLeave={() => setHovered(null)}
              onClick={() => { if (!compact) setPinned(previous => previous === index ? null : index); }} />
          </g>;
        })}
      </g>
      {!solid && <CircularCenter center={center} size={2 * inner - 16} useCustom={Boolean(renderCenter)} value={value} label={label} currency={currency}
        animated={!compact && !showsShare} fontSize={fixture.fontSize} color={showsShare && row ? tone(theme, active ?? 0, row.color) : undefined}
        share={showsShare && row ? `${percentage.format(share)} of total` : undefined}>
        {renderCenter?.({ name: row?.name ?? null, value, total, share })}
      </CircularCenter>}
    </svg>
    {!compact && <span className={styles.screenReader} id={uid} role="status">{readout}</span>}
  </div>;
}
