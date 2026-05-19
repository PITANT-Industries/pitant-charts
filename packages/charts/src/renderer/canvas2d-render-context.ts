import type {
  FillOptions,
  LineOptions,
  RectOptions,
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
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)

    // Apply data→pixel transform if set
    if (this._transform) {
      const sx = this._transform.scaleX
      const sy = this._transform.scaleY
      const tx = this._transform.translateX
      const ty = this._transform.translateY
      const hw = this._width / 2
      const hh = this._height / 2
      // Combine into a single matrix: translate(hw,hh) · scale(sx,sy) · translate(tx,ty)
      this._ctx.transform(sx, 0, 0, sy, sx * tx + hw, sy * ty + hh)
    }
  }

  endFrame(): void {
    this._ctx.restore()
  }

  drawLines(buffer: Float32Array, options: LineOptions): void {
    const ctx = this._ctx
    const [r, g, b, a] = options.color
    ctx.strokeStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
    ctx.lineWidth = options.width
    ctx.lineCap = options.cap ?? 'butt'
    ctx.lineJoin = options.join ?? 'miter'

    const path = new Path2D()
    const len = buffer.length
    if (len >= 2) {
      path.moveTo(buffer[0] as number, buffer[1] as number)
      for (let i = 2; i < len; i += 2) {
        path.lineTo(buffer[i] as number, buffer[i + 1] as number)
      }
    }
    ctx.stroke(path)
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
