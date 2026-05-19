import { act, cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { DistributionColumnData, DistributionConfig } from '../distribution.js'
import { useDistribution } from '../distribution.js'

afterEach(cleanup)

const DATA: DistributionColumnData = {
  binStarts: new Float64Array([0, 10, 20, 30]),
  binEnds: new Float64Array([10, 20, 30, 40]),
  columns: {
    count: new Float64Array([1, 8, 4, 2]),
    hidden: new Float64Array([2, 2, 2, 2]),
  },
}

const CONFIG: DistributionConfig = {
  series: [
    {
      key: 'count',
      label: 'Capability histogram',
      field: 'count',
      color: 'blue',
      rgba: [0.15, 0.39, 0.92, 1],
    },
    {
      key: 'hidden',
      label: 'Hidden histogram',
      field: 'hidden',
      visible: false,
    },
  ],
  markers: [
    { key: 'lsl', kind: 'lower-spec', value: 4, label: 'LSL' },
    { key: 'target', kind: 'target', value: 18, label: 'Target' },
    { key: 'usl', kind: 'upper-spec', value: 36, label: 'USL' },
  ],
  xAxis: {
    label: 'Value',
  },
  yAxis: {
    label: 'Count',
    baseline: 0,
  },
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

describe('useDistribution', () => {
  it('builds a distribution render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDistribution({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.legendItems).toHaveLength(2)
    expect(result.current.legendItems[0]?.color).toBe('blue')
    expect(result.current.renderPlan.kind).toBe('distribution')
    expect(result.current.renderPlan.series.map((series) => series.key)).toEqual(['count'])
    expect(result.current.renderPlan.markers).toHaveLength(3)
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
  })

  it('exports SVG from the distribution command-frame path', async () => {
    const { result } = renderHook(() =>
      useDistribution({
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
    expect(svg).toContain('Target')
    expect(svg).toContain('<rect')
  })

  it('toggleSeries includes a hidden distribution series in the render plan', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useDistribution({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.toggleSeries('hidden')
    })

    expect(result.current.legendItems.find((item) => item.key === 'hidden')?.visible).toBe(true)
    expect(result.current.renderPlan.series.map((series) => series.key)).toEqual([
      'count',
      'hidden',
    ])
  })
})
