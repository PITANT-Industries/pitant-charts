/**
 * Wheel/pinch steps and zoom-around-point math adapted from Bklit UI (MIT),
 * commit a02b9496b0ea4b665bd12f234d75ec2aa87baa5a:
 * https://github.com/bklit/bklit-ui/blob/a02b9496b0ea4b665bd12f234d75ec2aa87baa5a/packages/ui/src/charts/choropleth/choropleth-zoom-matrix.ts
 * Copyright (c) 2026 uixmat. See licenses/Bklit-UI-MIT.md.
 * The gallery renderer clamps manual zoom and uses a separate focus camera.
 */
import type { Coordinate } from "./geo-fixtures";

export type ManualMapView = { x: number; y: number; scale: number };
export type MapFragmentBounds = readonly [Coordinate, Coordinate];
export const manualMapRest: ManualMapView = { x: 0, y: 0, scale: 1 };

/** The gallery's 5% wheel step is independent of delta magnitude and mode. */
export function choroplethWheelDelta(event: { deltaY: number }) {
  return event.deltaY > 0 ? .95 : 1.05;
}

/** visx's default pinch step compares the offset with the gesture's start. */
export function defaultPinchDelta(offset: number, lastOffset: number) {
  return offset - lastOffset < 0 ? .9 : 1.1;
}

export function scaleManualMap(view: ManualMapView, point: Coordinate, ratio: number): ManualMapView {
  const scale = Math.max(.5, Math.min(4, view.scale * ratio));
  const factor = scale / view.scale;
  return { scale, x: point[0] - (point[0] - view.x) * factor, y: point[1] - (point[1] - view.y) * factor };
}

/** Mercator geoPath emits linear subpaths, split at islands and the dateline. */
export function mapFragmentBounds(path: string): MapFragmentBounds[] {
  return path.split("M").slice(1).map(fragment => {
    const numbers = fragment.match(/-?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < numbers.length; i += 2) {
      left = Math.min(left, numbers[i]); right = Math.max(right, numbers[i]);
      top = Math.min(top, numbers[i + 1]); bottom = Math.max(bottom, numbers[i + 1]);
    }
    return [[left, top], [right, bottom]];
  });
}

export function mapCountryIsVisible(bounds: readonly MapFragmentBounds[], view: ManualMapView, width: number, height: number) {
  return bounds.some(([[left, top], [right, bottom]]) =>
    Math.min(width, right * view.scale + view.x) - Math.max(0, left * view.scale + view.x) >= 2
    && Math.min(height, bottom * view.scale + view.y) - Math.max(0, top * view.scale + view.y) >= 2);
}
