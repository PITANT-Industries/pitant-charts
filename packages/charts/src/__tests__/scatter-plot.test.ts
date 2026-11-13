import { describe, expect, it } from 'vitest'

import {
  addScatterPlotToCommandList,
  buildScatterPlotCommandFrame,
  buildScatterPlotRenderPlan,
  commandFrameToSvg,
  createChartLayout,
  RenderCommandList,
  type ScatterPlotDataSet,
} from '../index.js'

function createSmallScatterFixture(): ScatterPlotDataSet {
  return {
    series: [
      {
        key: 'pressure-torque',
        label: 'Pressure vs torque',
        x: new Float64Array([80, 84, 92, 100, 108, 120]),
        y: new Float64Array([12, 14, 16, 20, 24, 31]),
      },
      {
        key: 'pressure-temp',
        label: 'Pressure vs temperature',
        x: new Float64Array([78, 82, 90, Number.NaN, 111, 118]),
        y: new Float64Array([62, 64, 67, 69, 72, 74]),
        color: [0.86, 0.15, 0.15, 1],
      },
    ],
  }
}

function createDenseScatterFixture(pointCount: number): ScatterPlotDataSet {
  const x = new Float32Array(pointCount)
  const y = new Float32Array(pointCount)

  for (let index = 0; index < pointCount; index++) {
    const cluster = index % 3
    const centerX = cluster === 0 ? 20 : cluster === 1 ? 55 : 82
    const centerY = cluster === 0 ? 30 : cluster === 1 ? 72 : 45
    x[index] = centerX + Math.sin(index / 17) * 9 + Math.cos(index / 101) * 2
    y[index] = centerY + Math.cos(index / 23) * 12 + Math.sin(index / 83) * 3
  }

  return {
    series: [
      {
        key: 'dense',
        label: 'Dense process cloud',
        x,
        y,
      },
    ],
  }
}

describe('scatter plot planning', () => {
  it('renders small scatter payloads as bounded point rectangles', () => {
    const plan = buildScatterPlotRenderPlan(createSmallScatterFixture(), {
      xRange: [70, 130],
      yRange: [0, 80],
      maxRenderedPoints: 64,
    })

    expect(plan.kind).toBe('scatter-plot')
    expect(plan.mode).toBe('points')
    expect(plan.sourcePointCount).toBe(12)
    expect(plan.filteredPointCount).toBe(11)
    expect(plan.renderedPointCount).toBe(11)
    expect(plan.densityCellCount).toBe(0)
    expect(plan.series).toHaveLength(2)
  })

  it('switches high-density payloads to bounded density cells', () => {
    const plan = buildScatterPlotRenderPlan(createDenseScatterFixture(120_000), {
      xRange: [0, 100],
      yRange: [0, 100],
      maxRenderedPoints: 10_000,
      density: {
        columns: 96,
        rows: 64,
      },
    })

    expect(plan.mode).toBe('density')
    expect(plan.sourcePointCount).toBe(120_000)
    expect(plan.filteredPointCount).toBe(120_000)
    expect(plan.renderedPointCount).toBe(120_000)
    expect(plan.densityCellCount).toBeGreaterThan(100)
    expect(plan.densityCellCount).toBeLessThanOrEqual(96 * 64)
    expect(plan.commandCount).toBe(plan.densityCellCount)
  })

  it.each([
    { maxRenderedPoints: 2, density: undefined, mode: 'density' },
    { maxRenderedPoints: 5, density: undefined, mode: 'points' },
    { maxRenderedPoints: 2, density: { enabled: true, minPointCount: 5 }, mode: 'density' },
    { maxRenderedPoints: 5, density: { enabled: true, minPointCount: 6 }, mode: 'points' },
    { maxRenderedPoints: 2, density: { enabled: false }, mode: 'points' },
  ] as const)('keeps exact multi-series counts when selecting $mode mode: %j', (scenario) => {
    const plan = buildScatterPlotRenderPlan(
      {
        series: [
          {
            key: 'first',
            label: 'First',
            x: new Float64Array([-1, 0, 1, 2, Number.NaN]),
            y: new Float64Array([0, 0, 1, 2, 1]),
          },
          {
            key: 'second',
            label: 'Second',
            x: new Float32Array([3, 4, 5, Number.POSITIVE_INFINITY]),
            y: new Float32Array([3, 4, 5, 1]),
          },
        ],
      },
      {
        xRange: [0, 4],
        yRange: [0, 4],
        maxRenderedPoints: scenario.maxRenderedPoints,
        density: { ...scenario.density, columns: 2, rows: 2 },
      },
    )

    expect(plan.mode).toBe(scenario.mode)
    expect(plan.filteredPointCount).toBe(5)
    expect(plan.series.map((series) => series.filteredPointCount)).toEqual([3, 2])
    if (scenario.mode === 'density') {
      expect(
        plan.series.map((series) =>
          series.densityCells.map(({ column, row, count }) => [column, row, count]),
        ),
      ).toEqual([
        [
          [0, 0, 2],
          [1, 1, 1],
        ],
        [[1, 1, 2]],
      ])
      expect(plan.renderedPointCount).toBe(5)
    }
  })

  it('samples large payloads when density is explicitly disabled', () => {
    const plan = buildScatterPlotRenderPlan(createDenseScatterFixture(50_000), {
      xRange: [0, 100],
      yRange: [0, 100],
      maxRenderedPoints: 5_000,
      density: {
        enabled: false,
      },
    })

    expect(plan.mode).toBe('points')
    expect(plan.renderedPointCount).toBeLessThanOrEqual(5_000)
    expect(plan.warnings.join('\n')).toContain('sampled')
  })

  it('adds density cells or points to command lists', () => {
    const plan = buildScatterPlotRenderPlan(createDenseScatterFixture(25_000), {
      xRange: [0, 100],
      yRange: [0, 100],
      density: {
        columns: 48,
        rows: 32,
      },
    })
    const commands = new RenderCommandList()

    addScatterPlotToCommandList(commands, plan)

    expect(commands.sorted()).toHaveLength(plan.commandCount)
    expect(commands.sorted().every((command) => command.kind === 'rect')).toBe(true)
  })

  it('exports scatter density frames through SVG', () => {
    const plan = buildScatterPlotRenderPlan(createDenseScatterFixture(20_000), {
      xRange: [0, 100],
      yRange: [0, 100],
      density: {
        enabled: true,
        minPointCount: 1,
        columns: 32,
        rows: 24,
      },
    })
    const layout = createChartLayout({
      width: 520,
      height: 320,
      xRange: plan.xRelativeRange,
      yRange: plan.yRange,
      xAxis: { visible: true, label: 'Pressure' },
      yAxis: { visible: true, label: 'Torque' },
      grid: { visible: true },
    })
    const frame = buildScatterPlotCommandFrame(plan, 520, 320, { layout })
    const svg = commandFrameToSvg(frame, { title: 'Scatter plot' })

    expect(svg).toContain('<rect')
    expect(svg).toContain('Scatter plot')
  })
})
