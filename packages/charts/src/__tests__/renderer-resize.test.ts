import { describe, expect, it, vi } from 'vitest'
import { Canvas2DRenderContext } from '../renderer/canvas2d-render-context.js'
import { ViewTransform } from '../renderer/view-transform.js'

function makeCanvasContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
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

  it('builds line paths in data space and strokes with only the backing-store scale', () => {
    const canvas = document.createElement('canvas')
    const ctx = makeCanvasContext()
    canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext']
    const renderer = new Canvas2DRenderContext(canvas)
    renderer.resize(120, 60, 2)
    const transform = new ViewTransform(120, 60)
    transform.setScale(0.5, -400)
    transform.setTranslate(-10, -9.25)
    renderer.setTransform(transform)
    renderer.beginFrame()
    renderer.drawLines(new Float32Array([10, 9.25, 40, 9.3125]), {
      color: [0, 0, 1, 1],
      width: 1.5,
      cap: 'round',
      join: 'round',
    })
    renderer.endFrame()

    expect(ctx.transform).toHaveBeenCalledWith(0.5, 0, 0, -400, 55, 3730)
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 9.25)
    expect(ctx.lineTo).toHaveBeenCalledWith(40, 9.3125)
    expect(ctx.setTransform).toHaveBeenNthCalledWith(3, 2, 0, 0, 2, 0, 0)
    expect(vi.mocked(ctx.lineTo).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(ctx.setTransform).mock.invocationCallOrder[2] as number,
    )
    expect(vi.mocked(ctx.stroke).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(ctx.setTransform).mock.invocationCallOrder[2] as number,
    )
    expect(ctx.lineWidth).toBe(1.5)
    expect(ctx.lineCap).toBe('round')
    expect(ctx.lineJoin).toBe('round')
    expect(ctx.restore).toHaveBeenCalledTimes(2)
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
