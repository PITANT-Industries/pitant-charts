export interface GaugeZone {
  from: number;
  to: number;
  color: string;
}

interface Ruler {
  position: "inside" | "outside";
  ticks: number;
  majorEvery: number;
  labels?: readonly string[];
}

export interface DialOptions {
  name: string;
  value: number;
  subtitle?: string;
  mode?: "notches" | "solid" | "none";
  needle?: "line" | "gradient" | "triangle" | "polygon";
  tip?: "inner" | "outer" | "edge";
  ruler?: Ruler;
  zones?: readonly GaugeZone[];
  zoneDisplay?: "band" | "fill" | "both";
  sector?: "conic" | "radial" | "pattern";
  dots?: readonly number[];
  dotPaint?: string;
  ring?: number;
  glow?: boolean;
  disc?: boolean;
  count?: number;
  radius?: number;
  depth?: number;
  rounded?: number;
  sweep?: number;
  gradient?: boolean;
  paint?: number | "foreground";
  readout?: (value: number) => string;
}

const inside = { position: "inside", ticks: 50, majorEvery: 5 } as const;
const ends = { position: "outside", ticks: 20, majorEvery: 5, labels: ["0", "100"] } as const;
const storageZones = [
  { from: 0, to: 60, color: "var(--chart-2)" },
  { from: 60, to: 85, color: "var(--chart-4)" },
  { from: 85, to: 100, color: "var(--destructive, var(--chart-negative))" },
] as const;
const dialTrack = { ruler: inside, count: 72, depth: 10, rounded: 1.2, sweep: 244, radius: 97 } as const;
const needleTips = { ruler: { ...ends, labels: undefined }, mode: "solid", needle: "triangle", depth: 8, radius: 86, value: 62 } as const;

export const dialFixtures: Record<string, readonly DialOptions[]> = {
  "gauge-default": [{ name: "ARR run rate", value: 66, readout: value => `$${(Math.round(428_000 * value / 66)).toLocaleString("en-US")}` }],
  "gauge-semicircle": [{ sweep: 180, gradient: true, rounded: 1.5, name: "CPU load", value: 64 }],
  "gauge-fixed": [{ name: "CPU", value: 38 }, { name: "Memory", value: 71 }, { name: "Disk", value: 54 }],
  "gauge-interactive": [{ name: "Attainment", value: 67 }],
  "gauge-dial": [{ ...dialTrack, needle: "line", name: "Load", value: 38 }],
  "gauge-arc-styles": [
    { name: "Notches", subtitle: "Notched track", value: 64 },
    { mode: "solid", name: "Solid", subtitle: "Solid stroke", value: 64 },
    { mode: "none", ring: 3, name: "Ring", subtitle: "Progress ring", value: 64 },
  ],
  "gauge-ruler": [
    { ...dialTrack, name: "Inside", subtitle: "Inside ruler", value: 53 },
    { mode: "solid", depth: 8, radius: 71, ruler: ends, name: "Outside", subtitle: "Labels at the ends", value: 53 },
    { mode: "solid", depth: 4.5, radius: 72, ruler: { position: "outside", ticks: 16, majorEvery: 4, labels: ["0k", "2k", "4k", "6k", "8k"] },
      name: "rpm × 1000", subtitle: "RPM scale", value: 53, readout: value => (value * .08).toFixed(1) },
  ],
  "gauge-needles": [
    { ...dialTrack, needle: "line", name: "Line", value: 62 },
    { ...dialTrack, needle: "gradient", name: "Gradient", value: 62 },
    { ...dialTrack, needle: "triangle", name: "Triangle", value: 62 },
    { ...dialTrack, needle: "polygon", name: "Polygon", value: 62 },
  ],
  "gauge-needle-tips": [
    { ...needleTips, tip: "inner", name: "Inner" },
    { ...needleTips, tip: "outer", name: "Outer" },
    { ...needleTips, tip: "edge", name: "Edge" },
  ],
  "gauge-zones": [
    { mode: "solid", depth: 8, zoneDisplay: "band", zones: storageZones, name: "store-1", subtitle: "Band", value: 78 },
    { count: 60, zoneDisplay: "fill", zones: storageZones, name: "store-2", subtitle: "Fill", value: 92 },
    { mode: "solid", depth: 8, zoneDisplay: "both", zones: storageZones, name: "store-3", subtitle: "Both", value: 92 },
  ],
  "gauge-sectors": [
    { mode: "none", sector: "conic", ring: 2.3, name: "Conic", value: 68 },
    { mode: "solid", sector: "radial", depth: 4.6, name: "Radial", value: 68 },
    { mode: "none", sector: "pattern", ring: 2.3, name: "Pattern", value: 68 },
  ],
  "gauge-progress-ring": [
    { ring: 2.3, name: "Completed", subtitle: "Notches and ring", value: 71 },
    { mode: "none", ring: 5, paint: 2, name: "Completed", subtitle: "Ring only", value: 71 },
  ],
  "gauge-dots": [
    { mode: "solid", dots: [38, 43, 47, 52, 57], name: "Health", subtitle: "Behind a solid arc", value: 83, readout: value => String(Math.round(value)) },
    { mode: "none", ring: 2.3, dots: [33, 38, 42, 47, 52, 56, 61], name: "Health", subtitle: "Seven rings and a progress ring", value: 83, readout: value => String(Math.round(value)) },
  ],
  "gauge-glow": [
    { glow: true, count: 60, depth: 17, rounded: .75, name: "Output", subtitle: "Lit notches", value: 74 },
    { glow: true, mode: "solid", paint: 1, name: "Output", subtitle: "Solid arc", value: 74 },
  ],
  "gauge-center-disc": [
    { disc: true, mode: "none", sector: "conic", name: "Hired", subtitle: "Disc and sector", value: 68 },
    { disc: true, mode: "solid", needle: "line", name: "Hired", subtitle: "Disc and needle", value: 68 },
  ],
  "gauge-fan-duty": [
    { mode: "solid", depth: 8, radius: 64, zoneDisplay: "band", zones: [{ from: 80, to: 100, color: "var(--destructive, var(--chart-negative))" }],
      ruler: ends, needle: "line", tip: "inner", paint: "foreground", name: "Duty %", value: 72, readout: value => String(Math.round(value)) },
  ],
  "gauge-speedometer": [
    { count: 90, depth: 16, radius: 89, glow: true, rounded: 1, dots: [23, 28, 32, 37, 42, 47], dotPaint: "var(--destructive, var(--chart-negative))", ruler: { position: "outside", ticks: 26, majorEvery: 2 },
      zoneDisplay: "fill", zones: [{ from: 200 / 260 * 100, to: 100, color: "var(--destructive, var(--chart-negative))" }], name: "km/h",
      value: 228 / 2.6, readout: value => numberFromScale(value, 260) },
  ],
  "gauge-throughput": [
    { mode: "none", sector: "conic", ring: 2.3, ruler: { position: "inside", ticks: 16, majorEvery: 2, labels: ["0", "100", "200", "300", "400", "500", "600", "700", "800"] },
      needle: "triangle", disc: true, name: "t / day", value: 518 / 8, readout: value => numberFromScale(value, 800) },
  ],
  "gauge-live-load": [
    { zoneDisplay: "both", zones: [{ ...storageZones[0], color: "var(--chart-1)" }, { ...storageZones[1], color: "var(--chart-2)" }, storageZones[2]],
      mode: "solid", radius: 94, needle: "gradient", name: "CPU", value: 42 },
  ],
};

function numberFromScale(value: number, maximum: number) {
  return String(Math.round(value * maximum / 100));
}

export const gaugeMetrics: Record<string, readonly [string, string][]> = {
  "gauge-fan-duty": [["Speed", "3,240 rpm"], ["Inlet", "41 °C"], ["Limit", "80%"]],
  "gauge-speedometer": [["Average", "184 km/h"], ["Top", "241 km/h"], ["Gear", "6"]],
  "gauge-throughput": [["Target", "600 t"], ["Yesterday", "487 t"], ["Change", "+6.4%"]],
};
