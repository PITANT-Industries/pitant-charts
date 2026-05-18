'use client'

import type { RenderContext, RenderContextOptions, RendererType } from '@pitant/charts'
import { type JSX, useCallback, useEffect, useRef } from 'react'

export interface ChartCanvasProps {
  width: number
  height: number
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
  const { width, height, renderer = 'auto', className, onContextReady, onContextError } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<RenderContext | null>(null)

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
    ctxRef.current?.resize(width, height)
  }, [width, height])

  return <canvas ref={canvasRef} className={className} style={{ width, height }} />
}
