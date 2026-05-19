import { describe, expect, it } from 'vitest'

import {
  addTimeSeriesToCommandList,
  buildTimeSeriesRenderPlan,
  createTimeSeriesViewTransform,
  RenderCommandList,
} from '../index.js'

describe('time-series chart planning', () => {
  it('builds line segments with rebased x coordinates for epoch timestamps', () => {
    const timestamps = new Float64Array([1_700_000_000_000, 1_700_000_000_010, 1_700_000_000_020])
    const plan = buildTimeSeriesRenderPlan({
      timestamps,
      columns: {
        temp: new Float64Array([10, 12, 11]),
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp', color: [1, 0, 0, 1] }],
    })

    expect(plan.xOrigin).toBe(1_700_000_000_000)
    expect(plan.xRelativeRange).toEqual([0, 20])
    expect(plan.yRange[0]).toBeLessThan(10)
    expect(plan.yRange[1]).toBeGreaterThan(12)
    expect(plan.series).toHaveLength(1)

    const segment = plan.series[0]?.segments[0]
    expect(segment?.buffer).toEqual(new Float32Array([0, 10, 10, 12, 20, 11]))
  })

  it('splits line segments on configured gaps', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 20, 100]),
        columns: {
          pressure: new Float64Array([1, 2, 3, 4]),
        },
        series: [{ key: 'pressure', label: 'Pressure', field: 'pressure' }],
      },
      { gapThreshold: 25 },
    )

    expect(plan.segmentCount).toBe(1)
    expect(plan.series[0]?.segments).toHaveLength(1)
    expect(plan.series[0]?.segments[0]?.buffer).toEqual(new Float32Array([0, 1, 10, 2, 20, 3]))
    expect(plan.series[0]?.droppedPointCount).toBe(0)
  })

  it('filters hidden series unless requested', () => {
    const data = {
      timestamps: new Float64Array([0, 1, 2]),
      columns: {
        a: new Float64Array([1, 2, 3]),
        b: new Float64Array([3, 2, 1]),
      },
      series: [
        { key: 'a', label: 'A', field: 'a' },
        { key: 'b', label: 'B', field: 'b', visible: false },
      ],
    } as const

    expect(buildTimeSeriesRenderPlan(data).series.map((series) => series.key)).toEqual(['a'])
    expect(
      buildTimeSeriesRenderPlan(data, { includeHidden: true }).series.map((series) => series.key),
    ).toEqual(['a', 'b'])
  })

  it('builds step-after geometry', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 20]),
        columns: {
          state: new Float64Array([0, 1, 0]),
        },
        series: [{ key: 'state', label: 'State', field: 'state' }],
      },
      { interpolation: 'step-after' },
    )

    expect(plan.series[0]?.segments[0]?.buffer).toEqual(
      new Float32Array([0, 0, 10, 0, 10, 1, 20, 1, 20, 0]),
    )
  })

  it('adds one render command per contiguous segment', () => {
    const plan = buildTimeSeriesRenderPlan({
      timestamps: new Float64Array([0, 1, 2]),
      columns: {
        temp: new Float64Array([10, 11, 12]),
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
    })
    const commands = new RenderCommandList()

    addTimeSeriesToCommandList(commands, plan)

    expect(commands.length).toBe(1)
    expect(commands.sorted()[0]?.kind).toBe('line')
  })

  it('creates a transform that maps rebased data to pixels', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([1_700_000_000_000, 1_700_000_000_100]),
        columns: {
          temp: new Float64Array([0, 10]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      },
      { yRange: [0, 10] },
    )
    const transform = createTimeSeriesViewTransform(plan, 200, 100)

    expect(transform.dataToPixel(0, 0)).toEqual({ x: 0, y: 100 })
    expect(transform.dataToPixel(100, 10)).toEqual({ x: 200, y: 0 })
  })
})
