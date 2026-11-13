import type { CartesianData } from "./data";
import type { ChartSeries } from "../../types";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const h1 = months.slice(0, 6);
const series = (name: string, values: number[]): ChartSeries => ({ name, values });
const revenue = () => series("Revenue", [12000, 15500, 11000, 18500, 16800, 21200]);
const profit = () => series("Profit", [4500, 5200, 3800, 7100, 5400, 8800]);

export function barFixture(id: string): CartesianData {
  switch (id) {
    case "bar-grouped":
    case "bar-squares-legend":
      return { categories: h1, series: [revenue(), profit()] };
    case "bar-stacked":
      return { categories: h1, series: [
        series("Organic", [820, 1100, 940, 1250, 1380, 1520]),
        series("Paid", [410, 690, 580, 720, 650, 840]),
        series("Referral", [190, 240, 210, 310, 360, 420]),
      ] };
    case "bar-values":
      return { categories: months, series: [series("Orders", [720, 640, 810, 580, 930, 700, 880, 760, 1010, 860, 1120, 970])] };
    case "bar-profit-loss":
      return { categories: months.slice(0, 8), series: [series("Profit", [4200, -1800, 2600, -3400, 5100, -900, 3800, 6200])] };
    case "bar-sources":
      return { categories: ["Organic", "Paid", "Direct", "Referral", "Social", "Email"], series: [series("Visits", [4250, 3120, 2100, 1480, 960, 640])] };
    case "bar-squares":
      return { categories: [...months.slice(10), ...months.slice(0, 10)], series: [series("Revenue", [9800, 13400, 12000, 15500, 11000, 18500, 16800, 21200, 19600, 17300, 22800, 25100])] };
    case "bar-synced":
      return { categories: months, series: [
        series("Revenue", [48200, 47100, 55900, 59300, 61800, 64400, 63100, 62700, 71500, 76800, 88900, 97300]),
        series("Orders", [412, 398, 455, 471, 503, 488, 452, 437, 519, 546, 612, 658]),
      ] };
    case "bar-loading":
      return { categories: months.slice(0, 8), series: [series("Orders", [1240, 1385, 1190, 1520, 1610, 1745, 1680, 1830])] };
    default:
      return { categories: h1, series: [revenue()] };
  }
}
