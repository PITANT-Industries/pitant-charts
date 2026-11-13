import { area, curveNatural, line } from "d3-shape";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { lineDate } from "./line-format";
import type { LineBounds, LineVariant } from "./line-detail-data";

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

export function LineDateRegions({ id, variant, fill, categories, top, bottom, right, x }: {
  id: string;
  variant: LineVariant;
  fill: Fill;
  categories: string[];
  top: number;
  bottom: number;
  right: number;
  x: (index: number) => number;
}) {
  const weekends = variant === "line-weekends";
  const deadline = variant === "line-deadline" || variant === "line-deadline-fills";
  if (!weekends && !deadline) return null;
  const due = categories.findIndex(category => lineDate(category)?.getUTCMonth() === 9 && lineDate(category)?.getUTCDate() === 15);
  const dueX = x(due);
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
    {weekends && categories.map((category, index) => lineDate(category)?.getUTCDay() === 6 && index < categories.length - 1
      ? <rect key={index} x={x(index)} y={top} width={x(Math.min(categories.length - 1, index + 2)) - x(index)} height={bottom - top} fill={`url(#${id})`} /> : null)}
    {deadline && due >= 0 && <>
      <rect data-line-deadline-fill={fill} x={dueX} y={top} width={right - dueX} height={bottom - top}
        fill={fill === "solid" ? negative : fill === "gradient" ? `url(#${id}-gradient)` : `url(#${id})`}
        fillOpacity={fill === "solid" ? .17 : fill === "pattern" ? .6 : 1}
        mask={fill === "gradient" ? undefined : `url(#${id}-fade)`} />
      <line x1={dueX} x2={dueX} y1={top} y2={bottom} stroke={negative} />
      {variant === "line-deadline" && <text x={dueX + 6} y={top + 6} dominantBaseline="hanging" fill={negative} fontSize={11}>Due Oct 15</text>}
    </>}
  </g>;
}

export function LineEvents({ rows, x, top, bottom, compact }: {
  rows: readonly Record<string, unknown>[];
  x: (index: number) => number;
  top: number;
  bottom: number;
  compact: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return <g data-line-event-rules="">
    {rows.map((row, index) => {
      const events = Array.isArray(row.events) ? row.events.filter((value): value is string => typeof value === "string") : [];
      if (!events.length) return null;
      const isOpen = open === index;
      const [icon] = events[0].split(" ");
      return <g key={index} transform={`translate(${x(index)},${top - 8})`}>
        <line y1={18} y2={bottom - top + 8} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        <foreignObject x="-21" y="-21" width="42" height="42" className="line-detail-event">
          <Button type="button" className="line-detail-event-button" tabIndex={compact ? -1 : undefined}
            aria-label={events.join(", ")} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : index)}
            onPointerEnter={() => { if (!compact) setOpen(index); }} onPointerLeave={() => setOpen(null)} onBlur={() => setOpen(null)}>
            {icon}
            {events.length > 1 && <span className="line-detail-event-count">{events.length}</span>}
          </Button>
        </foreignObject>
        {isOpen && <g pointerEvents="none" role="status">
          {events.map((event, position) => <g key={event} transform={`translate(${(position - (events.length - 1) / 2) * 30},30)`}>
            {events.length > 1 && <circle r={14} fill="var(--card)" stroke="var(--border)" />}
            {events.length > 1 && <text dominantBaseline="central" textAnchor="middle" fontSize={14}>{event.split(" ")[0]}</text>}
          </g>)}
          <text x="0" y={events.length > 1 ? -20 : 31} textAnchor="middle" fill="var(--foreground)" fontSize={11}>{events.map(event => event.replace(/^\S+\s/, "")).join(" · ")}</text>
        </g>}
      </g>;
    })}
  </g>;
}
