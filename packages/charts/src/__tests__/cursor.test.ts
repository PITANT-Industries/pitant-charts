import { describe, expect, it } from 'vitest'
import { findNearestTimestampIndex } from '../charts/cursor.js'

describe('findNearestTimestampIndex', () => {
  it('returns null for empty or invalid inputs', () => {
    expect(findNearestTimestampIndex(new Float64Array(), 10)).toBeNull()
    expect(findNearestTimestampIndex(new Float64Array([1, 2, 3]), Number.NaN)).toBeNull()
  })

  it('clamps to the nearest edge outside the source range', () => {
    const timestamps = new Float64Array([10, 20, 30])

    expect(findNearestTimestampIndex(timestamps, 4)).toEqual({
      index: 0,
      timestamp: 10,
      distance: 6,
    })
    expect(findNearestTimestampIndex(timestamps, 36)).toEqual({
      index: 2,
      timestamp: 30,
      distance: 6,
    })
  })

  it('uses binary search to find the nearest timestamp', () => {
    const timestamps = new Float64Array([10, 20, 40, 80])

    expect(findNearestTimestampIndex(timestamps, 39)).toEqual({
      index: 2,
      timestamp: 40,
      distance: 1,
    })
  })

  it('chooses the left timestamp when distances tie', () => {
    const timestamps = new Float64Array([10, 20, 30])

    expect(findNearestTimestampIndex(timestamps, 15)).toEqual({
      index: 0,
      timestamp: 10,
      distance: 5,
    })
  })
})
