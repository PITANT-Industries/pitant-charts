import type { ChartData, ChartExample, ChartSeries } from "../../types";
import { barFixture } from "./bar-fixtures";
import type { CartesianData } from "./data";

const sample = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function resolveBarInput(example: ChartExample, input?: ChartData): CartesianData {
  if (input === undefined) return barFixture(example.id);

  const rows = input.rows?.map(row => ({ ...row }));
  const series: ChartSeries[] = input.series !== undefined
    ? input.series.map(item => ({ ...item, values: item.values.map(sample) }))
    : rows?.some(row => Object.hasOwn(row, "value"))
      ? [{ name: "Value", values: rows.map(row => sample(row.value)) }]
      : [];
  const count = Math.max(rows?.length ?? 0, ...series.map(item => item.values.length));
  const categories = input.categories !== undefined ? [...input.categories]
    : Array.from({ length: count }, (_, index) => {
      const row = rows?.[index];
      return String(row?.category ?? row?.label ?? row?.date ?? row?.name ?? index + 1);
    });

  return { categories, series, rows };
}
