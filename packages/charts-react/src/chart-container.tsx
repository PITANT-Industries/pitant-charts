'use client'

import type { ReactNode, RefObject } from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Dimensions } from './use-dimensions.js'
import { useDimensions } from './use-dimensions.js'

// ── Public types ─────────────────────────────────────────────

export interface ChartContainerProps {
  /** CSS class merged onto the outer wrapper `<div>`. */
  className?: string
  /** Inline styles merged onto the outer wrapper `<div>`. */
  style?: React.CSSProperties
  /** DOM children rendered in the overlay layer above the canvas. */
  children?: ReactNode
  /** Aspect ratio constraint (e.g. `16 / 9`). Omit for parent-sized. */
  aspectRatio?: number
  /** Fired after the container or device-pixel-ratio changes. */
  onResize?: (width: number, height: number, dpr: number) => void
  /** Accessible label for the chart. Defaults to `"Chart"`. */
  ariaLabel?: string
  /** id of an element describing the chart data (e.g. a table). */
  ariaDescribedBy?: string
}

export interface ChartContainerRef {
  /** The underlying `<canvas>` element, or `null` before mount. */
  canvas: HTMLCanvasElement | null
  /** Current layout dimensions (CSS px) and device-pixel-ratio. */
  dimensions: Dimensions
  /** Export the canvas content as a data URL. */
  toDataURL: (type?: string, quality?: number) => string
  /** Bump the invalidation counter to trigger a re-render cycle. */
  invalidate: () => void
}

// ── Context for child access to dimensions ───────────────────

export interface ChartContainerContext {
  dimensions: Dimensions
  canvasRef: RefObject<HTMLCanvasElement | null>
}

// ── Component ────────────────────────────────────────────────

export const ChartContainer = forwardRef<ChartContainerRef, ChartContainerProps>(
  function ChartContainer(
    { className, style, children, aspectRatio, onResize, ariaLabel = 'Chart', ariaDescribedBy },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const dims = useDimensions(containerRef)
    const [, setTick] = useState(0)

    // Keep a stable ref to avoid re-attaching ResizeObserver in useDimensions
    const onResizeRef = useRef(onResize)
    onResizeRef.current = onResize

    // Fire onResize whenever dims change
    useEffect(() => {
      if (dims.width > 0 && dims.height > 0 && dims.dpr > 0) {
        onResizeRef.current?.(dims.width, dims.height, dims.dpr)
      }
    }, [dims.width, dims.height, dims.dpr])

    // Scale the canvas backing store to match DPR
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || dims.width <= 0 || dims.height <= 0) return
      const pixelWidth = Math.max(1, Math.round(dims.width * dims.dpr))
      const pixelHeight = Math.max(1, Math.round(dims.height * dims.dpr))
      if (canvas.width !== pixelWidth) {
        canvas.width = pixelWidth
      }
      if (canvas.height !== pixelHeight) {
        canvas.height = pixelHeight
      }
    }, [dims.width, dims.height, dims.dpr])

    const invalidate = useCallback(() => {
      setTick((t) => t + 1)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        canvas: canvasRef.current,
        dimensions: dims,
        toDataURL: (type?: string, quality?: number) =>
          canvasRef.current?.toDataURL(type, quality) ?? '',
        invalidate,
      }),
      [dims, invalidate],
    )

    const mergedStyle: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      ...(aspectRatio !== undefined ? { aspectRatio: String(aspectRatio) } : undefined),
      ...style,
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={mergedStyle}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        {/* Canvas layer — rendering surface */}
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />

        {/* Overlay layer — DOM-based children (tooltip, legend, etc.) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {children}
        </div>
      </div>
    )
  },
) as ReturnType<typeof forwardRef<ChartContainerRef, ChartContainerProps>> & {
  displayName: string
}

ChartContainer.displayName = 'ChartContainer'
