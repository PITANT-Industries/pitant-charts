import type { ChartData, ChartSeries } from "../../types";

export const finiteLineValue = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** This parser is browser/worker independent and never imports demo fixtures. */
export function lineCallerInput(input: ChartData) {
  const rows = input?.rows?.map(row => row && typeof row === "object" ? { ...row } : {});
  const supplied = input?.series !== undefined ? input.series
    : rows?.some(row => Object.hasOwn(row, "value"))
      ? [{ name: "Value", values: rows.map(row => finiteLineValue(row.value) ? row.value : null) }] : [];
  let count = rows?.length ?? 0;
  for (const series of supplied ?? []) count = Math.max(count, series.values.length);
  const categories = input?.categories !== undefined ? [...input.categories]
    : Array.from({ length: count }, (_, index) => String(rows?.[index]?.category ?? rows?.[index]?.label ?? rows?.[index]?.date ?? rows?.[index]?.name ?? index + 1));
  const series: ChartSeries[] = (supplied ?? []).map((item, index) => ({
    ...item, name: String(item.name ?? `Series ${index + 1}`),
    values: categories.map((_, position) => finiteLineValue(item.values[position]) ? item.values[position] : null),
  }));
  return { categories, series, rows };
}
