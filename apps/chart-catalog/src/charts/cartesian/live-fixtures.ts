export interface LivePreset {
  name: string;
  period: number;
  window: number;
  range: [number, number];
  initial: number;
  seedRange: [number, number];
  seed: readonly number[];
  digits: number;
  unit: "number" | "usd" | "ms";
}

// Approximate seed histories derived from the visible reference traces. The feed is a local demo.
const defaultHistory = [676, 789, 789, 689, 720, 853, 846, 781, 854, 969, 919, 880, 931, 998, 938, 866, 901, 929, 802, 688, 695, 681, 489, 397, 426, 380, 198, 139, 203, 158, 16, 26, 118, 75, 7, 51, 176, 164, 132, 221, 312, 276, 241, 332, 413, 340, 294, 369, 408, 421, 307];
const momentum = [713, 692, 698, 787, 810, 803, 862, 931, 912, 933, 994, 981, 935, 945, 945, 863, 837, 839, 785, 706, 700, 694, 614, 600, 643, 607, 570, 625, 629, 585, 599, 629, 578, 541, 555, 502, 430, 402, 381, 276, 220, 204, 166, 77, 67, 79, 17, 0, 29, 58, 51];
const paused = [445, 512, 426, 407, 506, 525, 421, 408, 483, 461, 323, 284, 315, 262, 115, 96, 147, 104, 0, 17, 109, 86, 25, 136, 272, 253, 264, 409, 558, 542, 581, 765, 820, 802, 811, 942, 965, 908, 876, 973, 985, 869, 867, 951, 948, 938];
const latency = [779, 923, 910, 908, 986, 915, 895, 890, 753, 733, 705, 571, 538, 512, 423, 448, 467, 394, 455, 471, 415, 480, 420, 360, 410, 281, 225, 231, 79, 93, 90, 12, 90, 101, 107, 192, 255, 276, 399, 416, 436, 496, 493, 449, 515, 448, 445, 505, 442, 458, 506];

const price: LivePreset = {
  name: "Price", period: 600, window: 30_000, range: [138, 147], initial: 141.45,
  seedRange: [139, 145.58], seed: defaultHistory, digits: 2, unit: "usd",
};

const presets: Partial<Record<string, LivePreset>> = {
  "live-line-momentum": { name: "Index", period: 600, window: 30_000, range: [4800, 4845],
    initial: 4807.61, seedRange: [4806, 4839], seed: momentum, digits: 2, unit: "number" },
  "live-line-paused": { name: "Viewers", period: 1000, window: 60_000, range: [1050, 1400],
    initial: 1278, seedRange: [1144, 1288], seed: paused, digits: 0, unit: "number" },
  "live-line-right-axis": { name: "p95 latency", period: 800, window: 40_000, range: [110, 170],
    initial: 137, seedRange: [115, 163], seed: latency, digits: 0, unit: "ms" },
  "live-line-loading": { ...price, range: [82, 89.3], seedRange: [84, 88.6], initial: 85.69 },
};

export function livePreset(id: string) {
  return presets[id] ?? price;
}

export function liveValue(index: number, preset: LivePreset) {
  const [minimum, maximum] = preset.seedRange;
  const scale = 10 ** preset.digits;
  const lastSeed = preset.seed.length - 1;
  const seeded = index < lastSeed;
  const position = (index - lastSeed) * .19;
  const variation = .28 * Math.sin(position) + .11 * Math.sin(position * 2.27) + .05 * Math.sin(position * 4.1);
  const value = seeded ? minimum + (maximum - minimum) * preset.seed[Math.max(0, index)] / 1000
    : preset.initial + (maximum - minimum) * variation;
  return Math.round(value * scale) / scale;
}
