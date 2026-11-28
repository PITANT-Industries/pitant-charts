import { describe, expect, it } from 'vitest'

import {
  addTimeSeriesAnnotationsToCommandList,
  addTimeSeriesAnomalyTracksToCommandList,
  addTimeSeriesBandsToCommandList,
  addTimeSeriesEventMarkersToCommandList,
  addTimeSeriesSpcTracksToCommandList,
  addTimeSeriesToCommandList,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  commandFrameToSvg,
  createTimeSeriesViewTransform,
  RenderCommandList,
  TimeSeriesSampleKind,
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

  it('plans SPC control-limit tracks and sparse rule markers', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 1, 2, 3]),
        columns: {
          xbar: new Float64Array([10, 12, 11, 15]),
        },
        series: [{ key: 'xbar', label: 'Xbar', field: 'xbar' }],
        spcTracks: [
          {
            key: 'xbar-limits',
            label: 'Xbar limits',
            chartKind: 'xbar',
            centerLine: 12,
            upperControlLimit: 18,
            lowerControlLimit: 6,
            upperWarningLimit: 16,
            lowerWarningLimit: 8,
            markers: [
              { key: 'rule-1', x: 2, rule: 'WE-1', label: 'Rule 1', severity: 'violation' },
            ],
          },
        ],
      },
      { yRange: [0, 20] },
    )

    expect(plan.spcTracks).toHaveLength(1)
    expect(plan.spcTracks[0]?.chartKind).toBe('xbar')
    expect(plan.spcTracks[0]?.zoneSegments[0]?.lower).toEqual(new Float32Array([0, 6, 3, 6]))
    expect(plan.spcTracks[0]?.zoneSegments[0]?.upper).toEqual(new Float32Array([0, 18, 3, 18]))
    expect(plan.spcTracks[0]?.warningZoneSegments).toHaveLength(2)
    expect(plan.spcTracks[0]?.centerLineSegments[0]?.buffer).toEqual(
      new Float32Array([0, 12, 3, 12]),
    )
    expect(plan.spcTracks[0]?.controlLimitSegments.map((segment) => segment.buffer)).toEqual([
      new Float32Array([0, 18, 3, 18]),
      new Float32Array([0, 6, 3, 6]),
    ])
    expect(plan.spcTracks[0]?.markers[0]?.lineSegments[0]?.buffer).toEqual(
      new Float32Array([2, 20, 2, 18.4]),
    )

    const commands = new RenderCommandList()
    addTimeSeriesSpcTracksToCommandList(commands, plan)
    expect(commands.sorted().map((command) => command.kind)).toEqual([
      'fill',
      'fill',
      'fill',
      'line',
      'line',
      'line',
      'line',
      'line',
      'line',
    ])
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

  it('mixes splines, filled lines, bars and screen-sized points in one frame', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 5, 10]),
        columns: {
          trend: new Float64Array([-4, 3, 4]),
          valves: new Float64Array([50, 100, 200]),
          samples: new Float64Array([NaN, 150, NaN]),
        },
        series: [
          { key: 'trend', field: 'trend', label: 'Trend', mark: 'area', interpolation: 'spline' },
          {
            key: 'valves',
            field: 'valves',
            label: 'Valves',
            mark: 'bar',
            yAxisKey: 'right',
            baseline: 100,
          },
          {
            key: 'samples',
            field: 'samples',
            label: 'Samples',
            mark: 'point',
            yAxisKey: 'right',
            points: { size: 9 },
          },
        ],
      },
      {
        yAxes: [
          { key: 'left', range: [-5, 5], visible: false },
          { key: 'right', range: [0, 250], visible: false },
        ],
      },
    )

    const frame = buildTimeSeriesCommandFrame(plan, 400, 300, { guides: false })
    const commands = frame.commands.sorted()
    const line = commands.find((command) => command.kind === 'line')
    if (line?.kind !== 'line') throw new Error('Expected a spline line')
    expect(line.buffer.length).toBeGreaterThan(6)
    for (let i = 0; i < line.buffer.length; i += 2) {
      const x = line.buffer[i] as number
      const y = line.buffer[i + 1] as number
      expect(y).toBeGreaterThanOrEqual(x < 5 ? -4 : 3)
      expect(y).toBeLessThanOrEqual(x < 5 ? 3 : 4)
    }

    const area = commands.find((command) => command.kind === 'fill')
    if (area?.kind !== 'fill') throw new Error('Expected one filled area')
    expect(area.upper.length).toBeGreaterThan(line.buffer.length)
    expect(Array.from(area.lower).filter((_, index) => index % 2 === 1)).toEqual(
      Array.from({ length: area.lower.length / 2 }, () => 0),
    )

    const bars = commands.find(
      (command) => command.kind === 'marks' && command.options.shape !== 'ellipse',
    )
    if (bars?.kind !== 'marks') throw new Error('Expected batched bars')
    expect(bars.bounds.length).toBe(8)
    const markers = commands.find(
      (command) => command.kind === 'marks' && command.options.shape === 'ellipse',
    )
    if (markers?.kind !== 'marks') throw new Error('Expected one isolated point')
    expect(markers.bounds.subarray(2)).toEqual(new Float32Array([9, 9]))
    const svg = commandFrameToSvg(frame)
    expect(svg).toContain(' H ')
    expect(svg).toContain(' A 4.5 4.5 ')
  })

  it('only marks real samples on stepped lines', () => {
    const plan = buildTimeSeriesRenderPlan({
      timestamps: new Float64Array([0, 5, 10]),
      columns: { valve: new Float64Array([0, 1, 0]) },
      series: [
        { key: 'valve', field: 'valve', label: 'Valve', interpolation: 'step-after', points: {} },
      ],
    })
    const commands = buildTimeSeriesCommandFrame(plan, 300, 150).commands.sorted()
    const line = commands.find((command) => command.kind === 'line')
    const points = commands.find((command) => command.kind === 'marks')
    if (line?.kind !== 'line' || points?.kind !== 'marks')
      throw new Error('Expected markers and line')
    expect(line.buffer.length).toBe(10)
    expect(points.bounds.length).toBe(12)
  })

  it('keeps explicit gaps distinct from alignment holes and still honors elapsed gap thresholds', () => {
    const timestamps = new Float64Array([0, 1, 2, 3, 4, 100, 101])
    const values = new Float64Array([1, NaN, 2, NaN, 3, 4, 5])
    const { Observed, ExplicitGap, AlignmentHole } = TimeSeriesSampleKind
    const kinds = new Uint8Array([
      Observed,
      AlignmentHole,
      Observed,
      ExplicitGap,
      Observed,
      Observed,
      Observed,
    ])
    const data = {
      timestamps,
      columns: { first: values, second: values },
      sampleKinds: { first: kinds, second: kinds },
      series: [
        { key: 'first', label: 'First', field: 'first', gapThreshold: 10 },
        { key: 'second', label: 'Second', field: 'second', spanGaps: true, gapThreshold: 10 },
      ],
    }

    const [first, second] = buildTimeSeriesRenderPlan(data).series
    expect(first?.segments.map(({ buffer }) => Array.from(buffer))).toEqual([
      [0, 1, 2, 2],
      [100, 4, 101, 5],
    ])
    expect(second?.segments.map(({ buffer }) => Array.from(buffer))).toEqual([
      [0, 1, 2, 2, 4, 3],
      [100, 4, 101, 5],
    ])
  })

  it('uses independent sample coordinates and binds custom geometry to the named axis', () => {
    const epoch = Date.UTC(2026, 10, 28)
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array(0),
        seriesTimestamps: {
          left: new Float64Array([epoch + 1, epoch + 3]),
          right: new Float64Array([epoch + 2, epoch + 5]),
        },
        columns: { left: new Float64Array([1, 2]), right: new Float64Array([120, 140]) },
        series: [
          { key: 'left', field: 'left', label: 'Left' },
          {
            key: 'right',
            field: 'right',
            label: 'Right',
            yAxisKey: 'right',
            path: ({ series, commands, yRange, xRange, transform }) => {
              expect(yRange).toEqual([110, 150])
              expect(xRange).toEqual([epoch + 1, epoch + 5])
              expect(transform).toBeDefined()
              commands.addLine(series.segments[0]?.buffer ?? new Float32Array(0), {
                color: [1, 0, 0, 1],
                width: 3,
              })
            },
          },
        ],
      },
      {
        yAxes: [
          { key: 'left', range: [0, 3] },
          { key: 'right', range: [110, 150] },
        ],
      },
    )
    expect(plan.xRange).toEqual([epoch + 1, epoch + 5])
    expect(plan.series[0]?.segments[0]?.buffer).toEqual(new Float32Array([0, 1, 2, 2]))
    expect(plan.series[1]?.segments[0]?.buffer).toEqual(new Float32Array([1, 120, 4, 140]))
    const frame = buildTimeSeriesCommandFrame(plan, 320, 180, { guides: false })
    const path = frame.commands
      .sorted()
      .find((command) => command.kind === 'line' && command.options.width === 3)
    if (path?.kind !== 'line') throw new Error('Expected a custom line')
    expect(path.transform).toBeDefined()
    expect(path.transform?.mapY(120)).toBe(120)
  })

  it('draws independently scaled lines in the same plot and SVG frame', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10]),
        columns: {
          temperature: new Float64Array([0, 100]),
          pressure: new Float64Array([2000, 1000]),
        },
        series: [
          { key: 'temperature', label: 'Temperature', field: 'temperature', color: [1, 0, 0, 1] },
          {
            key: 'pressure',
            yAxisKey: 'pressure',
            label: 'Pressure',
            field: 'pressure',
            color: [0, 0, 1, 1],
          },
        ],
      },
      {
        yAxes: [
          { key: 'temperature', label: 'Temperature (°C)', paddingRatio: 0 },
          { key: 'pressure', side: 'right', label: 'Pressure (mbar)', paddingRatio: 0 },
        ],
      },
    )
    expect(plan.yRange).toEqual([0, 100])
    expect(plan.yAxes).toMatchObject([
      { key: 'temperature', range: [0, 100] },
      { key: 'pressure', range: [1000, 2000] },
    ])

    const [temperature, pressure] = plan.series
    const temperatureBuffer = temperature?.segments[0]?.buffer
    const pressureBuffer = pressure?.segments[0]?.buffer
    expect(temperatureBuffer).toEqual(new Float32Array([0, 0, 10, 100]))
    expect(pressureBuffer).toEqual(new Float32Array([0, 2000, 10, 1000]))

    const frame = buildTimeSeriesCommandFrame(plan, 320, 180)
    const { layout } = frame
    if (!layout) throw new Error('Named axes should reserve plot gutters')
    expect(layout.yAxes?.map((axis) => [axis.key, axis.side])).toEqual([
      ['temperature', 'left'],
      ['pressure', 'right'],
    ])

    const commands = frame.commands.sorted()
    const temperatureCommand = commands.find(
      (command) => command.kind === 'line' && command.buffer === temperatureBuffer,
    )
    const pressureCommand = commands.find(
      (command) => command.kind === 'line' && command.buffer === pressureBuffer,
    )
    if (temperatureCommand?.kind !== 'line' || pressureCommand?.kind !== 'line') {
      throw new Error('Expected one render command per series')
    }
    expect(temperatureCommand.transform).toBeUndefined()
    const { x: left, y: top, width, height } = layout.plotArea
    const right = left + width
    const bottom = top + height
    expect(frame.transform.dataToPixel(0, 0).y).toBeCloseTo(bottom)
    expect(frame.transform.dataToPixel(10, 100).y).toBeCloseTo(top)
    expect(pressureCommand.transform?.dataToPixel(0, 2000).y).toBeCloseTo(top)
    expect(pressureCommand.transform?.dataToPixel(10, 1000).y).toBeCloseTo(bottom)

    const svg = commandFrameToSvg(frame)
    expect(svg).toContain(
      `d="M ${left} ${bottom} L ${right} ${top}" fill="none" stroke="rgb(255 0 0)"`,
    )
    expect(svg).toContain(
      `d="M ${left} ${top} L ${right} ${bottom}" fill="none" stroke="rgb(0 0 255)"`,
    )
    expect(svg).toContain('Temperature (°C)')
    expect(svg).toContain('Pressure (mbar)')
  })

  it('keeps bands, Y annotations and SPC on their named scale', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10]),
        columns: {
          temperature: new Float64Array([10, 20]),
          pressure: new Float64Array([1200, 1400]),
          lower: new Float64Array([950, 1000]),
          upper: new Float64Array([1450, 1500]),
        },
        series: [
          { key: 'temperature', label: 'Temperature', field: 'temperature' },
          { key: 'pressure', yAxisKey: 'pressure', label: 'Pressure', field: 'pressure' },
        ],
        bands: [
          { kind: 'value-band', key: 'low-warning', yAxisKey: 'pressure', yStart: 850, yEnd: 950 },
          {
            kind: 'envelope',
            key: 'forecast',
            yAxisKey: 'pressure',
            lowerField: 'lower',
            upperField: 'upper',
          },
        ],
        annotations: [
          { kind: 'x-line', key: 'batch-start', x: 0 },
          { kind: 'y-line', key: 'target', yAxisKey: 'pressure', y: 1600, includeInYRange: true },
        ],
        spcTracks: [
          {
            key: 'pressure-limits',
            yAxisKey: 'pressure',
            centerLine: 1500,
            upperControlLimit: 2350,
          },
        ],
      },
      {
        yRange: [0, 100],
        yAxes: [{ key: 'temperature' }, { key: 'pressure', side: 'right', paddingRatio: 0 }],
      },
    )

    expect(plan.yRange).toEqual([0, 100])
    expect(plan.yAxes?.[1]?.range).toEqual([850, 2350])
    expect(plan.bands.map((band) => band.yAxisKey)).toEqual(['pressure', 'pressure'])
    expect(plan.annotations.map((annotation) => annotation.yAxisKey)).toEqual([
      undefined,
      'pressure',
    ])
    expect(plan.annotations[0]?.lineSegments[0]?.buffer).toEqual(new Float32Array([0, 0, 0, 100]))
    expect(plan.annotations[1]?.lineSegments[0]?.buffer).toEqual(
      new Float32Array([0, 1600, 10, 1600]),
    )
    expect(plan.spcTracks[0]?.yAxisKey).toBe('pressure')

    const frame = buildTimeSeriesCommandFrame(plan, 320, 180)
    const commands = frame.commands.sorted()
    const series = plan.series[1]?.segments[0]?.buffer
    const secondary = commands.find(
      (command) => command.kind === 'line' && command.buffer === series,
    )
    if (secondary?.kind !== 'line' || !secondary.transform) {
      throw new Error('Expected a pressure scale transform')
    }
    const buffers = [
      plan.bands[0]?.segments[0]?.upper,
      plan.bands[1]?.segments[0]?.upper,
      plan.annotations[1]?.lineSegments[0]?.buffer,
      plan.spcTracks[0]?.centerLineSegments[0]?.buffer,
    ]
    for (const buffer of buffers) {
      const command = commands.find((item) => {
        if (item.kind === 'fill') return item.upper === buffer
        return item.kind === 'line' && item.buffer === buffer
      })
      expect(command).toMatchObject({ transform: secondary.transform })
    }
  })

  it('infers a positive log domain and uses its floor for an implicit zero baseline', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 1, 2, 3, 4]),
        columns: {
          a: new Float64Array([1, 10, 0, 25, 100]),
          b: new Float64Array([0, 50, 120, -2, 100]),
        },
        series: [
          { key: 'a', label: 'Area', field: 'a', mark: 'area' },
          { key: 'b', label: 'Bars', field: 'b', mark: 'bar' },
        ],
      },
      {
        yAxes: [{ key: 'y', scale: { type: 'log' }, paddingRatio: 0 }],
      },
    )
    expect(plan.yRange).toEqual([1, 120])
    expect(plan.series[0]?.segments.map(({ pointCount }) => pointCount)).toEqual([2, 2])
    const frame = buildTimeSeriesCommandFrame(plan, 300, 200, { guides: false })
    const commands = frame.commands.sorted()
    const fill = commands.find((command) => command.kind === 'fill')
    const bars = commands.find((command) => command.kind === 'marks')
    if (fill?.kind !== 'fill' || bars?.kind !== 'marks') throw new Error('Expected data geometry')
    expect(fill.lower[1]).toBe(1)
    expect(Array.from(bars.bounds).every(Number.isFinite)).toBe(true)
    expect(bars.bounds.length).toBe(12)
    expect(frame.transform.hasProjection).toBe(true)
  })

  it('stacks signed bar groups and normalizes each sign without changing source values', () => {
    const a = new Float64Array([2, -1, NaN])
    const b = new Float64Array([6, -3, 9])
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 1, 2]),
        columns: { a, b },
        series: [
          { key: 'a', label: 'A', field: 'a', mark: 'bar' },
          { key: 'b', label: 'B', field: 'b', mark: 'bar' },
        ],
      },
      {
        yPaddingRatio: 0,
        stack: { groups: [{ series: ['a', 'b'] }], percent: true },
      },
    )
    expect(plan.yRange).toEqual([-1, 1])
    expect(a).toEqual(new Float64Array([2, -1, NaN]))
    const [first, second] = plan.series
    expect(first?.segments[0]?.buffer).toEqual(new Float32Array([0, 0.25, 1, -0.25]))
    expect(second?.segments[0]?.buffer).toEqual(new Float32Array([0, 1, 1, -1, 2, 1]))
    expect(second?.segments[0]?.lower).toEqual(new Float32Array([0, 0.25, 1, -0.25, 2, 0]))
    const frame = buildTimeSeriesCommandFrame(plan, 300, 160)
    const markCommands = frame.commands.sorted().filter((command) => command.kind === 'marks')
    expect(markCommands.map(({ bounds }) => bounds.length)).toEqual([8, 12])
    expect(markCommands[0]?.bounds[3]).toBeCloseTo(20)
    expect(markCommands[1]?.bounds[3]).toBeCloseTo(60)
  })

  it('fills a cumulative area between the current and previous series', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 1]),
        columns: { a: new Float64Array([2, 3]), b: new Float64Array([5, 6]) },
        series: [
          { key: 'a', label: 'A', field: 'a', mark: 'area' },
          { key: 'b', label: 'B', field: 'b', mark: 'area' },
        ],
      },
      {
        yPaddingRatio: 0,
        stack: { groups: [{ series: ['a', 'b'], mode: 'cumulative' }] },
      },
    )
    const areas = buildTimeSeriesCommandFrame(plan, 300, 160)
      .commands.sorted()
      .filter((command) => command.kind === 'fill')
    expect(plan.yRange).toEqual([0, 9])
    expect(areas[1]?.upper).toEqual(new Float32Array([0, 7, 1, 9]))
    expect(areas[1]?.lower).toEqual(new Float32Array([0, 2, 1, 3]))
  })

  it('couples a dependent unit scale to the source axis and its own samples', () => {
    const toFahrenheit = (value: number) => value * 1.8 + 32
    const toCelsius = (value: number) => (value - 32) / 1.8
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 1]),
        columns: { c: new Float64Array([10, 25]), f: new Float64Array([32, 86]) },
        series: [
          { key: 'first', label: 'First probe', field: 'c' },
          { key: 'second', label: 'Second probe', field: 'f', yAxisKey: 'f' },
        ],
      },
      {
        yAxes: [
          { key: 'c', label: 'Celsius', paddingRatio: 0 },
          {
            key: 'f',
            label: 'Fahrenheit',
            from: { key: 'c', fromSource: toFahrenheit, toSource: toCelsius },
          },
          {
            key: 'invalid',
            from: { key: 'missing', fromSource: toFahrenheit, toSource: toCelsius },
          },
        ],
      },
    )
    expect(plan.yRange).toEqual([0, 30])
    expect(plan.yAxes?.map(({ range }) => range)).toEqual([
      [0, 30],
      [32, 86],
    ])
    expect(plan.warnings).toHaveLength(1)
    const frame = buildTimeSeriesCommandFrame(plan, 380, 240, { guides: false })
    const command = frame.commands.sorted()[1]
    if (command?.kind !== 'line' || !command.transform)
      throw new Error('Expected a dependent-scale line')
    expect(command.transform.dataToPixel(0, 50).y).toBeCloseTo(frame.transform.dataToPixel(0, 10).y)
    expect(frame.layout?.yAxes?.[1]?.ticks[0]?.position).toBe(frame.layout?.yTicks[0]?.position)
  })

  it('reports explicitly unknown axes and preserves legacy primary bounds', () => {
    const plan = buildTimeSeriesRenderPlan(
      {
        timestamps: new Float64Array([0, 10]),
        columns: { temp: new Float64Array([10, 20]) },
        series: [
          { key: 'temperature', yAxisKey: 'y', label: 'Temperature', field: 'temp' },
          { key: 'typo', yAxisKey: 'temperature', label: 'Typo', field: 'temp' },
        ],
        annotations: [
          { kind: 'y-line', key: 'limit', yAxisKey: 'missing', y: 2500, includeInYRange: true },
        ],
      },
      { yRange: [0, 30] },
    )

    expect(plan.yAxes).toBeUndefined()
    expect(plan.yRange).toEqual([0, 30])
    expect(plan.series.map(({ key }) => key)).toEqual(['temperature'])
    expect(plan.annotations).toEqual([])
    expect(plan.warnings).toEqual([
      'Series "typo" skipped because Y axis "temperature" is missing.',
      'Annotation "limit" skipped because Y axis "missing" is missing.',
    ])
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
