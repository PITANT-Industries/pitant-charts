import { describe, expect, it } from 'vitest'
import { buildHeatmapCommandFrame, buildHeatmapRenderPlan, commandFrameToSvg } from '../index.js'

describe('numeric heatmap', () => {
  it('preserves exact nonuniform cell edges and supports both dense value orders', () => {
    const xOrigin = 1_800_000_000_000
    const yOrigin = 1_200_000_000_000
    const xEdges = new Float64Array([xOrigin, xOrigin + 1, xOrigin + 4, xOrigin + 8])
    const yEdges = new Float64Array([yOrigin, yOrigin + 2, yOrigin + 9])
    const xMajor = buildHeatmapRenderPlan({
      xEdges,
      yEdges,
      values: new Float32Array([1, 4, 2, 5, 3, 6]),
      valueLayout: 'x-major',
    })
    const yMajor = buildHeatmapRenderPlan({
      xEdges,
      yEdges,
      values: new Float32Array([1, 2, 3, 4, 5, 6]),
    })

    expect(xMajor).toEqual(yMajor)
    expect(xMajor).toMatchObject({
      kind: 'heatmap',
      xOrigin,
      yOrigin,
      xRelativeRange: [0, 8],
      yRelativeRange: [0, 9],
      tiles: [
        { x: 0, y: 0, width: 1, height: 2, value: 1 },
        { x: 1, y: 0, width: 3, height: 2, value: 2 },
        { x: 4, y: 0, width: 4, height: 2, value: 3 },
        { x: 0, y: 2, width: 1, height: 7, value: 4 },
        { x: 1, y: 2, width: 3, height: 7, value: 5 },
        { x: 4, y: 2, width: 4, height: 7, value: 6 },
      ],
    })
    const frame = buildHeatmapCommandFrame(xMajor, 480, 320, {
      layout: {
        width: 480,
        height: 320,
        xAxis: { tickValues: [xOrigin + 1], formatValue: (x) => String(x) },
        yAxis: { tickValues: [yOrigin + 2], formatValue: (y) => String(y) },
      },
    })
    expect(frame.layout?.xTicks[0]).toMatchObject({ value: 1, label: String(xOrigin + 1) })
    expect(frame.layout?.yTicks[0]).toMatchObject({ value: 2, label: String(yOrigin + 2) })
    expect(commandFrameToSvg(frame)).toContain(String(yOrigin + 2))
  })

  it('clips sparse cells independently and only includes explicitly supplied missing cells', () => {
    const data = {
      cells: [
        { xRange: [-5, 2], yRange: [10, 30], value: 2 },
        { xRange: [4, 6], yRange: [40, 60], value: Number.NaN },
        { xRange: [9, 12], yRange: [45, 55], value: 10 },
        { xRange: [20, 50], yRange: [100, 200], value: 100 },
      ],
      missingColor: [1, 0, 0, 1],
    } as const
    const ranges = { xRange: [0, 10], yRange: [20, 65] } as const
    const plan = buildHeatmapRenderPlan(data, { ...ranges, includeMissing: true })
    expect(plan).toMatchObject({
      xRange: [0, 10],
      yRange: [20, 65],
      sourceTileCount: 4,
      renderedTileCount: 3,
      tiles: [
        { x: 0, y: 0, width: 2, height: 10, value: 2 },
        {
          x: 4,
          y: 20,
          width: 2,
          height: 20,
          value: Number.NaN,
          style: { fillColor: data.missingColor },
        },
        { x: 9, y: 25, width: 1, height: 10, value: 10 },
      ],
    })
    expect(plan.zRange[0]).toBeLessThan(2)
    expect(plan.zRange[1]).toBeLessThan(11)
    expect(buildHeatmapRenderPlan(data, ranges).renderedTileCount).toBe(2)
  })

  it('reports malformed dense axes without drawing ambiguous cells', () => {
    const plan = buildHeatmapRenderPlan({
      xEdges: new Float64Array([0, 1, 1]),
      yEdges: new Float64Array([0, 1]),
      values: new Float32Array([1]),
    })
    expect(plan.tiles).toEqual([])
    expect(plan.warnings).toEqual([
      'Heatmap values provide 1 tiles for 2 grid cells.',
      'Heatmap axis edges must be finite and strictly ascending.',
    ])
  })
})
