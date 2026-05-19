import { describe, expect, it, vi } from 'vitest'
import { Canvas2DRenderContext } from '../renderer/canvas2d-render-context.js'
import { ViewTransform } from '../renderer/view-transform.js'

function makeCanvasContext(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    strokeRect: vi.fn(),
    transform: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

describe('renderer resize behavior', () => {
  it('sizes Canvas2D backing store with explicit DPR without accumulating scale', () => {
    const canvas = document.createElement('canvas')
    const ctx = makeCanvasContext()
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 50 })
    canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext']

    const renderer = new Canvas2DRenderContext(canvas)
    renderer.resize(120, 60, 2)
    const transform = new ViewTransform(120, 60)
    transform.setScale(2, -3)
    transform.setTranslate(4, 5)
    renderer.setTransform(transform)
    renderer.beginFrame()
    renderer.endFrame()

    expect(renderer.width).toBe(120)
    expect(renderer.height).toBe(60)
    expect(renderer.dpr).toBe(2)
    expect(canvas.width).toBe(240)
    expect(canvas.height).toBe(120)
    expect(ctx.scale).not.toHaveBeenCalled()
    expect(ctx.setTransform).toHaveBeenNthCalledWith(1, 1, 0, 0, 1, 0, 0)
    expect(ctx.setTransform).toHaveBeenNthCalledWith(2, 2, 0, 0, 2, 0, 0)
  })

  it('draws text in screen space even when a data transform is active', () => {
    const canvas = document.createElement('canvas')
    const ctx = makeCanvasContext()
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 50 })
    canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext']

    const renderer = new Canvas2DRenderContext(canvas)
    renderer.resize(120, 60, 2)
    renderer.beginFrame()
    renderer.drawText('10s', 42, 54, {
      color: [0.2, 0.25, 0.33, 0.78],
      align: 'center',
      baseline: 'top',
    })
    renderer.endFrame()

    expect(ctx.setTransform).toHaveBeenNthCalledWith(3, 2, 0, 0, 2, 0, 0)
    expect(ctx.fillText).toHaveBeenCalledWith('10s', 42, 54)
  })
})
