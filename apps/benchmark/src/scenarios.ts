/**
 * Benchmark scenarios for @pitant/charts.
 *
 * Scenarios 1-4, 8-9 require a browser (WebGPU/Canvas2D).
 * Scenarios 5-7 and 10-30 are pure-compute/package-level gates.
 * Bundle-size scenario runs via size-limit.
 */
import {
  addCorrelationMatrixToCommandList,
  addDigitalChannelToCommandList,
  addDistributionMarkersToCommandList,
  addDistributionToCommandList,
  addKpiStripToCommandList,
  addSpectrogramToCommandList,
  addSpectrumBandsToCommandList,
  addSpectrumPeakMarkersToCommandList,
  addSpectrumToCommandList,
  addTimeSeriesAnomalyTracksToCommandList,
  addTimeSeriesBandsToCommandList,
  addTimeSeriesDerivedColumns,
  addTimeSeriesSpcTracksToCommandList,
  addTimeSeriesToCommandList,
  buildCorrelationMatrixRenderPlan,
  buildDigitalChannelRenderPlan,
  buildDistributionRenderPlan,
  buildKpiStripRenderPlan,
  buildSpectrogramRenderPlan,
  buildSpectrumRenderPlan,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  type CorrelationMatrixDataSet,
  clampRangeToBounds,
  DataSource,
  type DigitalChannelSeries,
  type DistributionDataSet,
  findNearestTimestampIndex,
  type KpiStripDataSet,
  panRangeByPixels,
  panRangeByValue,
  RenderCommandList,
  type SpectrogramDataSet,
  type SpectrumFrequencyBand,
  type SpectrumPeakMarker,
  type SpectrumSeries,
  type TimeSeriesAnnotation,
  type TimeSeriesAnomalyTrack,
  type TimeSeriesDerivedColumn,
  type TimeSeriesEventMarker,
  type TimeSeriesSeries,
  type TimeSeriesSpcRuleMarker,
  type TimeSeriesSpcTrack,
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

function generateSpectrumData(binCount: number): {
  series: SpectrumSeries[]
  peakMarkers: SpectrumPeakMarker[]
  bands: SpectrumFrequencyBand[]
} {
  const frequencies = new Float64Array(binCount)
  const magnitudes = new Float64Array(binCount)
  const sampleRateHz = 2048
  const binWidth = sampleRateHz / (binCount * 2)

  for (let i = 0; i < binCount; i++) {
    const frequency = i * binWidth
    const bearingPeak = gaussian(frequency, 73, 2.5) * 48
    const gearMeshPeak = gaussian(frequency, 312, 6) * 34
    const sideBand = gaussian(frequency, 328, 3.5) * 16
    const floor = 2 + Math.abs(Math.sin(i / 29)) * 0.8 + Math.abs(Math.cos(i / 97)) * 0.45
    frequencies[i] = frequency
    magnitudes[i] = floor + bearingPeak + gearMeshPeak + sideBand
  }

  return {
    series: [
      {
        key: 'vibration-spectrum',
        label: 'Vibration spectrum',
        frequencies,
        magnitudes,
        color: [0.48, 0.23, 0.93, 1],
        lineWidth: 0.8,
      },
    ],
    peakMarkers: [
      {
        key: 'bearing-outer-race',
        frequency: 73,
        magnitude: 50,
        label: 'BPFO',
      },
      {
        key: 'gear-mesh',
        frequency: 312,
        magnitude: 36,
        label: 'mesh',
      },
    ],
    bands: [
      {
        key: 'bearing-band',
        label: 'Bearing',
        frequencyStart: 68,
        frequencyEnd: 78,
      },
      {
        key: 'gear-band',
        label: 'Gear mesh',
        frequencyStart: 300,
        frequencyEnd: 336,
      },
    ],
  }
}

function generateSpectrogramData(
  timeBinCount: number,
  frequencyBinCount: number,
): SpectrogramDataSet {
  const timeBins = new Float64Array(timeBinCount)
  const frequencyBins = new Float64Array(frequencyBinCount)
  const values = new Float32Array(timeBinCount * frequencyBinCount)
  const timeStepSeconds = 15
  const frequencyStepHz = 2

  for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
    timeBins[timeIndex] = timeIndex * timeStepSeconds
  }
  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    frequencyBins[frequencyIndex] = frequencyIndex * frequencyStepHz
  }

  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    const frequency = frequencyBins[frequencyIndex] ?? 0
    for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
      const time = timeBins[timeIndex] ?? 0
      const bearingDrift = 72 + Math.sin(time / 420) * 9
      const gearMeshDrift = 310 + Math.cos(time / 780) * 15
      const resonance =
        gaussian(frequency, bearingDrift, 3.5) * (28 + Math.sin(time / 180) * 8) +
        gaussian(frequency, gearMeshDrift, 9) * (18 + Math.cos(time / 240) * 6)
      const floor =
        1.2 +
        Math.abs(Math.sin((timeIndex + frequencyIndex) / 31)) * 0.5 +
        Math.abs(Math.cos(frequencyIndex / 47)) * 0.35
      values[frequencyIndex * timeBinCount + timeIndex] = floor + resonance
    }
  }

  return {
    timeBins,
    frequencyBins,
    values,
    timeBinWidth: timeStepSeconds,
    frequencyBinWidth: frequencyStepHz,
  }
}

function generateDistributionData(binCount: number): DistributionDataSet {
  const binStarts = new Float64Array(binCount)
  const binEnds = new Float64Array(binCount)
  const counts = new Float64Array(binCount)
  const target = 0
  const lowerSpec = -3
  const upperSpec = 3
  const min = -5
  const max = 5
  const binWidth = (max - min) / binCount

  for (let i = 0; i < binCount; i++) {
    const start = min + i * binWidth
    const end = start + binWidth
    const center = start + binWidth / 2
    const mainProcess = gaussian(center, -0.18, 0.82) * 11_000
    const secondaryMode = gaussian(center, 1.48, 0.42) * 1_900
    const tail = gaussian(center, -2.85, 0.3) * 650
    const deterministicNoise = Math.abs(Math.sin(i / 11)) * 38 + Math.abs(Math.cos(i / 37)) * 19
    binStarts[i] = start
    binEnds[i] = end
    counts[i] = mainProcess + secondaryMode + tail + deterministicNoise
  }

  return {
    series: [
      {
        key: 'capability-distribution',
        label: 'Capability distribution',
        binStarts,
        binEnds,
        values: counts,
        color: [0.15, 0.39, 0.92, 1],
        fillColor: [0.15, 0.39, 0.92, 0.28],
        lineWidth: 0.7,
      },
    ],
    markers: [
      { key: 'lsl', kind: 'lower-spec', value: lowerSpec, label: 'LSL' },
      { key: 'target', kind: 'target', value: target, label: 'Target' },
      { key: 'usl', kind: 'upper-spec', value: upperSpec, label: 'USL' },
      { key: 'p05', kind: 'percentile', value: -1.65, label: 'P05' },
      { key: 'p95', kind: 'percentile', value: 1.72, label: 'P95' },
    ],
  }
}

function generateCorrelationMatrixData(variableCount: number): CorrelationMatrixDataSet {
  const variables = Array.from({ length: variableCount }, (_, index) => ({
    key: `var_${index}`,
    label: `V${index + 1}`,
  }))
  const values = new Float32Array(variableCount * variableCount)
  const sampleCounts = new Uint32Array(variableCount * variableCount)
  const missingCounts = new Uint32Array(variableCount * variableCount)

  for (let row = 0; row < variableCount; row++) {
    for (let column = 0; column < variableCount; column++) {
      const index = row * variableCount + column
      const distance = Math.abs(row - column)
      const cluster = Math.floor(row / 16) === Math.floor(column / 16) ? 0.44 : 0
      const periodic = Math.sin((row + 3) * (column + 5) * 0.013) * 0.28
      const anti = (row + column) % 19 === 0 ? -0.38 : 0
      values[index] =
        row === column ? 1 : Math.max(-1, Math.min(1, cluster + periodic + anti - distance / 900))
      sampleCounts[index] = 9_600 - ((row * 17 + column * 29) % 240)
      missingCounts[index] = (row * 7 + column * 11) % 17 === 0 ? 9 : 0
    }
  }

  return {
    variables,
    values,
    sampleCounts,
    missingCounts,
  }
}

function generateKpiStripData(itemCount: number, sparklinePoints: number): KpiStripDataSet {
  const statuses = ['normal', 'warning', 'alarm', 'stale', 'offline'] as const
  const items = Array.from({ length: itemCount }, (_, index) => {
    const values = new Float32Array(sparklinePoints)
    const center = 72 + (index % 13) * 1.8
    const drift = ((index % 17) - 8) * 0.018
    for (let sample = 0; sample < sparklinePoints; sample++) {
      values[sample] =
        center +
        Math.sin(sample / 6 + index * 0.11) * 7 +
        Math.cos(sample / 17 + index * 0.07) * 2.5 +
        sample * drift
    }

    return {
      key: `asset_${index}`,
      label: `Asset ${index + 1}`,
      value: values[sparklinePoints - 1] ?? center,
      unit: '%',
      status: statuses[(index * 7) % statuses.length],
      freshnessSeconds: (index * 11) % 900,
      quality: 0.82 + ((index * 19) % 18) / 100,
      sparkline: {
        values,
        valueRange: [40, 105] as const,
      },
      target: 88,
      lowerLimit: 62,
      upperLimit: 98,
    }
  })

  return { items }
}

function gaussian(value: number, center: number, width: number): number {
  const normalized = (value - center) / Math.max(Number.EPSILON, width)
  return Math.exp(-0.5 * normalized * normalized)
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

// ── SCENARIO 024: Anomaly score tracks ─────────────────────

scenarios['024_time_series_anomaly_tracks_4x1M'] = () => {
  const pointCount = 1_000_000
  const penCount = 4
  const trackCount = 4
  const data = generateMultiPenData(pointCount, penCount)
  const anomalyColumns: Record<string, Float64Array> = {}
  const anomalyTracks: TimeSeriesAnomalyTrack[] = []

  for (let track = 0; track < trackCount; track++) {
    const field = `anomaly_${track}`
    const scores = new Float64Array(pointCount)
    const fastPeriod = 97 + track * 13
    const slowPeriod = 21_000 + track * 2500
    for (let i = 0; i < pointCount; i++) {
      const fast = Math.abs(Math.sin(i / fastPeriod))
      const slow = Math.max(0, Math.sin(i / slowPeriod))
      const pulse = i % (80_000 + track * 8_000) < 2_500 ? 0.45 : 0
      scores[i] = Math.min(1, fast * 0.35 + slow * 0.45 + pulse)
    }
    anomalyColumns[field] = scores
    anomalyTracks.push({
      key: field,
      label: `Model ${track + 1}`,
      scoreField: field,
      threshold: 0.72,
      modelVersion: `v2026.05.${track + 1}`,
      reviewerState: track % 2 === 0 ? 'review-pending' : 'approved',
      placement: track % 2 === 0 ? 'bottom' : 'top',
      laneHeightRatio: 0.08,
      fillColor: [0.86, 0.15, 0.15, 0.14],
      lineColor: [0.86, 0.15, 0.15, 0.72],
      thresholdColor: [0.12, 0.12, 0.12, 0.65],
    })
  }

  const dataWithAnomalyTracks = {
    ...data,
    columns: {
      ...data.columns,
      ...anomalyColumns,
    },
    anomalyTracks,
  } as const
  const target = 250 // ms for 4M trend samples plus 4M anomaly score samples

  const warmup = buildTimeSeriesRenderPlan(dataWithAnomalyTracks, { gapThreshold: 0 })
  const warmupCommands = new RenderCommandList()
  addTimeSeriesAnomalyTracksToCommandList(warmupCommands, warmup)
  addTimeSeriesToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let anomalyPointCount = 0
  let commandCount = 0
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(dataWithAnomalyTracks, { gapThreshold: 0 })
    const commands = new RenderCommandList()
    addTimeSeriesAnomalyTracksToCommandList(commands, plan)
    addTimeSeriesToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    anomalyPointCount = plan.anomalyTracks.reduce(
      (total, track) => total + track.renderedPointCount,
      0,
    )
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '024_time_series_anomaly_tracks_4x1M',
    metric: `${penCount} pens x ${(pointCount / 1e6).toFixed(0)}M pts plus ${trackCount} anomaly tracks (${anomalyPointCount.toLocaleString()} anomaly pts, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 025: SPC control-limit tracks ──────────────────

scenarios['025_time_series_spc_tracks_10k'] = () => {
  const pointCount = 10_000
  const subgroupCount = 10_000
  const trackCount = 2
  const data = generateMultiPenData(pointCount, trackCount)
  const xStart = data.timestamps[0] ?? 0
  const xEnd = data.timestamps[data.timestamps.length - 1] ?? xStart
  const markerEvery = 137
  const xbarMarkers: TimeSeriesSpcRuleMarker[] = []
  const rangeMarkers: TimeSeriesSpcRuleMarker[] = []
  const spcTracks: TimeSeriesSpcTrack[] = [
    {
      key: 'xbar-limits',
      label: 'Xbar limits',
      chartKind: 'xbar',
      centerLine: 8,
      upperControlLimit: 36,
      lowerControlLimit: -20,
      upperWarningLimit: 28,
      lowerWarningLimit: -12,
      xRange: [xStart, xEnd],
      markers: xbarMarkers,
    },
    {
      key: 'range-limits',
      label: 'R limits',
      chartKind: 'range',
      centerLine: 18,
      upperControlLimit: 52,
      lowerControlLimit: 0,
      upperWarningLimit: 44,
      lowerWarningLimit: 6,
      xRange: [xStart, xEnd],
      markers: rangeMarkers,
    },
  ]

  for (let i = markerEvery; i < subgroupCount; i += markerEvery) {
    const x = data.timestamps[i] ?? xStart
    const target = i % spcTracks.length === 0 ? xbarMarkers : rangeMarkers
    target.push({
      key: `rule-${i}`,
      label: `WE-${(i % 4) + 1}`,
      rule: `Western Electric ${(i % 4) + 1}`,
      x,
      severity: i % 5 === 0 ? 'warning' : 'violation',
      labelVisible: i % (markerEvery * 12) === 0,
    })
  }

  const dataWithSpc = {
    ...data,
    spcTracks,
  } as const
  const target = 25 // ms for 10k subgroup trend plus SPC limits and sparse rule markers

  const warmup = buildTimeSeriesRenderPlan(dataWithSpc, { gapThreshold: 0 })
  const warmupCommands = new RenderCommandList()
  addTimeSeriesSpcTracksToCommandList(warmupCommands, warmup)
  addTimeSeriesToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let markerCount = 0
  let commandCount = 0
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    const plan = buildTimeSeriesRenderPlan(dataWithSpc, { gapThreshold: 0 })
    const commands = new RenderCommandList()
    addTimeSeriesSpcTracksToCommandList(commands, plan)
    addTimeSeriesToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    markerCount = plan.spcTracks.reduce((total, track) => total + track.markers.length, 0)
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '025_time_series_spc_tracks_10k',
    metric: `${trackCount} SPC tracks x ${subgroupCount.toLocaleString()} subgroups (${markerCount.toLocaleString()} rule markers, ${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 026: Spectrum precomputed-bin render planning ─

scenarios['026_spectrum_1m_window_64k_bins'] = () => {
  const sourceWindowSamples = 1_000_000
  const binCount = 65_536
  const data = generateSpectrumData(binCount)
  const target = 25 // ms for one-million-sample source-window spectrum payload as 64k bins

  const warmup = buildSpectrumRenderPlan(data, { baseline: 0 })
  const warmupCommands = new RenderCommandList()
  addSpectrumBandsToCommandList(warmupCommands, warmup)
  addSpectrumToCommandList(warmupCommands, warmup)
  addSpectrumPeakMarkersToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedBinCount = 0
  let commandCount = 0
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    const plan = buildSpectrumRenderPlan(data, { baseline: 0 })
    const commands = new RenderCommandList()
    addSpectrumBandsToCommandList(commands, plan)
    addSpectrumToCommandList(commands, plan)
    addSpectrumPeakMarkersToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedBinCount = plan.renderedBinCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '026_spectrum_1m_window_64k_bins',
    metric: `${(sourceWindowSamples / 1e6).toFixed(0)}M-sample window as ${renderedBinCount.toLocaleString()} spectrum bins (${commandCount} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 027: Spectrogram precomputed-tile render planning ─

scenarios['027_spectrogram_60m_64k_tiles'] = () => {
  const timeBinCount = 256
  const frequencyBinCount = 256
  const data = generateSpectrogramData(timeBinCount, frequencyBinCount)
  const target = 35 // ms for one-hour STFT tile payload as 64k precomputed cells

  const warmup = buildSpectrogramRenderPlan(data)
  const warmupCommands = new RenderCommandList()
  addSpectrogramToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedTileCount = 0
  let commandCount = 0
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    const plan = buildSpectrogramRenderPlan(data)
    const commands = new RenderCommandList()
    addSpectrogramToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedTileCount = plan.renderedTileCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '027_spectrogram_60m_64k_tiles',
    metric: `${timeBinCount} windows x ${frequencyBinCount} bands as ${renderedTileCount.toLocaleString()} tiles (${commandCount.toLocaleString()} commands)`,
    value: Math.round(medianMs * 100) / 100,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 028: Capability distribution render planning ───

scenarios['028_distribution_1m_window_512_bins'] = () => {
  const sourceWindowSamples = 1_000_000
  const binCount = 512
  const data = generateDistributionData(binCount)
  const target = 8 // ms for one-million-sample source-window distribution as 512 precomputed bins

  const warmup = buildDistributionRenderPlan(data, { baseline: 0 })
  const warmupCommands = new RenderCommandList()
  addDistributionToCommandList(warmupCommands, warmup)
  addDistributionMarkersToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedBinCount = 0
  let commandCount = 0
  for (let i = 0; i < 7; i++) {
    const start = performance.now()
    const plan = buildDistributionRenderPlan(data, { baseline: 0 })
    const commands = new RenderCommandList()
    addDistributionToCommandList(commands, plan)
    addDistributionMarkersToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedBinCount = plan.renderedBinCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '028_distribution_1m_window_512_bins',
    metric: `${(sourceWindowSamples / 1e6).toFixed(0)}M-sample window as ${renderedBinCount.toLocaleString()} distribution bins (${commandCount.toLocaleString()} commands)`,
    value: Math.round(medianMs * 1000) / 1000,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 029: Correlation matrix render planning ───────

scenarios['029_correlation_matrix_128vars'] = () => {
  const variableCount = 128
  const data = generateCorrelationMatrixData(variableCount)
  const target = 10 // ms for a frozen 128x128 correlation payload

  const warmup = buildCorrelationMatrixRenderPlan(data, { minSampleCount: 100 })
  const warmupCommands = new RenderCommandList()
  addCorrelationMatrixToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedCellCount = 0
  let commandCount = 0
  for (let i = 0; i < 7; i++) {
    const start = performance.now()
    const plan = buildCorrelationMatrixRenderPlan(data, { minSampleCount: 100 })
    const commands = new RenderCommandList()
    addCorrelationMatrixToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedCellCount = plan.renderedCellCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '029_correlation_matrix_128vars',
    metric: `${variableCount} variables as ${renderedCellCount.toLocaleString()} correlation cells (${commandCount.toLocaleString()} commands)`,
    value: Math.round(medianMs * 1000) / 1000,
    unit: 'ms',
    target,
    passed: medianMs < target,
  }
}

// ── SCENARIO 030: KPI strip render planning ────────────────

scenarios['030_kpi_strip_256_assets'] = () => {
  const itemCount = 256
  const sparklinePoints = 96
  const data = generateKpiStripData(itemCount, sparklinePoints)
  const target = 8 // ms for a 256-asset dashboard strip with bounded sparklines

  const warmup = buildKpiStripRenderPlan(data, {
    columns: 16,
    sparklinePointLimit: 48,
  })
  const warmupCommands = new RenderCommandList()
  addKpiStripToCommandList(warmupCommands, warmup)

  const times: number[] = []
  let renderedItemCount = 0
  let sparklinePointCount = 0
  let commandCount = 0
  for (let i = 0; i < 7; i++) {
    const start = performance.now()
    const plan = buildKpiStripRenderPlan(data, {
      columns: 16,
      sparklinePointLimit: 48,
    })
    const commands = new RenderCommandList()
    addKpiStripToCommandList(commands, plan)
    const elapsed = performance.now() - start
    times.push(elapsed)
    renderedItemCount = plan.renderedItemCount
    sparklinePointCount = plan.sparklinePointCount
    commandCount = commands.sorted().length
  }

  const medianMs = median(times)

  return {
    scenario: '030_kpi_strip_256_assets',
    metric: `${renderedItemCount} assets with ${sparklinePointCount.toLocaleString()} sparkline points (${commandCount.toLocaleString()} commands)`,
    value: Math.round(medianMs * 1000) / 1000,
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
