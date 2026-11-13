import { Button } from "@ui-sdk/react/button";
import type { EChartsType } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { Choices } from "../../ui/Choices";
import { EChart } from "../EChart";
import { buildLine, type ChartTheme, type Controls } from "./options";
import type { CartesianData } from "./data";
import "./line-extras.css";

const states = [{ value: "loading", label: "Loading" }, { value: "ready", label: "Ready" }];
const layouts = ["pattern", "gradient", "solid"] as const;
const formatTotal = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 });

export function DeadlineFills({ example, data, theme, compact, controls }: {
  example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean; controls: Controls;
}) {
  return <div className="line-deadline-comparison">
    {layouts.map(mode => <figure key={mode} className="line-deadline-panel">
      <figcaption>{mode}</figcaption>
      <EChart label={`Deadline with ${mode} fill`} option={buildLine(example, data, theme, compact, { ...controls, deadlineFill: mode })} compact={compact} />
    </figure>)}
  </div>;
}

export function LineLoadToggle({ loading, onChange }: { loading: boolean; onChange: (value: boolean) => void }) {
  return <Choices label="Chart state" className="cartesian-choice-group" options={states} value={loading ? "loading" : "ready"} onChange={value => onChange(value === "loading")} />;
}

export function LineSkeleton() {
  const label = "Loading sessions";
  return <div className="line-skeleton" role="status" aria-label={label} aria-busy="true">
    <svg viewBox="0 0 400 180" preserveAspectRatio="none" aria-hidden="true">
      {[24, 56, 88, 120, 152].map(y => <path key={y} d={`M14 ${y}H385`} fill="none" stroke="var(--border)" strokeDasharray="4 4" />)}
      <path d="M14 137C36 133 54 91 77 107S113 126 139 98S166 64 192 82S218 109 248 87S282 53 300 72S324 95 347 72S371 61 385 51"
        className="line-skeleton-stroke" fill="none" stroke="var(--chart-1)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
    <span className="line-skeleton-label" aria-hidden="true">{label}</span>
  </div>;
}

export function LineLegend({ series, currency, active, onActive }: {
  series: (ChartSeries & { color: string })[];
  currency: boolean;
  active: number | undefined;
  onActive: (index: number | undefined) => void;
}) {
  return <div className="line-series-legend" aria-label="Series legend">
    {series.map((item, index) => {
      const total = item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      return <Button key={index} className="line-legend-entry" data-active={active === index} data-dimmed={active !== undefined && active !== index}
        onPointerEnter={() => onActive(index)} onPointerLeave={() => onActive(undefined)}
        onFocus={() => onActive(index)} onBlur={() => onActive(undefined)}>
        <i className="cartesian-swatch" aria-hidden="true" style={{ backgroundColor: item.color }} />
        <span>{item.name}</span><strong>{currency ? `$${formatTotal.format(total).toLowerCase()}` : total.toLocaleString("en")}</strong>
      </Button>;
    })}
  </div>;
}

export async function downloadLineChart(chart: EChartsType, format: "svg" | "png", background: string) {
  const svg = chart.getSvgDataURL();
  if (!svg) return;
  const link = document.createElement("a");
  link.download = `line-export.${format}`;
  link.href = svg;
  if (format === "png") {
    const bitmap = new Image();
    bitmap.src = svg;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(chart.getWidth() * 2));
    canvas.height = Math.max(1, Math.round(chart.getHeight() * 2));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    link.href = canvas.toDataURL("image/png");
  }
  link.click();
}
