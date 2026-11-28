/** Scale coordinates are normalized to a unit interval before the viewport matrix is applied. */
export interface AxisProjection {
  toRatio(value: number): number
  fromRatio(ratio: number): number
}

export type ChartScale = (
  | { type: 'linear' }
  | { type: 'log'; base?: number }
  | { type: 'asinh'; threshold?: number }
  | { type: 'ordinal'; values: readonly number[] }
  | { type: 'custom'; forward: (value: number) => number; inverse: (value: number) => number }
) & { reverse?: boolean }

export interface CalendarAxisOptions {
  /** IANA timezone identifier. */
  timeZone: string
  /** Locale used for default axis labels. */
  locale?: string
}

interface ValueMapping {
  forward(value: number): number
  inverse(value: number): number
}

function ordinalMapping(values: readonly number[]): ValueMapping {
  if (
    values.length < 2 ||
    values.some(
      (value, i) => !Number.isFinite(value) || (i > 0 && value <= (values[i - 1] as number)),
    )
  ) {
    throw new RangeError('An ordinal scale needs two or more distinct ascending numeric positions.')
  }
  return {
    forward(value) {
      let lo = 0
      let hi = values.length - 1
      while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1
        if ((values[mid] as number) > value) hi = mid
        else lo = mid
      }
      const start = values[lo] as number
      return lo + (value - start) / ((values[lo + 1] as number) - start)
    },
    inverse(index) {
      const first = Math.max(0, Math.min(values.length - 2, Math.floor(index)))
      const start = values[first] as number
      return start + ((values[first + 1] as number) - start) * (index - first)
    },
  }
}

function valueMapping(scale: ChartScale): ValueMapping {
  switch (scale.type) {
    case 'custom':
      return scale
    case 'linear':
      return { forward: (value) => value, inverse: (value) => value }
    case 'log': {
      const base = scale.base ?? 10
      if (!Number.isFinite(base) || base <= 1) throw new RangeError('Log scale base must exceed 1.')
      const divisor = Math.log(base)
      return { forward: (value) => Math.log(value) / divisor, inverse: (value) => base ** value }
    }
    case 'asinh': {
      const threshold = scale.threshold ?? 1
      if (!Number.isFinite(threshold) || threshold <= 0) {
        throw new RangeError('Asinh scale threshold must be positive.')
      }
      return {
        forward: (value) => Math.asinh(value / threshold),
        inverse: (value) => Math.sinh(value) * threshold,
      }
    }
    case 'ordinal':
      return ordinalMapping(scale.values)
  }
}

export function createAxisProjection(
  scale: ChartScale,
  range: readonly [number, number],
  offset = 0,
): AxisProjection {
  const { forward, inverse } = valueMapping(scale)
  const first = forward(range[0] + offset)
  const last = forward(range[1] + offset)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last === first) {
    throw new RangeError('Scale endpoints must map to distinct finite values.')
  }
  const span = last - first
  return {
    toRatio(value) {
      const ratio = (forward(value + offset) - first) / span
      return scale.reverse ? 1 - ratio : ratio
    },
    fromRatio(ratio) {
      return inverse(first + (scale.reverse ? 1 - ratio : ratio) * span) - offset
    },
  }
}

/** Visible integer powers of a log base, reduced to the approximate tick budget. */
export function logarithmicTicks(
  range: readonly [number, number],
  count: number,
  base: number,
): number[] {
  const low = Math.ceil(Math.log(range[0]) / Math.log(base) - 1e-12)
  const high = Math.floor(Math.log(range[1]) / Math.log(base) + 1e-12)
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) return []
  const step = Math.max(1, Math.ceil((high - low + 1) / Math.max(1, count)))
  const ticks: number[] = []
  for (let power = low; power <= high && ticks.length < count; power += step) {
    ticks.push(base ** power)
  }
  return ticks
}

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const SUB_MONTH_STEPS = [
  1,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
  500,
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
]

function wallTime(timestamp: number, formatter: Intl.DateTimeFormat): number {
  const date = new Date(0)
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const part of formatter.formatToParts(timestamp)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  date.setUTCFullYear(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1)
  date.setUTCHours(
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    ((timestamp % SECOND) + SECOND) % SECOND,
  )
  return date.getTime()
}

function offsetAt(timestamp: number, formatter: Intl.DateTimeFormat): number {
  return wallTime(timestamp, formatter) - timestamp
}

/** Generate calendar-aligned ticks on dated millisecond input, including both sides of a DST fold. */
export function calendarTicks(
  range: readonly [number, number],
  count: number,
  options: CalendarAxisOptions,
): { values: number[]; format: (timestamp: number) => string } {
  const wallFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: options.timeZone,
    calendar: 'iso8601',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const [start, end] = range
  const span = end - start
  const budget = Math.max(1, Math.min(512, Math.round(count)))
  const desired = span / budget
  const interval = SUB_MONTH_STEPS.find((step) => step >= desired)
  const monthStep = interval
    ? 0
    : ([1, 2, 3, 6, 12].find((months) => months * 30 * DAY >= desired) ??
      Math.max(12, Math.ceil(desired / (365 * DAY)) * 12))
  const around = [start - 2 * DAY, start, end, end + 2 * DAY]
  const offsets = [...new Set(around.map((time) => offsetAt(time, wallFormatter)))]
  const firstWall = start + Math.min(...offsets)
  const lastWall = end + Math.max(...offsets)
  const calendar = new Date(firstWall)
  if (monthStep) {
    const month = calendar.getUTCFullYear() * 12 + calendar.getUTCMonth()
    const aligned = Math.ceil(month / monthStep) * monthStep
    calendar.setUTCFullYear(Math.floor(aligned / 12), aligned % 12, 1)
    calendar.setUTCHours(0, 0, 0, 0)
    if (calendar.getTime() < firstWall) calendar.setUTCMonth(calendar.getUTCMonth() + monthStep)
  }
  const fixedStep = interval ?? DAY
  const weekAnchor = fixedStep >= 7 * DAY ? 4 * DAY : 0
  let wall = monthStep
    ? calendar.getTime()
    : Math.ceil((firstWall - weekAnchor) / fixedStep) * fixedStep + weekAnchor
  const values = new Set<number>()
  for (let i = 0; i < 2048 && wall <= lastWall; i++) {
    const localOffsets = new Set([
      ...offsets,
      offsetAt(wall - 2 * DAY, wallFormatter),
      offsetAt(wall + 2 * DAY, wallFormatter),
    ])
    for (const offset of localOffsets) {
      const candidate = wall - offset
      if (candidate >= start && candidate <= end && wallTime(candidate, wallFormatter) === wall) {
        values.add(candidate)
      }
    }
    if (monthStep) {
      calendar.setUTCMonth(calendar.getUTCMonth() + monthStep)
      wall = calendar.getTime()
    } else {
      wall += fixedStep
    }
  }
  const formatting: Intl.DateTimeFormatOptions = monthStep
    ? { year: 'numeric', month: 'short' }
    : fixedStep >= DAY
      ? { month: 'short', day: 'numeric' }
      : {
          hour: '2-digit',
          minute: '2-digit',
          ...(fixedStep < MINUTE ? { second: '2-digit' } : {}),
          ...(fixedStep < SECOND ? { fractionalSecondDigits: 3 } : {}),
          ...(offsets.length > 1 ? { timeZoneName: 'shortOffset' } : {}),
          hourCycle: 'h23',
        }
  const format = new Intl.DateTimeFormat(options.locale, {
    ...formatting,
    timeZone: options.timeZone,
  })
  return { values: [...values].sort((a, b) => a - b), format: format.format }
}
