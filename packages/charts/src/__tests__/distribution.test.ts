import { describe, expect, it } from 'vitest'

import {
  addDistributionMarkersToCommandList,
  addDistributionToCommandList,
  buildDistributionCommandFrame,
  buildDistributionRenderPlan,
  commandFrameToSvg,
  RenderCommandList,
} from '../index.js'

describe('distribution chart planning', () => {
  it('builds distribution bins from precomputed histogram payloads', () => {
    const plan = buildDistributionRenderPlan({
      series: [
        {
          key: 'capability',
          label: 'Capability histogram',
          binStarts: new Float64Array([0, 10, 20]),
          binEnds: new Float64Array([10, 20, 30]),
          values: new Float64Array([4, 9, 2]),
        },
      ],
      markers: [
        { key: 'lsl', kind: 'lower-spec', value: 3, label: 'LSL' },
        { key: 'target', kind: 'target', value: 15, label: 'Target' },
        { key: 'usl', kind: 'upper-spec', value: 27, label: 'USL' },
      ],
    })

    expect(plan.kind).toBe('distribution')
    expect(plan.sourceBinCount).toBe(3)
    expect(plan.renderedBinCount).toBe(3)
    expect(plan.markers).toHaveLength(3)
    expect(plan.xRange[0]).toBeLessThanOrEqual(0)
    expect(plan.xRange[1]).toBeGreaterThanOrEqual(30)
    expect(plan.yRange[1]).toBeGreaterThan(9)

    const first = plan.series[0]?.bins[0]
    expect(first?.x).toBeGreaterThan(0)
    expect(first?.width).toBeLessThan(10)
    expect(first?.value).toBe(4)
  })

  it('clips bins to the requested value range', () => {
    const plan = buildDistributionRenderPlan(
      {
        series: [
          {
            key: 'pressure',
            label: 'Pressure',
            binStarts: new Float64Array([0, 10, 20, 30]),
            binEnds: new Float64Array([10, 20, 30, 40]),
            values: new Float64Array([2, 4, 8, 16]),
          },
        ],
      },
      {
        xRange: [5, 25],
      },
    )

    expect(plan.renderedBinCount).toBe(3)
    expect(plan.series[0]?.bins.every((bin) => bin.x >= 5 && bin.x + bin.width <= 25)).toBe(true)
  })

  it('warns and uses the shortest histogram column length', () => {
    const plan = buildDistributionRenderPlan({
      series: [
        {
          key: 'mismatch',
          label: 'Mismatch',
          binStarts: new Float64Array([0, 1, 2]),
          binEnds: new Float64Array([1, 2]),
          values: new Float64Array([3, 4, 5]),
        },
      ],
    })

    expect(plan.sourceBinCount).toBe(2)
    expect(plan.renderedBinCount).toBe(2)
    expect(plan.warnings[0]).toContain('lengths differ')
  })

  it('adds distribution bins and markers to command lists', () => {
    const plan = buildDistributionRenderPlan({
      series: [
        {
          key: 'capability',
          label: 'Capability histogram',
          binStarts: new Float64Array([0, 1, 2]),
          binEnds: new Float64Array([1, 2, 3]),
          values: new Float64Array([2, 5, 3]),
        },
      ],
      markers: [{ key: 'target', kind: 'target', value: 1.5, label: 'Target' }],
    })
    const commands = new RenderCommandList()

    addDistributionToCommandList(commands, plan)
    addDistributionMarkersToCommandList(commands, plan)

    const sorted = commands.sorted()
    expect(sorted.filter((command) => command.kind === 'rect')).toHaveLength(3)
    expect(sorted.filter((command) => command.kind === 'line')).toHaveLength(1)
  })

  it('exports distribution bins, marker lines, and labels through SVG', () => {
    const plan = buildDistributionRenderPlan({
      series: [
        {
          key: 'temperature',
          label: 'Temperature',
          binStarts: new Float64Array([40, 50, 60]),
          binEnds: new Float64Array([50, 60, 70]),
          values: new Float64Array([1, 6, 2]),
        },
      ],
      markers: [{ key: 'target', kind: 'target', value: 58, label: 'Target' }],
    })
    const frame = buildDistributionCommandFrame(plan, 420, 260)
    const svg = commandFrameToSvg(frame, { title: 'Distribution' })

    expect(svg).toContain('<rect')
    expect(svg).toContain('<path')
    expect(svg).toContain('<text')
    expect(svg).toContain('Target')
    expect(svg).toContain('Distribution')
  })
})
