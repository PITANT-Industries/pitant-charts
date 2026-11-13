import type { ChartData } from "../../types";
import { numeric } from "./shared";
import { readHierarchy } from "./treemap-tree-fixtures";
import type { SunburstNode } from "./upstream/sunburst-data";

export function referenceTreemapData(data: ChartData | undefined, fixture: SunburstNode): SunburstNode {
  return data ? { name: fixture.name, children: readHierarchy(data.rows) ?? [] } : fixture;
}

export type WaffleData = { names: readonly string[]; values: readonly number[]; colors: readonly (string | undefined)[] };

export function referenceWaffleData(data: ChartData | undefined, fixture: { names: readonly string[]; values: readonly number[] }): WaffleData {
  if (!data) return { ...fixture, colors: [] };
  if (data.rows) return {
    names: data.rows.map((row, index) => String(row.name ?? row.label ?? index + 1)),
    values: data.rows.map(row => Math.max(0, numeric(row.value))),
    colors: data.rows.map(row => typeof row.color === "string" ? row.color : undefined),
  };
  const first = data.series?.[0];
  return {
    names: (first?.values ?? []).map((_, index) => data.categories?.[index] ?? String(index + 1)),
    values: (first?.values ?? []).map(value => Math.max(0, numeric(value))),
    colors: (first?.values ?? []).map(() => first?.color),
  };
}

type MekkoData = { categories: readonly string[]; series: readonly { name: string; values: readonly number[]; color?: string }[] };

export function referenceMarimekkoData(data: ChartData | undefined, fixture: MekkoData): MekkoData {
  if (!data) return fixture;
  const source = data.series ?? [];
  const categories = data.categories ?? Array.from({ length: Math.max(0, ...source.map(row => row.values.length)) }, (_, index) => String(index + 1));
  return {
    categories,
    series: source.map(row => ({ name: row.name, color: row.color, values: categories.map((_, index) => Math.max(0, numeric(row.values[index]))) })),
  };
}
