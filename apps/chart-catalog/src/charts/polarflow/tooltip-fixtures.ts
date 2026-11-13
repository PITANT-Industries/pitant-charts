import type { ChartSeries } from "../../types";

export interface TooltipFixture {
  categories: string[];
  series: ChartSeries[];
  dates?: Date[];
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const tradingDays = Array.from({ length: 40 }, (_, index) => new Date(Date.UTC(2026, 7, 3 + index)))
  .filter(date => date.getUTCDay() !== 0 && date.getUTCDay() !== 6);

function dated(month: number, series: ChartSeries[]): TooltipFixture {
  const dates = month < 0 ? tradingDays : Array.from({ length: series[0].values.length }, (_, index) => new Date(Date.UTC(2026, month - 1, index + 1)));
  return { dates, categories: dates.map(date => shortDate.format(date)), series };
}

const price = [126, 133, 134, 140, 147, 145, 138, 142, 158, 171, 171, 165, 164, 165, 159, 152, 155, 167, 173, 164, 151, 146, 146, 142, 137, 142, 153, 155, 144, 132];

export const tooltipFixtures: Readonly<Record<string, TooltipFixture>> = {
  "tooltip-standard": dated(9, [
    { name: "Organic", values: [2430, 2500, 2680, 2850, 2700, 2560, 2570, 2530, 2300, 2680, 2610, 2760, 3110, 2870, 2920, 2720, 2630, 2760, 2850, 2920, 3060, 3020, 3300, 3300, 3170, 3290, 2940, 3100, 2920, 2980] },
    { name: "Direct", values: [1340, 1450, 1540, 1550, 1520, 1440, 1240, 1260, 1240, 1410, 1450, 1540, 1710, 1630, 1710, 1590, 1450, 1470, 1500, 1540, 1610, 1820, 1850, 1820, 1870, 1780, 1680, 1670, 1610, 1650] },
    { name: "Referral", values: [530, 580, 610, 600, 600, 520, 560, 470, 470, 590, 620, 680, 750, 680, 690, 650, 640, 620, 570, 600, 710, 690, 770, 840, 820, 740, 700, 690, 660, 700] },
  ]),
  "tooltip-crosshair": dated(10, [
    { name: "Sign-ups", values: [186, 194, 224, 207, 204, 204, 197, 186, 164, 197, 224, 223, 255, 230, 251, 235, 198, 228, 210, 241, 254, 264, 266, 282, 279, 264, 251, 234, 232, 266, 272] },
  ]),
  "tooltip-indicator": dated(7, [
    { name: "Users", values: [3290, 3420, 3670, 3640, 3610, 3280, 3510, 3260, 3230, 3490, 3590, 3750, 4080, 4110, 4060, 3980, 3890, 3870, 3670, 4010, 4120] },
  ]),
  "tooltip-motion": dated(8, [
    { name: "Web", values: [666, 692, 683, 682, 699, 711, 667, 619, 622, 686, 708, 727, 750, 756, 749, 783, 712, 677, 707, 755, 769] },
    { name: "App", values: [403, 464, 490, 454, 501, 462, 464, 460, 412, 477, 519, 544, 573, 589, 595, 540, 515, 525, 552, 522, 600] },
  ]),
  "tooltip-rows": dated(6, [
    { name: "Users", values: [1470, 1540, 1570, 1630, 1500, 1460, 1390, 1520, 1540, 1530, 1680, 1620, 1790, 1870, 1780, 1750, 1640, 1670, 1600, 1710, 1810, 1920, 1990, 2040, 2040, 1950, 1870, 1830, 1950, 1920] },
    { name: "Pageviews", values: [4970, 5650, 5770, 6460, 5580, 5950, 5410, 5830, 5680, 5450, 5490, 5170, 5560, 5700, 4890, 5130, 4870, 5160, 5480, 6110, 6220, 7290, 7710, 7620, 7760, 7290, 6940, 6960, 6680, 6240] },
  ]),
  "tooltip-content": dated(4, [
    { name: "Revenue", values: [13170, 13810, 13310, 13890, 14370, 13050, 11950, 12700, 11800, 12940, 13200, 14240, 14390, 16050, 14110, 13370, 13070, 12350, 13750, 13820, 14400, 14790, 16170, 15810, 16740, 14630, 15000, 14080, 14530, 14240] },
  ]),
  "tooltip-pinned": dated(11, [
    { name: "Online store", values: [8200, 8690, 9100, 9366, 9453, 9362, 9132, 8829, 8533, 8323, 8263, 8382, 8677, 9106, 9602, 10084, 10472, 10708, 10762, 10643, 10395, 10087, 9800, 9614, 9583, 9735, 10058, 10505, 11004, 11475] },
    { name: "Retail", values: [4320, 4297, 4230, 4127, 6199, 6060, 3725, 3610, 3526, 3484, 3488, 5737, 5825, 3745, 3881, 4019, 4144, 4243, 6503, 6519, 4289, 4217, 4109, 3978, 3839, 5906, 5795, 3517, 3482, 3492] },
    { name: "Partners", values: [2420, 2496, 2549, 2579, 2586, 2571, 2537, 2490, 2434, 2374, 2317, 2268, 2232, 2215, 2219, 2245, 2296, 2369, 2462, 2572, 2694, 2822, 2952, 3076, 3190, 3288, 3366, 3423, 3456, 3466] },
  ]),
  "tooltip-ring": { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"], series: [
    { name: "Online", values: [1860, 2050, 2370, 1730, 2090, 2140, 2480, 2630, 2510] },
    { name: "Retail", values: [800, 1200, 980, 1190, 1300, 1400, 1260, 1520, 1610] },
  ] },
  "tooltip-horizontal-crosshair": dated(-1, [{ name: "Price", values: price }]),
  "tooltip-header": dated(-1, [{ name: "Close", values: price }]),
  "tooltip-custom-indicator": { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"], series: [
    { name: "Revenue", values: [42300, 45800, 44100, 51600, 49200, 56900, 61400, 58700] },
  ] },
};
