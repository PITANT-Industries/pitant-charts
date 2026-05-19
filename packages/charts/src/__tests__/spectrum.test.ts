import { describe, expect, it } from 'vitest'

import {
  addSpectrumBandsToCommandList,
  addSpectrumPeakMarkersToCommandList,
  addSpectrumToCommandList,
  buildSpectrumCommandFrame,
  buildSpectrumRenderPlan,
  commandFrameToSvg,
  RenderCommandList,
} from '../index.js'

describe('spectrum chart planning', () => {
  it('builds filled spectrum bins from precomputed frequency magnitudes', () => {
    const plan = buildSpectrumRenderPlan({
      series: [
        {
          key: 'vibration',
          label: 'Vibration FFT',
          frequencies: new Float64Array([10, 20, 30]),
          magnitudes: new Float64Array([4, 10, 6]),
          color: [0.48, 0.23, 0.93, 1],
        },
      ],
    })

    expect(plan.kind).toBe('spectrum')
    expect(plan.sourceBinCount).toBe(3)
    expect(plan.renderedBinCount).toBe(3)
    expect(plan.xRange[0]).toBeLessThanOrEqual(10)
    expect(plan.yRange[1]).toBeGreaterThan(10)

    const segment = plan.series[0]?.fillSegments[0]
    expect(segment?.upper.length).toBe(12)
    expect(segment?.lower.length).toBe(12)
    expect(segment?.pointCount).toBe(6)
  })

  it('filters hidden series and out-of-range bins', () => {
    const plan = buildSpectrumRenderPlan(
      {
        series: [
          {
            key: 'visible',
            label: 'Visible',
            frequencies: new Float64Array([0, 10, 20, 30]),
            magnitudes: new Float64Array([1, 2, 3, 4]),
          },
          {
            key: 'hidden',
            label: 'Hidden',
            frequencies: new Float64Array([0, 10]),
            magnitudes: new Float64Array([9, 9]),
            visible: false,
          },
        ],
      },
      { xRange: [5, 25] },
    )

    expect(plan.series.map((series) => series.key)).toEqual(['visible'])
    expect(plan.series[0]?.renderedBinCount).toBe(2)
    expect(plan.series[0]?.droppedBinCount).toBe(2)
  })

  it('plans frequency bands and peak markers as command geometry', () => {
    const plan = buildSpectrumRenderPlan({
      series: [
        {
          key: 'spectrum',
          label: 'Spectrum',
          frequencies: new Float64Array([10, 20, 30, 40]),
          magnitudes: new Float64Array([1, 8, 3, 2]),
        },
      ],
      bands: [
        {
          key: 'bearing-band',
          label: 'Bearing band',
          frequencyStart: 18,
          frequencyEnd: 24,
        },
      ],
      peakMarkers: [
        {
          key: 'peak-20hz',
          frequency: 20,
          magnitude: 8,
          label: '20 Hz',
        },
      ],
    })
    const commands = new RenderCommandList()

    addSpectrumBandsToCommandList(commands, plan)
    addSpectrumToCommandList(commands, plan)
    addSpectrumPeakMarkersToCommandList(commands, plan)

    expect(plan.bands).toHaveLength(1)
    expect(plan.peakMarkers).toHaveLength(1)
    expect(commands.sorted().map((command) => command.kind)).toEqual([
      'fill',
      'fill',
      'line',
      'line',
      'line',
      'line',
    ])
  })

  it('exports peak labels through the command-frame SVG path', () => {
    const plan = buildSpectrumRenderPlan({
      series: [
        {
          key: 'spectrum',
          label: 'Spectrum',
          frequencies: new Float64Array([10, 20, 30]),
          magnitudes: new Float64Array([1, 6, 2]),
        },
      ],
      peakMarkers: [
        {
          key: 'peak',
          frequency: 20,
          magnitude: 6,
          label: 'dominant',
        },
      ],
    })
    const frame = buildSpectrumCommandFrame(plan, 420, 260)
    const svg = commandFrameToSvg(frame, { title: 'Spectrum' })

    expect(frame.commands.sorted().some((command) => command.kind === 'text')).toBe(true)
    expect(svg).toContain('dominant')
    expect(svg).toContain('<path')
  })
})
