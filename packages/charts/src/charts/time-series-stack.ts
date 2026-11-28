import type { TimeSeriesDataSet, TimeSeriesSeries, TimeSeriesStackOptions } from './time-series.js'

export interface StackedTimeSeriesColumn {
  values: Float64Array
  lower: Float64Array
}

interface StackInput {
  series: TimeSeriesSeries
  values: Float64Array
  timestamps: Float64Array
}

export function sameTimeSeriesTimestamps(a: Float64Array, b: Float64Array): boolean {
  return a === b || (a.length === b.length && a.every((value, index) => value === b[index]))
}

export function stackTimeSeriesColumns(
  data: TimeSeriesDataSet,
  options: TimeSeriesStackOptions,
  primaryAxisKey: string,
  includeHidden: boolean | undefined,
  warnings: string[],
): ReadonlyMap<string, StackedTimeSeriesColumn> {
  const seriesByKey = new Map(data.series.map((series) => [series.key, series]))
  const stacked = new Map<string, StackedTimeSeriesColumn>()
  for (const [groupIndex, group] of options.groups.entries()) {
    const inputs: StackInput[] = []
    const keys = new Set<string>()
    let invalidReason: string | undefined
    for (const key of group.series) {
      const series = seriesByKey.get(key)
      const values = series && data.columns[series.field]
      if (!series || !values || keys.has(key) || stacked.has(key)) {
        invalidReason = `series "${key}" is missing or used more than once`
        break
      }
      keys.add(key)
      if (!includeHidden && series.visible === false) continue
      const timestamps = data.seriesTimestamps?.[series.field] ?? data.timestamps
      const first = inputs[0]
      if (
        timestamps.length !== values.length ||
        (first && !sameTimeSeriesTimestamps(first.timestamps, timestamps))
      ) {
        invalidReason = 'its series do not have matching timestamps'
        break
      }
      if (
        first &&
        (first.series.yAxisKey ?? primaryAxisKey) !== (series.yAxisKey ?? primaryAxisKey)
      ) {
        invalidReason = 'its series use different Y axes'
        break
      }
      inputs.push({ series, values, timestamps })
    }
    if (invalidReason) {
      warnings.push(`Stack group ${groupIndex + 1} was ignored because ${invalidReason}.`)
      continue
    }
    stackGroup(inputs, group.mode !== 'cumulative', options.percent === true, stacked)
  }
  return stacked
}

function stackGroup(
  inputs: readonly StackInput[],
  separateSigns: boolean,
  percent: boolean,
  output: Map<string, StackedTimeSeriesColumn>,
): void {
  const count = inputs[0]?.values.length ?? 0
  if (count === 0) return
  const positive = new Float64Array(count)
  const negative = separateSigns ? new Float64Array(count) : positive
  const totalMagnitude = percent && !separateSigns ? new Float64Array(count) : undefined
  const columns = inputs.map(({ values: raw, series }) => {
    const values = new Float64Array(count)
    const lower = new Float64Array(count)
    for (let index = 0; index < count; index++) {
      const value = raw[index] as number
      if (!Number.isFinite(value)) {
        values[index] = Number.NaN
        lower[index] = Number.NaN
        continue
      }
      const accum = value < 0 ? negative : positive
      const base = accum[index] as number
      lower[index] = base
      values[index] = base + value
      accum[index] = base + value
      if (totalMagnitude)
        totalMagnitude[index] = (totalMagnitude[index] as number) + Math.abs(value)
    }
    const column = { values, lower }
    output.set(series.key, column)
    return column
  })

  if (!percent) return
  for (const [columnIndex, { values, lower }] of columns.entries()) {
    const raw = inputs[columnIndex]?.values
    if (!raw) continue
    for (let index = 0; index < count; index++) {
      if (!Number.isFinite(raw[index])) continue
      const sums = totalMagnitude ?? ((raw[index] as number) < 0 ? negative : positive)
      const total = Math.abs(sums[index] as number)
      values[index] = total === 0 ? 0 : (values[index] as number) / total
      lower[index] = total === 0 ? 0 : (lower[index] as number) / total
    }
  }
}
