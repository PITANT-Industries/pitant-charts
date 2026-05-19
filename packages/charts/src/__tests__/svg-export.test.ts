import { describe, expect, it } from 'vitest'
import {
  buildDigitalChannelCommandFrame,
  buildDigitalChannelRenderPlan,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  commandFrameToSvg,
  createChartLayout,
  type DigitalChannelDataSet,
  type TimeSeriesDataSet,
} from '../index.js'

const TIME_SERIES_DATA: TimeSeriesDataSet = {
  timestamps: new Float64Array([0, 1, 2, 3]),
  columns: {
    temp: new Float64Array([10, 12, 11, 13]),
  },
  series: [{ key: 'temp', label: 'Temperature', field: 'temp', color: [1, 0, 0, 1] }],
}

const DIGITAL_DATA: DigitalChannelDataSet = {
  timestamps: new Float64Array([0, 1, 2, 3]),
  columns: {
    running: new Float64Array([0, 1, 1, 0]),
  },
  channels: [{ key: 'running', label: 'Running', field: 'running', color: [0, 0.5, 1, 1] }],
}

describe('command frame SVG export', () => {
  it('serializes a time-series command frame as clipped vector SVG', () => {
    const plan = buildTimeSeriesRenderPlan({
      ...TIME_SERIES_DATA,
      bands: [
        {
          kind: 'value-band',
          key: 'warning',
          yStart: 11,
          yEnd: 14,
          fillColor: [1, 0, 0, 0.12],
        },
      ],
    })
    const layout = createChartLayout({
      width: 640,
      height: 360,
      padding: 8,
      xRange: plan.xRelativeRange,
      yRange: plan.yRange,
      xAxis: { visible: true, label: 'Time' },
      yAxis: { visible: true, label: 'Temperature' },
      grid: { visible: true },
    })
    const frame = buildTimeSeriesCommandFrame(plan, 640, 360, { layout })
    const svg = commandFrameToSvg(frame, {
      background: '#ffffff',
      title: 'Trend <export>',
    })

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="640"')
    expect(svg).toContain('height="360"')
    expect(svg).toContain('<title>Trend &lt;export&gt;</title>')
    expect(svg).toContain('<clipPath id="plot-clip">')
    expect(svg).toContain('clip-path="url(#plot-clip)"')
    expect(svg).toContain('<path')
    expect(svg).toContain('fill="rgb(255 0 0)" fill-opacity="0.12"')
    expect(svg).toContain('stroke="rgb(255 0 0)"')
    expect(svg).toContain('>Time</text>')
    expect(svg).not.toContain('[object Object]')
  })

  it('serializes a digital-channel command frame without raster placeholders', () => {
    const plan = buildDigitalChannelRenderPlan(DIGITAL_DATA)
    const layout = createChartLayout({
      width: 480,
      height: 240,
      padding: 8,
      xRange: plan.xRelativeRange,
      yRange: plan.yRange,
      xAxis: { visible: true },
      yAxis: { visible: true },
      grid: { visible: true },
    })
    const frame = buildDigitalChannelCommandFrame(plan, 480, 240, { layout })
    const svg = commandFrameToSvg(frame, { background: 'transparent' })

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="480"')
    expect(svg).toContain('height="240"')
    expect(svg).toContain('fill="transparent"')
    expect(svg).toContain('stroke="rgb(0 128 255)"')
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('data:image/png')
  })
})
