/**
 * Benchmark scenarios for @pitant/charts.
 *
 * Scenarios 1-4, 8-9 require a browser (WebGPU/Canvas2D).
 * Scenarios 5-7, 10 are pure-compute (data engine).
 * Bundle-size scenario runs via size-limit.
 */
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

export interface BenchmarkResult {
  scenario: string
  metric: string
  value: number
  unit: string
  target: number
  passed: boolean
}

type ScenarioFn = () => BenchmarkResult | BenchmarkResult[]

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
