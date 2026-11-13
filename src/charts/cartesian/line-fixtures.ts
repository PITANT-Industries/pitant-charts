import type { ChartSeries } from "../../types";
import { curve, dates, months, type CartesianData } from "./data";

const september = (count = 30) => dates(count, Date.UTC(2026, 8, 1));
const october = (count = 30, start = 1) => dates(count, Date.UTC(2026, 9, start));
const mondays = (count: number, start: number) => dates((count - 1) * 7 + 1, start).filter((_, index) => index % 7 === 0);
const series = (name: string, values: readonly number[]): ChartSeries => ({ name, values });

const issues = [
  series("Scope", [29, 31, 31, 31, 33, 34, 36, 40, 44, 45, 45, 46, 46, 47, 48, 49, 49, 49, 50, 50, 50, 51, 51]),
  series("Started", [11, 13, 13, 13, 18, 21, 25, 28, 31, 31, 31, 32, 34, 36, 38, 40, 40, 40, 41, 42, 42, 44, 45]),
  series("Completed", [8, 10, 10, 10, 15, 16, 19, 22, 25, 26, 26, 28, 30, 31, 33, 36, 36, 36, 37, 38, 38, 40, 42]),
];
const signupValues = [153, 159, 166, 159, 167, 174, 176, 168, 183, 192, 196, 183, 188, 181, 185, 173, 179, 182, 196, 206, 207, 203, 214, 219];
const signupBand = signupValues.map((value, index) => {
  const exact = ({ 4: [152, 186], 10: [183, 209], 15: [153, 194], 19: [184, 221], 22: [198, 228] } as Record<number, [number, number]>)[index];
  const [low, high] = exact ?? [value - 13 - index % 6, value + 13 + (index * 3) % 9];
  return { low, high };
});

export function lineFixture(id: string): CartesianData | undefined {
  switch (id) {
    case "line-default": return { categories: october(30, 2), series: [
      series("Users", [1_200, 1_350, 1_100, 1_450, 1_380, 1_520, 1_600, 1_480, 1_550, 1_420, 1_680, 1_750, 1_620, 1_580, 1_720, 1_850, 1_780, 1_650, 1_920, 1_880, 1_750, 1_980, 2_050, 1_920, 2_100, 2_180, 2_050, 2_250, 2_320, 2_400]),
      series("Pageviews", [4_500, 4_800, 4_200, 5_100, 4_900, 5_400, 5_800, 5_200, 5_500, 5_000, 6_100, 6_400, 5_900, 5_700, 6_200, 6_800, 6_500, 6_000, 7_100, 6_900, 6_400, 7_300, 7_600, 7_100, 7_800, 8_100, 7_600, 8_400, 8_700, 9_000]),
    ] };
    case "line-dual-axis": return { categories: september(), series: [series("Revenue", curve(30, 2, 10_100, 4300, 398)), series("Conversion", curve(30, 3, 365, 91, -3.6).map(value => value / 100))] };
    case "line-grid": return { categories: october(14, 5), series: [series("Sessions", [3280, 3450, 3350, 3590, 3820, 2680, 2480, 3900, 3730, 3970, 4070, 4190, 3020, 2930])] };
    case "line-points": return { categories: october(14), series: [series("Sign-ups", [203, 215, 172, 197, 226, 229, 238, 252, 268, 197, 224, 296, 312, 315])] };
    case "line-dashed": return { categories: october(31), series: [series("Orders", curve(31, 1, 434, 118, 6.9))] };
    case "line-markers": {
      const events: Record<number, readonly string[]> = {
        3: ["✨ New onboarding"], 9: ["⚠ Incident"], 15: ["🚀 Release"],
        22: ["🚀 Release", "🐛 Hotfix", "📣 Announcement"],
      };
      return { categories: september(), series: [series("Users", curve(30, 4, 1340, 480, 48)), series("Sessions", curve(30, 4, 4340, 1400, 165))],
        rows: september().map((_, index) => ({ events: events[index] })) };
    }
    case "line-legend": return { categories: october(21, 5), series: [
      series("Organic", curve(21, 3, 2870, 690, 18)), series("Paid", curve(21, 7, 1560, 440, 6)), series("Referral", curve(21, 6, 770, 270, 7)),
    ] };
    case "line-time-range": return { categories: dates(90, Date.UTC(2026, 6, 1)), series: [series("Visitors", curve(90, 4, 2400, 950, 6.2))] };
    case "line-table": return { categories: mondays(10, Date.UTC(2026, 6, 6)), series: [
      series("Trials", [1180, 1240, 1205, 1320, 1410, 1385, 1490, 1575, 1530, 1660]),
      series("Paid", [412, 438, 421, 466, 497, 485, 528, 561, 549, 602]),
    ] };
    case "line-projection": return {
      categories: october(30), series: [series("Users", curve(30, 3, 1160, 420, 31))],
      rows: ["Oct 31", "Nov 1", "Nov 2", "Nov 3", "Nov 4", "Nov 5"].map((category, index) => ({ category, goal: 2800 - (5 - index) * 82 })),
    };
    case "line-projection-manual": return {
      categories: mondays(16, Date.UTC(2026, 5, 1)), series: [series("Bookings", curve(16, 4, 85_300, 12_750, 3040))],
      rows: [{ category: "Sep 28", forecast: 117_500 }, { category: "Oct 12", forecast: 136_000 }, { category: "Oct 26", forecast: 142_500 }],
    };
    case "line-threshold": return {
      categories: october(30), series: [
        series("p95", [204, 196, 172, 168, 214, 231, 268, 244, 219, 181, 176, 223, 228, 291, 276, 238, 188, 179, 209, 216, 207, 212, 198, 165, 161, 189, 193, 186, 182, 177]),
        series("Median", [112, 108, 96, 94, 118, 124, 131, 127, 115, 99, 97, 119, 122, 138, 134, 121, 101, 98, 114, 117, 113, 116, 109, 92, 90, 104, 106, 103, 101, 99]),
      ],
    };
    case "line-profit-loss": return { categories: october(), series: [series("Net income", curve(30, 2, 260, 2370, 36))] };
    case "line-profit-loss-legend": return { categories: mondays(26, Date.UTC(2026, 3, 6)), series: [series("P&L", curve(26, 3, -1460, 6700, 195))] };
    case "line-band":
    case "line-band-fill":
    case "line-band-fade":
    case "line-band-edges": return { categories: october(24), series: [series("Signups", signupValues)], rows: signupBand };
    case "line-band-ranges": {
      const north = curve(24, 1, 43, 17, -0.1);
      const south = curve(24, 3, 62, 24, -0.4);
      return {
        categories: october(24), series: [series("North", north), series("South", south)],
        rows: north.map((value, index) => ({ North: { low: value - 6 - index % 5, high: value + 4 + index % 7 }, South: { low: south[index] - 6 - index % 6, high: south[index] + 4 + index % 7 } })),
      };
    }
    case "line-weekends":
    case "line-deadline": return { categories: october(23), series: issues };
    case "line-deadline-fills": return { categories: october(23), series: issues.slice(2) };
    case "line-glow": return { categories: october(), series: [series("Sessions", curve(30, 1, 34, 9, -0.28).map((value, index) => Math.round((value + 16 * Math.exp(-0.05 * (index - 9) ** 2)) * 10) / 10))] };
    case "line-trend": return { categories: mondays(14, Date.UTC(2026, 6, 6)), series: [series("Signups", [380, 427, 437, 491, 467, 531, 540, 593, 617, 655, 638, 702, 688, 731])] };
    case "line-bollinger":
    case "line-band-bollinger": return {
      categories: dates(40, Date.UTC(2026, 7, 3)), series: [series("Close", curve(40, 4, 18_800, 800, 69).map(value => value / 100))],
    };
    case "line-crosshair-point": return { categories: september(), series: [series("Visitors", curve(30, 6, 2570, 660, 23))] };
    case "line-fixed-scale": return { categories: september(), series: [series("CPU", curve(30, 4, 48, 24, 0.27).map(value => Math.min(72, value)))] };
    case "line-straight": return { categories: september(), series: [series("Web", curve(30, 4, 1630, 650, 15)), series("Mobile", curve(30, 5, 1010, 370, 15))] };
    case "line-export": return { categories: months.map(month => `${month} 1`), series: [
      series("Pro", [18_500, 19_500, 20_800, 22_300, 23_100, 24_900, 25_200, 27_100, 29_400, 31_200, 32_800, 35_200]),
      series("Team", [12_400, 13_100, 14_100, 15_000, 16_500, 17_200, 18_700, 20_400, 22_200, 23_500, 24_700, 28_200]),
      series("Starter", [9100, 9500, 9900, 9800, 10_100, 10_700, 10_600, 11_000, 11_400, 12_100, 12_400, 13_100]),
    ] };
    case "line-loading": return { categories: october(14, 5), series: [series("Revenue", curve(14, 2, 3600, 1300, 143))] };
    case "chart-data-table": return { categories: months.slice(0, 6), series: [
      series("Revenue", [12_200, 13_600, 12_800, 16_400, 18_900, 21_200]),
      series("Expenses", [8200, 8900, 9300, 9800, 10_600, 11_100]),
    ] };
    default: return undefined;
  }
}
