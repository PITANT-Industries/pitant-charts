import { describe, expect, it } from 'vitest'
import {
  type BinarySchema,
  type ColumnarData,
  toBigIntTimestamps,
  toColumnar,
  validateColumnar,
} from '../data-engine/columnar.js'

// ── toColumnar: ColumnarData pass-through ────────────────────

describe('toColumnar', () => {
  it('passes through ColumnarData as-is', () => {
    const input: ColumnarData = {
      timestamps: new Float64Array([1, 2, 3]),
      columns: { temp: new Float64Array([20, 21, 22]) },
    }
    const result = toColumnar(input)
    expect(result).toBe(input)
  })

  // ── Row-oriented JSON ────────────────────────────────────

  describe('from JSON rows', () => {
    it('converts row-oriented array to columnar', () => {
      const rows = [
        { timestamp: 1000, temp: 20, pressure: 1013 },
        { timestamp: 2000, temp: 21, pressure: 1012 },
        { timestamp: 3000, temp: 22, pressure: 1014 },
      ]
      const result = toColumnar(rows)

      expect(result.timestamps).toBeInstanceOf(Float64Array)
      expect(result.timestamps.length).toBe(3)
      expect(result.timestamps[0]).toBe(1000)
      expect(result.timestamps[2]).toBe(3000)

      expect(result.columns['temp']).toBeInstanceOf(Float64Array)
      expect(result.columns['temp']!.length).toBe(3)
      expect(result.columns['temp']![0]).toBe(20)
      expect(result.columns['temp']![2]).toBe(22)

      expect(result.columns['pressure']).toBeInstanceOf(Float64Array)
      expect(result.columns['pressure']![1]).toBe(1012)
    })

    it('handles empty array', () => {
      const result = toColumnar([])
      expect(result.timestamps.length).toBe(0)
      expect(Object.keys(result.columns).length).toBe(0)
    })

    it('treats missing fields as 0', () => {
      const rows = [
        { timestamp: 1, temp: 10 },
        { timestamp: 2 }, // missing temp
      ] as { timestamp: number; [key: string]: number }[]
      const result = toColumnar(rows)
      expect(result.columns['temp']![1]).toBe(0)
    })
  })

  // ── ArrayBuffer ──────────────────────────────────────────

  describe('from ArrayBuffer', () => {
    it('decodes binary data with float64 schema', () => {
      // 2 rows × 2 columns (timestamp, value) × 8 bytes = 32 bytes
      const buffer = new ArrayBuffer(32)
      const view = new DataView(buffer)

      // Row 0: timestamp=1000, value=42
      view.setFloat64(0, 1000, true)
      view.setFloat64(8, 42, true)
      // Row 1: timestamp=2000, value=43
      view.setFloat64(16, 2000, true)
      view.setFloat64(24, 43, true)

      const schema: BinarySchema = {
        columns: ['timestamp', 'value'],
      }
      const result = toColumnar(buffer, schema)

      expect(result.timestamps[0]).toBe(1000)
      expect(result.timestamps[1]).toBe(2000)
      expect(result.columns['value']![0]).toBe(42)
      expect(result.columns['value']![1]).toBe(43)
    })

    it('decodes float32 columns', () => {
      // 2 rows × (float64 timestamp + float32 value) = 2 × 12 = 24 bytes
      const buffer = new ArrayBuffer(24)
      const view = new DataView(buffer)

      view.setFloat64(0, 100, true)
      view.setFloat32(8, 3.14, true)
      view.setFloat64(12, 200, true)
      view.setFloat32(20, 2.71, true)

      const schema: BinarySchema = {
        columns: ['ts', 'val'],
        types: ['float64', 'float32'],
      }
      const result = toColumnar(buffer, schema)

      expect(result.timestamps[0]).toBe(100)
      expect(result.timestamps[1]).toBe(200)
      expect(result.columns['val']![0]).toBeCloseTo(3.14, 2)
      expect(result.columns['val']![1]).toBeCloseTo(2.71, 2)
    })

    it('decodes int32 and uint32 columns', () => {
      // 1 row × (float64 ts + int32 + uint32) = 16 bytes
      const buffer = new ArrayBuffer(16)
      const view = new DataView(buffer)

      view.setFloat64(0, 500, true)
      view.setInt32(8, -42, true)
      view.setUint32(12, 4294967295, true) // max uint32

      const schema: BinarySchema = {
        columns: ['ts', 'signed', 'unsigned'],
        types: ['float64', 'int32', 'uint32'],
      }
      const result = toColumnar(buffer, schema)

      expect(result.columns['signed']![0]).toBe(-42)
      expect(result.columns['unsigned']![0]).toBe(4294967295)
    })

    it('throws without schema', () => {
      expect(() => toColumnar(new ArrayBuffer(16))).toThrow('BinarySchema is required')
    })

    it('throws on mismatched types/columns lengths', () => {
      const schema: BinarySchema = {
        columns: ['ts', 'a'],
        types: ['float64'],
      }
      expect(() => toColumnar(new ArrayBuffer(16), schema)).toThrow('types length')
    })

    it('handles empty buffer', () => {
      const schema: BinarySchema = { columns: ['ts', 'val'] }
      const result = toColumnar(new ArrayBuffer(0), schema)
      expect(result.timestamps.length).toBe(0)
    })

    it('handles big-endian', () => {
      const buffer = new ArrayBuffer(16)
      const view = new DataView(buffer)
      view.setFloat64(0, 1234, false)
      view.setFloat64(8, 5678, false)

      const schema: BinarySchema = {
        columns: ['ts', 'v'],
        littleEndian: false,
      }
      const result = toColumnar(buffer, schema)
      expect(result.timestamps[0]).toBe(1234)
      expect(result.columns['v']![0]).toBe(5678)
    })
  })

  // ── Float64Array shorthand ───────────────────────────────

  describe('from Float64Array', () => {
    it('creates sequential timestamps and single "value" column', () => {
      const values = new Float64Array([10, 20, 30, 40])
      const result = toColumnar(values)

      expect(result.timestamps.length).toBe(4)
      expect(result.timestamps[0]).toBe(0)
      expect(result.timestamps[1]).toBe(1)
      expect(result.timestamps[3]).toBe(3)

      expect(result.columns['value']!.length).toBe(4)
      expect(result.columns['value']![0]).toBe(10)
      expect(result.columns['value']![3]).toBe(40)
    })

    it('handles empty array', () => {
      const result = toColumnar(new Float64Array(0))
      expect(result.timestamps.length).toBe(0)
      expect(result.columns['value']!.length).toBe(0)
    })
  })

  // ── Error cases ──────────────────────────────────────────

  it('throws on unsupported input type', () => {
    // @ts-expect-error — intentionally passing invalid type
    expect(() => toColumnar(42)).toThrow('Unsupported DataInput format')
  })
})

// ── validateColumnar ─────────────────────────────────────────

describe('validateColumnar', () => {
  it('returns empty array for valid data', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 2, 3]),
      columns: { a: new Float64Array([10, 20, 30]) },
    }
    expect(validateColumnar(data)).toEqual([])
  })

  it('detects non-ascending timestamps', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 3, 2]),
      columns: { a: new Float64Array([10, 20, 30]) },
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'not-ascending')).toBe(true)
    expect(issues.find((i) => i.type === 'not-ascending')!.index).toBe(2)
  })

  it('detects duplicate timestamps', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 2, 2, 3]),
      columns: { a: new Float64Array([10, 20, 30, 40]) },
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'duplicate-timestamp')).toBe(true)
  })

  it('detects NaN in timestamps', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, Number.NaN, 3]),
      columns: { a: new Float64Array([10, 20, 30]) },
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'nan-timestamp')).toBe(true)
  })

  it('detects NaN in column values', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 2, 3]),
      columns: { a: new Float64Array([10, Number.NaN, 30]) },
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'nan-value')).toBe(true)
    expect(issues.find((i) => i.type === 'nan-value')!.column).toBe('a')
  })

  it('detects length mismatch between timestamps and columns', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 2, 3]),
      columns: { a: new Float64Array([10, 20]) }, // wrong length
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'length-mismatch')).toBe(true)
  })

  it('detects quality length mismatch', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([1, 2, 3]),
      columns: { a: new Float64Array([10, 20, 30]) },
      quality: { a: new Uint8Array([0, 1]) },
    }
    const issues = validateColumnar(data)
    expect(issues.some((i) => i.type === 'quality-length-mismatch')).toBe(true)
  })

  it('reports multiple issues at once', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array([2, 1, Number.NaN]),
      columns: { a: new Float64Array([Number.NaN, 20]) }, // length + NaN
    }
    const issues = validateColumnar(data)
    expect(issues.length).toBeGreaterThanOrEqual(3)
  })

  it('handles empty data', () => {
    const data: ColumnarData = {
      timestamps: new Float64Array(0),
      columns: {},
    }
    expect(validateColumnar(data)).toEqual([])
  })
})

// ── toBigIntTimestamps ───────────────────────────────────────

describe('toBigIntTimestamps', () => {
  it('converts ms to nanoseconds', () => {
    const ts = new Float64Array([1000, 2000, 3000])
    const result = toBigIntTimestamps(ts, 'ms')

    expect(result.length).toBe(3)
    expect(result[0]).toBe(1_000_000_000n)
    expect(result[1]).toBe(2_000_000_000n)
    expect(result[2]).toBe(3_000_000_000n)
  })

  it('converts us to nanoseconds', () => {
    const ts = new Float64Array([1000])
    const result = toBigIntTimestamps(ts, 'us')
    expect(result[0]).toBe(1_000_000n)
  })

  it('passes ns through (×1)', () => {
    const ts = new Float64Array([1_000_000_000])
    const result = toBigIntTimestamps(ts, 'ns')
    expect(result[0]).toBe(1_000_000_000n)
  })

  it('defaults to ms when no unit given', () => {
    const ts = new Float64Array([500])
    const result = toBigIntTimestamps(ts)
    expect(result[0]).toBe(500_000_000n)
  })

  it('rounds fractional values', () => {
    const ts = new Float64Array([1000.7])
    const result = toBigIntTimestamps(ts, 'ms')
    // Math.round(1000.7) = 1001 → 1001 * 1_000_000
    expect(result[0]).toBe(1_001_000_000n)
  })
})
