import { act, cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { SpectrumColumnData, SpectrumConfig } from '../spectrum.js'
import { useSpectrum } from '../spectrum.js'

afterEach(cleanup)

const DATA: SpectrumColumnData = {
  frequencies: new Float64Array([10, 20, 30, 40]),
  columns: {
    magnitude: new Float64Array([1, 8, 3, 2]),
    hidden: new Float64Array([2, 2, 2, 2]),
  },
}

const CONFIG: SpectrumConfig = {
  series: [
    {
      key: 'magnitude',
      label: 'Vibration spectrum',
      field: 'magnitude',
      color: 'purple',
      rgba: [0.48, 0.23, 0.93, 1],
    },
    {
      key: 'hidden',
      label: 'Hidden spectrum',
      field: 'hidden',
      visible: false,
    },
  ],
  bands: [
    {
      key: 'bearing',
      frequencyStart: 18,
      frequencyEnd: 24,
      label: 'Bearing',
    },
  ],
  peakMarkers: [
    {
      key: 'peak',
      frequency: 20,
      magnitude: 8,
      label: '20 Hz',
    },
  ],
  xAxis: {
    label: 'Frequency',
  },
  yAxis: {
    label: 'Magnitude',
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

describe('useSpectrum', () => {
  it('builds a spectrum render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useSpectrum({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.legendItems).toHaveLength(2)
    expect(result.current.legendItems[0]?.color).toBe('purple')
    expect(result.current.renderPlan.kind).toBe('spectrum')
    expect(result.current.renderPlan.series.map((series) => series.key)).toEqual(['magnitude'])
    expect(result.current.renderPlan.peakMarkers).toHaveLength(1)
    expect(result.current.renderPlan.bands).toHaveLength(1)
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
  })

  it('exports SVG from the spectrum command-frame path', async () => {
    const { result } = renderHook(() =>
      useSpectrum({
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
    expect(svg).toContain('20 Hz')
    expect(svg).toContain('<path')
  })

  it('toggleSeries includes a hidden spectrum series in the render plan', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useSpectrum({ config: CONFIG, data: DATA, containerRef })
    })

    act(() => {
      result.current.toggleSeries('hidden')
    })

    expect(result.current.legendItems.find((item) => item.key === 'hidden')?.visible).toBe(true)
    expect(result.current.renderPlan.series.map((series) => series.key)).toEqual([
      'magnitude',
      'hidden',
    ])
  })
})
