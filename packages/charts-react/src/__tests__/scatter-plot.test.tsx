import { cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { ScatterPlotColumnData, ScatterPlotConfig } from '../scatter-plot.js'
import { useScatterPlot } from '../scatter-plot.js'

afterEach(cleanup)

const DATA: ScatterPlotColumnData = {
  columns: {
    pressure: new Float32Array([80, 84, 88, 96, 102, 112]),
    torque: new Float32Array([12, 14, 19, 24, 31, 37]),
    temperature: new Float32Array([62, 64, 68, 71, 72, 74]),
  },
}

const CONFIG: ScatterPlotConfig = {
  series: [
    {
      key: 'pressure-torque',
      label: 'Pressure vs torque',
      xField: 'pressure',
      yField: 'torque',
      color: 'var(--chart-1)',
      rgba: [0.15, 0.39, 0.92, 1],
    },
    {
      key: 'pressure-temperature',
      label: 'Pressure vs temperature',
      xField: 'pressure',
      yField: 'temperature',
      color: 'var(--chart-4)',
      rgba: [0.86, 0.15, 0.15, 1],
    },
  ],
  xAxis: {
    label: 'Pressure',
    range: [70, 120],
  },
  yAxis: {
    label: 'Output',
    range: [0, 80],
  },
  maxRenderedPoints: 100,
}

const DENSE_POINT_COUNT = 40_000
const DENSE_X = new Float32Array(DENSE_POINT_COUNT)
const DENSE_Y = new Float32Array(DENSE_POINT_COUNT)
for (let index = 0; index < DENSE_POINT_COUNT; index++) {
  DENSE_X[index] = 50 + Math.sin(index / 17) * 30
  DENSE_Y[index] = 50 + Math.cos(index / 19) * 25
}

const DENSE_CONFIG: ScatterPlotConfig = {
  ...CONFIG,
  series: [
    {
      key: 'dense',
      label: 'Dense',
      xField: 'x',
      yField: 'y',
    },
  ],
  density: {
    columns: 64,
    rows: 48,
  },
  maxRenderedPoints: 8_000,
}

const DENSE_DATA: ScatterPlotColumnData = { columns: { x: DENSE_X, y: DENSE_Y } }

function fakeContainerRef(width: number): RefObject<ChartContainerRef | null> {
  return {
    current: {
      canvas: null,
      dimensions: { width, height: 220, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  }
}

describe('useScatterPlot', () => {
  it('builds a scatter plot render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useScatterPlot({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.renderPlan.kind).toBe('scatter-plot')
    expect(result.current.renderPlan.mode).toBe('points')
    expect(result.current.renderPlan.filteredPointCount).toBe(12)
    expect(result.current.stats.renderedPointCount).toBe(12)
    expect(result.current.legendItems).toHaveLength(2)
  })

  it('exports SVG from the scatter command-frame path', async () => {
    const { result } = renderHook(() =>
      useScatterPlot({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(420),
      }),
    )

    const blob = await result.current.exportImage('svg', {
      width: 520,
      height: 320,
      background: '#ffffff',
    })
    const svg = await blob.text()

    expect(blob.type).toBe('image/svg+xml')
    expect(svg).toContain('width="520"')
    expect(svg).toContain('height="320"')
    expect(svg).toContain('Scatter plot')
    expect(svg).toContain('<rect')
  })

  it('honors density gates through config', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useScatterPlot({
        config: DENSE_CONFIG,
        data: DENSE_DATA,
        containerRef,
      })
    })

    expect(result.current.renderPlan.mode).toBe('density')
    expect(result.current.stats.densityCellCount).toBeGreaterThan(0)
    expect(result.current.stats.densityCellCount).toBeLessThanOrEqual(64 * 48)
  })
})
