import { describe, expect, it } from 'vitest'
import { calendarTicks, createAxisProjection } from '../charts/axis-scale.js'
import {
  addChartGuidesToCommandList,
  createChartLayout,
  createPlotViewportTransform,
} from '../charts/common.js'
import { mapChartPointToDataPoint, mapDataPointToChartPoint } from '../charts/pointer.js'
import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'

describe('axis scales', () => {
  it('rotates scales, their gutters, tick pixels and pointer mapping together', () => {
    const xRange = [0, 100] as const
    const yRange = [1, 1000] as const
    const layout = createChartLayout({
      width: 500,
      height: 260,
      orientation: 'rotated',
      padding: { left: 12, bottom: 20 },
      xRange,
      yRange,
      xAxis: { visible: true, tickValues: [25] },
      yAxis: { visible: true, scale: { type: 'log' }, tickValues: [100] },
    })
    const { plotArea } = layout
    const transform = createPlotViewportTransform(xRange, yRange, 500, 260, plotArea, layout)
    const point = transform.dataToPixel(25, 100)
    expect(layout.xAxisArea?.x).toBe(12)
    expect(layout.yAxisArea?.y).toBeLessThan(plotArea.y)
    expect(point.x).toBeCloseTo(plotArea.x + (2 / 3) * plotArea.width)
    expect(point.y).toBeCloseTo(plotArea.y + 0.25 * plotArea.height)
    expect(layout.xTicks[0]?.position).toBeCloseTo(point.y)
    expect(layout.yTicks[0]?.position).toBeCloseTo(point.x)
    const pointer = mapChartPointToDataPoint({ ...point, layout, xRange, yRange })
    expect(pointer.x).toBeCloseTo(25)
    expect(pointer.y).toBeCloseTo(100)
    const restored = transform.pixelToData(point.x, point.y)
    expect(restored.x).toBeCloseTo(25)
    expect(restored.y).toBeCloseTo(100)
    expect(mapDataPointToChartPoint({ x: 25, y: 100, layout, xRange, yRange })).toEqual(point)
  })

  it('keeps log ticks, rendered coordinates, and interactions on the same reversed axis', () => {
    const xRange = [0, 9] as const
    const yRange = [1, 1000] as const
    const layout = createChartLayout({
      width: 400,
      height: 240,
      xRange,
      yRange,
      xAxis: { visible: true, side: 'top' },
      yAxis: { visible: true, side: 'right', scale: { type: 'log', reverse: true } },
    })
    const transform = createPlotViewportTransform(xRange, yRange, 400, 240, layout.plotArea, layout)
    expect(layout.yTicks.map((tick) => tick.value)).toEqual([1, 10, 100, 1000])
    expect(layout.xAxisArea?.y).toBeLessThan(layout.plotArea.y)
    expect(layout.yAxisArea?.x).toBe(layout.plotArea.x + layout.plotArea.width)
    const point = transform.dataToPixel(2, 100)
    expect(point.y).toBeCloseTo(layout.yTicks[2]?.position ?? NaN)
    const mapped = mapChartPointToDataPoint({ ...point, layout, xRange, yRange })
    expect(mapped.x).toBeCloseTo(2)
    expect(mapped.y).toBeCloseTo(100)
    const inverse = mapDataPointToChartPoint({ x: 2, y: 100, layout, xRange, yRange })
    expect(inverse.x).toBeCloseTo(point.x)
    expect(inverse.y).toBeCloseTo(point.y)
  })

  it('aligns dependent axes to the exact ticks of their source axis', () => {
    const layout = createChartLayout({
      width: 400,
      height: 240,
      yAxes: [
        { key: 'celsius', range: [0, 100], tickCount: 3 },
        {
          key: 'fahrenheit',
          from: {
            key: 'celsius',
            fromSource: (value) => value * 1.8 + 32,
            toSource: (value) => (value - 32) / 1.8,
          },
        },
      ],
    })
    const source = layout.yAxes?.[0]
    const dependent = layout.yAxes?.[1]
    expect(dependent?.ticks.map((tick) => tick.value)).toEqual([32, 122, 212])
    expect(dependent?.ticks.map((tick) => tick.position)).toEqual(
      source?.ticks.map((tick) => tick.position),
    )
    expect(dependent?.projection?.fromRatio(0.5)).toBe(122)
  })

  it('draws a secondary grid and labels at the secondary axis positions', () => {
    const gridColor = [0.2, 0.4, 0.8, 0.5] as const
    const textColor = [0.2, 0.4, 0.8, 1] as const
    const layout = createChartLayout({
      width: 400,
      height: 240,
      xAxis: { grid: false },
      yAxes: [
        { key: 'temperature', range: [0, 100], grid: false },
        {
          key: 'pressure',
          range: [1, 1000],
          scale: { type: 'log', reverse: true },
          grid: { color: gridColor, width: 2 },
          textColor,
        },
        { key: 'flow', range: [0, 10] },
      ],
    })
    const commands = new RenderCommandList()
    addChartGuidesToCommandList(commands, layout, [0, 1], [0, 100])
    const grid = commands
      .sorted()
      .flatMap((command) => (command.kind === 'line' && command.z === ZLayer.Fill ? [command] : []))
    const axis = layout.yAxes?.[1]
    expect(grid.length).toBe(4)
    expect(grid.map((command) => command.options)).toEqual(
      axis?.ticks.map(() => ({ color: gridColor, width: 2 })),
    )
    for (const [index, command] of grid.entries()) {
      const point = command.transform?.dataToPixel(
        command.buffer[0] as number,
        command.buffer[1] as number,
      )
      expect(point?.x).toBe(layout.plotArea.x)
      expect(point?.y).toBeCloseTo(axis?.ticks[index]?.position ?? NaN)
    }
    expect(
      commands
        .sorted()
        .flatMap((command) =>
          command.kind === 'text' && command.options.color === textColor ? [command.y] : [],
        ),
    ).toEqual(axis?.ticks.map(({ position }) => position))
  })

  it('round-trips ordinal, custom and signed nonlinear projections', () => {
    const ordinal = createAxisProjection({ type: 'ordinal', values: [2, 4, 20] }, [2, 20])
    expect(ordinal.toRatio(4)).toBe(0.5)
    expect(ordinal.fromRatio(0.5)).toBe(4)
    const custom = createAxisProjection(
      { type: 'custom', forward: Math.sqrt, inverse: (x) => x * x },
      [0, 100],
    )
    expect(custom.fromRatio(custom.toRatio(81))).toBe(81)
    const signed = createAxisProjection({ type: 'asinh' }, [-100, 100])
    expect(signed.fromRatio(signed.toRatio(-10))).toBeCloseTo(-10)
  })

  it('skips an absent hour in spring and labels both repeated autumn hours in Berlin', () => {
    const calendar = { timeZone: 'Europe/Berlin', locale: 'en-GB' }
    const spring = calendarTicks([Date.UTC(2026, 2, 29, 0), Date.UTC(2026, 2, 29, 4)], 4, calendar)
    const autumn = calendarTicks([Date.UTC(2026, 9, 25, 0), Date.UTC(2026, 9, 25, 4)], 4, calendar)
    expect(spring.values.map(spring.format).map((label) => label.slice(0, 5))).toEqual([
      '01:00',
      '03:00',
      '04:00',
      '05:00',
      '06:00',
    ])
    const repeated = autumn.values.map(autumn.format).filter((label) => label.startsWith('02:00'))
    expect(repeated).toHaveLength(2)
    expect(new Set(repeated).size).toBe(2)
  })
})
