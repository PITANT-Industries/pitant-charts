import { geoBounds, geoContains, geoMercator, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries from "world-atlas/countries-110m.json";
import { paymentBeta, paymentLive, signupBuckets, visitorBuckets } from "./choropleth-fixtures";

type Country = Feature<Polygon | MultiPolygon, { name: string }>;
type World = Topology<{ countries: GeometryCollection<{ name: string }> }>;
const atlas = countries as unknown as World;
const source = feature(atlas, atlas.objects.countries);

function quantizedRing(ring: Position[]) {
  return ring.map(position => position.map(coordinate => Math.round(coordinate * 100) / 100))
    .filter((position, index, points) => index === 0 || position.some((value, axis) => value !== points[index - 1][axis]));
}

function quantizedPolygon(polygon: Position[][]) {
  return polygon.map(quantizedRing).filter(ring => ring.length >= 4);
}

export const detailCountries = (source.features as Country[]).map(country => {
  const { geometry } = country;
  const precise: Country = {
    ...country,
    geometry: geometry.type === "Polygon"
      ? { type: "Polygon", coordinates: quantizedPolygon(geometry.coordinates) }
      : { type: "MultiPolygon", coordinates: geometry.coordinates.map(quantizedPolygon).filter(polygon => polygon.length) },
  };
  return precise;
});

export const officeLocations: readonly [name: string, lon: number, lat: number][] = [
  ["London", -.13, 51.51], ["New York", -74.01, 40.71], ["Tokyo", 139.69, 35.69], ["São Paulo", -46.63, -23.55], ["Sydney", 151.21, -33.87],
];

const visitors = [
  ["United States of America", 18], ["Mexico", 5], ["Canada", 8], ["Argentina", 3], ["Brazil", 7],
  ["France", 9], ["Spain", 3], ["United Kingdom", 12], ["Netherlands", 5], ["Germany", 17], ["Italy", 6],
  ["Sweden", 3], ["Poland", 4], ["South Africa", 4], ["India", 11], ["Indonesia", 2], ["Australia", 6], ["Japan", 4],
] as const;
export const officeVisitorCounts = new Map<string, number>(visitors);
const officeSteps = [
  ["Indonesia", "Argentina", "South Africa", "Sweden", "Poland", "Spain", "Japan"],
  ["Canada", "Mexico", "Brazil", "France", "Netherlands", "Australia", "Italy"],
  ["India", "United Kingdom"], ["United States of America", "Germany"],
];
const officeBuckets = new Map(officeSteps.flatMap((names, index) => names.map(name => [name, index + 2] as const)));

export const mapCaptions = {
  "choropleth-default": ["Scroll or pinch to zoom, drag to pan", "Hover or tab to a country to name it"],
  "choropleth-values": ["719,910 visitors from 42 countries", "Darker countries sent more visitors; grey ones sent none"],
  "choropleth-graticule": ["Mercator projection, centred on 20° N", "The lines sit behind the countries and show through when hover fades them"],
  "choropleth-patterns": ["Live in 18 countries, in beta in 10 more", "Solid: live. Striped: beta. Grey: not available yet"],
  "choropleth-click-to-zoom": ["Click a country or an office to zoom in", "Click it again, the sea, or press Escape to fly back"],
  "choropleth-markers": ["Five sites, one shape each", "Hover a marker for its coordinates; the live region pulses"],
  "choropleth-background": ["Zoom and drag the map; the backdrop stays put", "Countries without sign-ups keep the neutral tone"],
  "choropleth-pointer-camera": ["Move across the map to swing it from west to east", "Click a pin or a country to fly to it; the dots behind stay still"],
  "choropleth-dot-grid": ["One lattice, never cut at a coastline", "Click a country: the ocean fades and the dots swell as the camera flies in"],
} as const;

export type ChoroplethVariant = keyof typeof mapCaptions;
export const countryStatus = (name: string) => paymentLive.has(name) ? "live" : paymentBeta.has(name) ? "beta" : "not yet";

export function countryLevel(variant: ChoroplethVariant, name: string, index: number) {
  switch (variant) {
    case "choropleth-values": return (visitorBuckets.get(name) ?? -1) + 1;
    case "choropleth-background": return (signupBuckets.get(name) ?? 0) + 1;
    case "choropleth-click-to-zoom":
    case "choropleth-dot-grid": return officeBuckets.get(name) ?? 1;
    case "choropleth-graticule": return index % 5 + 1;
    case "choropleth-patterns": return paymentLive.has(name) ? 4 : 0;
    case "choropleth-markers":
    case "choropleth-pointer-camera": return 2;
    default: return 3;
  }
}

export const mapScale = (level: number) => level ? `var(--choropleth-scale-${level})` : "var(--muted)";
export const detailProjection = (width: number, height: number) =>
  geoMercator().center([0, 20]).scale(width / 6.3).translate([width / 2, height / 2 + 50]);

const countryBounds = detailCountries.map(country => ({ country, bounds: geoBounds(country) }));

export function dotLattice(width: number, height: number, projection: GeoProjection) {
  const step = 7;
  const advance = 6.062;
  const land = new Map<string, string[]>();
  const ocean: string[] = [];
  const pretty = (value: number) => Math.round(value * 100) / 100;
  for (let row = 0, y = step / 2; y < height; row++, y += advance) {
    for (let x = row % 2 === 0 ? step / 2 : step; x < width; x += step) {
      const point = projection.invert?.([x, y]);
      const region = point && countryBounds.find(({ country, bounds: [[west, south], [east, north]] }) =>
        point[1] >= south && point[1] <= north && (west <= east ? point[0] >= west && point[0] <= east : point[0] >= west || point[0] <= east)
        && geoContains(country, point));
      const segment = `M${x} ${pretty(y)}h0`;
      if (region) {
        const name = region.country.properties.name;
        if (!land.has(name)) land.set(name, []);
        land.get(name)!.push(segment);
      } else ocean.push(segment);
    }
  }
  return { ocean: ocean.join(""), land: [...land].map(([name, segments]) => ({ name, path: segments.join("") })) };
}
