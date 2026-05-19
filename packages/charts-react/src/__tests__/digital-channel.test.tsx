import type { ChartPointerCoordinates } from '@pitant/charts'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import { ChartSyncGroup } from '../chart-sync-group.js'
import type { DigitalChannelColumnData, DigitalChannelConfig } from '../digital-channel.js'
import { DigitalChannel, useDigitalChannel } from '../digital-channel.js'

afterEach(cleanup)

const DATA: DigitalChannelColumnData = {
  timestamps: new Float64Array([0, 10, 20]),
  columns: {
    running: new Float64Array([0, 1, 0]),
    faulted: new Float64Array([0, 0, 1]),
  },
}

const CONFIG: DigitalChannelConfig = {
  channels: [
    { key: 'running', label: 'Running', field: 'running', color: 'green', rgba: [0, 1, 0, 1] },
    { key: 'faulted', label: 'Faulted', field: 'faulted', visible: false },
  ],
  xAxis: {
    gapThreshold: 25,
  },
}

function makeLargeData(pointCount: number): DigitalChannelColumnData {
  const timestamps = new Float64Array(pointCount)
  const running = new Float64Array(pointCount)
  for (let i = 0; i < pointCount; i++) {
    timestamps[i] = i
    running[i] = i % 2
  }
  return { timestamps, columns: { running } }
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
    chartX: 100,
    chartY: 70,
    plotX: 50,
    plotY: 20,
    plotRatioX: 0.5,
    plotRatioY: 0.5,
    dataX,
    dataY: 1,
    relativeDataX: dataX,
    insideBounds: true,
    insidePlot: true,
  }
}

function SyncedDigitalChannelHarness() {
  const leftRef = useRef<ChartContainerRef | null>(null)
  const rightRef = useRef<ChartContainerRef | null>(null)
  const left = useDigitalChannel({
    chartKey: 'left',
    config: CONFIG,
    data: DATA,
    containerRef: leftRef,
  })
  const right = useDigitalChannel({
    chartKey: 'right',
    config: CONFIG,
    data: DATA,
    containerRef: rightRef,
  })

  return (
    <>
      <button type="button" onClick={() => left.setVisibleRange([10, 20])}>
        sync range
      </button>
      <button type="button" onClick={() => left.handleHoverChange(pointerAt(9))}>
        sync cursor
      </button>
      <span data-testid="right-range">{JSON.stringify(right.visibleRange)}</span>
      <span data-testid="right-cursor">{String(right.tooltipPayload?.timestamp ?? null)}</span>
      <span data-testid="right-synced-cursor">{String(right.syncedCursorX !== null)}</span>
    </>
  )
}

describe('useDigitalChannel', () => {
  it('builds a digital render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDigitalChannel({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.legendItems).toHaveLength(2)
    expect(result.current.legendItems[0]?.color).toBe('green')
    expect(result.current.renderPlan.kind).toBe('digital-channel')
    expect(result.current.renderPlan.channels.map((channel) => channel.key)).toEqual(['running'])
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
    expect(result.current.layout.legendArea).not.toBeNull()
  })

  it('exports SVG from the digital vector command frame', async () => {
    const { result } = renderHook(() =>
      useDigitalChannel({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(320),
      }),
    )

    const blob = await result.current.exportImage('svg', {
      width: 480,
      height: 240,
      background: '#ffffff',
    })
    const svg = await blob.text()

    expect(blob.type).toBe('image/svg+xml')
    expect(svg).toContain('width="480"')
    expect(svg).toContain('height="240"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('data:image/png')
  })

  it('toggleSeries includes a hidden channel in the render plan', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDigitalChannel({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.toggleSeries('faulted')
    })

    expect(result.current.legendItems.find((item) => item.key === 'faulted')?.visible).toBe(true)
    expect(result.current.renderPlan.channels.map((channel) => channel.key)).toEqual([
      'running',
      'faulted',
    ])
  })

  it('append extends the full range', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDigitalChannel({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.append({
        timestamps: new Float64Array([30]),
        columns: {
          running: new Float64Array([1]),
          faulted: new Float64Array([0]),
        },
      })
    })

    expect(result.current.fullRange).toEqual([0, 30])
  })

  it('switches to DataSource viewport results after async LOD query', async () => {
    const largeData = makeLargeData(9000)
    const config: DigitalChannelConfig = {
      channels: [{ key: 'running', label: 'Running', field: 'running' }],
    }
    const { result } = renderHook(() =>
      useDigitalChannel({
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

  it('builds a state-label tooltip payload from hover coordinates', () => {
    const config: DigitalChannelConfig = {
      channels: [
        {
          key: 'running',
          label: 'Running',
          field: 'running',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
        },
      ],
    }
    const data: DigitalChannelColumnData = {
      ...DATA,
      quality: { running: new Uint8Array([0, 10, 0]) },
      provenance: { running: ['live adapter', 'interlock replay', 'live adapter'] },
      gaps: [{ startIndex: 1, endIndex: 1 }],
    }
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDigitalChannel({ config, data, containerRef })
    })

    act(() => {
      result.current.handleHoverChange(pointerAt(9))
    })

    expect(result.current.tooltipPosition).toEqual({ x: 100, y: 70 })
    expect(result.current.tooltipPayload?.timestamp).toBe(10)
    expect(result.current.tooltipPayload?.series[0]).toMatchObject({
      key: 'running',
      value: 1,
      formatted: 'Running',
      quality: 10,
      qualityLabel: 'communication failed',
      provenance: { label: 'interlock replay' },
      gap: true,
    })
  })

  it('syncs x-range and cursor payloads through ChartSyncGroup', async () => {
    render(
      <ChartSyncGroup>
        <SyncedDigitalChannelHarness />
      </ChartSyncGroup>,
    )

    fireEvent.click(screen.getByText('sync range'))
    await waitFor(() => {
      expect(screen.getByTestId('right-range').textContent).toBe('[10,20]')
    })

    fireEvent.click(screen.getByText('sync cursor'))
    await waitFor(() => {
      expect(screen.getByTestId('right-cursor').textContent).toBe('10')
      expect(screen.getByTestId('right-synced-cursor').textContent).toBe('true')
    })
  })

  it('component renders a chart container and exposes chart state to children', () => {
    render(
      <DigitalChannel ariaLabel="Machine states" config={CONFIG} data={DATA}>
        {(chart) => <span data-testid="segments">{chart.renderPlan.segmentCount}</span>}
      </DigitalChannel>,
    )

    expect(screen.getByRole('img', { name: 'Machine states' })).toBeTruthy()
    expect(Number(screen.getByTestId('segments').textContent)).toBeGreaterThan(0)
  })
})

describe('use client directive', () => {
  it('digital-channel has use client directive', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(import.meta.dirname, '..', 'digital-channel.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content.startsWith("'use client'")).toBe(true)
  })
})
