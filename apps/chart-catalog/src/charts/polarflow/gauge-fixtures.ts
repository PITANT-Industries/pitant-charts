export interface GaugeZone {
  from: number;
  to: number;
  color: string;
}

interface Ruler {
  position: "inside" | "outside";
  ticks: number;
  majorEvery: number;
  radius: number;
  labels?: readonly string[];
  static?: boolean;
}

interface Dots {
  counts: readonly number[];
  outer: number;
  gap: number;
  size: number;
  color?: string;
}

export interface DialOptions {
  name: string;
  value: number;
  subtitle?: string;
  mode?: "notches" | "solid" | "none";
  needle?: "line" | "gradient" | "triangle" | "polygon";
  tip?: "inner" | "outer" | "edge";
  needleEnd?: number;
  needleBase?: number;
  needleWidth?: number;
  ruler?: Ruler;
  zones?: readonly GaugeZone[];
  zoneDisplay?: "band" | "fill" | "both";
  sector?: "conic" | "radial" | "pattern";
  sectorRadius?: number;
  dots?: Dots;
  ring?: number;
  glow?: number;
  disc?: number;
  count?: number;
  radius?: number;
  depth?: number;
  rounded?: number;
  sweep?: number;
  trackOpacity?: number;
  gap?: number;
  gradient?: boolean;
  paint?: number | "foreground";
  reading?: "currency" | "revenue" | "integer" | "rpm" | "speed" | "tonnage";
}

const inside = { position: "inside", ticks: 50, majorEvery: 5, radius: .3444 } as const;
const ends = { position: "outside", ticks: 20, majorEvery: 5, radius: .3588, labels: ["0", "100"] } as const;
const danger = "var(--destructive, var(--chart-negative))";
const storageZones = [
  { from: 0, to: 60, color: "var(--chart-2)" },
  { from: 60, to: 85, color: "var(--chart-4)" },
  { from: 85, to: 100, color: danger },
] as const;
const dialTrack = { ruler: inside, count: 72, depth: .0476, rounded: 2, sweep: 244, gap: .52, trackOpacity: .7,
  needleEnd: .3584, needleBase: .16128 } as const;
const needleTips = { ruler: { ...ends, labels: undefined, radius: .42 }, mode: "solid", needle: "triangle", depth: .035, radius: .392, value: 62 } as const;

export const dialFixtures: Record<string, readonly DialOptions[]> = {
  "gauge-default": [{ name: "ARR run rate", value: 66, reading: "currency", trackOpacity: .4 }],
  "gauge-semicircle": [{ sweep: 180, gradient: true, rounded: 2, name: "CPU load", value: 64 }],
  "gauge-fixed": [{ name: "CPU", value: 38 }, { name: "Memory", value: 71 }, { name: "Disk", value: 54 }],
  "gauge-interactive": [{ name: "Attainment", value: 67, reading: "revenue" }],
  "gauge-dial": [{ ...dialTrack, needle: "line", name: "Load", value: 38 }],
  "gauge-arc-styles": [
    { name: "Notches", subtitle: "Notches", value: 64, trackOpacity: .4 },
    { mode: "solid", depth: .05, name: "Solid", subtitle: "Solid stroke", value: 64 },
    { mode: "none", ring: .01, name: "Ring", subtitle: "No track, progress ring", value: 64 },
  ],
  "gauge-ruler": [
    { ...dialTrack, name: "Inside", subtitle: "Inside ruler", value: 53 },
    { mode: "solid", depth: .035, radius: .392, ruler: ends, name: "Outside", subtitle: "Outside, labelled at the ends", value: 53 },
    { mode: "solid", depth: .02, radius: .392, ruler: { ...ends, ticks: 16, majorEvery: 4, labels: ["0k", "2k", "4k", "6k", "8k"] },
      name: "rpm × 1000", subtitle: "Labelled in rpm", value: 52.5, reading: "rpm" },
  ],
  "gauge-needles": [
    { ...dialTrack, needle: "line", name: "Line", subtitle: "Line", value: 62 },
    { ...dialTrack, needle: "gradient", name: "Gradient", subtitle: "Gradient", value: 62 },
    { ...dialTrack, needle: "triangle", needleWidth: 5, name: "Triangle", subtitle: "Triangle", value: 62 },
    { ...dialTrack, needle: "polygon", name: "Polygon", subtitle: "Polygon", value: 62 },
  ],
  "gauge-needle-tips": [
    { ...needleTips, tip: "inner", needleEnd: .343, needleBase: .2401, name: "Inner", subtitle: "Inner" },
    { ...needleTips, tip: "outer", needleEnd: .392, needleBase: .2744, name: "Outer", subtitle: "Outer" },
    { ...needleTips, tip: "edge", needleEnd: .47, needleBase: .329, name: "Edge", subtitle: "Edge" },
  ],
  "gauge-zones": [
    { mode: "solid", depth: .035, radius: .436, zoneDisplay: "band", zones: storageZones, name: "store-1", subtitle: "Band", value: 78 },
    { count: 60, trackOpacity: .3, zoneDisplay: "fill", zones: storageZones, name: "store-2", subtitle: "Fill", value: 92 },
    { mode: "solid", depth: .035, radius: .436, zoneDisplay: "both", zones: storageZones, name: "store-3", subtitle: "Both", value: 92 },
  ],
  "gauge-sectors": [
    { mode: "none", sector: "conic", sectorRadius: .438, ring: .01, name: "Conic", subtitle: "Conic", value: 68 },
    { mode: "solid", sector: "radial", sectorRadius: .42, depth: .02, name: "Radial", subtitle: "Radial", value: 68 },
    { mode: "none", sector: "pattern", sectorRadius: .438, ring: .01, name: "Pattern", subtitle: "Pattern", value: 68 },
  ],
  "gauge-progress-ring": [
    { ring: .01, radius: .438, depth: .146, trackOpacity: .35, name: "Completed", subtitle: "Notches and ring", value: 71 },
    { mode: "none", ring: .022, paint: 2, name: "Completed", subtitle: "Ring only", value: 71 },
  ],
  "gauge-dots": [
    { mode: "solid", dots: { counts: [57, 52, 47, 43, 38], outer: .355, gap: .03, size: 1.6 },
      name: "Health", subtitle: "Behind a solid arc", value: 83, reading: "integer" },
    { mode: "none", ring: .01, dots: { counts: [61, 56, 52, 47, 42, 38, 33], outer: .408, gap: .032, size: 2.2 },
      name: "Health", subtitle: "Seven rings and a progress ring", value: 83, reading: "integer" },
  ],
  "gauge-glow": [
    { glow: 6, count: 60, depth: .077, rounded: 1, gap: .48, trackOpacity: .25, name: "Output", subtitle: "Lit notches", value: 74 },
    { glow: 10, mode: "solid", paint: 1, trackOpacity: .5, name: "Output", subtitle: "Solid arc", value: 74 },
  ],
  "gauge-center-disc": [
    { disc: .19, mode: "none", sector: "conic", sectorRadius: .42, name: "Hired", subtitle: "Disc and sector", value: 68 },
    { disc: .22, mode: "solid", needle: "line", needleEnd: .42, needleBase: .231, name: "Hired", subtitle: "Disc and needle", value: 68 },
  ],
  "gauge-fan-duty": [
    { mode: "solid", radius: .358, zoneDisplay: "band", zones: [{ from: 80, to: 100, color: danger }],
      ruler: ends, needle: "line", needleEnd: .309, needleBase: .25565, needleWidth: 5, tip: "inner",
      paint: "foreground", name: "Duty %", value: 72, reading: "integer" },
  ],
  "gauge-speedometer": [
    { count: 90, depth: .07187, radius: .392, glow: 6, rounded: 1, gap: .48, trackOpacity: .25,
      dots: { counts: [47, 42, 37, 32, 28, 23], outer: .29013, gap: .03, size: 1.6, color: danger },
      ruler: { position: "outside", ticks: 26, majorEvery: 2, radius: .42, static: true },
      zoneDisplay: "fill", zones: [{ from: 200 / 260 * 100, to: 100, color: danger }], name: "km/h", value: 228 / 2.6, reading: "speed" },
  ],
  "gauge-throughput": [
    { mode: "none", sector: "conic", sectorRadius: .438, ring: .01,
      ruler: { position: "inside", ticks: 16, majorEvery: 2, radius: .41, labels: ["0", "100", "200", "300", "400", "500", "600", "700", "800"] },
      needle: "triangle", needleEnd: .438, needleBase: .16644, disc: .19, name: "t / day", value: 518 / 8, reading: "tonnage" },
  ],
  "gauge-live-load": [
    { zoneDisplay: "both", zones: [{ ...storageZones[0], color: "var(--chart-1)" }, { ...storageZones[1], color: "var(--chart-2)" }, storageZones[2]],
      mode: "solid", radius: .436, depth: .05, needle: "gradient", needleEnd: .436, needleBase: .218, trackOpacity: .5, name: "CPU", value: 42 },
  ],
};

export const gaugeMetrics: Record<string, readonly [string, string][]> = {
  "gauge-fan-duty": [["Speed", "3,240 rpm"], ["Inlet", "41 °C"], ["Limit", "80%"]],
  "gauge-speedometer": [["Average", "184 km/h"], ["Top", "241 km/h"], ["Gear", "6"]],
  "gauge-throughput": [["Target", "600 t"], ["Yesterday", "487 t"], ["Change", "+6.4%"]],
};

export const gaugeNotes: Record<string, readonly [string, string?]> = {
  "gauge-default": ["66% of the $650K target", "Annualised from November 2026 billing"],
  "gauge-semicircle": ["Within the 80% autoscale threshold", "Average across 12 nodes in eu-west-1"],
  "gauge-linear": ["42% of the 10K launch goal", "November 2 to November 8, 2026"],
  "gauge-linear-gradient": ["1.44 TB of 2 TB used (72%)", "Uploads pause at 100%. Archive old projects to free space."],
  "gauge-fixed": ["Memory is the busiest resource", "Five-minute averages, November 8, 2026"],
  "gauge-arc-styles": ["64 of 100 points closed", "Two days left in the sprint"],
  "gauge-ruler": ["Ticks light up as the fill passes them", "Map a reading onto 0 to 100 and label the ruler in its units"],
  "gauge-needles": ["62% of the quota used", "Resets on December 1, 2026"],
  "gauge-needle-tips": ["Average charge 62% across 48 robots", "The tip stops inside the track, at its edge, or past the scale"],
  "gauge-zones": ["Two nodes are past the 85% line", "Later zones win where ranges overlap"],
  "gauge-sectors": ["68% of slots filled on average", "With a centre disc, a sector starts at its edge"],
  "gauge-progress-ring": ["71% of new workspaces finished setup", "Week of November 2, 2026"],
  "gauge-dots": ["Health score 83 of 100", "Three incidents, 18 minutes to recover on average"],
  "gauge-glow": ["74% of the 120 kW rating", "Reads best on a dark surface"],
  "gauge-center-disc": ["34 of 50 roles filled", "The disc sits above the sector and the needle"],
  "gauge-fan-duty": ["Running below the 80% limit"],
  "gauge-speedometer": ["Past the 200 km/h red line"],
  "gauge-throughput": ["86% of the 600 t target so far"],
  "gauge-live-load": ["A new sample every 1.8 seconds"],
};
