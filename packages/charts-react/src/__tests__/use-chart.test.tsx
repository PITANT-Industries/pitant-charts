import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { type ReactNode, type RefObject, useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import { resolveExportOptions } from '../chart-runtime.js'
import type { ChartConfig } from '../use-chart.js'
import { useChart } from '../use-chart.js'

afterEach(cleanup)

// ── Helpers ──────────────────────────────────────────────────

const BASE_CONFIG: ChartConfig = {
  series: [
    { key: 'temp', label: 'Temperature', color: 'red' },
    { key: 'pressure', label: 'Pressure' },
  ],
}

function createContainerRef(canvas = document.createElement('canvas')) {
  return {
    current: {
      canvas,
      dimensions: { width: 320, height: 180, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  } satisfies RefObject<ChartContainerRef | null>
}

/** Wrapper that provides a containerRef for testing */
function UseChartHarness({
  config = BASE_CONFIG,
  children,
}: {
  config?: ChartConfig
  children: (ret: ReturnType<typeof useChart>) => ReactNode
}) {
  const containerRef = useRef<ChartContainerRef | null>(null)
  const chart = useChart({ config, containerRef })
  return <>{children(chart)}</>
}

// ── Tests ────────────────────────────────────────────────────

describe('useChart', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    const ret = result.current
    expect(ret.append).toBeTypeOf('function')
    expect(ret.setData).toBeTypeOf('function')
    expect(ret.setVisibleRange).toBeTypeOf('function')
    expect(ret.toggleSeries).toBeTypeOf('function')
    expect(ret.exportImage).toBeTypeOf('function')
    expect(ret.visibleRange).toEqual([0, 0])
    expect(ret.tooltipPayload).toBeNull()
    expect(ret.tooltipPosition).toBeNull()
    expect(ret.stats).toEqual({ fps: 0, renderTime: 0, pointCount: 0 })
    expect(ret.ready).toBe(false)
    expect(ret.error).toBeNull()
    expect(ret.config).toBe(BASE_CONFIG)
  })

  it('derives legendItems from config', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    const items = result.current.legendItems
    expect(items).toHaveLength(2)
    expect(items[0]!.key).toBe('temp')
    expect(items[0]!.label).toBe('Temperature')
    expect(items[0]!.color).toBe('red')
    expect(items[0]!.visible).toBe(true)
    // Second series uses default palette
    expect(items[1]!.key).toBe('pressure')
    expect(items[1]!.color).toContain('var(--chart-2')
    expect(items[1]!.visible).toBe(true)
  })

  it('toggleSeries toggles visibility', () => {
    render(
      <UseChartHarness>
        {(chart) => (
          <>
            <span data-testid="visible">
              {String(chart.legendItems.find((i) => i.key === 'temp')?.visible)}
            </span>
            <button type="button" onClick={() => chart.toggleSeries('temp')}>
              toggle
            </button>
          </>
        )}
      </UseChartHarness>,
    )

    expect(screen.getByTestId('visible').textContent).toBe('true')

    const { fireEvent } = require('@testing-library/react')
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByTestId('visible').textContent).toBe('false')
  })

  it('setVisibleRange updates range', () => {
    render(
      <UseChartHarness>
        {(chart) => (
          <>
            <span data-testid="range">{JSON.stringify(chart.visibleRange)}</span>
            <button type="button" onClick={() => chart.setVisibleRange([100, 200])}>
              zoom
            </button>
          </>
        )}
      </UseChartHarness>,
    )

    expect(screen.getByTestId('range').textContent).toBe('[0,0]')

    const { fireEvent } = require('@testing-library/react')
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByTestId('range').textContent).toBe('[100,200]')
  })

  it('respects initial visibility from config', () => {
    const config: ChartConfig = {
      series: [
        { key: 'a', label: 'A', visible: false },
        { key: 'b', label: 'B', visible: true },
        { key: 'c', label: 'C' },
      ],
    }

    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config, containerRef })
    })

    expect(result.current.legendItems[0]!.visible).toBe(false)
    expect(result.current.legendItems[1]!.visible).toBe(true)
    expect(result.current.legendItems[2]!.visible).toBe(true)
  })

  it('default palette cycles for > 8 series', () => {
    const config: ChartConfig = {
      series: Array.from({ length: 10 }, (_, i) => ({
        key: `s${i}`,
        label: `Series ${i}`,
      })),
    }

    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config, containerRef })
    })

    // Series 0 and 8 should get the same palette color
    expect(result.current.legendItems[0]!.color).toBe(result.current.legendItems[8]!.color)
    // Series 1 and 9 should match
    expect(result.current.legendItems[1]!.color).toBe(result.current.legendItems[9]!.color)
  })

  it('ready is false without container canvas', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('exposes renderer initialization failures through error state', async () => {
    const containerRef = createContainerRef()
    const config: ChartConfig = { ...BASE_CONFIG, renderer: 'webgpu' }
    const { result } = renderHook(() => useChart({ config, containerRef }))

    await waitFor(() => {
      expect(result.current.error?.message).toContain('WebGPU is not available')
    })

    expect(result.current.ready).toBe(false)
  })

  it('exportImage throws when canvas is not available', async () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    await expect(result.current.exportImage('png')).rejects.toThrow('Chart canvas is not available')
  })

  it('generic SVG export requires a vector renderer', async () => {
    const containerRef = createContainerRef()
    const { result } = renderHook(() => useChart({ config: BASE_CONFIG, containerRef }))

    await expect(result.current.exportImage('svg')).rejects.toThrow('SVG export requires')
  })

  it('resolves explicit export dimensions, background, and pixel ratio', () => {
    const containerRef = createContainerRef()

    expect(
      resolveExportOptions(containerRef.current, {
        width: 640,
        height: 360,
        background: '#ffffff',
        pixelRatio: 3,
      }),
    ).toEqual({
      width: 640,
      height: 360,
      background: '#ffffff',
      pixelRatio: 3,
    })
  })

  it('fails generic data controls explicitly instead of silently swallowing data', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    act(() => {
      result.current.append(new Float64Array([1, 2, 3]))
    })

    expect(result.current.error?.message).toContain('useChart() is renderer/lifecycle-only')
    expect(result.current.error?.message).toContain('useTimeSeries()')
    expect(result.current.stats.pointCount).toBe(0)

    act(() => {
      result.current.setData(new ArrayBuffer(8))
    })

    expect(result.current.error?.message).toContain('useDigitalChannel()')
    expect(result.current.stats.pointCount).toBe(0)
  })

  it('returns the config for type narrowing', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<ChartContainerRef | null>(null)
      return useChart({ config: BASE_CONFIG, containerRef })
    })

    expect(result.current.config).toBe(BASE_CONFIG)
    expect(result.current.config.series).toHaveLength(2)
  })

  it('double toggle restores original visibility', () => {
    render(
      <UseChartHarness>
        {(chart) => (
          <>
            <span data-testid="vis">
              {String(chart.legendItems.find((i) => i.key === 'temp')?.visible)}
            </span>
            <button type="button" onClick={() => chart.toggleSeries('temp')}>
              toggle
            </button>
          </>
        )}
      </UseChartHarness>,
    )

    const { fireEvent } = require('@testing-library/react')
    const btn = screen.getByRole('button')

    expect(screen.getByTestId('vis').textContent).toBe('true')
    fireEvent.click(btn)
    expect(screen.getByTestId('vis').textContent).toBe('false')
    fireEvent.click(btn)
    expect(screen.getByTestId('vis').textContent).toBe('true')
  })
})

describe('use client directives', () => {
  const files = [
    'accessibility',
    'chart-canvas',
    'chart-container',
    'chart-runtime',
    'digital-channel',
    'chart-legend',
    'chart-sync-group',
    'chart-tooltip',
    'time-series',
    'use-chart',
    'use-chart-tokens',
    'use-dimensions',
  ]

  for (const file of files) {
    it(`${file} has 'use client' directive`, async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const actualExt =
        file === 'chart-runtime'
          ? '.ts'
          : file === 'use-chart'
            ? '.ts'
            : file === 'use-chart-tokens'
              ? '.ts'
              : file === 'use-dimensions'
                ? '.ts'
                : '.tsx'
      const filePath = path.resolve(import.meta.dirname, '..', `${file}${actualExt}`)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content.startsWith("'use client'")).toBe(true)
    })
  }
})
