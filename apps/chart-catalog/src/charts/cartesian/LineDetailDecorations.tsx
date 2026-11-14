import { area, curveNatural, line } from "d3-shape";
import { useEffect, useRef, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { lineDate } from "./line-format";
import type { LineBounds, LineVariant } from "./line-detail-data";
import { lineEventFanPosition, readLineEvents } from "./line-events";

export type Fill = "pattern" | "gradient" | "solid";
export const negative = "var(--chart-negative, #dc5149)";
export const positive = "var(--chart-positive, #279873)";

export function LineBand({ id, variant, band, fill, color, width, x, y }: {
  id: string;
  variant: LineVariant;
  band: LineBounds;
  fill: Fill;
  color: string;
  width: number;
  x: (index: number) => number;
  y: (value: number) => number;
}) {
  const indices = band.low.map((_, index) => index);
  const outline = (values: LineBounds["low"]) => line<number>().x(x).y(index => y(values[index]!)).defined(index => values[index] != null).curve(curveNatural)(indices) ?? undefined;
  const fillPath = area<number>().x(x).y0(index => y(band.low[index]!)).y1(index => y(band.high[index]!))
    .defined(index => band.low[index] != null && band.high[index] != null).curve(curveNatural)(indices);
  const ceiling = variant === "line-band-edges";
  const fade = variant === "line-band-fade";
  const ranges = variant === "line-band-ranges";
  const range = variant === "line-band-range";
  const bollinger = variant === "line-band-bollinger";
  const mode = variant === "line-band-fill" ? fill : ceiling ? "gradient" : "solid";
  const bandOpacity = variant === "line-band-fill" ? .4 : ranges || bollinger ? .12 : .15;
  const stroke = ceiling || range ? 1.5 : 1;
  if (!fillPath) return null;

  return <g data-line-band={band.name} mask={fade ? `url(#${id}-fade)` : undefined}>
    <defs>
      {mode === "gradient" && <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity={ceiling ? .3 : .4} /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient>}
      {mode === "pattern" && <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0,0V6" stroke={color} strokeOpacity=".4" strokeWidth="1.5" />
      </pattern>}
      {fade && <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height="100%">
        <linearGradient id={`${id}-alpha`} gradientUnits="userSpaceOnUse" x1={x(0)} x2={x(indices.length - 1)} y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".2" stopColor="white" /><stop offset=".8" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <rect width="100%" height="100%" fill={`url(#${id}-alpha)`} />
      </mask>}
    </defs>
    <path d={fillPath} fill={mode === "solid" ? color : `url(#${id})`} fillOpacity={mode === "solid" ? bandOpacity : mode === "pattern" ? .6 : 1} />
    {!ranges && <>
      {!ceiling && <path d={outline(band.low)} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={fade ? "4 4" : undefined} />}
      <path d={outline(band.high)} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={fade ? "4 4" : ceiling ? "1 3" : undefined} strokeLinecap="round" />
    </>}
  </g>;
}

export function LineDateRegions({ id, variant, fill, categories, top, bottom, right, x, demo = true, dates,
  deadlinePoint, highlights = [], datePosition }: {
  id: string;
  variant: LineVariant;
  fill: Fill;
  categories: string[];
  top: number;
  bottom: number;
  right: number;
  x: (index: number) => number;
  demo?: boolean;
  dates?: readonly (string | undefined)[];
  deadlinePoint?: { x: number; label: string };
  highlights?: readonly { x: number; label: string }[];
  datePosition?: (time: number) => number;
}) {
  const weekends = variant === "line-weekends";
  const deadline = variant === "line-deadline" || variant === "line-deadline-fills";
  if (!weekends && !deadline && !highlights.length) return null;
  const due = demo ? categories.findIndex(category => lineDate(category)?.getUTCMonth() === 9 && lineDate(category)?.getUTCDate() === 15) : -1;
  const dueX = demo ? x(due) : deadlinePoint?.x ?? right;
  const hasDue = demo ? due >= 0 : deadlinePoint !== undefined;
  const dateAt = (index: number) => demo ? lineDate(categories[index])
    : dates?.[index] ? new Date(`${dates[index]}T00:00:00Z`) : undefined;
  return <g data-line-date-regions="">
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
        <path d="M0,0V5" stroke={weekends ? "var(--muted-foreground)" : negative} strokeWidth="1" strokeOpacity={weekends ? ".22" : ".4"} />
      </pattern>
      <linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={negative} stopOpacity=".22" /><stop offset="1" stopColor={negative} stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-fade`}>
        <linearGradient id={`${id}-alpha`}><stop offset="0" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <rect x={dueX} y={top} width={Math.max(0, right - dueX)} height={bottom - top} fill={`url(#${id}-alpha)`} />
      </mask>
    </defs>
    {weekends && categories.map((_, index) => dateAt(index)?.getUTCDay() === 6 && index < categories.length - 1
      ? <rect key={index} x={x(index)} y={top} width={!demo && datePosition
        ? Math.max(0, Math.min(right, datePosition(dateAt(index)!.valueOf() + 2 * 86_400_000)) - x(index))
        : x(Math.min(categories.length - 1, index + 2)) - x(index)} height={bottom - top} fill={`url(#${id})`} /> : null)}
    {highlights.map((point, index) => <line key={index} data-line-highlight="" x1={point.x} x2={point.x} y1={top} y2={bottom}
      stroke="var(--chart-line-primary, currentColor)" strokeDasharray="4 4"><title>{point.label}</title></line>)}
    {deadline && hasDue && <>
      <rect data-line-deadline-fill={fill} x={dueX} y={top} width={right - dueX} height={bottom - top}
        fill={fill === "solid" ? negative : fill === "gradient" ? `url(#${id}-gradient)` : `url(#${id})`}
        fillOpacity={fill === "solid" ? .17 : fill === "pattern" ? .6 : 1}
        mask={fill === "gradient" ? undefined : `url(#${id}-fade)`} />
      <line x1={dueX} x2={dueX} y1={top} y2={bottom} stroke={negative} />
      {variant === "line-deadline" && <text x={dueX + 6} y={top + 6} dominantBaseline="hanging" fill={negative} fontSize={11}>
        {demo ? "Due Oct 15" : `Due ${deadlinePoint?.label ?? ""}`}
      </text>}
    </>}
  </g>;
}

export function LineEvents({ rows, x, top, bottom, compact, onInspectMarkers }: {
  rows: readonly Record<string, unknown>[];
  x: (index: number) => number;
  top: number;
  bottom: number;
  compact: boolean;
  onInspectMarkers: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const rules = useRef<SVGGElement>(null);
  useEffect(() => {
    if (open === null) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (!rules.current?.querySelector(`[data-line-event-group="${open}"]`)?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  return <g ref={rules} data-line-event-rules="">
    {rows.map((row, index) => {
      const events = readLineEvents(row);
      if (!events.length) return null;
      const isOpen = open === index;
      return <g key={index} transform={`translate(${x(index)},${top - 8})`}>
        <line y1={18} y2={bottom - top + 8} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" pointerEvents="none" />
        <g data-line-event-group={index} data-expanded={isOpen && events.length > 1 || undefined}
          onPointerEnter={() => { if (!compact) { onInspectMarkers(); setOpen(index); } }}
          onPointerMove={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
          onPointerLeave={event => { if (event.pointerType !== "touch" && !event.currentTarget.contains(document.activeElement)) setOpen(null); }}
          onFocus={event => { if (!compact && !event.currentTarget.contains(event.relatedTarget)) { onInspectMarkers(); setOpen(index); } }}
          onKeyDown={event => {
            if (event.key !== "Escape" || !isOpen || events.length < 2) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(null);
            event.currentTarget.querySelector<HTMLButtonElement>(".line-detail-event-origin button")?.focus();
          }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
          <g className="line-detail-event-body" aria-hidden="true" pointerEvents="none">
            <circle cy="2" r="14" fill="black" fillOpacity=".15" />
            <circle data-line-event-disc="" r="14" fill="var(--chart-marker-background, var(--background))" stroke="var(--chart-marker-border, var(--border))" strokeWidth="1.5" />
            <text y="1" textAnchor="middle" dominantBaseline="middle" fill="var(--chart-marker-foreground, var(--foreground))" fontSize="14">{events[0].icon}</text>
            {events.length > 1 && <g>
              <circle cx="16" cy="-16" r="9" fill="var(--chart-marker-badge-background, var(--foreground))" />
              <text x="16" y="-16" textAnchor="middle" dominantBaseline="middle" fill="var(--chart-marker-badge-foreground, var(--background))" fontSize="11" fontWeight="600">{events.length}</text>
            </g>}
          </g>
          <foreignObject x="-21" y="-28" width="42" height="42" className="line-detail-event line-detail-event-origin">
            <Button type="button" className="line-detail-event-button" tabIndex={compact ? -1 : undefined}
              aria-label={events.map(event => event.title).join(", ")} aria-expanded={events.length > 1 ? isOpen : undefined}
              onClick={event => { if (!compact) setOpen(event.detail === 0 && isOpen ? null : index); }}>
            </Button>
          </foreignObject>
          {isOpen && events.length > 1 && <>
            <rect x="-71" y="-71" width="142" height="99" fill="transparent" />
            <circle r="7" fill="var(--border)" opacity=".5" pointerEvents="none" />
            {events.map((event, position) => {
              const point = lineEventFanPosition(position, events.length);
              return <g key={position} className="line-detail-event-fan" transform={`translate(${point.x},${point.y})`}>
                <circle data-line-event-fan-disc={position} r="14" fill="var(--chart-marker-background, var(--background))" stroke="var(--chart-marker-border, var(--border))" strokeWidth="1.5" pointerEvents="none" />
                <text y="1" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="var(--chart-marker-foreground, var(--foreground))" aria-hidden="true" pointerEvents="none">{event.icon}</text>
                <foreignObject data-line-event-fan={position} x="-21" y="-21" width="42" height="42" className="line-detail-event">
                  <Button type="button" className="line-detail-event-button" aria-label={[event.title, event.description].filter(Boolean).join(": ")}
                    onClick={() => setOpen(index)} />
                </foreignObject>
              </g>;
            })}
          </>}
        </g>
      </g>;
    })}
  </g>;
}
