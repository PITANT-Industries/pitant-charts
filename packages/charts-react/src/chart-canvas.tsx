'use client'

import type { RenderContext, RenderContextOptions, RendererType } from '@pitant/charts'
import { type JSX, useCallback, useEffect, useRef } from 'react'

export interface ChartCanvasProps {
  width: number
  height: number
  pixelRatio?: number
  renderer?: RendererType | 'auto'
  className?: string
  onContextReady?: (ctx: RenderContext) => void
  onContextError?: (error: Error) => void
}

/**
 * Manages canvas lifecycle and render context creation.
 * Full implementation in Phase 2.
 */
export function ChartCanvas(props: ChartCanvasProps): JSX.Element {
  const {
    width,
    height,
    pixelRatio,
    renderer = 'auto',
    className,
    onContextReady,
    onContextError,
  } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<RenderContext | null>(null)
  const dimensionsRef = useRef({ width, height, pixelRatio })
  dimensionsRef.current = { width, height, pixelRatio }

  // Stable callback refs to avoid recreating the context when callbacks change
  const onReadyRef = useRef(onContextReady)
  onReadyRef.current = onContextReady
  const onErrorRef = useRef(onContextError)
  onErrorRef.current = onContextError

  const initContext = useCallback(
    async (canvas: HTMLCanvasElement, signal: { disposed: boolean }) => {
      try {
        const { createRenderContext } = await import('@pitant/charts')
        const options: RenderContextOptions = { renderer }
        const ctx = await createRenderContext(canvas, options)
        if (signal.disposed) {
          ctx.dispose()
          return
        }
        const dimensions = dimensionsRef.current
        ctx.resize(dimensions.width, dimensions.height, dimensions.pixelRatio)
        ctxRef.current = ctx
        onReadyRef.current?.(ctx)
      } catch (error) {
        if (!signal.disposed) {
          onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)))
        }
      }
    },
    [renderer],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const signal = { disposed: false }
    void initContext(canvas, signal)

    return () => {
      signal.disposed = true
      ctxRef.current?.dispose()
      ctxRef.current = null
    }
  }, [initContext])

  useEffect(() => {
    ctxRef.current?.resize(width, height, pixelRatio)
  }, [width, height, pixelRatio])

  return <canvas ref={canvasRef} className={className} style={{ width, height }} />
}
