import type { DefaultLabelFormatterCallbackParams } from "echarts";
import { escapeTooltipHtml } from "../evil-tooltip";
import type { CartesianData } from "./data";

const integer = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });

export const lineMoney = (value: number) => money.format(value);

export function lineDate(category: string): Date | undefined {
  const monthAndDay = /^[A-Z][a-z]{2}(?: [0-9]{1,2})?$/.test(category);
  if (!monthAndDay && !/^\d{4}-\d{2}-\d{2}$/.test(category)) return undefined;
  const date = new Date(monthAndDay ? `${category.length === 3 ? `${category} 1` : category} 2026 UTC` : category);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function lineDateLabel(category: string) {
  const date = lineDate(category);
  return date ? dateLabel.format(date) : category;
}

export interface BandBounds {
  lower: readonly (number | null)[];
  upper: readonly (number | null)[];
}

function formatValue(id: string, value: number, series: string) {
  if (["line-profit-loss", "line-profit-loss-legend", "line-projection-manual", "line-loading"].includes(id) || id === "line-dual-axis" && series === "Revenue") return lineMoney(value);
  if (id === "line-dual-axis" && series === "Conversion" || id === "line-fixed-scale") return `${integer.format(value)}%`;
  if (id === "line-threshold") return `${integer.format(value)} ms`;
  return integer.format(value);
}

export function lineTooltip(id: string, data: CartesianData, bands: readonly BandBounds[]) {
  const nameForBand = (index: number) => id === "line-band-ranges" ? `${data.series[index]?.name ?? "Series"} range` : "Forecast";
  return (value: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) => {
    const entries = Array.isArray(value) ? value : [value];
    if (entries.some(entry => entry.componentType === "markPoint")) {
      const marker = entries.find(entry => entry.componentType === "markPoint");
      return escapeTooltipHtml(marker?.name ?? "");
    }
    const date = entries[0]?.name;
    if (!date) return "";
    const index = data.categories.indexOf(date);
    const rows = data.series.flatMap(({ name, values }) => {
      const point = values[index];
      return typeof point === "number" ? [{ name, value: formatValue(id, point, name) }] : [];
    });
    for (const [position, { lower, upper }] of bands.entries()) {
      const low = lower[index], high = upper[index];
      if (typeof low === "number" && typeof high === "number") rows.push({ name: nameForBand(position), value: `${integer.format(low)} – ${integer.format(high)}` });
    }
    if (id === "line-bollinger" || index === -1) {
      for (const { seriesName, value } of entries) {
        if (typeof value === "number" && seriesName && !rows.some(row => row.name === seriesName)) rows.push({ name: seriesName, value: formatValue(id, value, seriesName) });
      }
    }
    if (!rows.length) return "";
    return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(lineDateLabel(date))}</div><div class="cl-tooltip-rows">${rows.map(row => `<div class="cl-tooltip-row"><span>${escapeTooltipHtml(row.name)}</span><strong>${escapeTooltipHtml(row.value)}</strong></div>`).join("")}</div></div>`;
  };
}
