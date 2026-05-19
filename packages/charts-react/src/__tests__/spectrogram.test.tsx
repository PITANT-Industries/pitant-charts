import { cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import type { SpectrogramConfig, SpectrogramMatrixData } from '../spectrogram.js'
import { useSpectrogram } from '../spectrogram.js'

afterEach(cleanup)

const DATA: SpectrogramMatrixData = {
  timeBins: new Float64Array([0, 1, 2]),
  frequencyBins: new Float64Array([10, 20]),
  values: new Float32Array([1, 2, 3, 4, 5, 6]),
}

const CONFIG: SpectrogramConfig = {
  colorStops: [
    { value: 0, rgba: [0.04, 0.07, 0.16, 1] },
    { value: 1, rgba: [0.86, 0.15, 0.15, 1] },
  ],
  xAxis: {
    label: 'Time',
  },
  yAxis: {
    label: 'Frequency',
  },
  zAxis: {
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

describe('useSpectrogram', () => {
  it('builds a spectrogram render plan without a mounted canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useSpectrogram({ config: CONFIG, data: DATA, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.renderPlan.kind).toBe('spectrogram')
    expect(result.current.renderPlan.renderedTileCount).toBe(6)
    expect(result.current.layout.plotArea.width).toBeGreaterThan(0)
  })

  it('exports SVG from the spectrogram command-frame path', async () => {
    const { result } = renderHook(() =>
      useSpectrogram({
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
    expect(svg).toContain('<rect')
    expect(svg).toContain('Spectrogram chart')
  })
})
