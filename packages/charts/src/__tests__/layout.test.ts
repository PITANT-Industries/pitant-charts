import { describe, expect, it } from 'vitest'

import {
  addChartGuidesToCommandList,
  createChartLayout,
  createPlotViewportTransform,
  RenderCommandList,
} from '../index.js'

describe('chart layout planning', () => {
  it('reserves legend and axis areas while preserving a bounded plot area', () => {
    const layout = createChartLayout({
      width: 800,
      height: 420,
      padding: 12,
      legend: { visible: true, position: 'top', size: 40, gap: 8 },
      xAxis: { visible: true, size: 34 },
      yAxis: { visible: true, size: 58 },
      xRange: [0, 100],
      yRange: [-10, 10],
    })

    expect(layout.bounds).toEqual({ x: 0, y: 0, width: 800, height: 420 })
    expect(layout.contentArea).toEqual({ x: 12, y: 12, width: 776, height: 396 })
    expect(layout.legendArea).toEqual({ x: 12, y: 12, width: 776, height: 40 })
    expect(layout.yAxisArea).toEqual({ x: 12, y: 60, width: 58, height: 348 })
    expect(layout.xAxisArea).toEqual({ x: 70, y: 374, width: 718, height: 34 })
    expect(layout.plotArea).toEqual({ x: 70, y: 60, width: 718, height: 314 })
    expect(layout.xTicks).toHaveLength(6)
    expect(layout.yTicks).toHaveLength(5)
  })

  it('maps data coordinates into the reserved plot rectangle', () => {
    const plotArea = { x: 70, y: 60, width: 718, height: 314 }
    const transform = createPlotViewportTransform([0, 100], [-10, 10], 800, 420, plotArea)

    expect(transform.dataToPixel(0, -10)).toEqual({ x: 70, y: 374 })
    expect(transform.dataToPixel(100, 10).x).toBeCloseTo(788)
    expect(transform.dataToPixel(100, 10).y).toBeCloseTo(60)
    expect(transform.pixelToData(70, 374).x).toBeCloseTo(0)
    expect(transform.pixelToData(788, 60).y).toBeCloseTo(10)
  })

  it('adds bounded grid and axis guide commands in data coordinates', () => {
    const layout = createChartLayout({
      width: 320,
      height: 180,
      xRange: [0, 10],
      yRange: [0, 1],
      grid: { xTickCount: 3, yTickCount: 3 },
    })
    const commands = new RenderCommandList()

    addChartGuidesToCommandList(commands, layout, [0, 10], [0, 1])

    expect(commands.length).toBe(8)
    expect(commands.sorted()[0]).toMatchObject({ kind: 'line' })
  })

  it('adds screen-space tick labels and axis titles when axis areas are visible', () => {
    const layout = createChartLayout({
      width: 320,
      height: 180,
      xRange: [0, 10],
      yRange: [0, 100],
      xAxis: {
        visible: true,
        label: 'Time',
        formatValue: (value) => `${value.toFixed(0)}s`,
      },
      yAxis: {
        visible: true,
        label: 'Temperature',
        formatValue: (value) => `${value.toFixed(0)}C`,
      },
    })
    const commands = new RenderCommandList()

    addChartGuidesToCommandList(commands, layout, [0, 10], [0, 100])

    const textCommands = commands.sorted().filter((command) => command.kind === 'text')
    expect(textCommands.map((command) => command.text)).toContain('0s')
    expect(textCommands.map((command) => command.text)).toContain('10s')
    expect(textCommands.map((command) => command.text)).toContain('100C')
    expect(textCommands.map((command) => command.text)).toContain('Time')
    expect(textCommands.map((command) => command.text)).toContain('Temperature')
    expect(textCommands.every((command) => Number.isFinite(command.x))).toBe(true)
    expect(textCommands.every((command) => Number.isFinite(command.y))).toBe(true)
  })
})
