import type { ChartSeries } from "../../types";
import type { CartesianData } from "./data";

const dayMs = 86_400_000;
const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

function daySequence(year: number, month: number, count: number, first = 1, step = 1) {
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month - 1, first) + dayMs * step * index));
}

function monthSequence(year: number, count: number) {
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, index, 1)));
}

function records(days: Date[], series: ChartSeries[], label: (day: Date, index: number) => string = day => dateLabel.format(day)): CartesianData {
  return { categories: days.map(label), series, rows: days.map(day => ({ date: day.toISOString().slice(0, 10) })) };
}

export const loadingOrders = [95, 126, 133, 116, 99, 106, 137, 169, 175, 157, 140, 148, 180, 211, 217, 199, 182, 190, 222, 253, 258, 240, 224, 233, 265, 295, 300, 282, 266, 275, 307];

export function makeAreaFixture(id: string): CartesianData {
  switch (id) {
    case "area-default": return records(daySequence(2026, 9, 30), [
      { name: "Revenue", values: [12000, 13500, 11000, 14500, 13800, 15200, 16000, 14800, 15500, 14200, 16800, 17500, 16200, 15800, 17200, 18500, 17800, 16500, 19200, 18800, 17500, 19800, 20500, 19200, 21000, 21800, 20500, 22500, 23200, 24000] },
      { name: "Costs", values: [8500, 9200, 7800, 10100, 9400, 10800, 11200, 10500, 10900, 9800, 11800, 12400, 11500, 11200, 12100, 13200, 12600, 11700, 13800, 13400, 12400, 14200, 14800, 13600, 15200, 15800, 14600, 16200, 16800, 17400] },
    ]);
    case "area-fill": return records(daySequence(2026, 8, 31), [
      { name: "Visitors", values: [2260, 2520, 3230, 3240, 3400, 3380, 3350, 2600, 2620, 3490, 3560, 3570, 3650, 3520, 2650, 2750, 3730, 3590, 3780, 3750, 3900, 2900, 2750, 3880, 4010, 3980, 3990, 4000, 3080, 3100, 4030] },
    ]);
    case "area-gradient-fill": return records(daySequence(2026, 4, 30), [
      { name: "Subscribers", values: [8224, 8308, 8375, 8484, 8523, 8566, 8698, 8829, 8962, 9077, 9136, 9264, 9383, 9485, 9511, 9543, 9657, 9699, 9757, 9813, 9949, 9979, 10026, 10131, 10165, 10190, 10304, 10379, 10511, 10574] },
    ]);
    case "area-pattern": return records(daySequence(2026, 9, 30), [
      { name: "Spend", values: [4240, 4460, 4760, 4610, 4790, 4780, 4510, 4290, 4180, 4200, 4190, 4310, 4360, 4470, 4710, 4980, 4930, 5060, 5230, 5270, 5250, 4970, 4890, 4800, 4790, 4810, 4880, 5000, 5110, 5170] },
    ]);
    case "area-mixed": return records(daySequence(2026, 6, 30), [
      { name: "Desktop", values: [303, 325, 361, 343, 343, 211, 209, 359, 350, 343, 369, 365, 237, 223, 380, 349, 404, 360, 415, 294, 286, 423, 379, 429, 435, 404, 298, 321, 408, 390] },
      { name: "Mobile", values: [190, 172, 193, 198, 191, 285, 271, 226, 191, 226, 219, 206, 306, 278, 237, 223, 232, 239, 227, 312, 326, 232, 260, 259, 265, 240, 301, 344, 278, 270] },
    ]);
    case "area-forecast": return records(monthSequence(2026, 12), [
      { name: "Revenue", values: [48200, 50900, 53400, 55100, 58600, 61200, 63900, 67400, 70800, 74000, 77500, 81200] },
    ], day => monthLabel.format(day));
    case "area-reference-band": return records(daySequence(2026, 10, 31), [
      { name: "Sign-ups", values: [203, 234, 248, 240, 254, 236, 236, 234, 225, 223, 220, 201, 180, 176, 178, 192, 190, 190, 227, 223, 228, 251, 276, 274, 265, 277, 268, 255, 241, 243, 234] },
    ]);
    case "area-reference-range": return records(daySequence(2026, 10, 31), [
      { name: "Installs", values: [770, 820, 810, 830, 860, 870, 820, 810, 820, 920, 840, 2800, 3500, 3060, 2670, 2430, 2110, 1920, 1310, 1320, 1340, 1320, 1410, 1420, 1390, 1410, 1380, 1460, 1380, 1370, 1450] },
    ]);
    case "area-background": return records(daySequence(2026, 8, 31), [
      { name: "Requests", values: [971, 1044, 1551, 1578, 1588, 1595, 1588, 1112, 1122, 1589, 1678, 1671, 1689, 1671, 1167, 1193, 1738, 1696, 1790, 1793, 1767, 1254, 1239, 1780, 1785, 1876, 1831, 1872, 1274, 1257, 1944] },
    ]);
    case "area-small-multiples": return records(daySequence(2026, 4, 26, 6, 7), [
      { name: "North America", values: [3100, 3271, 3409, 3490, 3502, 3453, 3363, 3263, 3186, 3162, 3204, 3312, 3468, 3644, 3804, 3920, 3971, 3955, 3885, 3786, 3692, 3636, 3639, 3711, 3843, 4011] },
      { name: "Europe", values: [2818, 2874, 2872, 2825, 2753, 2684, 2646, 2657, 2726, 2846, 2997, 3152, 3285, 3372, 3403, 3379, 3318, 3244, 3185, 3167, 3203, 3295, 3431, 3588, 3737, 3852] },
      { name: "Asia Pacific", values: [2048, 2047, 2025, 2001, 1996, 2025, 2095, 2204, 2340, 2483, 2614, 2713, 2773, 2791, 2779, 2754, 2736, 2744, 2790, 2878, 3001, 3143, 3283, 3402, 3484, 3526] },
      { name: "Latin America", values: [946, 1003, 1042, 1062, 1064, 1056, 1048, 1048, 1064, 1100, 1155, 1222, 1292, 1357, 1407, 1438, 1449, 1446, 1437, 1431, 1437, 1462, 1507, 1567, 1637, 1706] },
      { name: "Middle East", values: [639, 625, 613, 610, 619, 642, 676, 716, 757, 790, 812, 820, 816, 804, 791, 782, 784, 799, 827, 864, 906, 944, 973, 989, 991, 983] },
      { name: "Africa", values: [414, 423, 426, 425, 424, 428, 439, 459, 486, 517, 550, 579, 601, 615, 621, 621, 620, 621, 628, 643, 666, 695, 727, 759, 785, 804] },
    ]);
    case "area-date-highlights": return records(daySequence(2026, 10, 22), [
      { name: "Completed", values: [0, 4, 8, 12, 15, 18, 20, 22, 24, 26, 28, 29, 31, 32, 33, 34, 35, 36, 36, 37, 38, 38] },
    ]);
    case "area-trend": return records(monthSequence(2026, 10), [
      { name: "Desktop", values: [186, 305, 237, 273, 209, 314, 352, 298, 341, 377] },
    ]);
    case "area-value-labels": return records(monthSequence(2025, 24), [
      { name: "Desktop", values: [1800, 2030, 2240, 2410, 2550, 2630, 2660, 2640, 2570, 2480, 2380, 2280, 2200, 2150, 2160, 2210, 2320, 2480, 2680, 2900, 3130, 3350, 3540, 3700] },
      { name: "Mobile", values: [1480, 1500, 1470, 1400, 1300, 1210, 1130, 1090, 1100, 1170, 1290, 1450, 1640, 1830, 2010, 2150, 2240, 2280, 2270, 2210, 2120, 2020, 1940, 1890] },
    ]);
    case "area-dual-axis": return records(daySequence(2026, 9, 30), [
      { name: "Sessions", values: [4200, 4470, 4720, 4950, 5150, 5310, 5420, 5480, 5490, 5450, 5370, 5250, 5110, 4960, 4800, 4650, 4520, 4430, 4370, 4360, 4400, 4490, 4630, 4820, 5040, 5280, 5550, 5820, 6080, 6320] },
      { name: "Conversion", values: [3.4, 3.3, 3.2, 3.2, 3.1, 3.1, 3.1, 3, 3.1, 3.1, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.2, 4.3, 4.3, 4.4, 4.4, 4.4, 4.4, 4.3, 4.3] },
    ]);
    case "area-steps": return records(daySequence(2026, 9, 30), [
      { name: "Pages", values: [3, 3, 2, 2, 5, 5, 4, 4, 4, 1, 1, 2, 2, 6, 6, 3, 3, 3, 2, 2, 4, 4, 7, 7, 5, 5, 2, 2, 1, 1] },
    ]);
    case "area-selection": return records(daySequence(2026, 9, 30), [
      { name: "Signups", values: [9400, 9830, 9950, 9840, 9630, 9460, 9440, 9610, 9920, 10280, 10540, 10570, 10290, 9700, 8880, 8000, 7240, 6780, 6740, 7170, 8000, 9070, 10210, 11220, 11940, 12310, 12350, 12160, 11870, 11630] },
    ]);
    case "area-pattern-fade": return records(daySequence(2026, 9, 30), [
      { name: "Revenue", values: [21000, 22200, 23300, 24300, 25200, 26000, 26600, 27000, 27200, 27200, 27100, 26700, 26300, 25700, 25100, 24400, 23800, 23200, 22800, 22400, 22300, 22300, 22500, 23000, 23600, 24300, 25300, 26300, 27500, 28600] },
    ]);
    case "area-fade-bottom": return records(daySequence(2026, 9, 30), [
      { name: "Orders", values: [700, 736, 746, 744, 747, 765, 797, 827, 837, 814, 756, 677, 601, 551, 540, 565, 613, 661, 695, 711, 718, 732, 768, 828, 901, 967, 1004, 998, 954, 886] },
    ]);
    case "area-custom-labels": return records(daySequence(2026, 1, 12, 1, 14), [
      { name: "Story points", values: [34, 38, 31, 42, 45, 40, 47, 51, 44, 53, 56, 58] },
    ], (_, index) => `Sprint ${index + 1}`);
    default: return records(daySequence(2026, 7, 31), [
      { name: "Orders", values: [408, 446, 497, 497, 445, 469, 454, 418, 404, 419, 402, 437, 419, 476, 523, 490, 527, 512, 526, 486, 463, 479, 426, 470, 452, 504, 506, 508, 532, 603, 587] },
    ]);
  }
}
