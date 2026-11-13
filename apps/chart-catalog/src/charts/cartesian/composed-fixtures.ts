// Demo values from the rendered reference. Price highs and lows were read from the measured wicks.
import type { CartesianData } from "./data";

const fixtures: Record<string, CartesianData> = {
  "default": {
    categories: ["Oct 1", "Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6", "Oct 7", "Oct 8", "Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30"],
    series: [
      { name: "Revenue", values: [106, 107, 109, 110, 110, 110, 109, 108, 107, 105, 104, 102, 101, 100, 99, 99, 99, 99, 100, 102, 104, 106, 109, 112, 115, 118, 121, 124, 126, 128] },
      { name: "Units", values: [51, 54, 57, 60, 62, 64, 64, 65, 64, 63, 61, 59, 57, 55, 52, 50, 48, 46, 45, 45, 45, 45, 46, 48, 51, 53, 56, 59, 63, 66] },
      { name: "Run rate", values: [96, 95, 94, 93, 91, 90, 88, 86, 84, 83, 82, 81, 80, 80, 80, 81, 82, 83, 85, 87, 88, 90, 92, 94, 95, 96, 97, 98, 98, 97] },
    ],
  },
  "target": {
    categories: ["Aug 3", "Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12", "Oct 19"],
    series: [
      { name: "Revenue", values: [118, 126, 121, 134, 129, 142, 151, 138, 156, 163, 158, 172] },
      { name: "Target", values: [120, 124, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164] },
      { name: "Trend", values: [118, 122, 122, 125, 128, 132, 139, 140, 147, 152, 154, 162] },
    ],
  },
  "grouped": {
    categories: ["Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12", "Oct 19"],
    series: [
      { name: "Signups", values: [1840, 1920, 2010, 1975, 2140, 2260, 2195, 2380, 2450, 2520] },
      { name: "Activations", values: [1610, 1690, 1720, 1750, 1810, 1880, 1860, 1930, 1990, 2040] },
      { name: "Goal", values: [1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050] },
    ],
  },
  "stacked": {
    categories: ["Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25"],
    series: [
      { name: "Organic", values: [412, 398, 455, 470, 438, 312, 296, 461, 488, 502, 476, 517, 349, 331] },
      { name: "Paid", values: [186, 172, 210, 224, 198, 121, 109, 232, 246, 259, 238, 271, 140, 128] },
    ],
  },
  "band": {
    categories: ["Oct 1", "Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6", "Oct 7", "Oct 8", "Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30"],
    series: [
    ],
    rows: [
      { low: 101, high: 112 },
      { low: 101, high: 114 },
      { low: 102, high: 117 },
      { low: 103, high: 119 },
      { low: 102, high: 120 },
      { low: 105, high: 117 },
      { low: 103, high: 116 },
      { low: 102, high: 116 },
      { low: 100, high: 116 },
      { low: 97, high: 114 },
      { low: 99, high: 110 },
      { low: 96, high: 109 },
      { low: 95, high: 109 },
      { low: 93, high: 108 },
      { low: 92, high: 108 },
      { low: 94, high: 105 },
      { low: 94, high: 106 },
      { low: 93, high: 106 },
      { low: 93, high: 108 },
      { low: 95, high: 111 },
      { low: 99, high: 110 },
      { low: 100, high: 113 },
      { low: 102, high: 117 },
      { low: 105, high: 121 },
      { low: 107, high: 125 },
      { low: 112, high: 125 },
      { low: 114, high: 129 },
      { low: 117, high: 133 },
      { low: 118, high: 136 },
      { low: 119, high: 140 },
    ],
  },
  "price-volume": {
    categories: ["Oct 1", "Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6", "Oct 7", "Oct 8", "Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30"],
    series: [
      { name: "Close", values: [183.1, 190.15, 189.72, 185.27, 189.33, 195.22, 192.12, 189.51, 195.76, 199.24, 194.57, 194.78, 201.88, 202.33, 197.6, 200.85, 207.23, 204.82, 201.55, 207.29, 211.56, 207.2, 206.53, 213.54, 214.88, 210, 212.4, 219.14, 217.49, 213.66] },
      { name: "Volume (M)", values: [42, 53, 62, 68, 72, 57, 54, 50, 57, 67, 59, 63, 64, 62, 58, 46, 56, 64, 69, 71, 54, 50, 51, 61, 69, 60, 62, 61, 58, 55] },
      { name: "5-day average", values: [183.1, 186.62, 187.66, 187.06, 187.51, 189.94, 190.33, 190.29, 192.39, 194.37, 194.24, 194.77, 197.25, 198.56, 198.23, 199.49, 201.98, 202.57, 202.41, 204.35, 206.49, 206.48, 206.83, 209.22, 210.74, 210.43, 211.47, 213.99, 214.78, 214.54] },
    ],
    rows: [
      { open: 182, high: 185.1, low: 180, close: 183.1 },
      { open: 183.1, high: 192.95, low: 180.4, close: 190.15 },
      { open: 190.15, high: 193.75, low: 186.32, close: 189.72 },
      { open: 189.72, high: 191.72, low: 181.17, close: 185.27 },
      { open: 185.27, high: 192.13, low: 183.27, close: 189.33 },
      { open: 189.33, high: 198.82, low: 186.63, close: 195.22 },
      { open: 195.22, high: 197.22, low: 188.72, close: 192.12 },
      { open: 192.12, high: 194.92, low: 185.41, close: 189.51 },
      { open: 189.51, high: 199.36, low: 187.51, close: 195.76 },
      { open: 195.76, high: 201.24, low: 193.06, close: 199.24 },
      { open: 199.24, high: 202.04, low: 191.17, close: 194.57 },
      { open: 194.57, high: 198.38, low: 190.47, close: 194.78 },
      { open: 194.78, high: 203.88, low: 192.78, close: 201.88 },
      { open: 201.88, high: 205.13, low: 199.18, close: 202.33 },
      { open: 202.33, high: 205.93, low: 194.2, close: 197.6 },
      { open: 197.6, high: 202.85, low: 193.5, close: 200.85 },
      { open: 200.85, high: 210.03, low: 198.85, close: 207.23 },
      { open: 207.23, high: 210.83, low: 202.12, close: 204.82 },
      { open: 204.82, high: 206.82, low: 198.15, close: 201.55 },
      { open: 201.55, high: 210.09, low: 197.45, close: 207.29 },
      { open: 207.29, high: 215.16, low: 205.29, close: 211.56 },
      { open: 211.56, high: 213.56, low: 204.5, close: 207.2 },
      { open: 207.2, high: 210, low: 203.13, close: 206.53 },
      { open: 206.53, high: 217.14, low: 202.43, close: 213.54 },
      { open: 213.54, high: 216.88, low: 211.54, close: 214.88 },
      { open: 214.88, high: 217.68, low: 207.3, close: 210 },
      { open: 210, high: 216, low: 206.6, close: 212.4 },
      { open: 212.4, high: 221.14, low: 208.3, close: 219.14 },
      { open: 219.14, high: 221.94, low: 215.49, close: 217.49 },
      { open: 217.49, high: 221.09, low: 210.96, close: 213.66 },
    ],
  },
  "signal": {
    categories: ["Oct 1", "Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6", "Oct 7", "Oct 8", "Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30"],
    series: [
      { name: "Signups", values: [109, 128, 124, 143, 139, 134, 151, 144, 160, 153, 144, 158, 149, 162, 152, 142, 156, 146, 160, 151, 143, 159, 153, 147, 164, 160, 178, 174, 171, 190] },
      { name: "7-day average", values: [109, 118.5, 120.3, 126, 128.6, 129.5, 132.6, 137.6, 142.1, 146.3, 146.4, 149.1, 151.3, 152.9, 154, 151.4, 151.9, 152.1, 152.4, 152.7, 150, 151, 152.6, 151.3, 153.9, 153.9, 157.7, 162.1, 163.9, 169.1] },
    ],
  },
  "profit-loss": {
    categories: ["Oct 1", "Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6", "Oct 7", "Oct 8", "Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30"],
    series: [
      { name: "P&L", values: [-3080, -2187, -1347, -609, -12, 420, 677, 768, 717, -458, -670, -885, -1049, -1113, -1039, -799, -386, -825, -101, 730, 1620, 2516, 3364, 4115, 4728, 5178, 4434, 4542, 4505, 4358] },
      { name: "Trades", values: [38, 47, 55, 61, 51, 51, 48, 50, 47, 54, 58, 59, 46, 42, 49, 58, 52, 55, 55, 52, 39, 49, 56, 61, 51, 50, 47, 51, 48, 54] },
    ],
  },
};

export function composedFixture(id: string): CartesianData {
  const key = id.replace(/^composed-/, "");
  const baseline = fixtures.default;
  if (key === "band") return { ...baseline, series: baseline.series.slice(0, 2), rows: fixtures.band.rows };
  return fixtures[key] ?? { ...baseline, series: baseline.series.slice(0, 2) };
}
