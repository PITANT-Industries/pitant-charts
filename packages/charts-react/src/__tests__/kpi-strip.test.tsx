import { cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { KpiStripConfig, KpiStripData } from '../kpi-strip.js'
import { useKpiStrip } from '../kpi-strip.js'

afterEach(cleanup)

const DATA: KpiStripData = {
  items: [
    {
      key: 'oee',
      label: 'OEE',
      value: 92.1,
      unit: '%',
      status: 'normal',
      sparkline: {
        values: new Float32Array([88, 90, 91, 92.1]),
        valueRange: [70, 100],
      },
      target: 90,
    },
    {
      key: 'rejects',
      label: 'Rejects',
      value: 4.8,
      unit: '%',
      status: 'warning',
      sparkline: {
        values: new Float32Array([2.1, 3.2, 4.1, 4.8]),
        valueRange: [0, 8],
      },
      upperLimit: 5,
    },
  ],
}

const CONFIG: KpiStripConfig = {
  columns: 2,
  labels: {
    maxCount: 8,
  },
  sparklinePointLimit: 16,
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

describe('useKpiStrip', () => {
  it('builds a KPI strip render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useKpiStrip({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.renderPlan.kind).toBe('kpi-strip')
    expect(result.current.renderPlan.renderedItemCount).toBe(2)
    expect(result.current.renderPlan.statusCounts.warning).toBe(1)
    expect(result.current.stats.sparklinePointCount).toBe(8)
  })

  it('exports SVG from the KPI command-frame path', async () => {
    const { result } = renderHook(() =>
      useKpiStrip({
        config: CONFIG,
        data: DATA,
        containerRef: fakeContainerRef(360),
      }),
    )

    const blob = await result.current.exportImage('svg', {
      width: 480,
      height: 220,
      background: '#ffffff',
    })
    const svg = await blob.text()

    expect(blob.type).toBe('image/svg+xml')
    expect(svg).toContain('width="480"')
    expect(svg).toContain('height="220"')
    expect(svg).toContain('KPI strip')
    expect(svg).toContain('<rect')
    expect(svg).toContain('<path')
  })

  it('honors max item gates through config', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useKpiStrip({
        config: { ...CONFIG, maxItems: 1 },
        data: DATA,
        containerRef,
      })
    })

    expect(result.current.renderPlan.sourceItemCount).toBe(2)
    expect(result.current.renderPlan.renderedItemCount).toBe(1)
  })
})
