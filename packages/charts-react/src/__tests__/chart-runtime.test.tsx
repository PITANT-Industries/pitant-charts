import type { ChartFramePlugin, RenderContext } from '@pitant/charts'
import * as charts from '@pitant/charts'
import { alignTimeSeriesColumns, DataSource, TimeSeriesSampleKind } from '@pitant/charts'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { ColumnarChartData, UseRendererOptions } from '../chart-runtime.js'
import { useColumnarViewport, useRenderer } from '../chart-runtime.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const base = Date.UTC(2026, 10, 28, 12)
const { Observed, ExplicitGap, AlignmentHole } = TimeSeriesSampleKind
const timestamps = (...offsets: number[]) => Float64Array.from(offsets, (offset) => base + offset)

function chartContainerRef(): { current: ChartContainerRef } {
  return {
    current: {
      canvas: document.createElement('canvas'),
      dimensions: { width: 1, height: 1, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  }
}

describe('useRenderer plugin lifecycle', () => {
  it('mounts before drawing, retains shared plugins, and cleans up before context disposal', async () => {
    const events: string[] = []
    const contextFirst = {
      dispose: () => {
        events.push('first:dispose')
      },
    } as RenderContext
    const contextSecond = {
      dispose: () => {
        events.push('second:dispose')
      },
    } as RenderContext
    const create = vi
      .spyOn(charts, 'createRenderContext')
      .mockResolvedValueOnce(contextFirst)
      .mockResolvedValueOnce(contextSecond)
    const first: ChartFramePlugin<unknown> = {
      mount: () => {
        events.push('plugin:mount')
        return () => events.push('plugin:cleanup')
      },
    }
    const second: ChartFramePlugin<unknown> = {
      mount: () => {
        events.push('other:mount')
        return () => events.push('other:cleanup')
      },
    }
    const containerRef = chartContainerRef()
    const { result, rerender, unmount } = renderHook(
      (options: UseRendererOptions) => {
        const state = useRenderer(options)
        useEffect(() => {
          if (state.ready) events.push('draw')
        }, [state.ready])
        return state
      },
      { initialProps: { containerRef, renderer: 'auto', plugins: [first] } },
    )

    await waitFor(() => expect(result.current.context).toBe(contextFirst))
    expect(events).toEqual(['plugin:mount', 'draw'])

    rerender({ containerRef, renderer: 'auto', plugins: [first, second] })
    rerender({ containerRef, renderer: 'auto', plugins: [second] })
    expect(create).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['plugin:mount', 'draw', 'other:mount', 'plugin:cleanup'])

    rerender({ containerRef, renderer: 'canvas2d', plugins: [second] })
    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.context).toBe(contextSecond))
    expect(events.slice(-4)).toEqual(['other:cleanup', 'first:dispose', 'other:mount', 'draw'])

    unmount()
    expect(events.slice(-2)).toEqual(['other:cleanup', 'second:dispose'])
  })

  it('disposes an asynchronous renderer that finishes after unmount', async () => {
    const dispose = vi.fn()
    const mount = vi.fn()
    let resolveContext!: (value: RenderContext) => void
    const deferred = new Promise<RenderContext>((resolve) => {
      resolveContext = resolve
    })
    const create = vi.spyOn(charts, 'createRenderContext').mockReturnValueOnce(deferred)

    const containerRef = chartContainerRef()
    const { unmount } = renderHook(() => useRenderer({ containerRef, plugins: [{ mount }] }))
    unmount()
    expect(create.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    resolveContext({ dispose } as unknown as RenderContext)
    await waitFor(() => expect(dispose).toHaveBeenCalledOnce())
    expect(mount).not.toHaveBeenCalled()
  })
})

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
