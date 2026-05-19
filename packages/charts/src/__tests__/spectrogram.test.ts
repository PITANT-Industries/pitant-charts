import { describe, expect, it } from 'vitest'

import {
  addSpectrogramToCommandList,
  buildSpectrogramCommandFrame,
  buildSpectrogramRenderPlan,
  commandFrameToSvg,
  RenderCommandList,
} from '../index.js'

describe('spectrogram chart planning', () => {
  it('builds heatmap tiles from precomputed time-frequency bins', () => {
    const plan = buildSpectrogramRenderPlan({
      timeBins: new Float64Array([0, 1, 2]),
      frequencyBins: new Float64Array([10, 20]),
      values: new Float32Array([1, 2, 3, 4, 5, 6]),
    })

    expect(plan.kind).toBe('spectrogram')
    expect(plan.timeBinCount).toBe(3)
    expect(plan.frequencyBinCount).toBe(2)
    expect(plan.sourceTileCount).toBe(6)
    expect(plan.renderedTileCount).toBe(6)
    expect(plan.xRange).toEqual([-0.5, 2.5])
    expect(plan.yRange).toEqual([5, 25])
    expect(plan.zRange[0]).toBeLessThanOrEqual(1)
    expect(plan.zRange[1]).toBeGreaterThanOrEqual(6)

    const first = plan.tiles[0]
    expect(first?.x).toBe(-0.5)
    expect(first?.y).toBe(5)
    expect(first?.width).toBe(1)
    expect(first?.height).toBe(10)
  })

  it('clips tiles to requested time and frequency ranges', () => {
    const plan = buildSpectrogramRenderPlan(
      {
        timeBins: new Float64Array([0, 1, 2, 3]),
        frequencyBins: new Float64Array([10, 20, 30]),
        values: new Float32Array(12).fill(1),
      },
      {
        xRange: [0.5, 2.5],
        yRange: [15, 25],
      },
    )

    expect(plan.renderedTileCount).toBe(2)
    expect(plan.tiles.every((tile) => tile.x >= 0.5 && tile.x + tile.width <= 2.5)).toBe(true)
    expect(plan.tiles.every((tile) => tile.y >= 15 && tile.y + tile.height <= 25)).toBe(true)
  })

  it('supports time-major value layout', () => {
    const plan = buildSpectrogramRenderPlan({
      timeBins: new Float64Array([0, 1]),
      frequencyBins: new Float64Array([10, 20, 30]),
      values: new Float32Array([1, 10, 100, 2, 20, 200]),
      valueLayout: 'time-major',
    })

    expect(plan.tiles.map((tile) => tile.value)).toEqual([1, 2, 10, 20, 100, 200])
  })

  it('adds spectrogram tiles as command-list rectangles', () => {
    const plan = buildSpectrogramRenderPlan({
      timeBins: new Float64Array([0, 1]),
      frequencyBins: new Float64Array([10, 20]),
      values: new Float32Array([1, 2, 3, 4]),
    })
    const commands = new RenderCommandList()

    addSpectrogramToCommandList(commands, plan)

    expect(commands.length).toBe(4)
    expect(commands.sorted().every((command) => command.kind === 'rect')).toBe(true)
  })

  it('exports spectrogram tiles through the command-frame SVG path', () => {
    const plan = buildSpectrogramRenderPlan({
      timeBins: new Float64Array([0, 1]),
      frequencyBins: new Float64Array([10, 20]),
      values: new Float32Array([1, 2, 3, 4]),
    })
    const frame = buildSpectrogramCommandFrame(plan, 420, 260)
    const svg = commandFrameToSvg(frame, { title: 'Spectrogram' })

    expect(svg).toContain('<rect')
    expect(svg).toContain('clip-path')
    expect(svg).toContain('Spectrogram')
  })
})
