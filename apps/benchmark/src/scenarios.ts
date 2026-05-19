/**
 * Benchmark scenarios for @pitant/charts.
 *
 * Scenarios 1-4, 8-9 require a browser (WebGPU/Canvas2D).
 * Scenarios 5-7 and 10-23 are pure-compute/package-level gates.
 * Bundle-size scenario runs via size-limit.
 */
import {
  addDigitalChannelToCommandList,
  addTimeSeriesBandsToCommandList,
  addTimeSeriesDerivedColumns,
  addTimeSeriesToCommandList,
  buildDigitalChannelRenderPlan,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  clampRangeToBounds,
  DataSource,
  type DigitalChannelSeries,
  findNearestTimestampIndex,
  panRangeByPixels,
  panRangeByValue,
  RenderCommandList,
  type TimeSeriesAnnotation,
  type TimeSeriesDerivedColumn,
  type TimeSeriesEventMarker,
  type TimeSeriesSeries,
  zoomRangeAroundAnchor,
  zoomRangeAroundCenter,
} from '@pitant/charts'
import { LodPyramid } from '@pitant/charts/data-engine'

// ── Helpers ──────────────────────────────────────────────────

function generateData(n: number): { timestamps: BigInt64Array; values: Float64Array } {
  const timestamps = new BigInt64Array(n)
  const values = new Float64Array(n)
  const baseTime = 1_700_000_000_000n // ~2023-11-14 in ms
  for (let i = 0; i < n; i++) {
    timestamps[i] = baseTime + BigInt(i) * 1_000n // 1s intervals
    values[i] = Math.sin(i * 0.001) * 100 + Math.random() * 10
  }
  return { timestamps, values }
}

function generateFloatTimestamps(n: number, offset = 0): Float64Array {
  const timestamps = new Float64Array(n)
  const baseTime = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    timestamps[i] = baseTime + (offset + i) * 1000
  }
  return timestamps
}

function generateMultiPenData(
  pointCount: number,
  penCount: number,
  timestampOffset = 0,
): {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  series: TimeSeriesSeries[]
} {
  const timestamps = generateFloatTimestamps(pointCount, timestampOffset)
  const columns: Record<string, Float64Array> = {}
  const series: TimeSeriesSeries[] = []

  for (let pen = 0; pen < penCount; pen++) {
    const field = `pen_${pen}`
    const values = new Float64Array(pointCount)
    const fastPeriod = 23 + pen * 3
    const slowPeriod = 700 + pen * 29
    const offset = pen * 12

    for (let i = 0; i < pointCount; i++) {
      values[i] = offset + Math.sin(i / fastPeriod) * 8 + Math.cos(i / slowPeriod) * 34
    }

    columns[field] = values
    series.push({
      key: field,
      label: `Pen ${pen + 1}`,
      field,
      lineWidth: 1,
    })
  }

  return { timestamps, columns, series }
}

function generateDigitalChannelData(
  pointCount: number,
  channelCount: number,
  timestampOffset = 0,
): {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  channels: DigitalChannelSeries[]
} {
  const timestamps = generateFloatTimestamps(pointCount, timestampOffset)
  const columns: Record<string, Float64Array> = {}
  const channels: DigitalChannelSeries[] = []

  for (let channel = 0; channel < channelCount; channel++) {
    const field = `channel_${channel}`
    const values = new Float64Array(pointCount)
    const highWindow = 80 + channel * 11
    const cycle = highWindow + 60 + channel * 7

    for (let i = 0; i < pointCount; i++) {
      values[i] = (i + channel * 17) % cycle < highWindow ? 1 : 0
    }

    columns[field] = values
    channels.push({
      key: field,
      label: `Channel ${channel + 1}`,
      field,
      lineWidth: 1,
      stateLabels: { 0: 'Low', 1: 'High' },
    })
  }

  return { timestamps, columns, channels }
}

function addQualityFlags<T extends { columns: Record<string, Float64Array> }>(
  data: T,
): T & { quality: Record<string, Uint8Array> } {
  const quality: Record<string, Uint8Array> = {}
  for (const [field, values] of Object.entries(data.columns)) {
    const flags = new Uint8Array(values.length)
    for (let i = 0; i < values.length; i++) {
      flags[i] = i % 997 === 0 ? 8 : i % 251 === 0 ? 2 : 0
    }
    quality[field] = flags
  }
  return { ...data, quality }
}

function median(values: number[]): number {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] as number
}

export interface BenchmarkResult {
  scenario: string
  metric: string
  value: number
  unit: string
  target: number
  passed: boolean
}

type ScenarioFn = () =>
  | BenchmarkResult
  | BenchmarkResult[]
  | Promise<BenchmarkResult | BenchmarkResult[]>

// ── Scenario Registry ────────────────────────────────────────

export const scenarios: Record<string, ScenarioFn> = {}

// ── SCENARIO 005: LOD pyramid build 1M points ───────────────

scenarios['005_pyramid_build_1M'] = () => {
  const n = 1_000_000
  const { timestamps, values } = generateData(n)
  const target = 100 // ms

  // Warm up
  const warmup = new LodPyramid()
  warmup.ingest(timestamps, values, { maxPoints: n })
  warmup.dispose()

  // Measure (median of 5 runs)
  const times: number[] = []
  for (let i = 0; i < 5; i++) {
    const p = new LodPyramid()
    const start = performance.now()
    p.ingest(timestamps, values, { maxPoints: n })
    const elapsed = performance.now() - start
    times.push(elapsed)
    p.dispose()
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)] as number

  return {
    scenario: '005_pyramid_build_1M',
    metric: 'LOD pyramid build (1M pts)',
    value: Math.round(median * 100) / 100,
    unit: 'ms',
    target,
    passed: median < target,
  }
}

// ── SCENARIO 006: LOD pyramid build 5M points ───────────────

scenarios['006_pyramid_build_5M'] = () => {
  const n = 5_000_000
  const { timestamps, values } = generateData(n)
  const target = 500 // ms

  const times: number[] = []
  for (let i = 0; i < 3; i++) {
    const p = new LodPyramid()
    const start = performance.now()
    p.ingest(timestamps, values, { maxPoints: n })
    const elapsed = performance.now() - start
    times.push(elapsed)
    p.dispose()
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)] as number

  return {
    scenario: '006_pyramid_build_5M',
    metric: 'LOD pyramid build (5M pts)',
    value: Math.round(median * 100) / 100,
    unit: 'ms',
    target,
    passed: median < target,
  }
}

// ── SCENARIO 007: Streaming append overhead ─────────────────

scenarios['007_streaming_append'] = () => {
  const baseN = 1_000_000
  const appendBatch = 100
  const appendIterations = 1_000
  const { timestamps, values } = generateData(baseN + appendBatch * appendIterations)
  const target = 2 // ms per 100-point append (full pyramid rebuild)

  const p = new LodPyramid()

  // Ingest base data
  p.ingest(timestamps.subarray(0, baseN), values.subarray(0, baseN), {
    maxPoints: baseN + appendBatch * appendIterations,
  })

  // Measure append batches
  const start = performance.now()
  for (let i = 0; i < appendIterations; i++) {
    const offset = baseN + i * appendBatch
    p.append(
      timestamps.subarray(offset, offset + appendBatch),
      values.subarray(offset, offset + appendBatch),
    )
  }
  const totalMs = performance.now() - start
  const avgPerBatch = totalMs / appendIterations
  p.dispose()

  return {
    scenario: '007_streaming_append',
    metric: `Append ${appendBatch} pts/batch (${appendIterations} batches, 1M base)`,
    value: Math.round(avgPerBatch * 1000) / 1000,
    unit: 'ms/batch',
    target,
    passed: avgPerBatch < target,
  }
}

// ── SCENARIO 010: Data engine init (fast path) ──────────────

scenarios['010_fast_path_init'] = () => {
  const n = 5_000 // below FAST_PATH_THRESHOLD
  const { timestamps, values } = generateData(n)
  const target = 5 // ms

  // Warm up
  const warmP = new LodPyramid()
  warmP.ingest(timestamps, values, { maxPoints: n })
  warmP.dispose()

  const times: number[] = []
  for (let i = 0; i < 10; i++) {
    const p = new LodPyramid()
    const start = performance.now()
    p.ingest(timestamps, values, { maxPoints: n })
    const elapsed = performance.now() - start
    times.push(elapsed)
    p.dispose()
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)] as number

  return {
    scenario: '010_fast_path_init',
    metric: 'Fast-path ingest (5K pts)',
    value: Math.round(median * 1000) / 1000,
    unit: 'ms',
    target,
    passed: median < target,
  }
}

// ── SCENARIO 011: LOD query performance ─────────────────────

scenarios['011_query_perf'] = () => {
  const n = 1_000_000
  const { timestamps, values } = generateData(n)
  const target = 2 // ms per query

  const p = new LodPyramid()
  p.ingest(timestamps, values, { maxPoints: n })

  // Measure queries at different viewport widths
  const queryIterations = 100
  const start = performance.now()
  for (let i = 0; i < queryIterations; i++) {
    // Random viewport window covering ~10% of data
    const windowSize = BigInt(Math.floor(n * 0.1)) * 1_000n
    const baseTime = 1_700_000_000_000n
    const offset = BigInt(Math.floor(Math.random() * n * 0.9)) * 1_000n
    p.query(baseTime + offset, baseTime + offset + windowSize, 1920)
  }
  const totalMs = performance.now() - start
  const avgPerQuery = totalMs / queryIterations
  p.dispose()

  return {
    scenario: '011_query_perf',
    metric: `LOD query (1M pts, ${queryIterations} queries)`,
    value: Math.round(avgPerQuery * 1000) / 1000,
    unit: 'ms/query',
    target,
    passed: avgPerQuery < target,
  }
}

// ── SCENARIO 012: Memory overhead ───────────────────────────

scenarios['012_memory_overhead'] = () => {
  const n = 1_000_000
  const { timestamps, values } = generateData(n)
  const rawBytes = n * (8 + 8) // BigInt64 + Float64 = 16 bytes/pt
  const maxOverhead = 3.5 // raw(16n) + LOD levels(~32n) = ~3× theoretical

  const p = new LodPyramid()
  p.ingest(timestamps, values, { maxPoints: n })

  // Estimate total memory from level count and point counts
  // Level 0 raw: n * 16 bytes (timestamps + values stored internally)
  // Each LOD level k: ceil(n / 2^k) * 32 bytes (Float64 quads)
  let estimatedPyramidBytes = 0
  const levelCount = p.levelCount
  for (let lvl = 1; lvl < levelCount; lvl++) {
    const levelPoints = Math.ceil(n / 2 ** lvl)
    estimatedPyramidBytes += levelPoints * 32 // 4 × Float64
  }
  const totalEstimate = rawBytes + estimatedPyramidBytes
  const ratio = totalEstimate / rawBytes
  p.dispose()

  return {
    scenario: '012_memory_overhead',
    metric: `Memory ratio (1M pts, raw=${(rawBytes / 1024 / 1024).toFixed(1)}MB)`,
    value: Math.round(ratio * 100) / 100,
    unit: '× raw',
    target: maxOverhead,
    passed: ratio <= maxOverhead,
  }
}

// ── SCENARIO 013: Ingestion throughput ──────────────────────

scenarios['013_ingestion_throughput'] = () => {
  const n = 5_000_000
  const { timestamps, values } = generateData(n)
  const target = 5_000_000 // 5M pts/sec minimum

  const times: number[] = []
  for (let i = 0; i < 3; i++) {
    const p = new LodPyramid()
    const start = performance.now()
    p.ingest(timestamps, values, { maxPoints: n })
    const elapsed = performance.now() - start
    times.push(elapsed)
    p.dispose()
  }
  times.sort((a, b) => a - b)
  const medianMs = times[Math.floor(times.length / 2)] as number
  const ptsPerSec = Math.round(n / (medianMs / 1000))

  return {
    scenario: '013_ingestion_throughput',
    metric: `Ingestion throughput (${(n / 1e6).toFixed(0)}M pts)`,
    value: ptsPerSec,
    unit: 'pts/sec',
    target,
    passed: ptsPerSec >= target,
  }
}

// ── SCENARIO 014: 8-pen TimeSeries render-plan generation ───

scenarios['014_time_series_plan_8x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 8
  const data = generateMultiPenData(pointCount, penCount)
  const target = 150 // ms for 8M source samples to command buffers

  const warmup = buildTimeSeriesRenderPlan(data, { gapThreshold: 0 })
  const warmupCommands = new RenderCommandList()
  addTimeSeriesToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(data, { gapThreshold: 0 })
    const commands = new RenderCommandList()
    addTimeSeriesToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedPointCount = plan.renderedPointCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '014_time_series_plan_8x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts (${renderedPointCount.toLocaleString()} rendered, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 015: 16-channel digital render-plan generation ─

scenarios['015_digital_channel_plan_16x250K'] = () => {
  const pointCount = 250_000
  const channelCount = 16
  const data = generateDigitalChannelData(pointCount, channelCount)
  const target = 100 // ms for 4M source samples with step expansion

  const warmup = buildDigitalChannelRenderPlan(data, { gapThreshold: 0 })
  const warmupCommands = new RenderCommandList()
  addDigitalChannelToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildDigitalChannelRenderPlan(data, { gapThreshold: 0 })
    const commands = new RenderCommandList()
    addDigitalChannelToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedPointCount = plan.renderedPointCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '015_digital_channel_plan_16x250K',
    metric: `${channelCount} channels x ${pointCount.toLocaleString()} pts (${renderedPointCount.toLocaleString()} rendered, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 020: Alarm/envelope overlay plan generation ────

scenarios['020_time_series_bands_8x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 8
  const data = generateMultiPenData(pointCount, penCount)
  const baseline = data.columns['pen_0']
  if (!baseline) {
    throw new Error('benchmark fixture missing pen_0')
  }

  const low = new Float64Array(pointCount)
  const high = new Float64Array(pointCount)
  for (let i = 0; i < pointCount; i++) {
    const value = baseline[i] ?? 0
    low[i] = value - 12
    high[i] = value + 12
  }
  const dataWithBands = {
    ...data,
    columns: {
      ...data.columns,
      model_low: low,
      model_high: high,
    },
    bands: [
      {
        kind: 'value-band',
        key: 'warning',
        yStart: 52,
        yEnd: 68,
        fillColor: [1, 0.15, 0.05, 0.1],
        lineColor: [1, 0.15, 0.05, 0.55],
      },
      {
        kind: 'envelope',
        key: 'model',
        lowerField: 'model_low',
        upperField: 'model_high',
        fillColor: [0.1, 0.4, 1, 0.08],
      },
    ],
  } as const
  const target = 250 // ms for 8M trend samples plus 1M envelope samples

  const warmup = buildTimeSeriesRenderPlan(dataWithBands, { gapThreshold: 0 })
  const warmupCommands = new RenderCommandList()
  addTimeSeriesBandsToCommandList(warmupCommands, warmup)
  addTimeSeriesToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let bandPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(dataWithBands, { gapThreshold: 0 })
    const commands = new RenderCommandList()
    addTimeSeriesBandsToCommandList(commands, plan)
    addTimeSeriesToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    bandPointCount = plan.bands.reduce((total, band) => total + band.renderedPointCount, 0)
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '020_time_series_bands_8x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts plus ${bandPointCount.toLocaleString()} band pts (${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 021: Derived series overlay generation ────────

scenarios['021_time_series_derived_8x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 8
  const data = generateMultiPenData(pointCount, penCount)
  const derivedColumns: TimeSeriesDerivedColumn[] = []
  const derivedSeries: TimeSeriesSeries[] = []

  for (let pen = 0; pen < penCount; pen++) {
    const sourceField = `pen_${pen}`
    const field = pen % 2 === 0 ? `${sourceField}_ma` : `${sourceField}_rate`
    if (pen % 2 === 0) {
      derivedColumns.push({
        kind: 'moving-average',
        sourceField,
        field,
        windowSize: 64,
        minimumSamples: 16,
      })
    } else {
      derivedColumns.push({
        kind: 'rate-of-change',
        sourceField,
        field,
        per: 1000,
      })
    }
    derivedSeries.push({
      key: field,
      label: pen % 2 === 0 ? `Pen ${pen + 1} MA` : `Pen ${pen + 1} rate`,
      field,
      lineWidth: 1,
    })
  }

  const target = 350 // ms for 8M derived samples plus 16-series render-plan commands

  const warmupData = addTimeSeriesDerivedColumns(data, derivedColumns)
  const warmup = buildTimeSeriesRenderPlan({
    timestamps: warmupData.timestamps,
    columns: warmupData.columns,
    series: [...data.series, ...derivedSeries],
  })
  const warmupCommands = new RenderCommandList()
  addTimeSeriesToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const derivedData = addTimeSeriesDerivedColumns(data, derivedColumns)
    const plan = buildTimeSeriesRenderPlan({
      timestamps: derivedData.timestamps,
      columns: derivedData.columns,
      series: [...data.series, ...derivedSeries],
    })
    const commands = new RenderCommandList()
    addTimeSeriesToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedPointCount = plan.renderedPointCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '021_time_series_derived_8x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts plus ${derivedColumns.length} derived overlays (${renderedPointCount.toLocaleString()} rendered, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 022: Persistent annotation/ruler overlays ─────

scenarios['022_time_series_annotations_8x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 8
  const annotationCount = 1_000
  const data = generateMultiPenData(pointCount, penCount)
  const xStart = data.timestamps[0]
  const xEnd = data.timestamps[data.timestamps.length - 1]
  if (xStart === undefined || xEnd === undefined) {
    throw new Error('benchmark fixture missing timestamps')
  }

  const span = xEnd - xStart
  const annotations: TimeSeriesAnnotation[] = []
  for (let i = 0; i < annotationCount; i++) {
    const center = xStart + (span * (i + 1)) / (annotationCount + 1)
    const width = Math.max(1000, span / 10_000)
    const lowY = -20 + (i % 40)
    const highY = lowY + 8
    switch (i % 5) {
      case 0:
        annotations.push({
          kind: 'x-line',
          key: `batch-${i}`,
          label: `B${i}`,
          x: center,
          color: [0.1, 0.3, 0.9, 0.75],
        })
        break
      case 1:
        annotations.push({
          kind: 'y-line',
          key: `limit-${i}`,
          label: `L${i}`,
          y: lowY,
          color: [0.8, 0.2, 0.1, 0.75],
        })
        break
      case 2:
        annotations.push({
          kind: 'x-range',
          key: `hold-${i}`,
          label: `H${i}`,
          xStart: center - width,
          xEnd: center + width,
          fillColor: [1, 0.75, 0.1, 0.08],
          lineColor: [1, 0.75, 0.1, 0.25],
        })
        break
      case 3:
        annotations.push({
          kind: 'y-range',
          key: `target-${i}`,
          label: `T${i}`,
          yStart: lowY,
          yEnd: highY,
          fillColor: [0.1, 0.7, 0.4, 0.08],
          lineColor: [0.1, 0.7, 0.4, 0.25],
        })
        break
      default:
        annotations.push({
          kind: 'ruler',
          key: `ruler-${i}`,
          label: `R${i}`,
          xStart: center - width,
          xEnd: center + width,
          yStart: lowY,
          yEnd: highY,
          color: [0.15, 0.15, 0.15, 0.8],
        })
        break
    }
  }

  const dataWithAnnotations = { ...data, annotations } as const
  const target = 250 // ms for 8M trend samples plus 1000 persistent overlays

  const warmup = buildTimeSeriesRenderPlan(dataWithAnnotations, { gapThreshold: 0 })
  buildTimeSeriesCommandFrame(warmup, 1280, 720, { guides: false })

  const times: number[] = []
  let annotationPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(dataWithAnnotations, { gapThreshold: 0 })
    const frame = buildTimeSeriesCommandFrame(plan, 1280, 720, { guides: false })
    const elapsed = performance.now() - start
    times.push(elapsed)
    annotationPointCount = plan.annotations.reduce(
      (total, annotation) => total + annotation.renderedPointCount,
      0,
    )
    commandCount = frame.commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '022_time_series_annotations_8x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts plus ${annotations.length.toLocaleString()} annotations (${annotationPointCount.toLocaleString()} annotation pts, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 023: Sparse event marker overlay generation ───

scenarios['023_time_series_event_markers_8x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 8
  const markerCount = 10_000
  const data = generateMultiPenData(pointCount, penCount)
  const xStart = data.timestamps[0]
  const xEnd = data.timestamps[data.timestamps.length - 1]
  if (xStart === undefined || xEnd === undefined) {
    throw new Error('benchmark fixture missing timestamps')
  }

  const span = xEnd - xStart
  const eventTypes = [
    'start',
    'stop',
    'alarm',
    'comment',
    'batch',
    'hold',
    'investigation',
    'correction',
    'maintenance',
  ] as const
  const eventMarkers: TimeSeriesEventMarker[] = []
  for (let i = 0; i < markerCount; i++) {
    eventMarkers.push({
      key: `event-${i}`,
      label: `E${i}`,
      x: xStart + (span * (i + 1)) / (markerCount + 1),
      eventType: eventTypes[i % eventTypes.length],
      placement: i % 17 === 0 ? 'full-height' : i % 3 === 0 ? 'bottom-tick' : 'top-tick',
      labelVisible: i % 250 === 0,
    })
  }

  const dataWithEvents = { ...data, eventMarkers } as const
  const target = 250 // ms for 8M trend samples plus 10k sparse event markers

  const warmup = buildTimeSeriesRenderPlan(dataWithEvents, { gapThreshold: 0 })
  buildTimeSeriesCommandFrame(warmup, 1280, 720, { guides: false })

  const times: number[] = []
  let markerPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(dataWithEvents, { gapThreshold: 0 })
    const frame = buildTimeSeriesCommandFrame(plan, 1280, 720, { guides: false })
    const elapsed = performance.now() - start
    times.push(elapsed)
    markerPointCount = plan.eventMarkers.reduce(
      (total, marker) => total + marker.renderedPointCount,
      0,
    )
    commandCount = frame.commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '023_time_series_event_markers_8x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts plus ${eventMarkers.length.toLocaleString()} event markers (${markerPointCount.toLocaleString()} marker pts, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 016: DataSource live append + viewport query ───

scenarios['016_data_source_live_append_query_4pens'] = async () => {
  const basePointCount = 100_000
  const penCount = 4
  const appendBatch = 250
  const appendIterations = 100
  const target = 2 // ms per append + visible-window query
  const base = generateMultiPenData(basePointCount, penCount)
  const batches = Array.from({ length: appendIterations }, (_, index) =>
    generateMultiPenData(appendBatch, penCount, basePointCount + index * appendBatch),
  )
  const source = new DataSource({ strict: false })
  const fields = Object.keys(base.columns)

  await source.load({ timestamps: base.timestamps, columns: base.columns })

  const start = performance.now()
  for (const batch of batches) {
    await source.append({ timestamps: batch.timestamps, columns: batch.columns })
    const end = batch.timestamps[batch.timestamps.length - 1] as number
    await source.query({
      start: end - 20_000 * 1000,
      end,
      targetPixels: 1200,
      columns: fields,
    })
  }
  const totalMs = performance.now() - start
  const avgPerBatch = totalMs / appendIterations
  source.destroy()

  return {
    scenario: '016_data_source_live_append_query_4pens',
    metric: `${penCount} pens append ${appendBatch} pts + viewport query (${appendIterations} batches)`,
    value: Math.round(avgPerBatch * 1000) / 1000,
    unit: 'ms/batch',
    target,
    passed: avgPerBatch < target,
  }
}

// ── SCENARIO 017: Quality-preserving viewport query ─────────

scenarios['017_data_source_quality_query_4pens'] = async () => {
  const pointCount = 200_000
  const penCount = 4
  const queryIterations = 100
  const target = 1 // ms per 4-pen query with quality mapping
  const data = addQualityFlags(generateMultiPenData(pointCount, penCount))
  const fields = Object.keys(data.columns)
  const source = new DataSource({ strict: false })

  await source.load({
    timestamps: data.timestamps,
    columns: data.columns,
    quality: data.quality,
  })

  const start = performance.now()
  for (let i = 0; i < queryIterations; i++) {
    const windowStart = (i * 977) % (pointCount - 20_000)
    await source.query({
      start: data.timestamps[windowStart] as number,
      end: data.timestamps[windowStart + 20_000] as number,
      targetPixels: 1200,
      columns: fields,
    })
  }
  const totalMs = performance.now() - start
  const avgPerQuery = totalMs / queryIterations
  source.destroy()

  return {
    scenario: '017_data_source_quality_query_4pens',
    metric: `${penCount} pens quality-preserving viewport query (${queryIterations} windows)`,
    value: Math.round(avgPerQuery * 1000) / 1000,
    unit: 'ms/query',
    target,
    passed: avgPerQuery < target,
  }
}

// ── SCENARIO 018: Interaction range stress ─────────────────

scenarios['018_interaction_range_1000_cycles'] = () => {
  const iterations = 1_000
  const runs = 10
  const latencyTarget = 2 // ms for one frame-safe burst of 1000 range updates
  const heapTarget = 2 // MB after 10k range updates
  const bounds: readonly [number, number] = [0, 86_400_000]
  const plotWidth = 1200
  const initialRange: readonly [number, number] = [18_000_000, 24_000_000]

  runInteractionRangeCycle(initialRange, bounds, plotWidth, iterations)

  const heapStart = process.memoryUsage().heapUsed
  const times: number[] = []
  let finalRange = initialRange
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    finalRange = runInteractionRangeCycle(finalRange, bounds, plotWidth, iterations)
    times.push(performance.now() - start)
  }
  const heapDeltaMb = Math.max(0, process.memoryUsage().heapUsed - heapStart) / 1024 / 1024
  const medianMs = median(times)
  const finite = Number.isFinite(finalRange[0]) && Number.isFinite(finalRange[1])

  return [
    {
      scenario: '018_interaction_range_1000_cycles_latency',
      metric: `${iterations} zoom/pan/DataZoom/touch range updates`,
      value: Math.round(medianMs * 1000) / 1000,
      unit: 'ms/1000',
      target: latencyTarget,
      passed: finite && medianMs < latencyTarget,
    },
    {
      scenario: '018_interaction_range_1000_cycles_heap',
      metric: `${runs * iterations} range updates heap delta`,
      value: Math.round(heapDeltaMb * 1000) / 1000,
      unit: 'MB',
      target: heapTarget,
      passed: finite && heapDeltaMb < heapTarget,
    },
  ]
}

function runInteractionRangeCycle(
  startRange: readonly [number, number],
  bounds: readonly [number, number],
  plotWidth: number,
  iterations: number,
): readonly [number, number] {
  let range = startRange

  for (let i = 0; i < iterations; i++) {
    switch (i % 6) {
      case 0:
        range = zoomRangeAroundAnchor({
          range,
          anchor: range[0] + (range[1] - range[0]) * ((i % 11) / 10),
          factor: Math.exp(-80 * 0.002),
          bounds,
        })
        break
      case 1:
        range = panRangeByPixels({
          range,
          deltaPixels: ((i % 17) - 8) * 7,
          plotWidth,
          bounds,
        })
        break
      case 2:
        range = zoomRangeAroundCenter(range, i % 4 === 0 ? 0.8 : 1.25, bounds)
        break
      case 3: {
        const span = range[1] - range[0]
        const center = bounds[0] + (bounds[1] - bounds[0]) * ((i % 997) / 996)
        range = clampRangeToBounds([center - span / 2, center + span / 2], bounds)
        break
      }
      case 4:
        range = panRangeByValue(range, ((i % 23) - 11) * 250, bounds)
        break
      default:
        range = zoomRangeAroundAnchor({
          range,
          anchor: (range[0] + range[1]) / 2,
          factor: i % 2 === 0 ? 0.92 : 1.08,
          bounds,
        })
        break
    }
  }

  return range
}

// ── SCENARIO 019: Cursor propagation latency ───────────────

scenarios['019_cursor_propagation_4panels'] = () => {
  const panelCount = 4
  const penCount = 4
  const pointCount = 100_000
  const cursorEvents = 1_000
  const runs = 10
  const target = 1 // ms per 1000 cursor propagations; far below one frame
  const panels = Array.from({ length: panelCount }, (_, panelIndex) =>
    addQualityFlags(generateMultiPenData(pointCount, penCount, panelIndex * 3)),
  )
  const cursorTargets = new Float64Array(cursorEvents)
  for (let i = 0; i < cursorTargets.length; i++) {
    cursorTargets[i] = 1_700_000_000_000 + ((i * 977) % pointCount) * 1000 + 250
  }

  runCursorPropagationCycle(panels, cursorTargets)

  const times: number[] = []
  let checksum = 0
  for (let run = 0; run < runs; run++) {
    const start = performance.now()
    checksum += runCursorPropagationCycle(panels, cursorTargets)
    times.push(performance.now() - start)
  }

  const medianMs = median(times)

  return {
    scenario: '019_cursor_propagation_4panels_latency',
    metric: `${panelCount} panels x ${penCount} pens cursor propagation (${cursorEvents} events)`,
    value: Math.round(medianMs * 1000) / 1000,
    unit: 'ms/1000',
    target,
    passed: checksum > 0 && medianMs < target,
  }
}

function runCursorPropagationCycle(
  panels: Array<ReturnType<typeof generateMultiPenData> & { quality: Record<string, Uint8Array> }>,
  cursorTargets: Float64Array,
): number {
  let checksum = 0

  for (let eventIndex = 0; eventIndex < cursorTargets.length; eventIndex++) {
    const sourcePanel = eventIndex % panels.length
    const cursorTimestamp = cursorTargets[eventIndex]
    if (cursorTimestamp === undefined) continue

    for (let panelIndex = 0; panelIndex < panels.length; panelIndex++) {
      if (panelIndex === sourcePanel) continue

      const panel = panels[panelIndex]
      if (!panel) continue

      const nearest = findNearestTimestampIndex(panel.timestamps, cursorTimestamp)
      if (!nearest) continue

      checksum += nearest.index
      for (const series of panel.series) {
        const value = panel.columns[series.field]?.[nearest.index]
        const quality = panel.quality[series.field]?.[nearest.index] ?? 0
        if (Number.isFinite(value)) {
          checksum += Math.trunc((value as number) * 1000) + quality
        }
      }
    }
  }

  return checksum
}
