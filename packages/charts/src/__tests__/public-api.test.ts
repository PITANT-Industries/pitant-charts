import { describe, expect, it } from 'vitest'

describe('public API', () => {
  it('exports core types and classes', async () => {
    const api = await import('../index.js')

    expect(api.ViewTransform).toBeDefined()
    expect(api.DataEngine).toBeDefined()
    expect(api.createRenderContext).toBeDefined()
    expect(typeof api.createRenderContext).toBe('function')
  })

  it('ViewTransform is constructable', async () => {
    const { ViewTransform } = await import('../index.js')
    const vt = new ViewTransform(1920, 1080)
    expect(vt.viewportWidth).toBe(1920)
    expect(vt.viewportHeight).toBe(1080)
  })

  it('DataEngine is constructable', async () => {
    const { DataEngine } = await import('../index.js')
    const engine = new DataEngine()
    expect(engine).toBeDefined()
    // Don't call methods that spawn a Worker in unit tests
    engine.destroy()
  })
})
