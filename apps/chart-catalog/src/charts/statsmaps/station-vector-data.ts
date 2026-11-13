import type { ChartData } from "../../types";
import { number, rows, string } from "./primitives";
import type { WindSample } from "./geo-detail-fixtures";

/** Cartesian station coordinates are kilometres; speed is km/h. */
export function stationVectors(data: ChartData): WindSample[] {
  const samples = rows(data).flatMap((row, index) => {
    const x = number(row.x), y = number(row.y);
    const speed = number(row.speedKmh) ?? number(row.speed);
    const bearing = number(row.direction) ?? number(row.bearing);
    if (x === undefined || y === undefined || speed === undefined || bearing === undefined) return [];
    return [{ x, y, speed: Math.max(0, speed), bearing: ((bearing % 360) + 360) % 360,
      label: string(row.label) ?? string(row.name) ?? `Station ${index + 1}` }];
  });
  const max = Math.max(1, ...samples.map(sample => sample.speed));
  return samples.map(({ x, y, label, speed, bearing }) => {
    const angle = (bearing - 90) * Math.PI / 180;
    const length = Math.sqrt(speed / max) * 30;
    const head = Math.min(5, length / 3);
    return [x, y, label, speed, bearing, 1,
      Math.cos(angle) * length, Math.sin(angle) * length,
      Math.cos(angle + Math.PI + Math.PI / 6) * head, Math.sin(angle + Math.PI + Math.PI / 6) * head,
      Math.cos(angle + Math.PI - Math.PI / 6) * head, Math.sin(angle + Math.PI - Math.PI / 6) * head];
  });
}

/** Retain the existing lon/lat + m/s geographic input route. */
export function hasCartesianStations(data: ChartData) {
  return !rows(data).some(row => number(row.lon) !== undefined && number(row.lat) !== undefined)
    || rows(data).some(row => number(row.x) !== undefined && number(row.y) !== undefined);
}
