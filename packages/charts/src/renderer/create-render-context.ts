import type { RenderContext, RenderContextOptions, RendererType } from './types.js'

/**
 * Detect whether WebGPU is available in the current environment.
 */
async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return false
  }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

/**
 * Create a render context for the given canvas.
 *
 * @param canvas - Target canvas element
 * @param options - Renderer selection options
 * @returns A render context (WebGPU or Canvas2D)
 */
export async function createRenderContext(
  canvas: HTMLCanvasElement,
  options: RenderContextOptions = {},
): Promise<RenderContext> {
  const renderer = options.renderer ?? 'auto'

  let selectedType: RendererType

  if (renderer === 'auto') {
    selectedType = (await isWebGPUAvailable()) ? 'webgpu' : 'canvas2d'
  } else {
    selectedType = renderer
  }

  if (selectedType === 'webgpu') {
    if (!(await isWebGPUAvailable())) {
      throw new Error(
        '@pitant/charts: WebGPU is not available. Use renderer: "auto" or "canvas2d".',
      )
    }
    // Lazy import to tree-shake WebGPU code on Canvas2D-only builds
    const { WebGPURenderContext } = await import('./webgpu-render-context.js')
    return WebGPURenderContext.create(canvas)
  }

  const { Canvas2DRenderContext } = await import('./canvas2d-render-context.js')
  return new Canvas2DRenderContext(canvas)
}
