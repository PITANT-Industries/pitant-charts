import { comparisonFixture } from "./comparison-fixtures";
import { accumulateWaterfall } from "./upstream";

const plain = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const millions = (value: number) => `$${plain.format(value)}M`;
const points = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;
const seconds = (value: number) => `${value.toFixed(2)}s`;
const percent = (value: number) => `${plain.format(value)}%`;
const signed = (value: number, format: (value: number) => string) => `${value < 0 ? "−" : value > 0 ? "+" : ""}${format(Math.abs(value))}`;
const thousands = (value: number) => value ? `${value / 1000}k` : "0";

type MarkKind = "waterfall" | "lollipop" | "dumbbell";
type Config = {
  kind: MarkKind;
  min: number;
  max: number;
  step: number;
  padding: number;
  axis: (value: number) => string;
  format: (value: number) => string;
  color: number;
  horizontal?: boolean;
  left?: number;
  right?: number;
  loadingLabel?: string;
  ratio?: number;
  labelAfter?: number;
  radius?: number;
};

const cash: Config = { kind: "waterfall", min: 0, max: 40_000, step: 10_000, padding: .36, axis: thousands, format: plain.format, color: 0, ratio: 2.5 };
const waterfall: Config = { kind: "waterfall", min: 0, max: 7, step: 1, padding: .24, axis: value => `$${value}M`, format: millions, color: 0, labelAfter: 500 };
const lollipop: Config = { kind: "lollipop", min: 0, max: 10_000, step: 2000, padding: .2, axis: thousands, format: plain.format, color: 0 };
const dumbbell: Config = { kind: "dumbbell", min: .5, max: 4, step: .5, padding: .3, axis: seconds, format: seconds, color: 0, horizontal: true, left: 112 };

const designs = {
  "waterfall-default": waterfall,
  "waterfall-cash-flow": cash,
  "waterfall-subtotals": { ...waterfall, max: 1000, step: 200, color: 1 },
  "waterfall-loading": { ...waterfall, max: 6, loadingLabel: "Fetching cash flows…" },
  "lollipop-default": lollipop,
  "lollipop-horizontal": { ...lollipop, max: 100, step: 20, horizontal: true, left: 88, right: 48, axis: percent, format: percent, color: 1 },
  "lollipop-change": { ...lollipop, min: -3, max: 3, step: 1, axis: points, format: points, color: 2, radius: 5 },
  "lollipop-loading": { ...lollipop, max: 7000, step: 1000, loadingLabel: "Fetching sessions…" },
  "dumbbell-default": dumbbell,
  "dumbbell-legend": { ...dumbbell, min: 50, max: 80, step: 5, left: 96, right: 48, axis: plain.format, format: plain.format, color: 1 },
  "dumbbell-vertical": { ...dumbbell, horizontal: false, left: 56, min: -500, max: 2000, step: 500, padding: .3, axis: value => `$${plain.format(value)}`, format: usd.format, color: 2, radius: 7 },
  "dumbbell-loading": { ...dumbbell, min: 40, max: 90, step: 10, left: 96, axis: plain.format, format: plain.format, loadingLabel: "Fetching survey results…" },
} satisfies Record<string, Config>;

export type ComparisonMarksVariant = keyof typeof designs;
export const isComparisonMarksVariant = (id: string): id is ComparisonMarksVariant => Object.hasOwn(designs, id);
export const comparisonMarksDesign = (variant: ComparisonMarksVariant): Config => designs[variant];

export type ComparisonMark = { category: string; first: number; second: number; delta: number; total: boolean; value: number; };
export type MarkRow = { name: string; value: string; };

export function comparisonMarksData(variant: ComparisonMarksVariant) {
  const data = comparisonFixture(variant);
  const [first, second] = data.series;
  const marks: ComparisonMark[] = designs[variant].kind === "waterfall"
    ? accumulateWaterfall(first.values, index => data.rows?.[index]?.total === true).map(([index, from, to, value, total]) => ({
      category: data.categories[index], first: from, second: to, delta: value, total: Boolean(total), value,
    }))
    : data.categories.map((category, index) => {
      const from = second ? first.values[index] ?? 0 : 0;
      const to = (second ?? first).values[index] ?? 0;
      return { category, first: from, second: to, delta: to - from, total: false, value: to };
    });
  return { marks, series: data.series };
}

export function markRows(variant: ComparisonMarksVariant, mark: ComparisonMark, names: string[]): MarkRow[] {
  const { kind, format } = designs[variant];
  if (kind === "lollipop") return [{ name: names[0], value: format(mark.value) }];
  if (kind === "dumbbell") {
    return [
      { name: names[0], value: format(mark.first) },
      { name: names[1], value: format(mark.second) },
      { name: "Change", value: `${signed(mark.delta, format)} (${signed(mark.delta / mark.first * 100, value => `${Number(value.toFixed(1))}%`)})` },
    ];
  }
  const name = variant === "waterfall-cash-flow" ? "Net flow" : mark.total ? "Total" : mark.value < 0 ? "Decrease" : "Increase";
  const change = { name, value: mark.total ? format(mark.value) : signed(mark.value, format) };
  return mark.total ? [change] : [change, { name: "Running total", value: format(mark.second) }];
}

export const waterfallLabel = (mark: ComparisonMark) => mark.total ? millions(mark.value) : signed(mark.value, millions);

export function visibleCategoryIndices(variant: ComparisonMarksVariant, width: number, count: number) {
  switch (variant) {
    case "waterfall-default":
      if (width < 380) return [0, 3, 7];
      if (width < 440) return [0, 2, 4, 7];
      if (width < 700) return [0, 2, 4, 6, 7];
      break;
    case "waterfall-subtotals":
      return width < 350 ? [0, 4, 9] : width < 500 ? [0, 3, 6, 9] : width < 670 ? [0, 2, 4, 6, 9] : [0, 2, 4, 6, 8, 9];
    case "waterfall-loading":
      if (width < 310) return [0, 3, 6];
      if (width < 550) return [0, 2, 4, 6];
      break;
    case "lollipop-change":
      if (width < 310) return [0, 3, 6];
      if (width < 670) return [0, 2, 4, 6];
      break;
    case "lollipop-loading":
      if (width < 440) return [0, 2, 4, 6, 8];
      break;
    case "lollipop-default":
    case "waterfall-cash-flow":
      if (width < 310) return [0, 2, 4, 6];
      break;
    case "dumbbell-vertical":
      if (width < 325) return [0, 3];
      break;
  }
  return Array.from({ length: count }, (_, index) => index);
}

export function markTickValues(variant: ComparisonMarksVariant, width: number) {
  const { min, max, step } = designs[variant];
  let interval = step;
  if (variant === "dumbbell-default") interval = width < 345 ? 2 : width < 550 ? 1 : .5;
  if (variant === "lollipop-horizontal" && width < 380) interval = 50;
  if (variant === "dumbbell-legend" && width < 325) interval = 10;
  if (variant === "dumbbell-loading" && width < 310) interval = 20;
  const start = Math.ceil(min / interval) * interval;
  return Array.from({ length: Math.floor((max - start) / interval) + 1 }, (_, index) => start + interval * index);
}

// These loading profiles are normalized to the plot bounds so they scale with the same axes.
export const waterfallPlaceholder = [[0, .47968], [.47968, .66975], [.52641, .66975], [.52641, .70187], [.70187, .82426], [.65458, .82426], [0, .65458]] as const;
export const lollipopPlaceholder = [.68046, .85405, .58933, .52665, .57398, .43743, .36571, .55289, .35768] as const;
export const dumbbellPlaceholder = [[.34608, .62708], [.43568, .81804], [.47485, .82736], [.49909, .70970], [.49843, .68294], [.42585, .80789]] as const;
