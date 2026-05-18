import { describe, expect, it } from 'vitest'

import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'

describe('RenderCommandList', () => {
  it('starts empty', () => {
    const list = new RenderCommandList()
    expect(list.length).toBe(0)
    expect(list.sorted()).toEqual([])
  })

  it('adds line commands', () => {
    const list = new RenderCommandList()
    const buf = new Float32Array([0, 0, 1, 1])
    list.addLine(buf, { color: [1, 0, 0, 1], width: 2 })
    expect(list.length).toBe(1)
    const cmds = list.sorted()
    expect(cmds[0]?.kind).toBe('line')
  })

  it('adds fill commands', () => {
    const list = new RenderCommandList()
    const upper = new Float32Array([0, 1, 1, 2])
    const lower = new Float32Array([0, 0, 1, 0])
    list.addFill(upper, lower, { color: [0, 1, 0, 0.5] })
    expect(list.length).toBe(1)
    expect(list.sorted()[0]?.kind).toBe('fill')
  })

  it('adds rect commands', () => {
    const list = new RenderCommandList()
    list.addRect(10, 20, 100, 50, { fillColor: [0, 0, 1, 1] })
    expect(list.length).toBe(1)
    expect(list.sorted()[0]?.kind).toBe('rect')
  })

  it('adds text commands', () => {
    const list = new RenderCommandList()
    list.addText('hello', 10, 20, { color: [1, 1, 1, 1] })
    expect(list.length).toBe(1)
    expect(list.sorted()[0]?.kind).toBe('text')
  })

  it('sorts by z-layer: fills before lines before overlays before text', () => {
    const list = new RenderCommandList()
    list.addText('t', 0, 0, { color: [1, 1, 1, 1] })
    list.addLine(new Float32Array([0, 0, 1, 1]), { color: [1, 0, 0, 1], width: 1 })
    list.addRect(0, 0, 10, 10, { fillColor: [0, 0, 1, 1] })
    list.addFill(new Float32Array([0, 1]), new Float32Array([0, 0]), { color: [0, 1, 0, 1] })

    const sorted = list.sorted()
    expect(sorted.map((c) => c.kind)).toEqual(['fill', 'line', 'rect', 'text'])
  })

  it('preserves insertion order within the same z-layer', () => {
    const list = new RenderCommandList()
    list.addLine(new Float32Array([0, 0, 1, 1]), { color: [1, 0, 0, 1], width: 1 })
    list.addLine(new Float32Array([2, 2, 3, 3]), { color: [0, 1, 0, 1], width: 2 })

    const sorted = list.sorted()
    expect(sorted).toHaveLength(2)
    if (sorted[0]?.kind === 'line' && sorted[1]?.kind === 'line') {
      expect(sorted[0].options.width).toBe(1)
      expect(sorted[1].options.width).toBe(2)
    }
  })

  it('allows custom z-layer override', () => {
    const list = new RenderCommandList()
    // Add a line at Fill layer and a fill at Line layer — should swap
    list.addLine(new Float32Array([0, 0, 1, 1]), { color: [1, 0, 0, 1], width: 1 }, ZLayer.Fill)
    list.addFill(
      new Float32Array([0, 1]),
      new Float32Array([0, 0]),
      { color: [0, 1, 0, 1] },
      ZLayer.Line,
    )

    const sorted = list.sorted()
    expect(sorted[0]?.kind).toBe('line')
    expect(sorted[1]?.kind).toBe('fill')
  })

  it('clears all commands', () => {
    const list = new RenderCommandList()
    list.addLine(new Float32Array([0, 0, 1, 1]), { color: [1, 0, 0, 1], width: 1 })
    list.addText('t', 0, 0, { color: [1, 1, 1, 1] })
    expect(list.length).toBe(2)

    list.clear()
    expect(list.length).toBe(0)
    expect(list.sorted()).toEqual([])
  })

  it('sorted() returns a copy, not the internal array', () => {
    const list = new RenderCommandList()
    list.addLine(new Float32Array([0, 0, 1, 1]), { color: [1, 0, 0, 1], width: 1 })

    const a = list.sorted()
    const b = list.sorted()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})
