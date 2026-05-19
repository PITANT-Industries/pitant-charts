import { describe, expect, it } from 'vitest'

import { addTimeSeriesDerivedColumns } from '../index.js'

describe('time-series derived columns', () => {
  it('computes scale, delta, rate, and moving-average columns in one pass per series', () => {
    const result = addTimeSeriesDerivedColumns(
      {
        timestamps: new Float64Array([0, 1000, 2000, 4000]),
        columns: {
          temp: new Float64Array([10, 15, 18, 30]),
        },
        quality: {
          temp: new Uint8Array([0, 1, 0, 2]),
        },
      },
      [
        { kind: 'scale-offset', sourceField: 'temp', field: 'temp_f', scale: 1.8, offset: 32 },
        { kind: 'delta', sourceField: 'temp', field: 'temp_delta' },
        { kind: 'rate-of-change', sourceField: 'temp', field: 'temp_rate', per: 1000 },
        {
          kind: 'moving-average',
          sourceField: 'temp',
          field: 'temp_ma',
          windowSize: 3,
          minimumSamples: 2,
        },
      ],
    )

    expect(Array.from(result.columns['temp_f'] ?? [])).toEqual([50, 59, 64.4, 86])
    expect(result.columns['temp_delta']?.[0]).toBeNaN()
    expect(Array.from(result.columns['temp_delta']?.subarray(1) ?? [])).toEqual([5, 3, 12])
    expect(result.columns['temp_rate']?.[0]).toBeNaN()
    expect(Array.from(result.columns['temp_rate']?.subarray(1) ?? [])).toEqual([5, 3, 6])
    expect(result.columns['temp_ma']?.[0]).toBeNaN()
    expect(result.columns['temp_ma']?.[1]).toBeCloseTo(12.5)
    expect(result.columns['temp_ma']?.[2]).toBeCloseTo(14.333333)
    expect(result.columns['temp_ma']?.[3]).toBeCloseTo(21)
    expect(Array.from(result.quality?.['temp_rate'] ?? [])).toEqual([6, 1, 6, 2])
  })

  it('preserves append continuity for boundary-dependent derived columns', () => {
    const previousData = {
      timestamps: new Float64Array([0, 1000]),
      columns: {
        temp: new Float64Array([10, 14]),
      },
    }

    const result = addTimeSeriesDerivedColumns(
      {
        timestamps: new Float64Array([2000, 3000]),
        columns: {
          temp: new Float64Array([17, 23]),
        },
      },
      [
        { kind: 'delta', sourceField: 'temp', field: 'temp_delta' },
        { kind: 'rate-of-change', sourceField: 'temp', field: 'temp_rate', per: 1000 },
        {
          kind: 'moving-average',
          sourceField: 'temp',
          field: 'temp_ma',
          windowSize: 3,
          minimumSamples: 3,
        },
      ],
      { previousData },
    )

    expect(Array.from(result.columns['temp_delta'] ?? [])).toEqual([3, 6])
    expect(Array.from(result.columns['temp_rate'] ?? [])).toEqual([3, 6])
    expect(result.columns['temp_ma']?.[0]).toBeCloseTo(13.666667)
    expect(result.columns['temp_ma']?.[1]).toBeCloseTo(18)
  })

  it('keeps missing sources as NaN derived columns with calculated quality', () => {
    const result = addTimeSeriesDerivedColumns(
      {
        timestamps: new Float64Array([0, 1, 2]),
        columns: {
          temp: new Float64Array([1, 2, 3]),
        },
      },
      [{ kind: 'moving-average', sourceField: 'missing', field: 'missing_ma' }],
    )

    expect(Array.from(result.columns['missing_ma'] ?? [])).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ])
    expect(Array.from(result.quality?.['missing_ma'] ?? [])).toEqual([6, 6, 6])
  })
})
