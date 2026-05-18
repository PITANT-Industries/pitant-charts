import { describe, expect, it } from 'vitest'
import { ViewTransform } from '../renderer/view-transform.js'

describe('ViewTransform', () => {
  it('initializes with identity transform', () => {
    const vt = new ViewTransform(800, 600)
    expect(vt.scaleX).toBe(1)
    expect(vt.scaleY).toBe(1)
    expect(vt.translateX).toBe(0)
    expect(vt.translateY).toBe(0)
    expect(vt.viewportWidth).toBe(800)
    expect(vt.viewportHeight).toBe(600)
  })

  it('dataToPixel → pixelToData roundtrips', () => {
    const vt = new ViewTransform(800, 600)
    vt.setScale(2, 3)
    vt.setTranslate(10, 20)

    const px = vt.dataToPixel(5, 10)
    const data = vt.pixelToData(px.x, px.y)

    expect(data.x).toBeCloseTo(5, 10)
    expect(data.y).toBeCloseTo(10, 10)
  })

  it('pan shifts the translate', () => {
    const vt = new ViewTransform(800, 600)
    vt.pan(100, -50)
    expect(vt.translateX).toBe(100) // dx / scaleX = 100/1
    expect(vt.translateY).toBe(-50)
  })

  it('zoom preserves anchor point', () => {
    const vt = new ViewTransform(800, 600)
    const anchorX = 200
    const anchorY = 300

    const before = vt.pixelToData(anchorX, anchorY)
    vt.zoom(2, anchorX, anchorY)
    const after = vt.pixelToData(anchorX, anchorY)

    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('toMatrix4 returns 16-element Float32Array', () => {
    const vt = new ViewTransform(800, 600)
    const mat = vt.toMatrix4()

    expect(mat).toBeInstanceOf(Float32Array)
    expect(mat.length).toBe(16)
    // Identity-like: m00 = 2/800, m11 = 2/600, m22 = 1, m33 = 1
    expect(mat[0]).toBeCloseTo(2 / 800)
    expect(mat[5]).toBeCloseTo(2 / 600)
    expect(mat[10]).toBe(1)
    expect(mat[15]).toBe(1)
  })

  it('reset restores identity', () => {
    const vt = new ViewTransform(800, 600)
    vt.setScale(5, 5)
    vt.setTranslate(100, 200)
    vt.reset()
    expect(vt.scaleX).toBe(1)
    expect(vt.scaleY).toBe(1)
    expect(vt.translateX).toBe(0)
    expect(vt.translateY).toBe(0)
  })
})
