import "./cartesian-focus.css";

const groupedNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });

export function cartesianPillWidth(label: string) {
  if (/^[\p{L}]{3}$/u.test(label)) return 63;
  if (/^[\p{L}]{3} \d{1,2}$/u.test(label)) return 75;
  return Math.max(48, label.length * 7.2 + 26);
}

export function CartesianDatePill({ x, y, label, text, surface, width = cartesianPillWidth(label) }: {
  x: number;
  y: number;
  label: string;
  text: string;
  surface: string;
  width?: number;
}) {
  return <g className="cartesian-focus-pill" data-line-date-pill="" aria-hidden="true" pointerEvents="none">
    <rect x={x - width / 2} y={y} width={width} height={32} rx={16} fill={text} style={{ fill: `var(--chart-focus-pill, ${text})` }} />
    <text x={x} y={y + 16} dominantBaseline="central" textAnchor="middle" fill={surface} fontSize={14} fontWeight={500}
      style={{ fill: `var(--chart-focus-pill-text, ${surface})` }}>{label}</text>
  </g>;
}

export function CartesianFocusPoint({ x, y, color, surface, halo = true }: {
  x: number;
  y: number;
  color: string;
  surface?: string;
  halo?: boolean;
}) {
  return <g aria-hidden="true" pointerEvents="none" data-cartesian-focus-point="">
    {halo && <circle cx={x} cy={y} r={13} fill={color} fillOpacity={0.3} />}
    <circle cx={x} cy={y} r={5} fill={color} stroke={surface} strokeWidth={surface ? 2 : undefined} />
  </g>;
}

export function CartesianReadout({ label, entries, live = true }: { label: string; entries: { name: string; value: number | string; color: string }[]; live?: boolean }) {
  return <div className="cartesian-focus-readout" role={live ? "status" : undefined}>
    <div className="cartesian-focus-readout-title">{label}</div>
    <dl className="cartesian-focus-readout-values recharts-tooltip-item-list">
      {entries.map(({ name, value, color }, index) => <div className="cartesian-focus-readout-row" key={index}>
        <dt><i style={{ backgroundColor: color }} aria-hidden="true" />{name}</dt>
        <dd>{typeof value === "number" ? groupedNumber.format(value) : value}</dd>
      </div>)}
    </dl>
  </div>;
}
