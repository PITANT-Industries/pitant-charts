import { describe, expect, it } from 'vitest'
import {
  alignTimeSeriesColumns,
  type IndependentTimeSeriesColumn,
  TimeSeriesSampleKind,
} from '../index.js'

const { AlignmentHole, ExplicitGap, Observed } = TimeSeriesSampleKind
const base = Date.UTC(2026, 10, 28, 12)

function times(...offsets: number[]): Float64Array {
  return Float64Array.from(offsets, (offset) => base + offset)
}

describe('alignTimeSeriesColumns', () => {
  it('merges epoch grids and keeps every reading and quality flag on its original X', () => {
    const timestamps = times(0, 0.25, 4)
    const values = new Float64Array([20.2, 20.3, 21])
    const quality = new Uint8Array([0, 1, 3])
    const result = alignTimeSeriesColumns([
      { key: 'temperature', timestamps, values, quality },
      { key: 'pressure', timestamps: times(0.25, 2, 5), values: [1_000, 1_002, 1_003] },
      { key: 'sample', timestamps: times(0, 2, 8), values: [0, null, 9] },
    ])

    expect(result.timestamps).toEqual(times(0, 0.25, 2, 4, 5, 8))
    expect(result.columns['temperature']).toEqual(new Float64Array([20.2, 20.3, NaN, 21, NaN, NaN]))
    expect(result.columns['pressure']).toEqual(
      new Float64Array([NaN, 1_000, 1_002, NaN, 1_003, NaN]),
    )
    expect(result.columns['sample']).toEqual(new Float64Array([0, NaN, NaN, NaN, NaN, 9]))
    expect(result.sampleKinds['sample']).toEqual(
      new Uint8Array([
        Observed,
        AlignmentHole,
        ExplicitGap,
        AlignmentHole,
        AlignmentHole,
        Observed,
      ]),
    )
    expect(result.quality?.['temperature']).toEqual(new Uint8Array([0, 1, 12, 3, 12, 12]))
    expect(result.quality?.['pressure']).toBeUndefined()
    expect(timestamps).toEqual(times(0, 0.25, 4))
    expect(values).toEqual(new Float64Array([20.2, 20.3, 21]))
    expect(quality).toEqual(new Uint8Array([0, 1, 3]))
  })

  it('preserves, bridges or expands explicit gaps independently by series', () => {
    const timestamps = times(0, 1, 3, 5, 7)
    const values = [10, undefined, null, 15, 17]
    const result = alignTimeSeriesColumns([
      { key: 'preserve', timestamps, values },
      { key: 'bridge', timestamps, values, gapPolicy: 'bridge' },
      { key: 'expand', timestamps, values, gapPolicy: 'expand' },
      { key: 'reference', timestamps: times(2, 4, 6), values: [12, 14, 16] },
    ])

    expect(result.sampleKinds['preserve']).toEqual(
      new Uint8Array([
        Observed,
        AlignmentHole,
        AlignmentHole,
        ExplicitGap,
        AlignmentHole,
        Observed,
        AlignmentHole,
        Observed,
      ]),
    )
    expect(result.sampleKinds['bridge']).toEqual(
      new Uint8Array([
        Observed,
        AlignmentHole,
        AlignmentHole,
        AlignmentHole,
        AlignmentHole,
        Observed,
        AlignmentHole,
        Observed,
      ]),
    )
    expect(result.sampleKinds['expand']).toEqual(
      new Uint8Array([
        Observed,
        ExplicitGap,
        ExplicitGap,
        ExplicitGap,
        ExplicitGap,
        Observed,
        AlignmentHole,
        Observed,
      ]),
    )
  })

  it('handles empty grids and copies a shared grid', () => {
    expect(alignTimeSeriesColumns([])).toEqual({
      timestamps: new Float64Array(),
      columns: {},
      sampleKinds: {},
    })

    const timestamps = times(1, 3)
    const result = alignTimeSeriesColumns([
      { key: 'a', timestamps, values: [Number.NaN, Number.POSITIVE_INFINITY] },
      { key: 'b', timestamps, values: [9, 3] },
      { key: 'empty', timestamps: new Float64Array(), values: [] },
    ])
    expect(result.timestamps).toEqual(timestamps)
    expect(result.timestamps).not.toBe(timestamps)
    expect(result.sampleKinds['a']).toEqual(new Uint8Array([ExplicitGap, ExplicitGap]))
    expect(result.sampleKinds['empty']).toEqual(new Uint8Array([AlignmentHole, AlignmentHole]))
  })

  it('rejects invalid grids, mismatched lengths and duplicate keys', () => {
    for (const timestamps of [times(1, 0), times(0, 0), new Float64Array([0, Number.NaN])]) {
      expect(() => alignTimeSeriesColumns([{ key: 'series', timestamps, values: [1, 2] }])).toThrow(
        'finite and strictly increasing',
      )
    }
    const column: IndependentTimeSeriesColumn = { key: 'series', timestamps: times(0), values: [1] }
    expect(() => alignTimeSeriesColumns([{ ...column, values: [] }])).toThrow('one value')
    expect(() => alignTimeSeriesColumns([{ ...column, quality: new Uint8Array() }])).toThrow(
      'quality flag',
    )
    expect(() => alignTimeSeriesColumns([column, column])).toThrow('unique')
  })
})
