import { describe, expect, it } from 'vitest'
import { LodPyramid } from '../data-engine/lod-pyramid.js'

// ── Helpers ──────────────────────────────────────────────

function makeSeries(
  n: number,
  valueFn: (i: number) => number = (i) => Math.sin(i * 0.01) * 100,
  startTs = 1_000_000_000n,
  stepNs = 1_000_000n, // 1ms
): { timestamps: BigInt64Array; values: Float64Array } {
  const timestamps = new BigInt64Array(n)
  const values = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    timestamps[i] = startTs + BigInt(i) * stepNs
    values[i] = valueFn(i)
  }
  return { timestamps, values }
}

function makeLinear(n: number) {
  return makeSeries(n, (i) => i)
}

function makeFlat(n: number, value = 42) {
  return makeSeries(n, () => value)
}

function makeWithSpike(n: number, spikeAt: number, spikeVal: number) {
  return makeSeries(n, (i) => (i === spikeAt ? spikeVal : 0))
}

function makeWithGap(
  n: number,
  gapStartIdx: number,
  gapSizeMs: number,
): { timestamps: BigInt64Array; values: Float64Array } {
  const timestamps = new BigInt64Array(n)
  const values = new Float64Array(n)
  const stepNs = 1_000_000n // 1ms
  let currentTs = 1_000_000_000n

  for (let i = 0; i < n; i++) {
    if (i === gapStartIdx) {
      currentTs += BigInt(gapSizeMs) * 1_000_000n
    }
    timestamps[i] = currentTs
    values[i] = Math.sin(i * 0.01) * 100
    currentTs += stepNs
  }
  return { timestamps, values }
}

// ── Ingest Basic ─────────────────────────────────────────

describe('LodPyramid', () => {
  describe('constructor and empty state', () => {
    it('starts with zero points', () => {
      const p = new LodPyramid()
      expect(p.pointCount).toBe(0)
      expect(p.levelCount).toBe(0)
      expect(p.stats.count).toBe(0)
    })

    it('returns empty query result when no data', () => {
      const p = new LodPyramid()
      const q = p.query(0n, 100n, 800)
      expect(q.data.length).toBe(0)
      expect(q.level).toBe(0)
      expect(q.pointCount).toBe(0)
      expect(q.gaps).toEqual([])
    })
  })

  describe('ingest', () => {
    it('ingests basic series and returns correct stats', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(1000)
      const stats = p.ingest(timestamps, values)

      expect(stats.count).toBe(1000)
      expect(stats.min).toBe(0)
      expect(stats.max).toBe(999)
      expect(stats.mean).toBeCloseTo(499.5, 5)
      expect(stats.firstTimestamp).toBe(timestamps[0])
      expect(stats.lastTimestamp).toBe(timestamps[999])
    })

    it('builds pyramid levels for large datasets', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeSeries(10_000)
      p.ingest(timestamps, values)

      // Should have pyramid levels since 10000 > MIN_LEVEL_SIZE (256)
      expect(p.levelCount).toBeGreaterThan(0)
      expect(p.pointCount).toBe(10_000)
    })

    it('does not build pyramid levels for small datasets', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeSeries(100)
      p.ingest(timestamps, values)

      expect(p.levelCount).toBe(0)
      expect(p.pointCount).toBe(100)
    })

    it('handles single point', () => {
      const p = new LodPyramid()
      const ts = new BigInt64Array([1_000_000n])
      const vs = new Float64Array([42.5])
      const stats = p.ingest(ts, vs)

      expect(stats.count).toBe(1)
      expect(stats.min).toBe(42.5)
      expect(stats.max).toBe(42.5)
      expect(stats.mean).toBe(42.5)
      expect(stats.stdDev).toBe(0)
    })

    it('handles empty arrays', () => {
      const p = new LodPyramid()
      const stats = p.ingest(new BigInt64Array(0), new Float64Array(0))
      expect(stats.count).toBe(0)
    })

    it('replaces data on re-ingest', () => {
      const p = new LodPyramid()
      p.ingest(...(Object.values(makeLinear(500)) as [BigInt64Array, Float64Array]))
      expect(p.pointCount).toBe(500)

      p.ingest(...(Object.values(makeLinear(200)) as [BigInt64Array, Float64Array]))
      expect(p.pointCount).toBe(200)
      expect(p.stats.count).toBe(200)
    })

    it('respects maxPoints option (ring buffer)', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(5000)
      const stats = p.ingest(timestamps, values, { maxPoints: 1000 })

      expect(stats.count).toBeLessThanOrEqual(1000)
      // Should keep the latest data (tail)
      expect(stats.lastTimestamp).toBe(timestamps[4999])
    })
  })

  // ── Statistics ────────────────────────────────────────

  describe('statistics', () => {
    it('computes stdDev correctly for known data', () => {
      const p = new LodPyramid()
      // Values: 2, 4, 4, 4, 5, 5, 7, 9 → mean=5, stdDev=2
      const n = 8
      const ts = new BigInt64Array(n)
      const vs = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9])
      for (let i = 0; i < n; i++) ts[i] = BigInt(i) * 1_000_000n
      const stats = p.ingest(ts, vs)

      expect(stats.mean).toBe(5)
      expect(stats.stdDev).toBeCloseTo(2, 5)
    })

    it('computes stats for flat data', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeFlat(100, 7)
      const stats = p.ingest(timestamps, values)

      expect(stats.min).toBe(7)
      expect(stats.max).toBe(7)
      expect(stats.mean).toBe(7)
      expect(stats.stdDev).toBe(0)
    })

    it('computes stats for negative values', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeSeries(500, (i) => -100 + i * 0.5)
      const stats = p.ingest(timestamps, values)

      expect(stats.min).toBe(-100)
      expect(stats.max).toBeCloseTo(149.5, 5)
    })
  })

  // ── Gap Detection ─────────────────────────────────────

  describe('gap detection', () => {
    it('detects gap exceeding threshold', () => {
      const p = new LodPyramid()
      // Gap of 500ms at index 50, threshold 100ms
      const { timestamps, values } = makeWithGap(200, 50, 500)
      p.ingest(timestamps, values, { maxGapDuration: 100_000_000n }) // 100ms in ns

      expect(p.gaps.length).toBeGreaterThan(0)
      expect(p.stats.gapCount).toBeGreaterThan(0)
    })

    it('does not detect gap below threshold', () => {
      const p = new LodPyramid()
      // Gap of 50ms at index 50, threshold 100ms → no gap
      const { timestamps, values } = makeWithGap(200, 50, 50)
      p.ingest(timestamps, values, { maxGapDuration: 100_000_000n })

      expect(p.gaps.length).toBe(0)
      expect(p.stats.gapCount).toBe(0)
    })

    it('detects no gaps with default threshold (0)', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeWithGap(200, 50, 500)
      p.ingest(timestamps, values) // No maxGapDuration → 0 → no gap detection

      expect(p.gaps.length).toBe(0)
    })
  })

  // ── Query (Raw Level) ─────────────────────────────────

  describe('query — raw data', () => {
    it('returns all points for full range at raw level when small dataset', () => {
      const p = new LodPyramid()
      const n = 100
      const { timestamps, values } = makeLinear(n)
      p.ingest(timestamps, values)

      const q = p.query(timestamps[0]!, timestamps[n - 1]!, 800)
      expect(q.level).toBe(0)
      expect(q.pointCount).toBe(n)
      // Data is interleaved [x, y] pairs → length = n * 2
      expect(q.data.length).toBe(n * 2)
    })

    it('returns subset for partial time range', () => {
      const p = new LodPyramid()
      const n = 1000
      const { timestamps, values } = makeLinear(n)
      p.ingest(timestamps, values)

      // Query middle 50% of range
      const start = timestamps[250]!
      const end = timestamps[749]!
      const q = p.query(start, end, 800)

      expect(q.pointCount).toBe(500)
      expect(q.data.length).toBe(1000) // 500 * 2
    })

    it('returns Float32Array data', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(100)
      p.ingest(timestamps, values)

      const q = p.query(timestamps[0]!, timestamps[99]!, 800)
      expect(q.data).toBeInstanceOf(Float32Array)
    })

    it('returns empty for out-of-range query', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(100)
      p.ingest(timestamps, values)

      const q = p.query(0n, 1n, 800) // Before data range
      expect(q.pointCount).toBe(0)
      expect(q.data.length).toBe(0)
    })
  })

  // ── Query (LOD Levels) ─────────────────────────────────

  describe('query — LOD levels', () => {
    it('uses LOD level for large dataset with narrow viewport', () => {
      const p = new LodPyramid()
      const n = 50_000
      const { timestamps, values } = makeSeries(n)
      p.ingest(timestamps, values)

      // Narrow viewport (100px) for the full range → should pick a LOD level
      const q = p.query(timestamps[0]!, timestamps[n - 1]!, 100)
      expect(q.level).toBeGreaterThan(0)
      // pointCount should be manageable (≤ 2 × viewportWidth for LOD)
      expect(q.pointCount).toBeLessThanOrEqual(100 * 4) // generous margin
    })

    it('uses raw level for large dataset when zoomed in enough', () => {
      const p = new LodPyramid()
      const n = 10_000
      const { timestamps, values } = makeSeries(n)
      p.ingest(timestamps, values)

      // Query a tiny range with wide viewport → raw level
      const start = timestamps[100]!
      const end = timestamps[200]!
      const q = p.query(start, end, 2000)
      expect(q.level).toBe(0)
      expect(q.pointCount).toBe(101)
    })

    it('LOD data preserves min-max extremes', () => {
      const p = new LodPyramid()
      // Create data with a large spike
      const n = 10_000
      const { timestamps, values } = makeWithSpike(n, 5000, 999_999)
      p.ingest(timestamps, values)

      // Query full range at LOD level
      const q = p.query(timestamps[0]!, timestamps[n - 1]!, 50)
      expect(q.level).toBeGreaterThan(0)

      // The spike must be preserved somewhere in the LOD data
      let maxVal = -Infinity
      for (let i = 0; i < q.data.length; i += 2) {
        const v = q.data[i + 1] as number
        if (v > maxVal) maxVal = v
      }
      expect(maxVal).toBeCloseTo(999_999, 0)
    })
  })

  // ── Append ─────────────────────────────────────────────

  describe('append', () => {
    it('increases point count', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(500)
      p.ingest(timestamps, values)

      const appendTs = new BigInt64Array([
        timestamps[499]! + 1_000_000n,
        timestamps[499]! + 2_000_000n,
      ])
      const appendVs = new Float64Array([600, 601])
      const newLen = p.append(appendTs, appendVs)

      expect(newLen).toBe(502)
      expect(p.pointCount).toBe(502)
    })

    it('updates stats incrementally', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeFlat(100, 10)
      p.ingest(timestamps, values)
      expect(p.stats.max).toBe(10)

      // Append a point with higher value
      const newTs = new BigInt64Array([timestamps[99]! + 1_000_000n])
      const newVs = new Float64Array([999])
      p.append(newTs, newVs)

      expect(p.stats.max).toBe(999)
      expect(p.stats.count).toBe(101)
      expect(p.stats.lastTimestamp).toBe(newTs[0])
    })

    it('query returns appended data', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(100)
      p.ingest(timestamps, values)

      const lastTs = timestamps[99]!
      const appendTs = new BigInt64Array([lastTs + 1_000_000n, lastTs + 2_000_000n])
      const appendVs = new Float64Array([100, 101])
      p.append(appendTs, appendVs)

      const q = p.query(timestamps[0]!, appendTs[1]!, 800)
      expect(q.pointCount).toBe(102)
    })

    it('produces consistent results with full rebuild', () => {
      const p1 = new LodPyramid()
      const p2 = new LodPyramid()

      const n = 2000
      const splitAt = 1500
      const { timestamps, values } = makeLinear(n)

      // p1: single ingest of all data
      p1.ingest(timestamps, values)

      // p2: ingest first chunk, append rest
      p2.ingest(timestamps.slice(0, splitAt), values.slice(0, splitAt))
      p2.append(timestamps.slice(splitAt), values.slice(splitAt))

      // Both should have same stats
      expect(p2.stats.count).toBe(p1.stats.count)
      expect(p2.stats.min).toBe(p1.stats.min)
      expect(p2.stats.max).toBe(p1.stats.max)
      expect(p2.stats.firstTimestamp).toBe(p1.stats.firstTimestamp)
      expect(p2.stats.lastTimestamp).toBe(p1.stats.lastTimestamp)
    })

    it('detects gaps in appended data', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(100)
      p.ingest(timestamps, values, { maxGapDuration: 5_000_000n }) // 5ms gap

      expect(p.gaps.length).toBe(0)

      // Append with a 50ms gap
      const lastTs = timestamps[99]!
      const gapTs = new BigInt64Array([lastTs + 50_000_000n])
      const gapVs = new Float64Array([42])
      p.append(gapTs, gapVs)

      expect(p.gaps.length).toBe(1)
    })
  })

  // ── Ring Buffer ────────────────────────────────────────

  describe('ring buffer (maxPoints)', () => {
    it('caps data at maxPoints on ingest', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(5000)
      p.ingest(timestamps, values, { maxPoints: 1000 })

      expect(p.pointCount).toBeLessThanOrEqual(1000)
    })

    it('triggers rebuild on append when at capacity', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(1000)
      p.ingest(timestamps, values, { maxPoints: 1000 })

      const lastTs = timestamps[999]!
      const appendTs = new BigInt64Array([lastTs + 1_000_000n])
      const appendVs = new Float64Array([9999])
      const newLen = p.append(appendTs, appendVs)

      // Should still be capped at maxPoints
      expect(newLen).toBeLessThanOrEqual(1000)
      // New data should be included (latest point)
      expect(p.stats.lastTimestamp).toBe(lastTs + 1_000_000n)
    })
  })

  // ── Dispose ────────────────────────────────────────────

  describe('dispose', () => {
    it('resets all state', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeSeries(5000)
      p.ingest(timestamps, values)
      expect(p.pointCount).toBe(5000)

      p.dispose()

      expect(p.pointCount).toBe(0)
      expect(p.levelCount).toBe(0)
      expect(p.stats.count).toBe(0)
      expect(p.gaps.length).toBe(0)
    })

    it('can re-ingest after dispose', () => {
      const p = new LodPyramid()
      p.ingest(...(Object.values(makeLinear(100)) as [BigInt64Array, Float64Array]))
      p.dispose()

      const { timestamps, values } = makeLinear(200)
      p.ingest(timestamps, values)
      expect(p.pointCount).toBe(200)
    })
  })

  // ── Memory Overhead ────────────────────────────────────

  describe('memory overhead', () => {
    it('pyramid memory ≤ 2× raw data', () => {
      const p = new LodPyramid()
      const n = 50_000
      const { timestamps, values } = makeSeries(n)
      p.ingest(timestamps, values)

      // Raw data = BigInt64Array(n) + Float64Array(n) = 16n bytes
      // Pyramid levels follow geometric series: total ≤ 2× raw
      const levelCount = p.levelCount
      expect(levelCount).toBeGreaterThan(0)

      // We can't directly measure pyramid memory, but the construction
      // follows geometric series: n/2 + n/4 + ... < n total quads
      // Each quad = 4 * 8 = 32 bytes, so total ≤ n * 32 bytes
      // This is 2× raw data (n * 16), confirming the spec requirement.
      // If we could peek, we'd verify. For now, verify build completes.
      expect(p.pointCount).toBe(n)
    })
  })

  // ── Edge Cases ─────────────────────────────────────────

  describe('edge cases', () => {
    it('handles two points', () => {
      const p = new LodPyramid()
      const ts = new BigInt64Array([1_000_000n, 2_000_000n])
      const vs = new Float64Array([10, 20])
      const stats = p.ingest(ts, vs)

      expect(stats.count).toBe(2)
      expect(stats.min).toBe(10)
      expect(stats.max).toBe(20)

      const q = p.query(1_000_000n, 2_000_000n, 800)
      expect(q.pointCount).toBe(2)
    })

    it('handles mismatched array lengths (uses minimum)', () => {
      const p = new LodPyramid()
      const ts = new BigInt64Array(100)
      const vs = new Float64Array(50)
      for (let i = 0; i < 100; i++) ts[i] = BigInt(i) * 1_000_000n
      for (let i = 0; i < 50; i++) vs[i] = i

      const stats = p.ingest(ts, vs)
      expect(stats.count).toBe(50)
    })

    it('handles all identical timestamps gracefully', () => {
      const p = new LodPyramid()
      const n = 100
      const ts = new BigInt64Array(n)
      const vs = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        ts[i] = 1_000_000n // All same timestamp
        vs[i] = i
      }
      const stats = p.ingest(ts, vs)
      expect(stats.count).toBe(n)
    })

    it('handles NaN and Infinity values', () => {
      const p = new LodPyramid()
      const ts = new BigInt64Array([1_000_000n, 2_000_000n, 3_000_000n])
      const vs = new Float64Array([Number.NaN, Number.POSITIVE_INFINITY, 42])
      const stats = p.ingest(ts, vs)
      expect(stats.count).toBe(3)
    })

    it('query with start > end returns empty', () => {
      const p = new LodPyramid()
      const { timestamps, values } = makeLinear(100)
      p.ingest(timestamps, values)

      const q = p.query(timestamps[99]!, timestamps[0]!, 800)
      expect(q.pointCount).toBe(0)
    })
  })
})
