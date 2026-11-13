import type { ChartData } from "../../types";
import { detailCountries } from "./choropleth-detail-data";
import type { Coordinate } from "./geo-fixtures";

export type ChoroplethStatus = "live" | "beta" | "not yet";
export interface ChoroplethCallerMarker {
  key: string;
  name: string;
  at: Coordinate;
  value: number;
  hasValue: boolean;
  category?: string;
}

export interface ChoroplethCallerData {
  values: ReadonlyMap<string, number>;
  statuses: ReadonlyMap<string, ChoroplethStatus>;
  markers: readonly ChoroplethCallerMarker[];
  maximum: number;
  total: number;
}

const countryNames = new Set(detailCountries.map(country => country.properties.name));
const mercatorLatitudeLimit = 85.0511287798066;
const finite = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

/** Keep accepted pole coordinates finite in Mercator without changing input. */
export function callerMercatorCoordinates([lon, lat]: Coordinate): Coordinate {
  return [lon, Math.max(-mercatorLatitudeLimit, Math.min(mercatorLatitudeLimit, lat))];
}

/**
 * Geographic rows retain GeoMap's existing country/label and lon/lat inputs.
 * A supplied data object never falls back to example values or locations.
 * Country names match the atlas exactly; duplicate fields use the last valid
 * value. Optional status adds explicit pattern states without demo fixtures.
 */
export function adaptChoroplethData(data?: ChartData): ChoroplethCallerData | undefined {
  if (data == null) return undefined;
  const values = new Map<string, number>();
  const statuses = new Map<string, ChoroplethStatus>();
  const markers: ChoroplethCallerMarker[] = [];
  const rows = Array.isArray(data.rows) ? data.rows.filter(row => row && typeof row === "object") : [];
  rows.forEach((row, index) => {
    const name = text(row.country) ?? text(row.label);
    const value = finite(row.value);
    if (name && countryNames.has(name)) {
      if (value !== undefined) values.set(name, value);
      const status = text(row.status)?.trim().toLowerCase();
      if (status === "live" || status === "beta" || status === "not yet") statuses.set(name, status);
    }
    const lon = finite(row.lon), lat = finite(row.lat);
    if (lon === undefined || lat === undefined || Math.abs(lon) > 180 || Math.abs(lat) > 90) return;
    markers.push({ key: `marker:${index}`, name: text(row.label) ?? `Location ${index + 1}`, at: [lon, lat],
      value: Math.max(0, value ?? 1), hasValue: value !== undefined, category: text(row.category) });
  });
  return { values, statuses, markers, maximum: Math.max(1, ...values.values()),
    total: [...values.values()].reduce((sum, value) => sum + value, 0) };
}

/** Quantitative caller colors use the same four relative bands as GeoMap. */
export function callerCountryLevel(data: ChoroplethCallerData, name: string) {
  const value = data.values.get(name) ?? 0;
  return value > 0 ? Math.min(4, Math.ceil(value / data.maximum * 4)) + 1 : 0;
}
