import { describe, expect, it } from 'vitest'
import { DataEngine } from '../data-engine/data-engine.js'

// Note: Worker-based tests require a real Worker environment.
// These tests focus on the main-thread fast path (< 10,000 points).

function makeLinear(n: number) {
  const timestamps = new BigInt64Array(n)
  const values = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    timestamps[i] = BigInt(i) * 1_000_000n
    values[i] = i
  }
  return { timestamps, values }
}

describe('DataEngine (fast path)', () => {
  it('ingest returns stats for small dataset', async () => {
    const engine = new DataEngine()
    const { timestamps, values } = makeLinear(1000)
    const stats = await engine.ingest('series1', timestamps, values)

    expect(stats.count).toBe(1000)
    expect(stats.min).toBe(0)
    expect(stats.max).toBe(999)
    engine.destroy()
  })

  it('append increases point count', async () => {
    const engine = new DataEngine()
    const { timestamps, values } = makeLinear(500)
    await engine.ingest('s1', timestamps, values)

    const newTs = new BigInt64Array([timestamps[499]! + 1_000_000n])
    const newVs = new Float64Array([500])
    const newLen = await engine.append('s1', newTs, newVs)

    expect(newLen).toBe(501)
    engine.destroy()
  })

  it('query returns data', async () => {
    const engine = new DataEngine()
    const { timestamps, values } = makeLinear(200)
    await engine.ingest('s1', timestamps, values)

    const result = await engine.query('s1', timestamps[0]!, timestamps[199]!, 800)
    expect(result.pointCount).toBe(200)
    expect(result.data).toBeInstanceOf(Float32Array)
    expect(result.level).toBe(0)
    engine.destroy()
  })

  it('getStats returns current stats', async () => {
    const engine = new DataEngine()
    const { timestamps, values } = makeLinear(100)
    await engine.ingest('s1', timestamps, values)

    const stats = await engine.getStats('s1')
    expect(stats.count).toBe(100)
    expect(stats.min).toBe(0)
    expect(stats.max).toBe(99)
    engine.destroy()
  })

  it('dispose removes series from local storage', async () => {
    const engine = new DataEngine()
    const { timestamps, values } = makeLinear(100)
    await engine.ingest('s1', timestamps, values)
    await engine.dispose('s1')

    // After dispose, getStats falls through to worker path.
    // In test env without Worker, it throws about Worker.
    // Verify the series is gone by re-ingesting (would fail if resources stuck).
    const stats = await engine.ingest('s1', timestamps, values)
    expect(stats.count).toBe(100)
    engine.destroy()
  })

  it('handles multiple series independently', async () => {
    const engine = new DataEngine()
    const a = makeLinear(100)
    const b = makeLinear(200)

    await engine.ingest('a', a.timestamps, a.values)
    await engine.ingest('b', b.timestamps, b.values)

    const statsA = await engine.getStats('a')
    const statsB = await engine.getStats('b')

    expect(statsA.count).toBe(100)
    expect(statsB.count).toBe(200)
    engine.destroy()
  })

  it('destroy cleans up all series', () => {
    const engine = new DataEngine()
    // Should not throw
    engine.destroy()
  })

  it('FAST_PATH_THRESHOLD is 10000', () => {
    expect(DataEngine.FAST_PATH_THRESHOLD).toBe(10_000)
  })
})
