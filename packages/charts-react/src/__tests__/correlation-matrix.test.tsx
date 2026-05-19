import { cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { CorrelationMatrixConfig, CorrelationMatrixData } from '../correlation-matrix.js'
import { useCorrelationMatrix } from '../correlation-matrix.js'

afterEach(cleanup)

const DATA: CorrelationMatrixData = {
  variables: [
    { key: 'pressure', label: 'Press' },
    { key: 'torque', label: 'Torque' },
    { key: 'temperature', label: 'Temp' },
  ],
  values: new Float32Array([1, 0.76, Number.NaN, 0.76, 1, -0.32, 0.12, -0.32, 1]),
  sampleCounts: new Uint32Array([100, 100, 0, 100, 100, 12, 100, 12, 100]),
  missingCounts: new Uint32Array([0, 0, 9, 0, 0, 3, 0, 3, 0]),
}

const CONFIG: CorrelationMatrixConfig = {
  minSampleCount: 30,
  labels: {
    maxCount: 8,
  },
  xAxis: {
    label: 'Source',
  },
  yAxis: {
    label: 'Target',
  },
}

const SLICED_CONFIG: CorrelationMatrixConfig = {
  ...CONFIG,
  xAxis: { range: [1, 3] },
  yAxis: { range: [0, 2] },
}

function fakeContainerRef(width: number): RefObject<ChartContainerRef | null> {
  return {
    current: {
      canvas: null,
      dimensions: { width, height: 180, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  }
}

describe('useCorrelationMatrix', () => {
  it('builds a correlation matrix render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useCorrelationMatrix({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.renderPlan.kind).toBe('correlation-matrix')
    expect(result.current.renderPlan.renderedCellCount).toBe(9)
    expect(result.current.renderPlan.missingCellCount).toBe(1)
    expect(result.current.renderPlan.lowSampleCellCount).toBe(2)
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
  })

  it('exports SVG from the correlation command-frame path', async () => {
    const { result } = renderHook(() =>
      useCorrelationMatrix({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(360),
      }),
    )

    const blob = await result.current.exportImage('svg', {
      width: 480,
      height: 260,
      background: '#ffffff',
    })
    const svg = await blob.text()

    expect(blob.type).toBe('image/svg+xml')
    expect(svg).toContain('width="480"')
    expect(svg).toContain('height="260"')
    expect(svg).toContain('Correlation matrix')
    expect(svg).toContain('<rect')
  })

  it('supports viewport slicing through axis ranges', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useCorrelationMatrix({
        config: SLICED_CONFIG,
        data: DATA,
        containerRef,
      })
    })

    expect(result.current.renderPlan.renderedCellCount).toBe(4)
    expect(result.current.renderPlan.xRange).toEqual([1, 3])
    expect(result.current.renderPlan.yRange).toEqual([1, 3])
  })
})
