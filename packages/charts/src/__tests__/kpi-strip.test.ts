import { describe, expect, it } from 'vitest'

import {
  addKpiStripToCommandList,
  buildKpiStripCommandFrame,
  buildKpiStripRenderPlan,
  commandFrameToSvg,
  createChartLayout,
  type KpiStripDataSet,
  RenderCommandList,
} from '../index.js'

function createKpiFixture(): KpiStripDataSet {
  return {
    items: [
      {
        key: 'asset-a',
        label: 'Asset A',
        value: 97.4,
        unit: '%',
        status: 'normal',
        quality: 0.99,
        freshnessSeconds: 2,
        sparkline: {
          values: new Float32Array([92, 94, 95, 96, 97.4]),
          valueRange: [80, 100],
        },
        target: 95,
        lowerLimit: 88,
      },
      {
        key: 'asset-b',
        label: 'Asset B',
        value: 74.1,
        unit: '%',
        status: 'warning',
        quality: 0.91,
        freshnessSeconds: 14,
        sparkline: {
          values: new Float32Array([86, 82, 79, 77, 74.1]),
          valueRange: [60, 100],
        },
        target: 90,
        lowerLimit: 75,
      },
      {
        key: 'asset-c',
        label: 'Asset C',
        value: Number.NaN,
        unit: '%',
        status: 'offline',
        quality: 0,
        freshnessSeconds: 900,
        sparkline: {
          values: new Float32Array([72, 72, 72]),
          valueRange: [60, 100],
        },
      },
    ],
  }
}

describe('KPI strip planning', () => {
  it('builds compact KPI cards with status counts and sparklines', () => {
    const plan = buildKpiStripRenderPlan(createKpiFixture(), {
      columns: 2,
      sparklinePointLimit: 4,
    })

    expect(plan.kind).toBe('kpi-strip')
    expect(plan.sourceItemCount).toBe(3)
    expect(plan.renderedItemCount).toBe(3)
    expect(plan.columns).toBe(2)
    expect(plan.rows).toBe(2)
    expect(plan.statusCounts.normal).toBe(1)
    expect(plan.statusCounts.warning).toBe(1)
    expect(plan.statusCounts.offline).toBe(1)
    expect(plan.sparklinePointCount).toBe(11)
    expect(plan.items[0]?.sparkline).toHaveLength(8)
    expect(plan.items[0]?.targetLine).not.toBeNull()
    expect(plan.items[0]?.limitLines).toHaveLength(1)
  })

  it('limits hidden and max-item surfaces without changing source count', () => {
    const plan = buildKpiStripRenderPlan(
      {
        items: [
          ...createKpiFixture().items,
          { key: 'hidden', label: 'Hidden', value: 1, visible: false },
        ],
      },
      { columns: 4, maxItems: 2 },
    )

    expect(plan.sourceItemCount).toBe(4)
    expect(plan.renderedItemCount).toBe(2)
    expect(plan.items.map((item) => item.key)).toEqual(['asset-a', 'asset-b'])
  })

  it('adds backgrounds, rails, limit lines, target lines, and sparklines to commands', () => {
    const plan = buildKpiStripRenderPlan(createKpiFixture(), { columns: 3 })
    const commands = new RenderCommandList()

    addKpiStripToCommandList(commands, plan)

    const sorted = commands.sorted()
    expect(sorted.filter((command) => command.kind === 'rect')).toHaveLength(6)
    expect(sorted.filter((command) => command.kind === 'line')).toHaveLength(7)
  })

  it('exports cards and labels through SVG', () => {
    const plan = buildKpiStripRenderPlan(createKpiFixture(), { columns: 3 })
    const layout = createChartLayout({
      width: 520,
      height: 180,
      xRange: plan.xRange,
      yRange: plan.yRange,
      xAxis: { visible: false, size: 0 },
      yAxis: { visible: false, size: 0 },
      grid: { visible: false },
    })
    const frame = buildKpiStripCommandFrame(plan, 520, 180, {
      layout,
      labels: true,
      maxLabelCount: 6,
    })
    const svg = commandFrameToSvg(frame, { title: 'KPI strip' })

    expect(svg).toContain('<rect')
    expect(svg).toContain('<path')
    expect(svg).toContain('<text')
    expect(svg).toContain('Asset A')
    expect(svg).toContain('KPI strip')
  })
})
