import { describe, expect, it } from 'vitest'
import {
  DigitalChannelChart,
  type DigitalChannelDataSet,
  type FillOptions,
  type LineOptions,
  type RectOptions,
  type RenderContext,
  type RendererCapabilities,
  SpectrogramChart,
  type SpectrogramDataSet,
  SpectrumChart,
  type SpectrumDataSet,
  TimeSeriesChart,
  type TimeSeriesDataSet,
  type ViewTransform,
} from '../index.js'

class FakeRenderContext implements RenderContext {
  readonly type = 'canvas2d' as const
  readonly canvas = {} as HTMLCanvasElement
  width = 320
  height = 180
  dpr = 1
  beginCount = 0
  endCount = 0
  lineCount = 0
  fillCount = 0
  rectCount = 0
  textCount = 0
  disposed = false
  transform: ViewTransform | null = null

  resize(width: number, height: number, dpr = 1): void {
    this.width = width
    this.height = height
    this.dpr = dpr
  }

  beginFrame(): void {
    this.beginCount += 1
  }

  endFrame(): void {
    this.endCount += 1
  }

  drawLines(_buffer: Float32Array, _options: LineOptions): void {
    this.lineCount += 1
  }

  drawFill(_upper: Float32Array, _lower: Float32Array, _options: FillOptions): void {
    this.fillCount += 1
  }

  drawRect(_x: number, _y: number, _w: number, _h: number, _options: RectOptions): void {
    this.rectCount += 1
  }

  drawText(_text: string, _x: number, _y: number): void {
    this.textCount += 1
  }

  setTransform(transform: ViewTransform): void {
    this.transform = transform
  }

  getCapabilities(): RendererCapabilities {
    return {
      type: 'canvas2d',
      maxPoints: 200_000,
      supportsInstancing: false,
      supportsOffscreen: false,
    }
  }

  dispose(): void {
    this.disposed = true
  }
}

const TIME_SERIES_DATA: TimeSeriesDataSet = {
  timestamps: new Float64Array([0, 1, 2]),
  columns: {
    temp: new Float64Array([10, 11, 12]),
  },
  series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
}

const DIGITAL_DATA: DigitalChannelDataSet = {
  timestamps: new Float64Array([0, 1, 2]),
  columns: {
    running: new Float64Array([0, 1, 0]),
  },
  channels: [{ key: 'running', label: 'Running', field: 'running' }],
}

const SPECTRUM_DATA: SpectrumDataSet = {
  series: [
    {
      key: 'vibration',
      label: 'Vibration FFT',
      frequencies: new Float64Array([10, 20, 30]),
      magnitudes: new Float64Array([2, 8, 3]),
    },
  ],
}

const SPECTROGRAM_DATA: SpectrogramDataSet = {
  timeBins: new Float64Array([0, 1, 2]),
  frequencyBins: new Float64Array([10, 20]),
  values: new Float32Array([1, 2, 3, 4, 5, 6]),
}

describe('imperative chart classes', () => {
  it('renders TimeSeriesChart through the existing render-plan path', () => {
    const context = new FakeRenderContext()
    const chart = new TimeSeriesChart(context, { data: TIME_SERIES_DATA })

    expect(chart.renderPlan.kind).toBe('time-series')
    expect(chart.renderPlan.renderedPointCount).toBe(3)
    expect(context.beginCount).toBe(1)
    expect(context.endCount).toBe(1)
    expect(context.lineCount).toBe(1)
    expect(context.transform).not.toBeNull()

    chart.setRenderOptions({ xRange: [1, 2] })
    expect(chart.renderPlan.xRange).toEqual([1, 2])
    expect(context.beginCount).toBe(2)

    chart.resize(640, 320, 2)
    expect(context.width).toBe(640)
    expect(context.height).toBe(320)
    expect(context.dpr).toBe(2)

    chart.dispose()
    expect(context.disposed).toBe(false)
    expect(() => chart.render()).toThrow('TimeSeriesChart has been disposed')
  })

  it('disposes owned TimeSeriesChart contexts', () => {
    const context = new FakeRenderContext()
    const chart = new TimeSeriesChart(context, {
      data: TIME_SERIES_DATA,
      autoRender: false,
      ownsContext: true,
    })

    chart.dispose()

    expect(context.disposed).toBe(true)
  })

  it('renders DigitalChannelChart through the existing render-plan path', () => {
    const context = new FakeRenderContext()
    const chart = new DigitalChannelChart(context, { data: DIGITAL_DATA })

    expect(chart.renderPlan.kind).toBe('digital-channel')
    expect(chart.renderPlan.renderedPointCount).toBe(5)
    expect(context.beginCount).toBe(1)
    expect(context.endCount).toBe(1)
    expect(context.lineCount).toBe(1)

    chart.setData(
      {
        ...DIGITAL_DATA,
        columns: {
          running: new Float64Array([1, 1, 0]),
        },
      },
      { includeHidden: true },
    )
    expect(chart.renderOptions).toEqual({ includeHidden: true })
    expect(context.beginCount).toBe(2)

    chart.dispose()
    expect(() => chart.resize(100, 100)).toThrow('DigitalChannelChart has been disposed')
  })

  it('renders SpectrumChart through the existing render-plan path', () => {
    const context = new FakeRenderContext()
    const chart = new SpectrumChart(context, { data: SPECTRUM_DATA })

    expect(chart.renderPlan.kind).toBe('spectrum')
    expect(chart.renderPlan.renderedBinCount).toBe(3)
    expect(context.beginCount).toBe(1)
    expect(context.endCount).toBe(1)
    expect(context.fillCount).toBe(1)
    expect(context.lineCount).toBe(1)

    chart.setRenderOptions({ xRange: [15, 25] })
    expect(chart.renderPlan.renderedBinCount).toBe(1)
    expect(context.beginCount).toBe(2)

    chart.dispose()
    expect(() => chart.render()).toThrow('SpectrumChart has been disposed')
  })

  it('renders SpectrogramChart through the existing render-plan path', () => {
    const context = new FakeRenderContext()
    const chart = new SpectrogramChart(context, { data: SPECTROGRAM_DATA })

    expect(chart.renderPlan.kind).toBe('spectrogram')
    expect(chart.renderPlan.renderedTileCount).toBe(6)
    expect(context.beginCount).toBe(1)
    expect(context.endCount).toBe(1)
    expect(context.rectCount).toBe(6)

    chart.setRenderOptions({ xRange: [0.5, 2.5] })
    expect(chart.renderPlan.renderedTileCount).toBe(4)
    expect(context.beginCount).toBe(2)

    chart.dispose()
    expect(() => chart.render()).toThrow('SpectrogramChart has been disposed')
  })
})
