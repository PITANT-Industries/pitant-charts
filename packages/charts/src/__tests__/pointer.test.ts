import { describe, expect, it } from 'vitest'

import {
  clientPointToChartPoint,
  createChartLayout,
  mapChartPointToDataPoint,
  mapDataPointToChartPoint,
  mapPointerToChartCoordinates,
} from '../index.js'

describe('pointer coordinate mapping', () => {
  const layout = createChartLayout({
    width: 800,
    height: 420,
    padding: 12,
    legend: { visible: true, position: 'top', size: 40, gap: 8 },
    xAxis: { visible: true, size: 34 },
    yAxis: { visible: true, size: 58 },
    xRange: [0, 100],
    yRange: [-10, 10],
  })

  it('maps client coordinates through viewport scale into data coordinates', () => {
    const point = mapPointerToChartCoordinates({
      clientX: 224.5,
      clientY: 128.5,
      viewport: { left: 10, top: 20, width: 400, height: 210 },
      layout,
      xRange: [0, 100],
      yRange: [-10, 10],
      xValueOffset: 1_700_000,
    })

    expect(point.chartX).toBeCloseTo(429)
    expect(point.chartY).toBeCloseTo(217)
    expect(point.plotRatioX).toBeCloseTo(0.5)
    expect(point.plotRatioY).toBeCloseTo(0.5)
    expect(point.relativeDataX).toBeCloseTo(50)
    expect(point.dataX).toBeCloseTo(1_700_050)
    expect(point.dataY).toBeCloseTo(0)
    expect(point.insideBounds).toBe(true)
    expect(point.insidePlot).toBe(true)
  })

  it('reports out-of-plot pointers without clamping by default', () => {
    const point = mapChartPointToDataPoint({
      x: 34,
      y: 42,
      layout,
      xRange: [0, 100],
      yRange: [-10, 10],
    })

    expect(point.relativeX).toBeLessThan(0)
    expect(point.x).toBeLessThan(0)
    expect(point.y).toBeGreaterThan(10)
  })

  it('can clamp out-of-plot pointers to the nearest plot edge', () => {
    const point = mapPointerToChartCoordinates({
      clientX: 20,
      clientY: 30,
      viewport: { left: 10, top: 20, width: 800, height: 420 },
      layout,
      xRange: [0, 100],
      yRange: [-10, 10],
      clampToPlot: true,
    })

    expect(point.insideBounds).toBe(true)
    expect(point.insidePlot).toBe(false)
    expect(point.plotX).toBe(0)
    expect(point.plotY).toBe(0)
    expect(point.relativeDataX).toBe(0)
    expect(point.dataY).toBe(10)
  })

  it('maps data coordinates back into chart coordinates', () => {
    const point = mapDataPointToChartPoint({
      x: 1_700_075,
      y: -5,
      layout,
      xRange: [0, 100],
      yRange: [-10, 10],
      xValueOffset: 1_700_000,
    })

    expect(point.x).toBeCloseTo(layout.plotArea.x + layout.plotArea.width * 0.75)
    expect(point.y).toBeCloseTo(layout.plotArea.y + layout.plotArea.height * 0.75)
  })

  it('scales client coordinates even when the DOM viewport differs from layout size', () => {
    const point = clientPointToChartPoint({
      clientX: 210,
      clientY: 125,
      viewport: { left: 10, top: 25, width: 400, height: 200 },
      layout,
    })

    expect(point.x).toBeCloseTo(400)
    expect(point.y).toBeCloseTo(210)
  })
})
