import type { ChartSeries } from "../../types";
import { referenceLineFixture } from "./line-reference-fixtures";
import { dates, months, type CartesianData } from "./data";

const october = (count = 30, start = 1) => dates(count, Date.UTC(2026, 9, start));
const mondays = (count: number, start: number) => dates((count - 1) * 7 + 1, start).filter((_, index) => index % 7 === 0);
const series = (name: string, values: readonly number[]): ChartSeries => ({ name, values });

export function lineFixture(id: string): CartesianData | undefined {
  const reference = referenceLineFixture(id);
  if (reference) return reference;
  switch (id) {
    case "line-default": return { categories: october(30, 2), series: [
      series("Users", [1_200, 1_350, 1_100, 1_450, 1_380, 1_520, 1_600, 1_480, 1_550, 1_420, 1_680, 1_750, 1_620, 1_580, 1_720, 1_850, 1_780, 1_650, 1_920, 1_880, 1_750, 1_980, 2_050, 1_920, 2_100, 2_180, 2_050, 2_250, 2_320, 2_400]),
      series("Pageviews", [4_500, 4_800, 4_200, 5_100, 4_900, 5_400, 5_800, 5_200, 5_500, 5_000, 6_100, 6_400, 5_900, 5_700, 6_200, 6_800, 6_500, 6_000, 7_100, 6_900, 6_400, 7_300, 7_600, 7_100, 7_800, 8_100, 7_600, 8_400, 8_700, 9_000]),
    ] };
    case "line-table": return { categories: mondays(10, Date.UTC(2026, 6, 6)), series: [
      series("Trials", [1180, 1240, 1205, 1320, 1410, 1385, 1490, 1575, 1530, 1660]),
      series("Paid", [412, 438, 421, 466, 497, 485, 528, 561, 549, 602]),
    ] };
    case "line-threshold": return {
      categories: october(30), series: [
        series("p95", [204, 196, 172, 168, 214, 231, 268, 244, 219, 181, 176, 223, 228, 291, 276, 238, 188, 179, 209, 216, 207, 212, 198, 165, 161, 189, 193, 186, 182, 177]),
        series("Median", [112, 108, 96, 94, 118, 124, 131, 127, 115, 99, 97, 119, 122, 138, 134, 121, 101, 98, 114, 117, 113, 116, 109, 92, 90, 104, 106, 103, 101, 99]),
      ],
    };
    case "line-export": return { categories: months.map(month => `${month} 1`), series: [
      series("Pro", [18_500, 19_500, 20_800, 22_300, 23_100, 24_900, 25_200, 27_100, 29_400, 31_200, 32_800, 35_200]),
      series("Team", [12_400, 13_100, 14_100, 15_000, 16_500, 17_200, 18_700, 20_400, 22_200, 23_500, 24_700, 28_200]),
      series("Starter", [9100, 9500, 9900, 9800, 10_100, 10_700, 10_600, 11_000, 11_400, 12_100, 12_400, 13_100]),
    ] };
    case "chart-data-table": return { categories: months.slice(0, 6), series: [
      series("Revenue", [12_200, 13_600, 12_800, 16_400, 18_900, 21_200]),
      series("Expenses", [8200, 8900, 9300, 9800, 10_600, 11_100]),
    ] };
    default: return undefined;
  }
}
