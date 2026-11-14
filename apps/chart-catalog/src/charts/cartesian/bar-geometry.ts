import type { ChartSeries } from "../../types";

export const finiteBarValue = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const ordinaryNumber = new Intl.NumberFormat("en", { maximumSignificantDigits: 15 });
const scientificNumber = new Intl.NumberFormat("en", { notation: "scientific", maximumSignificantDigits: 15 });

export function formatBarValue(value: number) {
  const absolute = Math.abs(value);
  return (absolute !== 0 && (absolute < .001 || absolute >= 1e21) ? scientificNumber : ordinaryNumber).format(value);
}

/** Keep aggregate labels useful even when their mathematical sum exceeds a double. */
export function formatBarQuantity(unit: number, magnitude: number) {
  if (unit === 0) return "0";
  const value = unit * magnitude;
  if (magnitude >= 2.2250738585072014e-308 && Number.isFinite(value) && value !== 0) return formatBarValue(value);
  const power = Math.log10(Math.abs(unit)) + Math.log10(magnitude);
  const exponent = Math.floor(power);
  const coefficient = Number((Math.sign(unit) * 10 ** (power - exponent)).toPrecision(12));
  return `${ordinaryNumber.format(coefficient)}E${exponent}`;
}

export function formatBarTotal(values: readonly (number | null)[]) {
  let magnitude = 0;
  for (const value of values) if (finiteBarValue(value)) magnitude = Math.max(magnitude, Math.abs(value));
  if (magnitude === 0) return "0";
  const total = values.reduce<number>((sum, value) => sum + (finiteBarValue(value) ? value / magnitude : 0), 0);
  return formatBarQuantity(total, magnitude);
}

/** Normalize before subtraction and stacking, including subnormal and ±MAX_VALUE inputs. */
export function barValueDomain(series: readonly ChartSeries[], count: number, stacked: boolean,
  fixture?: readonly [minimum: number, maximum: number, increment: number]) {
  let magnitude = fixture ? 1 : 0;
  if (!fixture) for (const item of series) for (let i = 0; i < count; i++) {
    const value = item.values[i];
    if (finiteBarValue(value)) magnitude = Math.max(magnitude, Math.abs(value));
  }
  if (!magnitude) magnitude = 1;
  const units = series.map(item => Array.from({ length: count }, (_, i) => {
    const value = item.values[i];
    return finiteBarValue(value) ? value / magnitude : null;
  }));
  let minimum = 0;
  let maximum = 0;
  for (let category = 0; category < count; category++) {
    let positive = 0;
    let negative = 0;
    for (const values of units) {
      const value = values[category];
      if (value === null) continue;
      if (stacked) {
        if (value < 0) negative += value;
        else positive += value;
      } else {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }
    if (stacked) {
      minimum = Math.min(minimum, negative);
      maximum = Math.max(maximum, positive);
    }
  }
  if (fixture) [minimum, maximum] = fixture;
  else {
    if (maximum > 0) maximum *= 1.12;
    if (minimum < 0) minimum *= 1.12;
    if (maximum === minimum) maximum = minimum + 1;
  }
  const ticks = fixture
    ? Array.from({ length: Math.floor((fixture[1] - fixture[0]) / fixture[2]) + 1 }, (_, i) => fixture[0] + i * fixture[2])
    : Array.from({ length: 5 }, (_, i) => minimum + (maximum - minimum) * i / 4);
  return { minimum, maximum, magnitude, units, ticks };
}

const rounded = (value: number) => Number(value.toFixed(2));

/** Stacked segments have rounded outer ends and square inner ends. */
export function roundedBarPath(x: number, y: number, width: number, height: number, negative: boolean) {
  const left = rounded(x);
  const top = rounded(y);
  const right = rounded(x + width);
  const bottom = rounded(y + height);
  const radius = rounded(Math.min(8, width / 2, height));
  const upper = negative ? 0 : radius;
  const lower = negative ? radius : 0;
  return `M${rounded(left + upper)},${top}H${rounded(right - upper)}A${upper},${upper} 0 0 1 ${right},${rounded(top + upper)}` +
    `V${rounded(bottom - lower)}A${lower},${lower} 0 0 1 ${rounded(right - lower)},${bottom}` +
    `H${rounded(left + lower)}A${lower},${lower} 0 0 1 ${left},${rounded(bottom - lower)}` +
    `V${rounded(top + upper)}A${upper},${upper} 0 0 1 ${rounded(left + upper)},${top}Z`;
}
