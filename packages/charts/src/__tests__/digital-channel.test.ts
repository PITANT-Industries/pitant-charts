import { describe, expect, it } from 'vitest'

import {
  addDigitalChannelToCommandList,
  buildDigitalChannelRenderPlan,
  createDigitalChannelViewTransform,
  RenderCommandList,
} from '../index.js'

describe('digital-channel chart planning', () => {
  it('builds staircase geometry for binary channels', () => {
    const plan = buildDigitalChannelRenderPlan({
      timestamps: new Float64Array([1000, 1010, 1020]),
      columns: {
        running: new Float64Array([0, 1, 0]),
      },
      channels: [{ key: 'running', label: 'Running', field: 'running', color: [0, 1, 0, 1] }],
    })

    expect(plan.xOrigin).toBe(1000)
    expect(plan.xRelativeRange).toEqual([0, 20])
    expect(plan.channels).toHaveLength(1)
    expect(plan.channels[0]?.lowY).toBe(0)
    expect(plan.channels[0]?.highY).toBe(1)
    expect(plan.channels[0]?.segments[0]?.buffer).toEqual(
      new Float32Array([0, 0, 10, 0, 10, 1, 20, 1, 20, 0]),
    )
  })

  it('stacks visible channels into independent lanes', () => {
    const plan = buildDigitalChannelRenderPlan({
      timestamps: new Float64Array([0, 1]),
      columns: {
        a: new Float64Array([0, 1]),
        b: new Float64Array([1, 0]),
        c: new Float64Array([1, 1]),
      },
      channels: [
        { key: 'a', label: 'A', field: 'a' },
        { key: 'b', label: 'B', field: 'b', visible: false },
        { key: 'c', label: 'C', field: 'c' },
      ],
    })

    expect(plan.channels.map((channel) => channel.key)).toEqual(['a', 'c'])
    expect(plan.channels[0]?.laneIndex).toBe(0)
    expect(plan.channels[1]?.laneIndex).toBe(1)
    expect(plan.channels[1]?.lowY).toBe(1.5)
    expect(plan.channels[1]?.highY).toBe(2.5)
  })

  it('splits digital paths on gaps', () => {
    const plan = buildDigitalChannelRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 100, 110]),
        columns: {
          running: new Float64Array([0, 1, 1, 0]),
        },
        channels: [{ key: 'running', label: 'Running', field: 'running' }],
      },
      { gapThreshold: 25 },
    )

    expect(plan.segmentCount).toBe(2)
    expect(plan.channels[0]?.segments[0]?.buffer).toEqual(new Float32Array([0, 0, 10, 0, 10, 1]))
    expect(plan.channels[0]?.segments[1]?.buffer).toEqual(
      new Float32Array([100, 1, 110, 1, 110, 0]),
    )
  })

  it('adds render commands for digital channel segments', () => {
    const plan = buildDigitalChannelRenderPlan({
      timestamps: new Float64Array([0, 1]),
      columns: {
        running: new Float64Array([0, 1]),
      },
      channels: [{ key: 'running', label: 'Running', field: 'running' }],
    })
    const commands = new RenderCommandList()

    addDigitalChannelToCommandList(commands, plan)

    expect(commands.length).toBe(1)
    expect(commands.sorted()[0]?.kind).toBe('line')
  })

  it('creates a transform for stacked channel coordinates', () => {
    const plan = buildDigitalChannelRenderPlan({
      timestamps: new Float64Array([1000, 1020]),
      columns: {
        running: new Float64Array([0, 1]),
      },
      channels: [{ key: 'running', label: 'Running', field: 'running' }],
    })
    const transform = createDigitalChannelViewTransform(plan, 200, 100)

    expect(transform.dataToPixel(0, plan.channels[0]?.lowY ?? 0).x).toBe(0)
    expect(transform.dataToPixel(20, plan.channels[0]?.highY ?? 1).x).toBe(200)
  })
})
