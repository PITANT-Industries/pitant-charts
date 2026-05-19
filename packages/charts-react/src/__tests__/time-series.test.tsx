import { type ChartPointerCoordinates, DataSource } from '@pitant/charts'
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import { ChartSyncGroup } from '../chart-sync-group.js'
import type { TimeSeriesColumnData, TimeSeriesConfig } from '../time-series.js'
import { TimeSeries, useTimeSeries } from '../time-series.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const DATA: TimeSeriesColumnData = {
  timestamps: new Float64Array([1000, 1010, 1020]),
  columns: {
    temp: new Float64Array([10, 12, 11]),
    pressure: new Float64Array([1, 2, 3]),
  },
}

const CONFIG: TimeSeriesConfig = {
  series: [
    { key: 'temp', label: 'Temperature', field: 'temp', color: 'red', rgba: [1, 0, 0, 1] },
    { key: 'pressure', label: 'Pressure', field: 'pressure' },
  ],
  xAxis: {
    gapThreshold: 25,
  },
}

function makeLargeData(pointCount: number): TimeSeriesColumnData {
  const timestamps = new Float64Array(pointCount)
  const temp = new Float64Array(pointCount)
  for (let i = 0; i < pointCount; i++) {
    timestamps[i] = i
    temp[i] = Math.sin(i / 10)
  }
  return { timestamps, columns: { temp } }
}

function withTimestampOffset(data: TimeSeriesColumnData, offset: number): TimeSeriesColumnData {
  const timestamps = new Float64Array(data.timestamps.length)
  for (let i = 0; i < data.timestamps.length; i++) {
    timestamps[i] = (data.timestamps[i] ?? 0) + offset
  }
  return { timestamps, columns: data.columns }
}

function fakeContainerRef(width: number): RefObject<ChartContainerRef | null> {
  return {
    current: {
      canvas: null,
      dimensions: { width, height: 100, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  }
}

function pointerAt(dataX: number): ChartPointerCoordinates {
  return {
    clientX: 0,
    clientY: 0,
    chartX: 120,
    chartY: 80,
    plotX: 50,
    plotY: 20,
    plotRatioX: 0.5,
    plotRatioY: 0.5,
    dataX,
    dataY: 12,
    relativeDataX: dataX,
    insideBounds: true,
    insidePlot: true,
  }
}

function chartRect(width = 800, height = 420): DOMRect {
  return {
    bottom: 20 + height,
    height,
    left: 10,
    right: 10 + width,
    top: 20,
    width,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  } as DOMRect
}

function fireWheelAt(
  layer: HTMLElement,
  options: {
    clientX: number
    clientY: number
    deltaY: number
    deltaMode?: number
    deltaX?: number
    shiftKey?: boolean
  },
) {
  const event = createEvent.wheel(layer, {
    cancelable: true,
    deltaX: options.deltaX ?? 0,
    deltaMode: options.deltaMode ?? 0,
    deltaY: options.deltaY,
    shiftKey: options.shiftKey ?? false,
  })
  Object.defineProperty(event, 'clientX', { value: options.clientX })
  Object.defineProperty(event, 'clientY', { value: options.clientY })
  fireEvent(layer, event)
}

function parseRange(testId: string): readonly [number, number] {
  const value = JSON.parse(screen.getByTestId(testId).textContent ?? '[0,0]')
  return [Number(value[0]), Number(value[1])]
}

function parsePlotArea(): { x: number; y: number; width: number; height: number } {
  const value = JSON.parse(screen.getByTestId('plot-area').textContent ?? '{}')
  return {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height),
  }
}

function SyncedTimeSeriesHarness() {
  const leftRef = useRef<ChartContainerRef | null>(null)
  const rightRef = useRef<ChartContainerRef | null>(null)
  const left = useTimeSeries({
    chartKey: 'left',
    config: CONFIG,
    data: DATA,
    containerRef: leftRef,
  })
  const right = useTimeSeries({
    chartKey: 'right',
    config: CONFIG,
    data: DATA,
    containerRef: rightRef,
  })

  return (
    <>
      <button type="button" onClick={() => left.setVisibleRange([1010, 1020])}>
        sync range
      </button>
      <button type="button" onClick={() => left.handleHoverChange(pointerAt(1012))}>
        sync cursor
      </button>
      <span data-testid="right-range">{JSON.stringify(right.visibleRange)}</span>
      <span data-testid="right-cursor">{String(right.tooltipPayload?.timestamp ?? null)}</span>
      <span data-testid="right-synced-cursor">{String(right.syncedCursorX !== null)}</span>
    </>
  )
}

describe('useTimeSeries', () => {
  it('builds a render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.legendItems).toHaveLength(2)
    expect(result.current.legendItems[0]?.color).toBe('red')
    expect(result.current.renderPlan.kind).toBe('time-series')
    expect(result.current.renderPlan.series).toHaveLength(2)
    expect(result.current.renderPlan.xRelativeRange).toEqual([0, 20])
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
    expect(result.current.layout.legendArea).not.toBeNull()
  })

  it('passes value and envelope bands into the core render plan', () => {
    const data: TimeSeriesColumnData = {
      timestamps: new Float64Array([1000, 1010, 1020]),
      columns: {
        temp: new Float64Array([10, 12, 11]),
        low: new Float64Array([8, 9, 9]),
        high: new Float64Array([14, 15, 14]),
      },
    }
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      bands: [
        {
          kind: 'value-band',
          key: 'alarm',
          yStart: 13,
          yEnd: 16,
          fillRgba: [1, 0, 0, 0.12],
        },
        {
          kind: 'envelope',
          key: 'model',
          lowerField: 'low',
          upperField: 'high',
          fillRgba: [0, 0.4, 1, 0.1],
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data, containerRef })
    })

    expect(result.current.renderPlan.bands.map((band) => band.key)).toEqual(['alarm', 'model'])
    expect(result.current.renderPlan.bands[1]?.segments[0]?.upper).toEqual(
      new Float32Array([0, 14, 10, 15, 20, 14]),
    )
  })

  it('expands derived series into legend, render plan, and tooltip metadata', () => {
    const data: TimeSeriesColumnData = {
      timestamps: new Float64Array([1000, 1010, 1020]),
      columns: {
        temp: new Float64Array([10, 14, 16]),
      },
      quality: {
        temp: new Uint8Array([0, 0, 0]),
      },
    }
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      derivedSeries: [
        {
          key: 'temp_ma',
          label: 'Temperature MA',
          kind: 'moving-average',
          sourceField: 'temp',
          windowSize: 2,
          minimumSamples: 1,
          rgba: [0, 0.5, 1, 1],
        },
        {
          key: 'temp_rate',
          label: 'Temperature rate',
          kind: 'rate-of-change',
          sourceField: 'temp',
          per: 10,
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data, containerRef })
    })

    expect(result.current.legendItems.map((item) => item.key)).toEqual([
      'temp',
      'temp_ma',
      'temp_rate',
    ])
    expect(result.current.renderPlan.series.map((series) => series.key)).toEqual([
      'temp',
      'temp_ma',
      'temp_rate',
    ])
    expect(result.current.renderPlan.series[1]?.segments[0]?.buffer).toEqual(
      new Float32Array([0, 10, 10, 12, 20, 15]),
    )

    act(() => {
      result.current.handleHoverChange(pointerAt(1020))
    })

    expect(result.current.tooltipPayload?.series[1]).toMatchObject({
      key: 'temp_ma',
      value: 15,
      quality: 6,
      qualityLabel: 'calculated',
    })
  })

  it('keeps derived append values continuous at live data boundaries', () => {
    const data: TimeSeriesColumnData = {
      timestamps: new Float64Array([1000, 1010]),
      columns: {
        temp: new Float64Array([10, 14]),
      },
    }
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      derivedSeries: [
        { key: 'temp_delta', label: 'Temperature delta', kind: 'delta', sourceField: 'temp' },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data, containerRef })
    })

    act(() => {
      result.current.append({
        timestamps: new Float64Array([1020]),
        columns: {
          temp: new Float64Array([19]),
        },
      })
    })
    act(() => {
      result.current.handleHoverChange(pointerAt(1020))
    })

    expect(result.current.tooltipPayload?.series[1]).toMatchObject({
      key: 'temp_delta',
      value: 5,
      qualityLabel: 'calculated',
    })
  })

  it('exports SVG from the vector command frame with explicit dimensions', async () => {
    const { result } = renderHook(() =>
      useTimeSeries({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(320),
      }),
    )

    const blob = await result.current.exportImage('svg', {
      width: 640,
      height: 360,
      background: '#f8fafc',
    })
    const svg = await blob.text()

    expect(blob.type).toBe('image/svg+xml')
    expect(svg).toContain('width="640"')
    expect(svg).toContain('height="360"')
    expect(svg).toContain('fill="#f8fafc"')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('data:image/png')
  })

  it('updates visible range and filters the render plan', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.setVisibleRange([1010, 1020])
    })

    expect(result.current.visibleRange).toEqual([1010, 1020])
    expect(result.current.renderPlan.xRange).toEqual([1010, 1020])
    expect(result.current.renderPlan.xRelativeRange).toEqual([0, 10])
  })

  it('append preserves missing fields as gaps', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.append({
        timestamps: new Float64Array([1030]),
        columns: {
          temp: new Float64Array([13]),
        },
      })
    })

    const pressurePlan = result.current.renderPlan.series.find(
      (series) => series.key === 'pressure',
    )
    expect(result.current.fullRange).toEqual([1000, 1030])
    expect(pressurePlan?.includedSampleCount).toBe(3)
  })

  it('append preserves provenance for tooltip lookup', () => {
    const data: TimeSeriesColumnData = {
      ...DATA,
      provenance: { temp: 'live adapter' },
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config: CONFIG, data, containerRef })
    })

    act(() => {
      result.current.append({
        timestamps: new Float64Array([1030]),
        columns: { temp: new Float64Array([13]), pressure: new Float64Array([4]) },
        provenance: { temp: ['manual correction'], pressure: ['live adapter'] },
      })
    })
    act(() => {
      result.current.handleHoverChange(pointerAt(1030))
    })

    expect(result.current.tooltipPayload?.series[0]).toMatchObject({
      key: 'temp',
      provenance: { label: 'manual correction' },
    })
  })

  it('switches to DataSource viewport results after async LOD query', async () => {
    const largeData = makeLargeData(9000)
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
    }
    const { result } = renderHook(() =>
      useTimeSeries({
        config,
        data: largeData,
        containerRef: fakeContainerRef(25),
      }),
    )

    expect(result.current.renderPlan.sourcePointCount).toBe(9000)

    await waitFor(() => {
      expect(result.current.stats.dataLoading).toBe(false)
      expect(result.current.stats.rawPointCount).toBe(9000)
      expect(result.current.stats.returnedPointCount).toBeLessThan(9000)
    })
  })

  it('appends into the existing DataSource and updates live-edge range', async () => {
    const appendSpy = vi.spyOn(DataSource.prototype, 'append')
    const largeData = makeLargeData(9000)
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
    }
    const { result } = renderHook(() =>
      useTimeSeries({
        config,
        data: largeData,
        containerRef: fakeContainerRef(25),
        streaming: { enabled: true, liveEdge: true, windowSize: 50 },
      }),
    )

    await waitFor(() => {
      expect(result.current.stats.returnedPointCount).toBeLessThan(9000)
    })

    act(() => {
      result.current.append(withTimestampOffset(makeLargeData(100), 9000))
    })

    expect(result.current.visibleRange).toEqual([9050, 9099])
    await waitFor(() => {
      expect(appendSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('builds a tooltip payload from hover coordinates', () => {
    const config: TimeSeriesConfig = {
      ...CONFIG,
      yAxis: { formatValue: (value) => `${value} C` },
    }
    const data: TimeSeriesColumnData = {
      ...DATA,
      quality: { temp: new Uint8Array([0, 1, 2]) },
      provenance: {
        temp: {
          labels: ['live adapter', 'historian backfill'],
          codes: new Uint8Array([0, 1, 0]),
        },
      },
      gaps: [{ startIndex: 1, endIndex: 1 }],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data, containerRef })
    })

    act(() => {
      result.current.handleHoverChange(pointerAt(1012))
    })

    expect(result.current.tooltipPosition).toEqual({ x: 120, y: 80 })
    expect(result.current.tooltipPayload?.timestamp).toBe(1010)
    expect(result.current.tooltipPayload?.series[0]).toMatchObject({
      key: 'temp',
      value: 12,
      formatted: '12 C',
      quality: 1,
      qualityLabel: 'uncertain',
      provenance: { label: 'historian backfill' },
      gap: true,
    })
  })

  it('syncs x-range and cursor payloads through ChartSyncGroup', async () => {
    render(
      <ChartSyncGroup>
        <SyncedTimeSeriesHarness />
      </ChartSyncGroup>,
    )

    fireEvent.click(screen.getByText('sync range'))
    await waitFor(() => {
      expect(screen.getByTestId('right-range').textContent).toBe('[1010,1020]')
    })

    fireEvent.click(screen.getByText('sync cursor'))
    await waitFor(() => {
      expect(screen.getByTestId('right-cursor').textContent).toBe('1010')
      expect(screen.getByTestId('right-synced-cursor').textContent).toBe('true')
    })
  })

  it('component renders a chart container and exposes chart state to children', () => {
    render(
      <TimeSeries ariaLabel="Process trend" config={CONFIG} data={DATA}>
        {(chart) => <span data-testid="points">{chart.renderedPointCount}</span>}
      </TimeSeries>,
    )

    expect(screen.getByRole('img', { name: 'Process trend' })).toBeTruthy()
    expect(Number(screen.getByTestId('points').textContent)).toBeGreaterThan(0)
  })

  it('keeps wheel zoom working after live DataSource append updates the range', async () => {
    const appendSpy = vi.spyOn(DataSource.prototype, 'append')
    const largeData = makeLargeData(9000)
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
    }
    const { container } = render(
      <TimeSeries
        ariaLabel="Live trend"
        config={config}
        data={largeData}
        streaming={{ enabled: true, liveEdge: true, windowSize: 50 }}
      >
        {(chart) => (
          <>
            <button
              type="button"
              onClick={() => chart.append(withTimestampOffset(makeLargeData(100), 9000))}
            >
              append
            </button>
            <span data-testid="range">{JSON.stringify(chart.visibleRange)}</span>
            <span data-testid="returned">{chart.stats.returnedPointCount}</span>
            <span data-testid="loading">{String(chart.stats.dataLoading)}</span>
            <span data-testid="plot-area">{JSON.stringify(chart.layout.plotArea)}</span>
          </>
        )}
      </TimeSeries>,
    )
    const wrapper = screen.getByRole('img', { name: 'Live trend' }) as HTMLElement
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    const rect = chartRect()
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect)
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect)

    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(Number(screen.getByTestId('returned').textContent)).toBeLessThan(9000)
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    fireEvent.click(screen.getByText('append'))

    await waitFor(() => {
      expect(parseRange('range')).toEqual([9050, 9099])
      expect(appendSpy).toHaveBeenCalledTimes(1)
    })

    const plotArea = parsePlotArea()
    const layer = screen.getByTestId('chart-region-zoom-layer')
    fireWheelAt(layer, {
      clientX: rect.left + plotArea.x + plotArea.width / 2,
      clientY: rect.top + plotArea.y + plotArea.height / 2,
      deltaY: -120,
    })

    await waitFor(() => {
      const range = parseRange('range')
      expect(range[0]).toBeGreaterThan(9050)
      expect(range[1]).toBeLessThan(9099)
      expect(range[1] - range[0]).toBeLessThan(49)
    })
  })
})

describe('use client directive', () => {
  it('time-series has use client directive', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(import.meta.dirname, '..', 'time-series.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content.startsWith("'use client'")).toBe(true)
  })
})
