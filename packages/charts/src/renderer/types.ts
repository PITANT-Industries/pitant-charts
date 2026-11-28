/**
 * Renderer type identifier.
 */
export type RendererType = 'webgpu' | 'canvas2d'

/**
 * Options for line rendering.
 */
export interface LineOptions {
  color: readonly [r: number, g: number, b: number, a: number]
  /** Stroke width in CSS pixels. */
  width: number
  cap?: 'butt' | 'round'
  join?: 'miter' | 'round'
}

/**
 * Options for area fill between two polylines.
 */
export interface FillOptions {
  color: readonly [r: number, g: number, b: number, a: number]
}

/**
 * Options for rectangle rendering.
 */
export interface RectOptions {
  fillColor?: readonly [r: number, g: number, b: number, a: number]
  strokeColor?: readonly [r: number, g: number, b: number, a: number]
  strokeWidth?: number
}

/**
 * Options for text rendering.
 */
export interface TextOptions {
  color: readonly [r: number, g: number, b: number, a: number]
  font?: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  baseline?: 'top' | 'middle' | 'bottom'
}

/**
 * Renderer capability information.
 */
export interface RendererCapabilities {
  type: RendererType
  /** Recommended max points before performance degrades */
  maxPoints: number
  supportsInstancing: boolean
  supportsOffscreen: boolean
  gpuInfo?: {
    vendor: string
    architecture: string
    description: string
  }
}

/**
 * Configuration for creating a render context.
 */
export interface RenderContextOptions {
  renderer?: RendererType | 'auto'
}

/** A renderer clip rectangle in CSS pixels. */
export interface RenderClipRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Unified render context interface.
 * Chart types code exclusively against this interface.
 */
export interface RenderContext {
  readonly type: RendererType
  readonly canvas: HTMLCanvasElement
  readonly width: number
  readonly height: number
  readonly dpr: number

  resize(width: number, height: number, dpr?: number): void
  beginFrame(): void
  endFrame(): void

  drawLines(buffer: Float32Array, options: LineOptions): void
  drawFill(upper: Float32Array, lower: Float32Array, options: FillOptions): void
  drawRect(x: number, y: number, w: number, h: number, options: RectOptions): void
  drawText(text: string, x: number, y: number, options: TextOptions): void

  setTransform(transform: import('./view-transform.js').ViewTransform): void
  setClipRect?(rect: RenderClipRect | null): void

  getCapabilities(): RendererCapabilities

  dispose(): void
}
