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

  it('uses independent Y axes for channel values, overlays and SVG export', async () => {
    const data: TimeSeriesColumnData = {
      timestamps: DATA.timestamps,
      columns: {
        ...DATA.columns,
        pressure: new Float64Array([1500, 1000, 500]),
        other: new Float64Array([101, 102, 103]),
      },
    }
    const config: TimeSeriesConfig = {
      series: [
        { key: 'temp', label: 'Temperature', field: 'temp' },
        { key: 'pressure', label: 'Pressure', field: 'pressure', yAxisKey: 'pressure' },
        { key: 'other', label: 'Other', field: 'other', yAxisKey: 'other' },
        { key: 'unconfigured', label: 'Invalid axis', field: 'other', yAxisKey: 'unknown' },
      ],
      derivedSeries: [
        {
          key: 'pressure_ma',
          label: 'Pressure mean',
          sourceField: 'pressure',
          kind: 'moving-average',
          windowSize: 2,
          minimumSamples: 1,
          yAxisKey: 'pressure',
        },
      ],
      yAxis: { label: '°C', range: [0, 20], formatValue: (value) => `${value} °C` },
      yAxes: [
        { key: 'temperature' },
        {
          key: 'pressure',
          side: 'right',
          label: 'Pressure',
          range: [0, 2000],
          tickCount: 3,
          formatValue: (value) => `${value} kPa`,
        },
        { key: 'other', side: 'right', range: [0, 200] },
      ],
      bands: [{ kind: 'value-band', key: 'limit', yAxisKey: 'pressure', yStart: 1200, yEnd: 1500 }],
      annotations: [{ kind: 'y-line', key: 'setpoint', yAxisKey: 'pressure', y: 1100 }],
      spcTracks: [{ key: 'control', yAxisKey: 'pressure', centerLine: 950 }],
    }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data, containerRef: fakeContainerRef(900) }),
    )

    expect(result.current.renderPlan.yRange).toEqual([0, 20])
    expect(result.current.renderPlan.yAxes?.map((axis) => [axis.key, axis.range])).toEqual([
      ['temperature', [0, 20]],
      ['pressure', [0, 2000]],
      ['other', [0, 200]],
    ])
    expect(
      result.current.layout.yAxes?.map(({ key, label, side }) => ({ key, label, side })),
    ).toEqual([
      { key: 'temperature', label: '°C', side: 'left' },
      { key: 'pressure', label: 'Pressure', side: 'right' },
      { key: 'other', label: null, side: 'right' },
    ])
    expect(result.current.layout.yAxes?.[1]?.ticks.map((tick) => tick.label)).toEqual([
      '0 kPa',
      '1000 kPa',
      '2000 kPa',
    ])
    expect(
      result.current.renderPlan.series.find(({ key }) => key === 'pressure_ma')?.yAxisKey,
    ).toBe('pressure')
    expect(result.current.renderPlan.bands[0]?.yAxisKey).toBe('pressure')
    expect(result.current.renderPlan.annotations[0]?.yAxisKey).toBe('pressure')
    expect(result.current.renderPlan.spcTracks[0]?.yAxisKey).toBe('pressure')
    expect(result.current.renderPlan.series.some(({ key }) => key === 'unconfigured')).toBe(false)
    expect(result.current.legendItems.some(({ key }) => key === 'unconfigured')).toBe(false)

    act(() => result.current.handleHoverChange(pointerAt(1010)))
    expect(
      result.current.tooltipPayload?.series.map(({ key, formatted }) => [key, formatted]),
    ).toEqual([
      ['temp', '12 °C'],
      ['pressure', '1000 kPa'],
      ['other', '102'],
      ['pressure_ma', '1250 kPa'],
    ])

    const blob = await result.current.exportImage('svg', { width: 900, height: 400 })
    const svg = await blob.text()
    expect(svg).toContain('>Pressure</text>')
    expect(svg).toContain('>2000 kPa</text>')
    expect(svg).toContain('>20 °C</text>')

    act(() => result.current.toggleSeries('pressure'))
    act(() => result.current.handleHoverChange(pointerAt(1010)))
    expect(result.current.renderPlan.series.some(({ key }) => key === 'pressure')).toBe(false)
    expect(result.current.tooltipPayload?.series.some(({ key }) => key === 'pressure')).toBe(false)
  })

  it('applies and resets a primary Y viewport without changing the secondary scale', () => {
    const config: TimeSeriesConfig = {
      ...CONFIG,
      yAxes: [
        { key: 'temp', range: [0, 20] },
        { key: 'pressure', range: [0, 4] },
      ],
      series: CONFIG.series.map((item) => ({ ...item, yAxisKey: item.key })),
    }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data: DATA, containerRef: fakeContainerRef(700) }),
    )
    act(() => result.current.setVisibleYRange([9, 13]))
    expect(result.current.visibleYRange).toEqual([9, 13])
    expect(result.current.renderPlan.yRange).toEqual([9, 13])
    expect(result.current.renderPlan.yAxes?.[1]?.range).toEqual([0, 4])
    act(() => result.current.setVisibleYRange(null))
    expect(result.current.renderPlan.yRange).toEqual([0, 20])
  })

  it('inspects asynchronously sampled fields on their own sorted timestamps', () => {
    const data: TimeSeriesColumnData = {
      timestamps: new Float64Array([1000, 1010, 1020]),
      columns: {
        temp: new Float64Array([10, NaN, 15]),
        pressure: new Float64Array([400, 900]),
      },
      sampleKinds: { temp: new Uint8Array([0, 1, 0]) },
      seriesTimestamps: { pressure: new Float64Array([1011, 1040]) },
    }
    const config: TimeSeriesConfig = {
      ...CONFIG,
      series: CONFIG.series.map((item) => ({ ...item, mark: 'point' })),
    }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data, containerRef: fakeContainerRef(700) }),
    )
    expect(result.current.fullRange).toEqual([1000, 1040])
    expect(result.current.renderPlan.series.find(({ key }) => key === 'pressure')?.mark).toBe(
      'point',
    )
    act(() => result.current.handleHoverChange(pointerAt(1010)))
    expect(result.current.tooltipPayload?.series).toEqual([
      expect.objectContaining({ key: 'temp', value: null, gap: true }),
      expect.objectContaining({ key: 'pressure', value: 400 }),
    ])
  })

  it.each([false, true])('snaps and focuses using the series scale with rotation %s', (rotated) => {
    const config: TimeSeriesConfig = {
      ...(rotated ? { orientation: 'rotated' } : {}),
      series: [
        { key: 'temp', label: 'Temperature', field: 'temp' },
        { key: 'pressure', label: 'Pressure', field: 'pressure', yAxisKey: 'pressure' },
      ],
      yAxes: [
        { key: 'temp', range: [0, 20] },
        { key: 'pressure', range: [0, 3] },
      ],
    }
    const interaction = { snapToSample: true, focusClosestSeries: 2 }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data: DATA, containerRef: fakeContainerRef(700), interaction }),
    )
    const { layout } = result.current
    const snapped = result.current.snapHover(pointerAt(1014))
    expect(snapped.dataX).toBe(1010)
    if (rotated) {
      expect(snapped.plotRatioY).toBe(0.5)
      expect(snapped.chartY).toBe(layout.plotArea.y + layout.plotArea.height / 2)
    } else {
      expect(snapped.plotRatioX).toBe(0.5)
    }
    const valueCoordinate = rotated
      ? { plotX: (2 / 3) * layout.plotArea.width }
      : { plotY: (1 - 2 / 3) * layout.plotArea.height }
    act(() => result.current.handleHoverChange({ ...snapped, ...valueCoordinate }))
    expect(result.current.focusedSeriesKey).toBe('pressure')
    act(() => result.current.handleHoverChange(null))
    expect(result.current.focusedSeriesKey).toBe(null)
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

  it('passes persistent annotations and rulers into the core render plan', () => {
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      annotations: [
        { kind: 'x-line', key: 'batch-start', label: 'Batch start', x: 1010 },
        { kind: 'y-line', key: 'setpoint', label: 'Setpoint', y: 11 },
        {
          kind: 'x-range',
          key: 'hold-window',
          label: 'Hold',
          xStart: 1005,
          xEnd: 1015,
          fillRgba: [1, 0.8, 0, 0.12],
        },
        {
          kind: 'ruler',
          key: 'ramp-ruler',
          label: 'Ramp',
          xStart: 1000,
          xEnd: 1020,
          yStart: 10,
          yEnd: 12,
          rgba: [0.2, 0.2, 0.2, 1],
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data: DATA, containerRef })
    })

    expect(result.current.renderPlan.annotations.map((annotation) => annotation.key)).toEqual([
      'batch-start',
      'setpoint',
      'hold-window',
      'ramp-ruler',
    ])
    expect(result.current.renderPlan.annotations[0]?.lineSegments[0]?.buffer).toEqual(
      new Float32Array([
        10,
        result.current.renderPlan.yRange[0],
        10,
        result.current.renderPlan.yRange[1],
      ]),
    )
    expect(result.current.renderPlan.annotations[2]?.fillSegments).toHaveLength(1)
  })

  it('passes sparse event markers into the core render plan', () => {
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      eventMarkers: [
        {
          key: 'batch-start',
          label: 'Batch start',
          x: 1010,
          eventType: 'batch',
          placement: 'top-tick',
          labelVisible: true,
        },
        {
          key: 'alarm',
          label: 'Alarm',
          x: 1020,
          eventType: 'alarm',
          placement: 'full-height',
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data: DATA, containerRef })
    })

    expect(result.current.renderPlan.eventMarkers.map((marker) => marker.key)).toEqual([
      'batch-start',
      'alarm',
    ])
    expect(result.current.renderPlan.eventMarkers[0]?.eventType).toBe('batch')
    expect(result.current.renderPlan.eventMarkers[0]?.labelVisible).toBe(true)
    expect(result.current.renderPlan.eventMarkers[1]?.placement).toBe('full-height')
  })

  it('passes anomaly score tracks into the core render plan', () => {
    const data: TimeSeriesColumnData = {
      timestamps: new Float64Array([1000, 1010, 1020]),
      columns: {
        temp: new Float64Array([10, 12, 11]),
        anomaly: new Float64Array([0.2, 0.75, 0.45]),
      },
    }
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      anomalyTracks: [
        {
          key: 'model-score',
          label: 'Model score',
          scoreField: 'anomaly',
          threshold: 0.7,
          modelVersion: 'model-17',
          reviewerState: 'approved',
          placement: 'bottom',
          fillRgba: [0.9, 0.1, 0.1, 0.18],
          lineRgba: [0.9, 0.1, 0.1, 0.82],
          thresholdRgba: [0.1, 0.1, 0.1, 0.72],
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data, containerRef })
    })

    expect(result.current.renderPlan.anomalyTracks.map((track) => track.key)).toEqual([
      'model-score',
    ])
    expect(result.current.renderPlan.anomalyTracks[0]?.modelVersion).toBe('model-17')
    expect(result.current.renderPlan.anomalyTracks[0]?.reviewerState).toBe('approved')
    expect(result.current.renderPlan.anomalyTracks[0]?.threshold).toBe(0.7)
    expect(result.current.renderPlan.anomalyTracks[0]?.fillSegments).toHaveLength(1)
  })

  it('passes SPC control-limit tracks into the core render plan', () => {
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      spcTracks: [
        {
          key: 'xbar-control',
          label: 'Xbar control',
          chartKind: 'xbar',
          centerLine: 11,
          upperControlLimit: 13,
          lowerControlLimit: 9,
          upperWarningLimit: 12.3,
          lowerWarningLimit: 9.7,
          markers: [
            {
              key: 'rule-1',
              x: 1010,
              label: 'WE-1',
              rule: 'Western Electric 1',
              severity: 'violation',
              labelVisible: true,
            },
          ],
        },
      ],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useTimeSeries({ config, data: DATA, containerRef })
    })

    expect(result.current.renderPlan.spcTracks.map((track) => track.key)).toEqual(['xbar-control'])
    expect(result.current.renderPlan.spcTracks[0]?.chartKind).toBe('xbar')
    expect(result.current.renderPlan.spcTracks[0]?.centerLineSegments).toHaveLength(1)
    expect(result.current.renderPlan.spcTracks[0]?.controlLimitSegments).toHaveLength(2)
    expect(result.current.renderPlan.spcTracks[0]?.warningLimitSegments).toHaveLength(2)
    expect(result.current.renderPlan.spcTracks[0]?.markers[0]?.rule).toBe('Western Electric 1')
    expect(result.current.renderPlan.spcTracks[0]?.markers[0]?.labelVisible).toBe(true)
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

  it('formats custom axis labels with original x values before and after zoom', () => {
    const config: TimeSeriesConfig = {
      ...CONFIG,
      xAxis: { ...CONFIG.xAxis, formatValue: (value) => `Sample ${value}` },
    }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data: DATA, containerRef: fakeContainerRef(800) }),
    )

    expect(result.current.layout.xTicks[0]).toMatchObject({ value: 0, label: 'Sample 1000' })
    expect(result.current.layout.xTicks.at(-1)).toMatchObject({ value: 20, label: 'Sample 1020' })

    act(() => {
      result.current.setVisibleRange([1010, 1020])
    })

    expect(result.current.layout.xTicks[0]).toMatchObject({ value: 0, label: 'Sample 1010' })
    expect(result.current.layout.xTicks.at(-1)).toMatchObject({ value: 10, label: 'Sample 1020' })
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

  it('keeps real epoch timestamps distinct after the viewport query settles', async () => {
    const epoch = Date.UTC(2026, 10, 28, 12)
    const offsets = [0, 1, 10, 100, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 180000]
    const data: TimeSeriesColumnData = {
      timestamps: Float64Array.from(offsets, (offset) => epoch + offset),
      columns: { temp: Float64Array.from(offsets, (_, index) => index + 1) },
    }
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
    }
    const query = vi.spyOn(DataSource.prototype, 'query')
    const { result } = renderHook(() =>
      useTimeSeries({ config, data, containerRef: fakeContainerRef(1200) }),
    )

    await waitFor(() => expect(query).toHaveBeenCalled())
    await act(async () => {
      await query.mock.results[0]?.value
    })
    expect(result.current.stats.dataLoading).toBe(false)
    expect(result.current.stats.lodLevel).toBe(0)
    expect(result.current.renderPlan.xRange).toEqual([epoch, epoch + 180000])
    const buffer = result.current.renderPlan.series[0]?.segments[0]?.buffer
    expect(Array.from(buffer ?? []).filter((_, index) => index % 2 === 0)).toEqual(offsets)
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

  it('synchronizes visibility and focus through mapped series keys', () => {
    const leftConfig: TimeSeriesConfig = {
      series: [
        { key: 'temperature', label: 'Temperature', field: 'temp' },
        { key: 'pressure', label: 'Pressure', field: 'pressure' },
      ],
      yAxis: { range: [0, 20] },
    }
    const rightConfig: TimeSeriesConfig = {
      series: [
        { key: 'temperature-alias', label: 'Temperature alias', field: 'temp' },
        { key: 'pressure-alias', label: 'Pressure alias', field: 'pressure' },
      ],
      yAxis: { range: [0, 20] },
    }
    const interaction = { focusClosestSeries: 3 }
    function SyncedSeriesHarness() {
      const left = useTimeSeries({
        chartKey: 'left',
        config: leftConfig,
        data: DATA,
        containerRef: fakeContainerRef(700),
        interaction,
      })
      const right = useTimeSeries({
        chartKey: 'right',
        config: rightConfig,
        data: DATA,
        containerRef: fakeContainerRef(700),
      })
      return (
        <>
          <button
            type="button"
            onClick={() => {
              left.toggleSeries('pressure', false)
              left.handleHoverChange({
                ...pointerAt(1010),
                plotY: (1 - 12 / 20) * left.layout.plotArea.height,
              })
            }}
          >
            Synchronize plot
          </button>
          <span data-testid="right-focused">{right.focusedSeriesKey}</span>
          <span data-testid="right-pressure">
            {String(right.legendItems.find(({ key }) => key === 'pressure-alias')?.visible)}
          </span>
        </>
      )
    }
    render(
      <ChartSyncGroup
        sync={['series', 'focus']}
        mapSeriesKey={(key, _source, target) =>
          target === 'right' ? `${key}-alias` : key.replace(/-alias$/, '')
        }
      >
        <SyncedSeriesHarness />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByText('Synchronize plot'))
    expect(screen.getByTestId('right-focused').textContent).toBe('temperature-alias')
    expect(screen.getByTestId('right-pressure').textContent).toBe('false')
  })

  it('shows and clears a programmatic inspection rectangle without changing the chart ranges', () => {
    const onSelectionChange = vi.fn()
    render(
      <TimeSeries config={CONFIG} data={DATA} interaction={{ onSelectionChange }}>
        {(chart) => (
          <>
            <button
              type="button"
              onClick={() => chart.setSelection({ xRange: [1018, 1005], yRange: [6, 9] })}
            >
              Inspect range
            </button>
            <button type="button" onClick={() => chart.setSelection(null)}>
              Clear range
            </button>
            <span data-testid="selection-view-range">{JSON.stringify(chart.dataRange)}</span>
            <span data-testid="selection-y-range">{JSON.stringify(chart.visibleYRange)}</span>
          </>
        )}
      </TimeSeries>,
    )

    expect(screen.queryByTestId('chart-region-zoom-selection')).toBeNull()
    fireEvent.click(screen.getByText('Inspect range'))
    expect(screen.getByTestId('chart-region-zoom-selection')).toBeTruthy()
    expect(onSelectionChange).toHaveBeenLastCalledWith({ xRange: [1005, 1018], yRange: [6, 9] })
    expect(screen.getByTestId('selection-view-range').textContent).toBe('[1000,1020]')
    expect(screen.getByTestId('selection-y-range').textContent).toBe('null')
    fireEvent.click(screen.getByText('Clear range'))
    expect(screen.queryByTestId('chart-region-zoom-selection')).toBeNull()
    expect(onSelectionChange).toHaveBeenLastCalledWith(null)
  })

  it('reports selections through the callback when the rectangle is controlled', () => {
    const onSelectionChange = vi.fn()
    const interaction = { selectedRanges: null, onSelectionChange }
    const { result } = renderHook(() =>
      useTimeSeries({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(700),
        interaction,
      }),
    )
    act(() => result.current.setSelection({ xRange: [1000, 1015] }))
    expect(onSelectionChange).toHaveBeenLastCalledWith({ xRange: [1000, 1015] })
    expect(result.current.selectedRanges).toBe(null)
  })

  it('passes raw per-series hover policies through the native TimeSeries component', () => {
    const config: TimeSeriesConfig = {
      series: [{ key: 'temp', label: 'Temperature', field: 'temp', hoverIndex: 'previous' }],
    }
    const { result } = renderHook(() =>
      useTimeSeries({ config, data: DATA, containerRef: fakeContainerRef(700) }),
    )
    act(() => result.current.handleHoverChange(pointerAt(1009)))
    expect(result.current.tooltipPayload?.timestamp).toBe(1010)
    expect(result.current.tooltipPayload?.series[0]).toMatchObject({
      key: 'temp',
      value: 10,
      sampleTimestamp: 1000,
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
