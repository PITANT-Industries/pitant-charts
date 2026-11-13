/**
 * Renderer type identifier.
 */
export type RendererType = 'webgpu' | 'canvas2d'

/**
 * Options for line rendering.
 */
export interface LineOptions {
  color: readonly [r: number, g: number, b: number, a: number]
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

  getCapabilities(): RendererCapabilities

  dispose(): void
}
