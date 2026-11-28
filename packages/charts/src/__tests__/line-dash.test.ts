import { describe, expect, it } from 'vitest'
import { commandFrameToSvg } from '../charts/svg-export.js'
import { normalizeLineDash, packDashedLine } from '../renderer/line-dash.js'
import { RenderCommandList } from '../renderer/render-command-list.js'
import { ViewTransform } from '../renderer/view-transform.js'

describe('line dash', () => {
  it('repeats odd patterns and treats invalid or empty patterns as solid', () => {
    expect(normalizeLineDash([2, 4, 1])).toEqual([2, 4, 1, 2, 4, 1])
    expect(normalizeLineDash([0, 0])).toBeUndefined()
    expect(normalizeLineDash([2, -1])).toBeUndefined()
  })

  it('continues WebGPU stroke phase through a join at the configured scale and DPR', () => {
    const points = new Float32Array([0, 0, 3, 0, 3, 2, 4, 2])
    const { buffer, period } = packDashedLine(points, [4, 2], 3, -6, 2)
    expect(period).toBe(12)
    expect([...buffer]).toEqual([0, 0, 0, 1, 3, 0, 9, 0, 3, 2, 9, 0, 4, 2, 0, 0, 8, 4])
  })

  it('exports the same CSS-pixel dash lengths to SVG', () => {
    const commands = new RenderCommandList()
    commands.addLine(new Float32Array([0, 0, 20, 0]), {
      color: [0, 0, 0, 1],
      width: 2,
      dash: [3, 2, 1],
    })
    const transform = new ViewTransform(120, 80)
    const svg = commandFrameToSvg({ width: 120, height: 80, commands, transform })
    expect(svg).toContain('stroke-dasharray="3 2 1 3 2 1"')
  })
})
