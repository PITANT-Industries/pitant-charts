import { describe, expect, it } from 'vitest'

import {
  clampRangeToBounds,
  panRangeByPixels,
  panRangeByValue,
  rangesEqual,
  zoomRangeAroundAnchor,
  zoomRangeAroundCenter,
} from '../charts/range-navigation.js'

describe('range navigation', () => {
  it('pans by value and clamps to source bounds', () => {
    expect(panRangeByValue([20, 40], 10, [0, 100])).toEqual([30, 50])
    expect(panRangeByValue([20, 40], -100, [0, 100])).toEqual([0, 20])
    expect(panRangeByValue([20, 40], 100, [0, 100])).toEqual([80, 100])
  })

  it('pans by plot pixels without changing span', () => {
    expect(
      panRangeByPixels({
        bounds: [0, 100],
        deltaPixels: 250,
        plotWidth: 1000,
        range: [20, 60],
      }),
    ).toEqual([30, 70])
  })

  it('zooms around an anchor while preserving anchor ratio', () => {
    const range = zoomRangeAroundAnchor({
      anchor: 25,
      bounds: [0, 100],
      factor: 0.5,
      range: [0, 100],
    })

    expect(range[0]).toBeCloseTo(12.5)
    expect(range[1]).toBeCloseTo(62.5)
  })

  it('zooms around center and clamps to full range on zoom out', () => {
    expect(zoomRangeAroundCenter([25, 75], 2, [0, 100])).toEqual([0, 100])
    expect(clampRangeToBounds([-10, 20], [0, 100])).toEqual([0, 30])
  })

  it('compares ranges with an epsilon', () => {
    expect(rangesEqual([1, 2], [1 + Number.EPSILON / 2, 2])).toBe(true)
    expect(rangesEqual([1, 2], [1.01, 2])).toBe(false)
  })
})
