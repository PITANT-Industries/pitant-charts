import { GPUPipelineManager } from './gpu-pipeline.js'
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
 * Deferred text draw command for Canvas2D overlay.
 */
interface TextDraw {
  text: string
  x: number
  y: number
  options: TextOptions
}

/**
 * WebGPU render context with instanced line rendering,
 * analytical anti-aliasing, device loss recovery, and text overlay.
 */
export class WebGPURenderContext implements RenderContext {
  readonly type = 'webgpu' as const
  readonly canvas: HTMLCanvasElement

  private _device: GPUDevice
  private _context: GPUCanvasContext
  private _format: GPUTextureFormat
  private _pipelineManager: GPUPipelineManager
  private _width: number
  private _height: number
  private _dpr: number

  // Current frame state
  private _encoder: GPUCommandEncoder | null = null
  private _pass: GPURenderPassEncoder | null = null
  private _textureView: GPUTextureView | null = null
  private _frameStartTime = 0

  // Transform for current frame
  private _transformMatrix: Float32Array = new Float32Array(16)

  // Text overlay (rendered via Canvas2D after GPU frame)
  private _textOverlayCanvas: HTMLCanvasElement | null = null
  private _textOverlayCtx: CanvasRenderingContext2D | null = null
  private _pendingTexts: TextDraw[] = []

  // Ephemeral GPU buffers created during a frame — destroyed at endFrame
  private _frameBuffers: GPUBuffer[] = []

  // Device loss state
  private _lost = false
  private _onDeviceLost: ((reason: string) => void) | null = null

  // Frame budget tracking
  private _lastFrameMs = 0

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
  ) {
    this.canvas = canvas
    this._device = device
    this._context = context
    this._format = format
    this._pipelineManager = new GPUPipelineManager(device, format)
    this._dpr = globalThis.devicePixelRatio ?? 1
    this._width = canvas.width / this._dpr
    this._height = canvas.height / this._dpr

    // Identity transform
    this._transformMatrix[0] = 1
    this._transformMatrix[5] = 1
    this._transformMatrix[10] = 1
    this._transformMatrix[15] = 1

    this._setupDeviceLostHandler()
    this._setupTextOverlay()
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGPURenderContext> {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      throw new Error('@pitant/charts: No GPU adapter found')
    }
    const device = await adapter.requestDevice()

    const context = canvas.getContext('webgpu')
    if (!context) {
      throw new Error('@pitant/charts: Failed to get WebGPU canvas context')
    }

    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'premultiplied' })

    const dpr = globalThis.devicePixelRatio ?? 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr

    return new WebGPURenderContext(canvas, device, context, format)
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

  /** Duration of the last frame in milliseconds. */
  get lastFrameMs(): number {
    return this._lastFrameMs
  }

  /** Whether the GPU device has been lost. */
  get isLost(): boolean {
    return this._lost
  }

  /** Register a callback for device loss events. */
  set onDeviceLost(cb: ((reason: string) => void) | null) {
    this._onDeviceLost = cb
  }

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    this._dpr = globalThis.devicePixelRatio ?? 1
    this.canvas.width = width * this._dpr
    this.canvas.height = height * this._dpr

    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: 'premultiplied',
    })

    // Resize text overlay
    if (this._textOverlayCanvas) {
      this._textOverlayCanvas.width = this.canvas.width
      this._textOverlayCanvas.height = this.canvas.height
      this._textOverlayCanvas.style.width = `${width}px`
      this._textOverlayCanvas.style.height = `${height}px`
    }
  }

  beginFrame(): void {
    if (this._lost) return

    this._frameStartTime = performance.now()
    this._pendingTexts.length = 0

    this._encoder = this._device.createCommandEncoder({ label: 'frame-encoder' })

    const texture = this._context.getCurrentTexture()
    this._textureView = texture.createView()

    this._pass = this._encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this._textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
  }

  endFrame(): void {
    if (this._lost || !this._pass || !this._encoder) return

    this._pass.end()
    this._device.queue.submit([this._encoder.finish()])

    // Clean up ephemeral buffers
    for (const buf of this._frameBuffers) {
      buf.destroy()
    }
    this._frameBuffers.length = 0

    this._pass = null
    this._encoder = null
    this._textureView = null

    // Render text overlay via Canvas2D
    this._flushTextOverlay()

    this._lastFrameMs = performance.now() - this._frameStartTime
  }

  drawLines(buffer: Float32Array, options: LineOptions): void {
    if (this._lost || !this._pass) return

    const numPoints = buffer.length / 2
    if (numPoints < 2) return

    const { pipeline, frameBindGroupLayout, lineBindGroupLayout } =
      this._pipelineManager.getLinePipeline()

    // Frame uniforms
    const frameBindGroup = this._pipelineManager.getFrameBindGroup(
      frameBindGroupLayout,
      this._width * this._dpr,
      this._height * this._dpr,
      performance.now() / 1000,
    )

    // Point storage buffer
    const pointBuffer = this._pipelineManager.createPointBuffer(buffer)
    this._frameBuffers.push(pointBuffer)

    // Line uniforms
    const capVal = options.cap === 'round' ? 1 : 0
    const joinVal = options.join === 'round' ? 1 : 0
    const uniformBuffer = this._pipelineManager.createLineUniformBuffer(
      options.color,
      this._transformMatrix,
      options.width * this._dpr,
      capVal,
      joinVal,
    )
    this._frameBuffers.push(uniformBuffer)

    // Series bind group
    const lineBindGroup = this._device.createBindGroup({
      layout: lineBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: pointBuffer } },
      ],
    })

    this._pass.setPipeline(pipeline)
    this._pass.setBindGroup(0, frameBindGroup)
    this._pass.setBindGroup(1, lineBindGroup)

    // 6 vertices per segment, (numPoints - 1) segments
    const numSegments = numPoints - 1
    this._pass.draw(6, numSegments)
  }

  drawFill(upper: Float32Array, lower: Float32Array, options: FillOptions): void {
    if (this._lost || !this._pass) return

    const numUpperPoints = upper.length / 2
    const numLowerPoints = lower.length / 2
    if (numUpperPoints < 2 || numLowerPoints < 2) return

    const { pipeline, frameBindGroupLayout, fillBindGroupLayout } =
      this._pipelineManager.getFillPipeline()

    const frameBindGroup = this._pipelineManager.getFrameBindGroup(
      frameBindGroupLayout,
      this._width * this._dpr,
      this._height * this._dpr,
      performance.now() / 1000,
    )

    const upperBuffer = this._pipelineManager.createPointBuffer(upper)
    const lowerBuffer = this._pipelineManager.createPointBuffer(lower)
    this._frameBuffers.push(upperBuffer, lowerBuffer)

    const fillUniformBuffer = this._pipelineManager.createFillUniformBuffer(
      options.color,
      this._transformMatrix,
    )
    this._frameBuffers.push(fillUniformBuffer)

    const fillBindGroup = this._device.createBindGroup({
      layout: fillBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: fillUniformBuffer } },
        { binding: 1, resource: { buffer: upperBuffer } },
        { binding: 2, resource: { buffer: lowerBuffer } },
      ],
    })

    this._pass.setPipeline(pipeline)
    this._pass.setBindGroup(0, frameBindGroup)
    this._pass.setBindGroup(1, fillBindGroup)

    // Triangle strip: 2 vertices per data point pair
    const vertexCount = Math.min(numUpperPoints, numLowerPoints) * 2
    this._pass.draw(vertexCount)
  }

  drawRect(x: number, y: number, w: number, h: number, options: RectOptions): void {
    // Rectangles are rendered as two-triangle fills
    if (options.fillColor) {
      const upper = new Float32Array([x, y, x + w, y])
      const lower = new Float32Array([x, y + h, x + w, y + h])
      this.drawFill(upper, lower, { color: options.fillColor })
    }
    if (options.strokeColor) {
      const color = options.strokeColor
      const sw = options.strokeWidth ?? 1
      const lineOpts: LineOptions = { color, width: sw }
      // Top, right, bottom, left
      this.drawLines(new Float32Array([x, y, x + w, y]), lineOpts)
      this.drawLines(new Float32Array([x + w, y, x + w, y + h]), lineOpts)
      this.drawLines(new Float32Array([x + w, y + h, x, y + h]), lineOpts)
      this.drawLines(new Float32Array([x, y + h, x, y]), lineOpts)
    }
  }

  drawText(text: string, x: number, y: number, options: TextOptions): void {
    // Text is deferred to Canvas2D overlay — GPU text is complex and not needed for charts
    this._pendingTexts.push({ text, x, y, options })
  }

  setTransform(transform: ViewTransform): void {
    this._transformMatrix = transform.toMatrix4()
  }

  getCapabilities(): RendererCapabilities {
    const adapterInfo = this._device.adapterInfo
    const base: RendererCapabilities = {
      type: 'webgpu',
      maxPoints: 10_000_000,
      supportsInstancing: true,
      supportsOffscreen: typeof OffscreenCanvas !== 'undefined',
    }
    if (adapterInfo) {
      base.gpuInfo = {
        vendor: adapterInfo.vendor,
        architecture: adapterInfo.architecture,
        description: adapterInfo.description,
      }
    }
    return base
  }

  dispose(): void {
    this._pipelineManager.destroy()
    for (const buf of this._frameBuffers) {
      buf.destroy()
    }
    this._frameBuffers.length = 0
    this._device.destroy()
    this._textOverlayCanvas?.remove()
    this._lost = true
  }

  // --- Private ---

  private _setupDeviceLostHandler(): void {
    this._device.lost.then((info) => {
      this._lost = true
      const reason = info.reason ?? 'unknown'
      // biome-ignore lint/suspicious/noConsole: device loss warnings are important for debugging
      console.warn(`@pitant/charts: GPU device lost (${reason}): ${info.message}`)
      this._onDeviceLost?.(reason)
    })
  }

  private _setupTextOverlay(): void {
    // Create a transparent Canvas2D overlay for text rendering
    const overlay = document.createElement('canvas')
    overlay.style.position = 'absolute'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.pointerEvents = 'none'
    overlay.width = this.canvas.width
    overlay.height = this.canvas.height
    overlay.style.width = `${this._width}px`
    overlay.style.height = `${this._height}px`

    // Insert after the WebGPU canvas
    this.canvas.parentElement?.insertBefore(overlay, this.canvas.nextSibling)

    this._textOverlayCanvas = overlay
    this._textOverlayCtx = overlay.getContext('2d')
  }

  private _flushTextOverlay(): void {
    const ctx = this._textOverlayCtx
    if (!ctx || this._pendingTexts.length === 0) return

    const overlay = this._textOverlayCanvas
    if (!overlay) return
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    ctx.save()
    ctx.scale(this._dpr, this._dpr)

    for (const { text, x, y, options } of this._pendingTexts) {
      const [r, g, b, a] = options.color
      ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
      ctx.font = `${options.fontSize ?? 12}px ${options.font ?? 'sans-serif'}`
      ctx.textAlign = options.align ?? 'left'
      ctx.textBaseline = options.baseline ?? 'top'
      ctx.fillText(text, x, y)
    }

    ctx.restore()
    this._pendingTexts.length = 0
  }
}
