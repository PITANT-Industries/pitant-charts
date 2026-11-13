export type ScatterKind = "default" | "rings" | "solid" | "outline";

interface ScatterFixture {
  start: [month: number, day: number];
  dayStep: number;
  clockChangeAt?: number;
  cap: number;
  interval: number;
  ticks: readonly number[];
  series: readonly { name: string; color: number; values: readonly number[] }[];
}

export const scatterFixtures: Readonly<Record<ScatterKind, ScatterFixture>> = {
  default: {
    start: [5, 18], dayStep: 7, clockChangeAt: 23, cap: 550, interval: 100, ticks: [0, 8, 16, 23],
    series: [
      { name: "Organic", color: 0, values: [280, 360, 434, 496, 462, 488, 494, 484, 378, 342, 304, 190, 166, 158, 168, 116, 164, 228, 304, 306, 386, 460, 440, 482] },
      { name: "Referral", color: 1, values: [250, 254, 244, 220, 192, 94, 72, 64, 72, 96, 68, 120, 176, 232, 280, 244, 262, 262, 248, 222, 122, 96, 78, 74] },
    ],
  },
  rings: {
    start: [10, 5], dayStep: 1, cap: 1600, interval: 500, ticks: [0, 5, 10, 15, 20],
    series: [
      { name: "Orders", color: 1, values: [1209, 1127, 1337, 1172, 1338, 1140, 1266, 1260, 1271, 1223, 1230, 1311, 1389, 1298, 1310, 1451, 1294, 1283, 1318, 1440, 1414] },
    ],
  },
  solid: {
    start: [9, 1], dayStep: 1, clockChangeAt: 55, cap: 280, interval: 50, ticks: [0, 15, 30, 44, 59],
    series: [
      { name: "p95 latency", color: 2, values: [149, 154, 225, 196, 225, 178, 184, 245, 247, 192, 226, 243, 242, 215, 228, 219, 175, 179, 195, 198, 199, 156, 150, 171, 168, 148, 109, 117, 146, 124, 138, 152, 161, 170, 176, 189, 172, 187, 201, 189, 181, 184, 177, 238, 230, 163, 182, 188, 212, 183, 186, 205, 152, 176, 138, 149, 172, 140, 131, 159] },
    ],
  },
  outline: {
    start: [7, 6], dayStep: 7, cap: 24, interval: 5, ticks: [0, 5, 10, 15],
    series: [
      { name: "Trial to paid", color: 0, values: [11.2, 12.8, 12.1, 13.4, 14.9, 14.2, 15.6, 16.8, 15.9, 17.5, 18.3, 17.7, 19.4, 20.1, 19.6, 21.3] },
    ],
  },
};
