import { describe, expect, it } from 'vitest'

import {
  addTimeSeriesAnnotationsToCommandList,
  addTimeSeriesAnomalyTracksToCommandList,
  addTimeSeriesBandsToCommandList,
  addTimeSeriesEventMarkersToCommandList,
  addTimeSeriesToCommandList,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  commandFrameToSvg,
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

  it('plans value bands as fill segments and includes them in y range', () => {
    const plan = buildTimeSeriesRenderPlan({
      timestamps: new Float64Array([0, 1, 2]),
      columns: {
        temp: new Float64Array([10, 11, 12]),
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      bands: [
        {
          kind: 'value-band',
          key: 'high-warning',
          label: 'High warning',
          yStart: 14,
          yEnd: 16,
          fillColor: [1, 0, 0, 0.1],
          lineColor: [1, 0, 0, 0.7],
        },
      ],
    })

    expect(plan.bands).toHaveLength(1)
    expect(plan.bands[0]?.segments[0]?.lower).toEqual(new Float32Array([0, 14, 2, 14]))
    expect(plan.bands[0]?.segments[0]?.upper).toEqual(new Float32Array([0, 16, 2, 16]))
    expect(plan.yRange[1]).toBeGreaterThan(16)

    const commands = new RenderCommandList()
    addTimeSeriesBandsToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual(['fill', 'line', 'line'])
  })

  it('plans envelope bands from columnar upper and lower fields', () => {
    const plan = buildTimeSeriesRenderPlan({
      timestamps: new Float64Array([0, 1, 2, 10]),
      columns: {
        temp: new Float64Array([10, 12, 11, 13]),
        low: new Float64Array([8, 9, 9, 10]),
        high: new Float64Array([14, 15, 14, 16]),
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      bands: [
        {
          kind: 'envelope',
          key: 'model-envelope',
          lowerField: 'low',
          upperField: 'high',
          gapThreshold: 3,
        },
      ],
    })

    expect(plan.bands).toHaveLength(1)
    expect(plan.bands[0]?.segments).toHaveLength(1)
    expect(plan.bands[0]?.segments[0]?.lower).toEqual(new Float32Array([0, 8, 1, 9, 2, 9]))
    expect(plan.bands[0]?.segments[0]?.upper).toEqual(new Float32Array([0, 14, 1, 15, 2, 14]))
    expect(plan.bands[0]?.includedSampleCount).toBe(4)
    expect(plan.bands[0]?.renderedPointCount).toBe(3)
  })

  it('plans x/y annotations and rulers as data-space command geometry', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([1000, 1010, 1020]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        annotations: [
          { kind: 'x-line', key: 'batch-start', x: 1010, label: 'Batch start' },
          { kind: 'y-line', key: 'setpoint', y: 11, label: 'Setpoint' },
          {
            kind: 'ruler',
            key: 'ramp',
            label: 'Ramp',
            xStart: 1000,
            xEnd: 1020,
            yStart: 10,
            yEnd: 12,
          },
        ],
      },
      { yRange: [9, 13] },
    )

    expect(plan.annotations.map((annotation) => annotation.key)).toEqual([
      'batch-start',
      'setpoint',
      'ramp',
    ])
    expect(plan.annotations[0]?.lineSegments[0]?.buffer).toEqual(new Float32Array([10, 9, 10, 13]))
    expect(plan.annotations[1]?.lineSegments[0]?.buffer).toEqual(new Float32Array([0, 11, 20, 11]))
    expect(plan.annotations[2]?.lineSegments[0]?.buffer).toEqual(new Float32Array([0, 10, 20, 12]))

    const commands = new RenderCommandList()
    addTimeSeriesAnnotationsToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual(['line', 'line', 'line'])
  })

  it('plans x/y range annotations as fill geometry without expanding y range by default', () => {
    const plan = buildTimeSeriesRenderPlan({
      timestamps: new Float64Array([0, 10, 20]),
      columns: {
        temp: new Float64Array([10, 12, 11]),
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      annotations: [
        {
          kind: 'x-range',
          key: 'hold',
          xStart: 5,
          xEnd: 15,
          fillColor: [1, 0.8, 0, 0.15],
          lineColor: [1, 0.8, 0, 0.8],
        },
        {
          kind: 'y-range',
          key: 'target',
          yStart: 20,
          yEnd: 25,
          includeInYRange: false,
        },
      ],
    })

    expect(plan.yRange[1]).toBeLessThan(20)
    expect(plan.annotations.map((annotation) => annotation.key)).toEqual(['hold'])
    expect(plan.annotations[0]?.fillSegments[0]?.lower).toEqual(
      new Float32Array([5, plan.yRange[0], 15, plan.yRange[0]]),
    )

    const commands = new RenderCommandList()
    addTimeSeriesAnnotationsToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual(['fill', 'line', 'line'])
  })

  it('includes annotation labels in the command frame and SVG export', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 20]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        annotations: [{ kind: 'x-line', key: 'startup', label: 'Startup', x: 10 }],
      },
      { yRange: [9, 13] },
    )
    const frame = buildTimeSeriesCommandFrame(plan, 320, 180)
    const commands = frame.commands.sorted()
    const svg = commandFrameToSvg(frame, { title: 'Trend' })

    expect(commands.some((command) => command.kind === 'text')).toBe(true)
    expect(svg).toContain('Startup')
    expect(svg).toContain('<path')
  })

  it('plans event markers as sparse tick geometry with opt-in labels', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([1000, 1010, 1020]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        eventMarkers: [
          {
            key: 'batch-start',
            x: 1010,
            label: 'Batch start',
            eventType: 'batch',
            labelVisible: true,
          },
          {
            key: 'alarm-out-of-view',
            x: 1200,
            eventType: 'alarm',
          },
        ],
      },
      { yRange: [0, 100] },
    )

    expect(plan.eventMarkers).toHaveLength(1)
    expect(plan.eventMarkers[0]?.lineSegments[0]?.buffer).toEqual(
      new Float32Array([10, 90, 10, 100]),
    )
    expect(plan.eventMarkers[0]?.labelVisible).toBe(true)
    expect(plan.warnings).toContain(
      'Event marker "alarm-out-of-view" has no geometry inside the visible range.',
    )

    const commands = new RenderCommandList()
    addTimeSeriesEventMarkersToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual(['line'])
  })

  it('plans anomaly score tracks as bounded score lanes', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([1000, 1010, 1020]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
          anomaly: new Float64Array([0.1, 0.5, 0.9]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        anomalyTracks: [
          {
            key: 'model-a',
            label: 'Model A',
            scoreField: 'anomaly',
            threshold: 0.6,
            modelVersion: 'v2026.05',
            reviewerState: 'review-pending',
            lineColor: [0.8, 0.1, 0.1, 0.8],
          },
        ],
      },
      { yRange: [0, 100] },
    )

    expect(plan.anomalyTracks).toHaveLength(1)
    expect(plan.anomalyTracks[0]?.modelVersion).toBe('v2026.05')
    expect(plan.anomalyTracks[0]?.reviewerState).toBe('review-pending')
    expect(plan.anomalyTracks[0]?.laneRange).toEqual([0, 12])
    expect(plan.anomalyTracks[0]?.scoreRange).toEqual([0.1, 0.9])
    expect(plan.anomalyTracks[0]?.fillSegments[0]?.lower).toEqual(
      new Float32Array([0, 0, 10, 0, 20, 0]),
    )
    expect(plan.anomalyTracks[0]?.fillSegments[0]?.upper).toEqual(
      new Float32Array([0, 1.2, 10, 6, 20, 10.8]),
    )
    expect(plan.anomalyTracks[0]?.thresholdSegments[0]?.buffer).toEqual(
      new Float32Array([0, 7.2, 20, 7.2]),
    )

    const commands = new RenderCommandList()
    addTimeSeriesAnomalyTracksToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual(['fill', 'line', 'line'])
  })

  it('exports anomaly score tracks through the command frame', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 20]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
          anomaly: new Float64Array([0.2, 0.8, 0.4]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        anomalyTracks: [
          {
            key: 'score',
            label: 'Score',
            scoreField: 'anomaly',
            threshold: 0.75,
            fillColor: [0.9, 0.1, 0.1, 0.18],
            lineColor: [0.9, 0.1, 0.1, 0.8],
          },
        ],
      },
      { yRange: [0, 100] },
    )
    const frame = buildTimeSeriesCommandFrame(plan, 320, 180)
    const svg = commandFrameToSvg(frame, { title: 'Anomaly trend' })

    expect(frame.commands.sorted().some((command) => command.kind === 'fill')).toBe(true)
    expect(svg).toContain('Anomaly trend')
    expect(svg).toContain('<path')
  })

  it('exports visible event marker labels through the command frame', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10, 20]),
        columns: {
          temp: new Float64Array([10, 12, 11]),
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        eventMarkers: [
          { key: 'hold-start', x: 10, label: 'Hold start', eventType: 'hold', labelVisible: true },
        ],
      },
      { yRange: [0, 20] },
    )
    const frame = buildTimeSeriesCommandFrame(plan, 320, 180)
    const svg = commandFrameToSvg(frame, { title: 'Trend' })

    expect(frame.commands.sorted().some((command) => command.kind === 'text')).toBe(true)
    expect(svg).toContain('Hold start')
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
