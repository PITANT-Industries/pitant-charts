import { FILL_SHADER, LINE_SHADER } from './shaders.js'

/**
 * Per-frame shared uniform data uploaded once per frame.
 * Layout: [viewportWidth, viewportHeight, time, _pad] = 16 bytes
 */
const FRAME_UNIFORM_SIZE = 16

/**
 * Per-series line uniform data.
 * Layout: [color(4f), transform(16f), width, cap, join, _pad] = 96 bytes
 * Must be aligned to 256 bytes for dynamic offsets.
 */
const LINE_UNIFORM_SIZE = 96
const LINE_UNIFORM_ALIGNED = 256

/**
 * Per-series fill uniform data.
 * Layout: [color(4f), transform(16f)] = 80 bytes
 */
const FILL_UNIFORM_SIZE = 80
const FILL_UNIFORM_ALIGNED = 256

export interface LinePipelineState {
  pipeline: GPURenderPipeline
  frameBindGroupLayout: GPUBindGroupLayout
  lineBindGroupLayout: GPUBindGroupLayout
}

export interface FillPipelineState {
  pipeline: GPURenderPipeline
  frameBindGroupLayout: GPUBindGroupLayout
  fillBindGroupLayout: GPUBindGroupLayout
}

/**
 * Manages GPU pipeline creation, caching, and buffer allocation.
 */
export class GPUPipelineManager {
  private _device: GPUDevice
  private _format: GPUTextureFormat
  private _linePipeline: LinePipelineState | null = null
  private _fillPipeline: FillPipelineState | null = null
  private _frameUniformBuffer: GPUBuffer | null = null
  private _frameBindGroup: GPUBindGroup | null = null

  constructor(device: GPUDevice, format: GPUTextureFormat) {
    this._device = device
    this._format = format
  }

  getLinePipeline(): LinePipelineState {
    if (this._linePipeline) return this._linePipeline

    const device = this._device

    const frameBindGroupLayout = device.createBindGroupLayout({
      label: 'line-frame-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const lineBindGroupLayout = device.createBindGroupLayout({
      label: 'line-series-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    })

    const pipelineLayout = device.createPipelineLayout({
      label: 'line-pipeline-layout',
      bindGroupLayouts: [frameBindGroupLayout, lineBindGroupLayout],
    })

    const shaderModule = device.createShaderModule({
      label: 'line-shader',
      code: LINE_SHADER,
    })

    const pipeline = device.createRenderPipeline({
      label: 'line-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this._format,
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    this._linePipeline = { pipeline, frameBindGroupLayout, lineBindGroupLayout }
    return this._linePipeline
  }

  getFillPipeline(): FillPipelineState {
    if (this._fillPipeline) return this._fillPipeline

    const device = this._device

    const frameBindGroupLayout = device.createBindGroupLayout({
      label: 'fill-frame-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const fillBindGroupLayout = device.createBindGroupLayout({
      label: 'fill-series-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    })

    const pipelineLayout = device.createPipelineLayout({
      label: 'fill-pipeline-layout',
      bindGroupLayouts: [frameBindGroupLayout, fillBindGroupLayout],
    })

    const shaderModule = device.createShaderModule({
      label: 'fill-shader',
      code: FILL_SHADER,
    })

    const pipeline = device.createRenderPipeline({
      label: 'fill-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this._format,
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32',
      },
    })

    this._fillPipeline = { pipeline, frameBindGroupLayout, fillBindGroupLayout }
    return this._fillPipeline
  }

  /**
   * Create or get the shared frame uniform buffer + bind group.
   */
  getFrameBindGroup(
    layout: GPUBindGroupLayout,
    width: number,
    height: number,
    time: number,
  ): GPUBindGroup {
    if (!this._frameUniformBuffer) {
      this._frameUniformBuffer = this._device.createBuffer({
        label: 'frame-uniforms',
        size: FRAME_UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
    }

    const data = new Float32Array([width, height, time, 0])
    this._device.queue.writeBuffer(this._frameUniformBuffer, 0, data)

    // Recreate bind group each frame (cheap; layout may differ between pipelines)
    this._frameBindGroup = this._device.createBindGroup({
      label: 'frame-bind-group',
      layout,
      entries: [{ binding: 0, resource: { buffer: this._frameUniformBuffer } }],
    })

    return this._frameBindGroup
  }

  /**
   * Create a storage buffer from a Float32Array of [x,y] pairs.
   */
  createPointBuffer(data: Float32Array): GPUBuffer {
    const buffer = this._device.createBuffer({
      label: 'points-storage',
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Float32Array(buffer.getMappedRange()).set(data)
    buffer.unmap()
    return buffer
  }

  /**
   * Create a uniform buffer for per-series line data.
   */
  createLineUniformBuffer(
    color: readonly [number, number, number, number],
    transform: Float32Array,
    width: number,
    cap: number,
    join: number,
  ): GPUBuffer {
    const buffer = this._device.createBuffer({
      label: 'line-uniforms',
      size: LINE_UNIFORM_ALIGNED,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Pack: color(4f) + transform(16f) + width + cap + join + pad
    const data = new Float32Array(LINE_UNIFORM_SIZE / 4)
    data[0] = color[0]
    data[1] = color[1]
    data[2] = color[2]
    data[3] = color[3]
    data.set(transform, 4)
    data[20] = width
    data[21] = cap
    data[22] = join
    data[23] = 0 // padding

    this._device.queue.writeBuffer(buffer, 0, data)
    return buffer
  }

  /**
   * Update a line uniform buffer in place.
   */
  updateLineUniforms(
    buffer: GPUBuffer,
    color: readonly [number, number, number, number],
    transform: Float32Array,
    width: number,
    cap: number,
    join: number,
  ): void {
    const data = new Float32Array(LINE_UNIFORM_SIZE / 4)
    data[0] = color[0]
    data[1] = color[1]
    data[2] = color[2]
    data[3] = color[3]
    data.set(transform, 4)
    data[20] = width
    data[21] = cap
    data[22] = join
    data[23] = 0
    this._device.queue.writeBuffer(buffer, 0, data)
  }

  /**
   * Create a uniform buffer for per-series fill data.
   */
  createFillUniformBuffer(
    color: readonly [number, number, number, number],
    transform: Float32Array,
  ): GPUBuffer {
    const buffer = this._device.createBuffer({
      label: 'fill-uniforms',
      size: FILL_UNIFORM_ALIGNED,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const data = new Float32Array(FILL_UNIFORM_SIZE / 4)
    data[0] = color[0]
    data[1] = color[1]
    data[2] = color[2]
    data[3] = color[3]
    data.set(transform, 4)

    this._device.queue.writeBuffer(buffer, 0, data)
    return buffer
  }

  destroy(): void {
    this._frameUniformBuffer?.destroy()
    this._linePipeline = null
    this._fillPipeline = null
    this._frameUniformBuffer = null
    this._frameBindGroup = null
  }
}

export { FILL_UNIFORM_ALIGNED, LINE_UNIFORM_ALIGNED }
