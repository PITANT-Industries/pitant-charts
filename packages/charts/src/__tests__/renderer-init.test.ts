import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderContext } from '../renderer/create-render-context.js'

function mockGpu(requestDevice: () => Promise<unknown>) {
  vi.stubGlobal('navigator', {
    gpu: {
      requestAdapter: async () => ({ requestDevice }),
      getPreferredCanvasFormat: () => 'rgba8unorm',
    },
  })
}

function gpuCanvas(configure: () => void) {
  return {
    width: 100,
    height: 100,
    clientWidth: 100,
    clientHeight: 100,
    getContext: vi.fn(() => ({ configure })),
  } as unknown as HTMLCanvasElement
}

afterEach(() => vi.unstubAllGlobals())

describe('renderer initialization', () => {
  it('keeps a canceled WebGPU device from taking over a live canvas', async () => {
    const canceledDevice = { destroy: vi.fn() }
    const liveDevice = { destroy: vi.fn(), lost: new Promise(() => {}) }
    let resolveCanceledDevice!: (device: typeof canceledDevice) => void
    const deferredDevice = new Promise<typeof canceledDevice>((resolve) => {
      resolveCanceledDevice = resolve
    })
    const requestDevice = vi
      .fn()
      .mockReturnValueOnce(deferredDevice)
      .mockResolvedValueOnce(liveDevice)
    mockGpu(requestDevice)

    const configure = vi.fn()
    const canvas = gpuCanvas(configure)
    const controller = new AbortController()
    const pending = createRenderContext(canvas, { renderer: 'webgpu', signal: controller.signal })
    const canceled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    await vi.waitFor(() => expect(requestDevice).toHaveBeenCalledOnce())
    controller.abort()
    const active = await createRenderContext(canvas, { renderer: 'webgpu' })
    resolveCanceledDevice(canceledDevice)
    await canceled

    expect(configure).toHaveBeenCalledExactlyOnceWith({
      device: liveDevice,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied',
    })
    expect(canceledDevice.destroy).toHaveBeenCalledOnce()
    expect(liveDevice.destroy).not.toHaveBeenCalled()
    active.dispose()
  })

  it('destroys the acquired WebGPU device if setup fails', async () => {
    const device = { destroy: vi.fn() }
    mockGpu(async () => device)
    const error = new Error('Failed to configure WebGPU')
    const canvas = gpuCanvas(() => {
      throw error
    })

    await expect(createRenderContext(canvas, { renderer: 'webgpu' })).rejects.toThrow(error)
    expect(device.destroy).toHaveBeenCalledOnce()
  })
})
