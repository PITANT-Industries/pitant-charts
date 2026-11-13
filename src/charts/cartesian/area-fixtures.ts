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

function wave(count: number, first: number, step: number, amplitude: number, phase = 0, precision = 1) {
  return Array.from({ length: count }, (_, index) => {
    const value = first + step * index + amplitude * (0.7 * Math.sin(index * 0.52 + phase) + 0.3 * Math.sin(index * 1.73 + phase));
    return Math.round(value / precision) * precision;
  });
}

function weekdayTraffic(days: Date[], first: number, step: number, amplitude: number, weekendRatio: number) {
  return wave(days.length, first, step, amplitude).map((value, index) => {
    const weekday = days[index].getUTCDay();
    return weekday === 0 || weekday === 6 ? Math.round(value * weekendRatio) : value;
  });
}

export function makeAreaFixture(id: string): CartesianData {
  const september = daySequence(2026, 9, 30);
  const august = daySequence(2026, 8, 31);
  const october = daySequence(2026, 10, 31);
  switch (id) {
    case "area-default": {
      const revenue = wave(30, 12_000, 394, 2_700, 0.2, 100);
      const costs = revenue.map((value, index) => Math.round(value * (0.72 + 0.01 * Math.cos(index)) / 100) * 100);
      return records(september, [{ name: "Revenue", values: revenue }, { name: "Costs", values: costs }]);
    }
    case "area-fill":
      return records(august, [{ name: "Visitors", values: weekdayTraffic(august, 3_260, 31, 285, 0.75) }]);
    case "area-gradient-fill":
      return records(daySequence(2026, 4, 30), [{ name: "Subscribers", values: wave(30, 8_130, 81, 145) }]);
    case "area-pattern":
      return records(september, [{ name: "Spend", values: wave(30, 4_250, 26, 655, 0.15, 10) }]);
    case "area-mixed": {
      const june = daySequence(2026, 6, 30);
      return records(june, [
        { name: "Desktop", values: weekdayTraffic(june, 322, 4.5, 35, 0.64) },
        { name: "Mobile", values: weekdayTraffic(june, 201, 2.5, 23, 1.26) },
      ]);
    }
    case "area-forecast":
      return records(monthSequence(2026, 12), [{ name: "Revenue", values: [48_200, 50_700, 53_400, 55_100, 58_600, 61_200, 63_800, 67_400, 70_800, 74_000, 77_650, 81_200] }], day => monthLabel.format(day));
    case "area-reference-band": {
      const values = wave(31, 217, 1.4, 37, 0.4).map((value, index) => index === 13 ? 169 : index === 14 ? 174 : Math.max(185, value));
      return records(october, [{ name: "Sign-ups", values }]);
    }
    case "area-reference-range": {
      const before = wave(11, 780, 9, 50, -0.35);
      const launch = [2_960, 3_560, 3_140, 2_790, 2_490, 2_150, 1_990];
      const after = wave(13, 1_300, 14, 50, -0.2);
      return records(october, [{ name: "Installs", values: [...before, ...launch, ...after] }]);
    }
    case "area-background":
      return records(august, [{ name: "Requests", values: weekdayTraffic(august, 1_520, 13, 128, 0.66) }]);
    case "area-small-multiples": {
      const regions = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa"];
      const starts = [3_100, 2_840, 1_940, 930, 575, 370];
      const growth = [35, 43, 56, 33, 17, 18];
      const variation = [280, 254, 196, 73, 56, 35];
      return records(daySequence(2026, 4, 26, 6, 7), regions.map((name, index) => ({ name, values: wave(26, starts[index], growth[index], variation[index], index * 0.72) })));
    }
    case "area-date-highlights":
      return records(october.slice(0, 22), [{ name: "Completed", values: [0, 4, 8, 12, 15, 18, 20, 22, 24, 26, 28, 29, 31, 32, 33, 34, 35, 36, 36, 37, 38, 38] }]);
    case "area-trend":
      return records(monthSequence(2026, 10), [{ name: "Desktop", values: [204, 305, 310, 273, 275, 314, 362, 353, 341, 377] }]);
    case "area-value-labels":
      return records(monthSequence(2025, 24), [
        { name: "Desktop", values: wave(24, 1_800, 75, 545, 0.1, 10) },
        { name: "Mobile", values: wave(24, 1_130, 48, 385, 0.6, 10) },
      ]);
    case "area-dual-axis":
      return records(september, [
        { name: "Sessions", values: weekdayTraffic(september, 4_130, 66, 750, 0.79) },
        { name: "Conversion", values: wave(30, 3.05, 0.046, 0.32, 1.15, 0.1) },
      ]);
    case "area-steps":
      return records(september, [{ name: "Pages", values: [5, 5, 4, 4, 5, 2, 1, 2, 1, 1, 1, 2, 4, 4, 3, 3, 3, 3, 5, 5, 6, 6, 7, 5, 5, 4, 3, 2, 1, 1] }]);
    case "area-selection":
      return records(september, [{ name: "Signups", values: wave(30, 9_850, 28, 3_100, 0.5, 10) }]);
    case "area-pattern-fade": {
      const values = Array.from({ length: 30 }, (_, index) => Math.round((20_900 + 260 * index + 4_800 * Math.sin(index * 0.23)) / 100) * 100);
      return records(september, [{ name: "Revenue", values }]);
    }
    case "area-fade-bottom":
      return records(september, [{ name: "Orders", values: wave(30, 714, 7, 152, 0.4) }]);
    case "area-custom-labels":
      return records(daySequence(2026, 1, 12, 1, 14), [{ name: "Story points", values: [34, 42, 31, 49, 45, 47, 50, 51, 43, 53, 54, 58] }], (_, index) => `Sprint ${index + 1}`);
    default:
      return records(daySequence(2026, 7, 31), [{ name: "Orders", values: wave(31, 365, 7.1, 89, 0.5) }]);
  }
}
