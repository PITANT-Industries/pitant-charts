import { alignTimeSeriesColumns, DataSource, TimeSeriesSampleKind } from '@pitant/charts'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ColumnarChartData } from '../chart-runtime.js'
import { useColumnarViewport } from '../chart-runtime.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const base = Date.UTC(2026, 10, 28, 12)
const { Observed, ExplicitGap, AlignmentHole } = TimeSeriesSampleKind
const timestamps = (...offsets: number[]) => Float64Array.from(offsets, (offset) => base + offset)

describe('useColumnarViewport data coordinates', () => {
  it('keeps sparse masks and quality through window selection and append', () => {
    const load = vi.spyOn(DataSource.prototype, 'load')
    const data = alignTimeSeriesColumns([
      {
        key: 'temperature',
        timestamps: timestamps(0, 2, 4),
        values: [20, null, 22],
        quality: new Uint8Array([0, 2, 4]),
      },
      { key: 'pressure', timestamps: timestamps(1, 3), values: [100, 103] },
    ])
    const { result, rerender } = renderHook(
      ({ range }) =>
        useColumnarViewport({ data, fields: ['temperature', 'pressure'], targetPixels: 1, range }),
      { initialProps: { range: [base + 1, base + 4] as const } },
    )

    expect(result.current.data.timestamps).toEqual(timestamps(1, 2, 3, 4))
    expect(result.current.data.sampleKinds?.['temperature']).toEqual(
      new Uint8Array([AlignmentHole, ExplicitGap, AlignmentHole, Observed]),
    )
    expect(result.current.data.quality?.['temperature']).toEqual(new Uint8Array([12, 2, 12, 4]))
    expect(result.current.lodLevel).toBe(0)
    expect(load).not.toHaveBeenCalled()

    act(() => {
      result.current.appendData(
        alignTimeSeriesColumns([
          {
            key: 'temperature',
            timestamps: timestamps(5),
            values: [25],
            quality: new Uint8Array([5]),
          },
          { key: 'pressure', timestamps: timestamps(6), values: [106] },
        ]),
      )
    })
    rerender({ range: [base + 4, base + 6] })
    expect(result.current.data.timestamps).toEqual(timestamps(4, 5, 6))
    expect(result.current.data.columns['temperature']).toEqual(new Float64Array([22, 25, NaN]))
    expect(result.current.data.sampleKinds?.['temperature']).toEqual(
      new Uint8Array([Observed, Observed, AlignmentHole]),
    )
    expect(result.current.data.quality?.['temperature']).toEqual(new Uint8Array([4, 5, 12]))
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps each independent X array aligned with its values and metadata', () => {
    const load = vi.spyOn(DataSource.prototype, 'load')
    const data: ColumnarChartData = {
      timestamps: timestamps(0, 1, 2, 3, 5),
      seriesTimestamps: { temp: timestamps(0, 2, 5), pressure: timestamps(1, 3) },
      columns: { temp: new Float64Array([20, 22, 25]), pressure: new Float64Array([101, 103]) },
      quality: { temp: new Uint8Array([0, 2, 5]) },
    }
    const { result, rerender } = renderHook(
      ({ range }) =>
        useColumnarViewport({ data, fields: ['temp', 'pressure'], targetPixels: 1, range }),
      { initialProps: { range: [base + 2, base + 5] as const } },
    )

    expect(result.current.data.seriesTimestamps?.['temp']).toEqual(timestamps(2, 5))
    expect(result.current.data.columns['temp']).toEqual(new Float64Array([22, 25]))
    expect(result.current.data.quality?.['temp']).toEqual(new Uint8Array([2, 5]))
    expect(result.current.data.seriesTimestamps?.['pressure']).toEqual(timestamps(3))
    expect(result.current.data.columns['pressure']).toEqual(new Float64Array([103]))

    act(() => {
      result.current.appendData({
        timestamps: timestamps(7, 8),
        seriesTimestamps: { temp: timestamps(7, 8) },
        columns: { temp: new Float64Array([27, 28]) },
        quality: { temp: new Uint8Array([7, 8]) },
      })
    })
    rerender({ range: [base + 3, base + 8] })
    expect(result.current.data.seriesTimestamps?.['temp']).toEqual(timestamps(5, 7, 8))
    expect(result.current.data.columns['temp']).toEqual(new Float64Array([25, 27, 28]))
    expect(result.current.data.quality?.['temp']).toEqual(new Uint8Array([5, 7, 8]))
    expect(result.current.rawData.seriesTimestamps?.['pressure']).toEqual(timestamps(1, 3))
    expect(result.current.rawData.columns['pressure']).toEqual(new Float64Array([101, 103]))
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps the dense DataSource path and carries quality to and from it', async () => {
    const load = vi.spyOn(DataSource.prototype, 'load')
    const data: ColumnarChartData = {
      timestamps: timestamps(0, 1, 2),
      columns: { signal: new Float64Array([1, 2, 3]) },
      quality: { signal: new Uint8Array([0, 2, 3]) },
    }
    const { result } = renderHook(() =>
      useColumnarViewport({
        data,
        fields: ['signal'],
        targetPixels: 1_200,
        range: [base + 1, base + 2],
      }),
    )
    await waitFor(() => expect(result.current.data.timestamps).toEqual(timestamps(1, 2)))
    expect(result.current.data.columns['signal']).toEqual(new Float64Array([2, 3]))
    expect(result.current.data.quality?.['signal']).toEqual(new Uint8Array([2, 3]))
    expect(load).toHaveBeenCalledTimes(1)
  })
})
