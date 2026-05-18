'use client'

import type { RenderContext, RendererType } from '@pitant/charts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChartContainerRef } from './chart-container.js'
import type { ChartLegendItem } from './chart-legend.js'
import type { ChartTooltipPayload } from './chart-tooltip.js'

// ── Chart Configuration ──────────────────────────────────────

export interface SeriesConfig {
  /** Unique series identifier */
  key: string
  /** Display label */
  label: string
  /** CSS color (or CSS variable reference) */
  color?: string
  /** Whether series is visible by default. @default true */
  visible?: boolean
}

export interface AxisConfig {
  /** Axis label */
  label?: string
  /** Value formatter for tick labels */
  formatValue?: (value: number) => string
}

export interface ChartConfig {
  /** Series definitions */
  series: SeriesConfig[]
  /** X-axis configuration */
  xAxis?: AxisConfig
  /** Y-axis configuration */
  yAxis?: AxisConfig
  /** Preferred renderer backend */
  renderer?: RendererType | 'auto'
}

export interface StreamingConfig {
  /** Enable streaming mode */
  enabled: boolean
  /** Number of data points to retain in the visible window */
  windowSize?: number
  /** Auto-scroll to keep the latest data visible */
  liveEdge?: boolean
}

export interface ExportOptions {
  /** Image width override (defaults to canvas width) */
  width?: number
  /** Image height override (defaults to canvas height) */
  height?: number
  /** Background color (defaults to chart background) */
  background?: string
  /** Pixel density multiplier. @default 2 */
  pixelRatio?: number
}

// ── Hook Options & Return ────────────────────────────────────

export interface UseChartOptions<TConfig extends ChartConfig = ChartConfig> {
  /** Chart configuration (series definitions, axis config, etc.) */
  config: TConfig
  /** Initial data — interleaved [timestamp, ...values] per series */
  data?: Float64Array | ArrayBuffer
  /** Container ref — the hook attaches the renderer to this element's canvas */
  containerRef: React.RefObject<ChartContainerRef | null>
  /** Streaming mode config */
  streaming?: StreamingConfig
}

export interface ChartStats {
  /** Frames per second. 0 when idle. */
  fps: number
  /** Last render duration in milliseconds */
  renderTime: number
  /** Total number of data points across all series */
  pointCount: number
}

export interface UseChartReturn<TConfig extends ChartConfig = ChartConfig> {
  /** Append new data points (interleaved [timestamp, ...values]) */
  append: (data: Float64Array | ArrayBuffer) => void
  /** Replace all data */
  setData: (data: Float64Array | ArrayBuffer) => void
  /** Current visible range [start, end] in data-space timestamps */
  visibleRange: readonly [number, number]
  /** Set visible range (for programmatic zoom/pan) */
  setVisibleRange: (range: readonly [number, number]) => void
  /** Legend items derived from config + visibility state */
  legendItems: readonly ChartLegendItem[]
  /** Toggle series visibility by key */
  toggleSeries: (key: string) => void
  /** Current tooltip payload (null when not hovering) */
  tooltipPayload: ChartTooltipPayload | null
  /** Tooltip screen position (null when not hovering) */
  tooltipPosition: { x: number; y: number } | null
  /** Export chart as image blob */
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  /** Current performance statistics */
  stats: ChartStats
  /** Whether the renderer is initialized and ready */
  ready: boolean
  /** The resolved config (for type narrowing with generics) */
  config: TConfig
}

// ── Default palette (fallback when series.color is not set) ──

const DEFAULT_COLORS = [
  'var(--chart-1, hsl(221 83% 53%))',
  'var(--chart-2, hsl(142 71% 45%))',
  'var(--chart-3, hsl(47 96% 53%))',
  'var(--chart-4, hsl(0 84% 60%))',
  'var(--chart-5, hsl(262 83% 58%))',
  'var(--chart-6, hsl(199 89% 48%))',
  'var(--chart-7, hsl(29 100% 52%))',
  'var(--chart-8, hsl(339 90% 51%))',
] as const

// ── Defaults ─────────────────────────────────────────────────

const EMPTY_RANGE: readonly [number, number] = [0, 0]
const EMPTY_STATS: ChartStats = { fps: 0, renderTime: 0, pointCount: 0 }

// ── Hook ─────────────────────────────────────────────────────

export function useChart<TConfig extends ChartConfig = ChartConfig>(
  options: UseChartOptions<TConfig>,
): UseChartReturn<TConfig> {
  const { config, data, containerRef } = options

  // ── Renderer state ───────────────────────────────────────
  const renderCtxRef = useRef<RenderContext | null>(null)
  const [ready, setReady] = useState(false)
  const [stats] = useState<ChartStats>(EMPTY_STATS)

  // ── Series visibility ────────────────────────────────────
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const s of config.series) {
      map[s.key] = s.visible !== false
    }
    return map
  })

  // ── Visible range ────────────────────────────────────────
  const [visibleRange, setVisibleRangeState] = useState<readonly [number, number]>(EMPTY_RANGE)

  // ── Tooltip ──────────────────────────────────────────────
  const [tooltipPayload] = useState<ChartTooltipPayload | null>(null)
  const [tooltipPosition] = useState<{
    x: number
    y: number
  } | null>(null)

  // ── Data buffer ──────────────────────────────────────────
  const dataRef = useRef<Float64Array | ArrayBuffer | undefined>(data)

  // ── Init renderer lifecycle ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container?.canvas) return

    let disposed = false

    async function init(canvas: HTMLCanvasElement) {
      try {
        const { createRenderContext } = await import('@pitant/charts')
        const ctx = await createRenderContext(canvas, {
          renderer: config.renderer ?? 'auto',
        })
        if (disposed) {
          ctx.dispose()
          return
        }
        renderCtxRef.current = ctx
        setReady(true)
      } catch {
        // Renderer init failed — stay in not-ready state
        // Phase 3 will add proper error reporting
      }
    }

    void init(container.canvas)

    return () => {
      disposed = true
      renderCtxRef.current?.dispose()
      renderCtxRef.current = null
      setReady(false)
    }
  }, [containerRef, config.renderer])

  // ── Keep data ref current ────────────────────────────────
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // ── Legend items (derived) ───────────────────────────────
  const legendItems: readonly ChartLegendItem[] = useMemo(
    () =>
      config.series.map((s, i) => ({
        key: s.key,
        label: s.label,
        color: s.color ?? (DEFAULT_COLORS[i % DEFAULT_COLORS.length] as string),
        visible: visibilityMap[s.key] ?? true,
      })),
    [config.series, visibilityMap],
  )

  // ── toggleSeries ─────────────────────────────────────────
  const toggleSeries = useCallback((key: string) => {
    setVisibilityMap((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }))
  }, [])

  // ── append ───────────────────────────────────────────────
  const append = useCallback((newData: Float64Array | ArrayBuffer) => {
    // Phase 3: forward to data engine worker
    // For now, store a reference so tests can verify the API
    dataRef.current = newData
  }, [])

  // ── setData ──────────────────────────────────────────────
  const setData = useCallback((newData: Float64Array | ArrayBuffer) => {
    dataRef.current = newData
  }, [])

  // ── setVisibleRange ──────────────────────────────────────
  const setVisibleRange = useCallback((range: readonly [number, number]) => {
    setVisibleRangeState(range)
  }, [])

  // ── exportImage ──────────────────────────────────────────
  const exportImage = useCallback(
    async (format: 'png' | 'svg', _options?: ExportOptions): Promise<Blob> => {
      const container = containerRef.current
      const canvas = container?.canvas
      if (!canvas) {
        throw new Error('Chart canvas is not available. Is the container mounted?')
      }

      const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/png'

      return new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Canvas toBlob returned null'))
              }
            },
            mimeType,
            1.0,
          )
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    },
    [containerRef],
  )

  return {
    append,
    setData,
    visibleRange,
    setVisibleRange,
    legendItems,
    toggleSeries,
    tooltipPayload,
    tooltipPosition,
    exportImage,
    stats,
    ready,
    config,
  } as UseChartReturn<TConfig>
}
