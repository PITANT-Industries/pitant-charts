import type {
  FillOptions,
  LineOptions,
  RectOptions,
  RenderClipRect,
  RenderContext,
  RendererCapabilities,
  TextOptions,
} from './types.js'
import type { ViewTransform } from './view-transform.js'

/**
 * Canvas2D fallback render context — full implementation in E1.3.
 */
export class Canvas2DRenderContext implements RenderContext {
  readonly type = 'canvas2d' as const
  readonly canvas: HTMLCanvasElement

  private _ctx: CanvasRenderingContext2D
  private _width: number
  private _height: number
  private _dpr: number
  private _transform: ViewTransform | null = null
  private _frameActive = false
  private _clipActive = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('@pitant/charts: Failed to get Canvas2D context')
    }
    this._ctx = ctx
    this._dpr = devicePixelRatio()
    this._width = canvas.clientWidth
    this._height = canvas.clientHeight
    this._resizeBackingStore(this._width, this._height, this._dpr)
  }

  get width(): number {
    return this._width
  }
  get height(): number {
    return this._height
  }
  get dpr(): number {
    return this._dpr
  }

  resize(width: number, height: number, dpr = devicePixelRatio()): void {
    this._width = width
    this._height = height
    this._dpr = normalizeDpr(dpr)
    this._resizeBackingStore(width, height, this._dpr)
  }

  beginFrame(): void {
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this._ctx.save()
    this._frameActive = true
    this._applyTransform()
  }

  endFrame(): void {
    if (this._clipActive) {
      this._ctx.restore()
      this._clipActive = false
    }
    this._ctx.restore()
    this._frameActive = false
  }

  drawLines(buffer: Float32Array, options: LineOptions): void {
    const ctx = this._ctx
    const [r, g, b, a] = options.color
    ctx.strokeStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
    ctx.lineWidth = options.width
    ctx.lineCap = options.cap ?? 'butt'
    ctx.lineJoin = options.join ?? 'miter'

    const len = buffer.length
    if (len < 2) return
    ctx.beginPath()
    ctx.moveTo(buffer[0] as number, buffer[1] as number)
    for (let i = 2; i < len; i += 2) {
      ctx.lineTo(buffer[i] as number, buffer[i + 1] as number)
    }

    // The current path captures the data transform as it is built.
    // Apply only the backing-store scale when stroking so width stays in CSS pixels.
    ctx.save()
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    ctx.stroke()
    ctx.restore()
  }

  drawFill(upper: Float32Array, lower: Float32Array, options: FillOptions): void {
    const ctx = this._ctx
    const [r, g, b, a] = options.color
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`

    const path = new Path2D()
    const upperLen = upper.length
    const lowerLen = lower.length

    if (upperLen >= 2) {
      path.moveTo(upper[0] as number, upper[1] as number)
      for (let i = 2; i < upperLen; i += 2) {
        path.lineTo(upper[i] as number, upper[i + 1] as number)
      }
    }
    // Trace lower boundary in reverse
    if (lowerLen >= 2) {
      for (let i = lowerLen - 2; i >= 0; i -= 2) {
        path.lineTo(lower[i] as number, lower[i + 1] as number)
      }
    }
    path.closePath()
    ctx.fill(path)
  }

  drawRect(x: number, y: number, w: number, h: number, options: RectOptions): void {
    const ctx = this._ctx
    if (options.fillColor) {
      const [r, g, b, a] = options.fillColor
      ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
      ctx.fillRect(x, y, w, h)
    }
    if (options.strokeColor) {
      const [r, g, b, a] = options.strokeColor
      ctx.strokeStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
      ctx.lineWidth = options.strokeWidth ?? 1
      ctx.strokeRect(x, y, w, h)
    }
  }

  drawText(text: string, x: number, y: number, options: TextOptions): void {
    const ctx = this._ctx
    const [r, g, b, a] = options.color
    ctx.save()
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
    ctx.font = `${options.fontSize ?? 12}px ${options.font ?? 'sans-serif'}`
    ctx.textAlign = options.align ?? 'left'
    ctx.textBaseline = options.baseline ?? 'top'
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  setTransform(transform: ViewTransform): void {
    this._transform = transform
    if (this._frameActive) this._applyTransform()
  }

  setClipRect(rect: RenderClipRect | null): void {
    if (!this._frameActive) return
    const ctx = this._ctx
    if (this._clipActive) ctx.restore()
    this._clipActive = rect !== null
    if (rect) {
      ctx.save()
      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.width, rect.height)
      ctx.clip()
    }
    this._applyTransform()
  }

  getCapabilities(): RendererCapabilities {
    return {
      type: 'canvas2d',
      maxPoints: 200_000,
      supportsInstancing: false,
      supportsOffscreen: typeof OffscreenCanvas !== 'undefined',
    }
  }

  dispose(): void {
    // Canvas2D doesn't need explicit GPU cleanup
  }

  private _applyTransform(): void {
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    if (!this._transform) return
    const { scaleX, scaleY, translateX, translateY } = this._transform
    this._ctx.transform(
      scaleX,
      0,
      0,
      scaleY,
      scaleX * translateX + this._width / 2,
      scaleY * translateY + this._height / 2,
    )
  }

  private _resizeBackingStore(width: number, height: number, dpr: number): void {
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== pixelWidth) {
      this.canvas.width = pixelWidth
    }
    if (this.canvas.height !== pixelHeight) {
      this.canvas.height = pixelHeight
    }
  }
}

function devicePixelRatio(): number {
  return normalizeDpr(globalThis.devicePixelRatio ?? 1)
}

function normalizeDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1
}
