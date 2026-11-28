import { describe, expect, it } from 'vitest'
import { DataSource } from '../data-engine/data-source.js'

// Helper: generate row-oriented JSON data
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * 1000,
    temp: 20 + Math.sin(i * 0.1),
    pressure: 1013 + Math.cos(i * 0.1),
  }))
}

describe('DataSource', () => {
  // ── load ──────────────────────────────────────────────────

  describe('load', () => {
    it('loads JSON rows and returns stats per column', async () => {
      const ds = new DataSource()
      const stats = await ds.load(makeRows(100))

      expect(stats['temp']).toBeDefined()
      expect(stats['pressure']).toBeDefined()
      expect(stats['temp']!.count).toBe(100)
      expect(stats['pressure']!.count).toBe(100)
      expect(ds.columns.has('temp')).toBe(true)
      expect(ds.columns.has('pressure')).toBe(true)

      ds.destroy()
    })

    it('loads Float64Array shorthand', async () => {
      const ds = new DataSource()
      const values = new Float64Array([1, 2, 3, 4, 5])
      const stats = await ds.load(values)

      expect(stats['value']!.count).toBe(5)
      expect(stats['value']!.min).toBe(1)
      expect(stats['value']!.max).toBe(5)

      ds.destroy()
    })

    it('loads columnar data directly', async () => {
      const ds = new DataSource()
      const stats = await ds.load({
        timestamps: new Float64Array([0, 1, 2]),
        columns: { x: new Float64Array([10, 20, 30]) },
      })

      expect(stats['x']!.count).toBe(3)
      ds.destroy()
    })

    it('throws in strict mode on invalid data', async () => {
      const ds = new DataSource({ strict: true })
      await expect(
        ds.load({
          timestamps: new Float64Array([3, 2, 1]), // not ascending
          columns: { x: new Float64Array([10, 20, 30]) },
        }),
      ).rejects.toThrow('validation failed')

      ds.destroy()
    })

    it('accepts invalid data in non-strict mode', async () => {
      const ds = new DataSource()
      // Not ascending — should not throw
      const stats = await ds.load({
        timestamps: new Float64Array([3, 2, 1]),
        columns: { x: new Float64Array([10, 20, 30]) },
      })
      expect(stats['x']!.count).toBe(3)
      ds.destroy()
    })
  })

  // ── append ────────────────────────────────────────────────

  describe('append', () => {
    it('appends data and increases point count', async () => {
      const ds = new DataSource()
      await ds.load(new Float64Array([1, 2, 3]))

      const counts = await ds.append(new Float64Array([4, 5, 6]))
      expect(counts['value']).toBe(6) // 3 original + 3 appended

      ds.destroy()
    })

    it('appends JSON rows', async () => {
      const ds = new DataSource()
      await ds.load([
        { timestamp: 0, temp: 20 },
        { timestamp: 1000, temp: 21 },
      ])

      const counts = await ds.append([{ timestamp: 2000, temp: 22 }])
      expect(counts['temp']).toBe(3)

      ds.destroy()
    })
  })

  // ── query ─────────────────────────────────────────────────

  describe('query', () => {
    it('preserves distinct epoch-millisecond timestamps and their aligned readings', async () => {
      const source = new DataSource()
      const start = Date.UTC(2026, 10, 28, 12)
      const offsets = [0, 1, 10, 100, 1_000, 2_000, 5_000, 10_000, 30_000, 60_000, 120_000, 180_000]
      const timestamps = Float64Array.from(offsets, (offset) => start + offset)
      const temperature = Float64Array.from(offsets, (_, index) => 20 + index / 10)
      const pressure = Float64Array.from(offsets, (_, index) => 1_000 + index)
      const quality = Uint8Array.from(offsets, (_, index) => index)
      await source.load({
        timestamps,
        columns: { temperature, pressure },
        quality: { temperature: quality },
      })

      const result = await source.query({ start, end: start + 180_000, targetPixels: 1_200 })

      expect(result.lodLevel).toBe(0)
      expect(result.timestamps).toEqual(timestamps)
      expect(result.columns).toEqual({ temperature, pressure })
      expect(result.quality?.['temperature']).toEqual(quality)
      source.destroy()
    })

    it('retains exact, aligned epoch-millisecond bucket boundaries when downsampling', async () => {
      const source = new DataSource()
      const start = Date.UTC(2026, 10, 28, 12)
      const timestamps = Float64Array.from({ length: 1_024 }, (_, index) => start + index)
      const temperature = Float64Array.from(timestamps, (_, index) => index + 20)
      const pressure = Float64Array.from(timestamps, (_, index) => index + 1_000)
      await source.load({ timestamps, columns: { temperature, pressure } })

      const result = await source.query({ start, end: start + 1_023, targetPixels: 256 })

      expect(result.lodLevel).toBeGreaterThan(0)
      expect(result.returnedPointCount).toBeLessThan(timestamps.length)
      expect(result.timestamps[0]).toBe(start)
      expect(result.timestamps.at(-1)).toBe(start + 1_023)
      expect(new Set(result.timestamps).size).toBe(result.returnedPointCount)
      expect(result.columns['temperature']).toEqual(
        Float64Array.from(result.timestamps, (t) => t - start + 20),
      )
      expect(result.columns['pressure']).toEqual(
        Float64Array.from(result.timestamps, (t) => t - start + 1_000),
      )
      source.destroy()
    })

    it('returns viewport-resolution data', async () => {
      const ds = new DataSource()
      const rows = makeRows(500)
      await ds.load(rows)

      const result = await ds.query({
        start: 0,
        end: 499_000,
        targetPixels: 800,
      })

      expect(result.timestamps.length).toBeGreaterThan(0)
      expect(result.columns['temp']).toBeDefined()
      expect(result.columns['pressure']).toBeDefined()
      expect(result.returnedPointCount).toBeGreaterThan(0)
      expect(result.lodLevel).toBeGreaterThanOrEqual(0)

      ds.destroy()
    })

    it('returns empty result when no columns are loaded', async () => {
      const ds = new DataSource()
      const result = await ds.query({
        start: 0,
        end: 1000,
        targetPixels: 800,
      })

      expect(result.timestamps.length).toBe(0)
      expect(result.returnedPointCount).toBe(0)

      ds.destroy()
    })

    it('queries specific columns', async () => {
      const ds = new DataSource()
      await ds.load(makeRows(100))

      const result = await ds.query({
        start: 0,
        end: 99_000,
        targetPixels: 800,
        columns: ['temp'],
      })

      expect(result.columns['temp']).toBeDefined()
      expect(result.columns['pressure']).toBeUndefined()

      ds.destroy()
    })

    it('preserves quality flags through viewport query results', async () => {
      const ds = new DataSource()
      await ds.load({
        timestamps: new Float64Array([0, 1000, 2000]),
        columns: { temp: new Float64Array([20, 21, 22]) },
        quality: { temp: new Uint8Array([0, 2, 8]) },
      })

      const result = await ds.query({
        start: 0,
        end: 2000,
        targetPixels: 800,
        columns: ['temp'],
      })

      expect(Array.from(result.quality?.['temp'] ?? [])).toEqual([0, 2, 8])
      ds.destroy()
    })

    it('preserves appended quality flags through viewport query results', async () => {
      const ds = new DataSource()
      await ds.load({
        timestamps: new Float64Array([0, 1000]),
        columns: { temp: new Float64Array([20, 21]) },
        quality: { temp: new Uint8Array([0, 2]) },
      })
      await ds.append({
        timestamps: new Float64Array([2000]),
        columns: { temp: new Float64Array([22]) },
        quality: { temp: new Uint8Array([8]) },
      })

      const result = await ds.query({
        start: 0,
        end: 2000,
        targetPixels: 800,
        columns: ['temp'],
      })

      expect(Array.from(result.quality?.['temp'] ?? [])).toEqual([0, 2, 8])
      ds.destroy()
    })

    it('preserves gap metadata through viewport query results', async () => {
      const ds = new DataSource({ ingestOptions: { maxGapDuration: 1_500_000_000n } })
      await ds.load({
        timestamps: new Float64Array([0, 1000, 5000, 6000]),
        columns: { temp: new Float64Array([20, 21, 22, 23]) },
      })

      const result = await ds.query({
        start: 0,
        end: 6000,
        targetPixels: 800,
        columns: ['temp'],
      })

      expect(result.gaps.length).toBe(1)
      expect(result.gaps[0]).toEqual({ startIndex: 1, endIndex: 2 })
      ds.destroy()
    })
  })

  // ── getTimeRange ──────────────────────────────────────────

  describe('getTimeRange', () => {
    it('returns null when no data loaded', async () => {
      const ds = new DataSource()
      const range = await ds.getTimeRange()
      expect(range).toBeNull()
      ds.destroy()
    })

    it('returns time range in ms', async () => {
      const ds = new DataSource()
      await ds.load([
        { timestamp: 1000, temp: 20 },
        { timestamp: 5000, temp: 25 },
      ])

      const range = await ds.getTimeRange()
      expect(range).not.toBeNull()
      expect(range!.start).toBe(1000)
      expect(range!.end).toBe(5000)

      ds.destroy()
    })

    it('handles microsecond time unit', async () => {
      const ds = new DataSource({ timeUnit: 'us' })
      await ds.load({
        timestamps: new Float64Array([1_000_000, 5_000_000]),
        columns: { x: new Float64Array([1, 2]) },
      })

      const range = await ds.getTimeRange()
      expect(range!.start).toBe(1_000_000)
      expect(range!.end).toBe(5_000_000)

      ds.destroy()
    })
  })

  // ── getStats ──────────────────────────────────────────────

  describe('getStats', () => {
    it('returns stats for a column', async () => {
      const ds = new DataSource()
      await ds.load(new Float64Array([10, 20, 30]))

      const stats = await ds.getStats('value')
      expect(stats.count).toBe(3)
      expect(stats.min).toBe(10)
      expect(stats.max).toBe(30)

      ds.destroy()
    })
  })

  // ── clear ─────────────────────────────────────────────────

  describe('clear', () => {
    it('removes a column from the source', async () => {
      const ds = new DataSource()
      await ds.load(makeRows(10))

      expect(ds.columns.has('temp')).toBe(true)
      await ds.clear('temp')
      expect(ds.columns.has('temp')).toBe(false)

      ds.destroy()
    })
  })

  // ── destroy ───────────────────────────────────────────────

  describe('destroy', () => {
    it('rejects operations after destroy', async () => {
      const ds = new DataSource()
      ds.destroy()

      await expect(ds.load(new Float64Array([1]))).rejects.toThrow('destroyed')
    })

    it('is idempotent', () => {
      const ds = new DataSource()
      ds.destroy()
      ds.destroy() // should not throw
    })
  })
})
