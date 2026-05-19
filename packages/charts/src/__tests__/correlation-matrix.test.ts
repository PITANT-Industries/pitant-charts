import { describe, expect, it } from 'vitest'

import {
  addCorrelationMatrixToCommandList,
  buildCorrelationMatrixCommandFrame,
  buildCorrelationMatrixRenderPlan,
  type CorrelationMatrixDataSet,
  commandFrameToSvg,
  createChartLayout,
  RenderCommandList,
} from '../index.js'

const VARIABLES = [
  { key: 'pressure', label: 'Press' },
  { key: 'torque', label: 'Torque' },
  { key: 'temperature', label: 'Temp' },
] as const

function createMatrixFixture(): CorrelationMatrixDataSet {
  return {
    variables: VARIABLES,
    values: new Float32Array([1, 0.82, Number.NaN, 0.82, 1, -0.41, 0.18, -0.41, 1]),
    sampleCounts: new Uint32Array([120, 120, 0, 120, 120, 18, 120, 18, 120]),
    missingCounts: new Uint32Array([0, 0, 12, 0, 0, 4, 0, 4, 0]),
    mask: new Uint8Array([0, 0, 0, 0, 0, 0, 1, 0, 0]),
  }
}

describe('correlation matrix planning', () => {
  it('builds cells from a precomputed correlation payload', () => {
    const plan = buildCorrelationMatrixRenderPlan(createMatrixFixture(), {
      minSampleCount: 30,
    })

    expect(plan.kind).toBe('correlation-matrix')
    expect(plan.sourceVariableCount).toBe(3)
    expect(plan.visibleVariableCount).toBe(3)
    expect(plan.sourceCellCount).toBe(9)
    expect(plan.renderedCellCount).toBe(9)
    expect(plan.missingCellCount).toBe(1)
    expect(plan.lowSampleCellCount).toBe(2)
    expect(plan.maskedCellCount).toBe(1)
    expect(plan.cells.find((cell) => cell.row === 0 && cell.column === 0)?.state).toBe('self')
    expect(plan.cells.find((cell) => cell.row === 1 && cell.column === 2)?.state).toBe('low-sample')
    expect(plan.cells.find((cell) => cell.row === 2 && cell.column === 0)?.state).toBe('masked')
  })

  it('clips rows and columns without changing source indexes', () => {
    const plan = buildCorrelationMatrixRenderPlan(createMatrixFixture(), {
      columnRange: [1, 3],
      rowRange: [0, 2],
    })

    expect(plan.renderedCellCount).toBe(4)
    expect(plan.xRange).toEqual([1, 3])
    expect(plan.yRange).toEqual([1, 3])
    expect(plan.cells.map((cell) => [cell.row, cell.column])).toEqual([
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ])
  })

  it('honors hidden variable filtering', () => {
    const plan = buildCorrelationMatrixRenderPlan({
      ...createMatrixFixture(),
      variables: [
        { key: 'pressure', label: 'Press' },
        { key: 'torque', label: 'Torque', visible: false },
        { key: 'temperature', label: 'Temp' },
      ],
    })

    expect(plan.visibleVariableCount).toBe(2)
    expect(plan.renderedCellCount).toBe(4)
    expect(plan.variables.map((variable) => variable.key)).toEqual(['pressure', 'temperature'])
  })

  it('adds matrix cells to command lists', () => {
    const plan = buildCorrelationMatrixRenderPlan(createMatrixFixture())
    const commands = new RenderCommandList()

    addCorrelationMatrixToCommandList(commands, plan)

    expect(commands.sorted().filter((command) => command.kind === 'rect')).toHaveLength(9)
  })

  it('exports matrix cells and labels through SVG', () => {
    const plan = buildCorrelationMatrixRenderPlan(createMatrixFixture())
    const layout = createChartLayout({
      width: 420,
      height: 260,
      xRange: plan.xRange,
      yRange: plan.yRange,
      xAxis: { visible: true },
      yAxis: { visible: true, size: 72 },
    })
    const frame = buildCorrelationMatrixCommandFrame(plan, 420, 260, {
      layout,
      guides: false,
      labels: true,
    })
    const svg = commandFrameToSvg(frame, { title: 'Correlation matrix' })

    expect(svg).toContain('<rect')
    expect(svg).toContain('<text')
    expect(svg).toContain('Press')
    expect(svg).toContain('Correlation matrix')
  })
})
