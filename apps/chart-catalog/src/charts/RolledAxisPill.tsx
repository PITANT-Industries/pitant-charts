import type { HTMLAttributes } from "react";
import "./rolled-axis-pill.css";

const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function datePillColumns(dates: readonly Date[]) {
  return [
    dates.map(date => month.format(date)),
    dates.map(date => String(date.getUTCDate())),
  ];
}

export function RolledAxisPill({ columns, index, x, y, className, style, collapseConstantColumns = true, ...attributes }: {
  columns: readonly (readonly string[])[];
  index: number;
  x: number;
  y: number;
  collapseConstantColumns?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  return <div {...attributes} className={`chart-axis-pill${className ? ` ${className}` : ""}`} data-single-column={columns.length === 1 || undefined} aria-hidden="true"
    style={{ ...style, left: x, top: y }}>
    {columns.map((labels, column) => {
      const constant = collapseConstantColumns && labels.every(label => label === labels[0]);
      return <div key={column} className="chart-axis-pill-window">
        <div className="chart-axis-pill-stack" style={{ transform: `translateY(${constant ? 0 : -24 * index}px)` }}>
          {(constant ? labels.slice(0, 1) : labels).map((label, row) => <div key={row}>{label}</div>)}
        </div>
      </div>;
    })}
  </div>;
}
