import { describe, expect, it } from 'vitest'
import { buildColumnarTooltipPayload } from '../chart-tooltip-data.js'

describe('buildColumnarTooltipPayload', () => {
  it('builds a nearest-point payload with quality, gap, and provenance metadata', () => {
    const payload = buildColumnarTooltipPayload({
      data: {
        timestamps: new Float64Array([1000, 1010, 1020]),
        columns: {
          temp: new Float64Array([10, 12.5, 11]),
          pressure: new Float64Array([1, 2, 3]),
        },
        quality: {
          temp: new Uint8Array([0, 1, 2]),
        },
        provenance: {
          temp: {
            labels: ['live adapter', 'manual correction'],
            codes: new Uint8Array([0, 1, 0]),
          },
        },
        gaps: [{ startIndex: 1, endIndex: 1 }],
      },
      series: [
        { key: 'temp', label: 'Temperature', field: 'temp', color: 'red' },
        { key: 'pressure', label: 'Pressure', field: 'pressure', visible: false },
      ],
      timestamp: 1012,
      formatX: (value) => `t=${value}`,
      formatY: (value) => `${value.toFixed(1)} C`,
    })

    expect(payload?.timestamp).toBe(1010)
    expect(payload?.label).toBe('t=1010')
    expect(payload?.series).toEqual([
      {
        key: 'temp',
        label: 'Temperature',
        color: 'red',
        value: 12.5,
        formatted: '12.5 C',
        quality: 1,
        qualityLabel: 'uncertain',
        provenance: { label: 'manual correction' },
        gap: true,
      },
    ])
  })

  it('supports static and sparse provenance fields', () => {
    const payload = buildColumnarTooltipPayload({
      data: {
        timestamps: new Float64Array([0, 10, 20]),
        columns: { temp: new Float64Array([10, 11, 12]) },
        provenance: {
          temp: [undefined, { label: 'historian backfill', source: 'PI import' }, undefined],
        },
      },
      series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
      timestamp: 9,
    })

    expect(payload?.series[0]?.provenance).toEqual({
      label: 'historian backfill',
      source: 'PI import',
    })
  })

  it('formats digital channel state labels', () => {
    const payload = buildColumnarTooltipPayload({
      data: {
        timestamps: new Float64Array([0, 10]),
        columns: { running: new Float64Array([0, 1]) },
      },
      series: [
        {
          key: 'running',
          label: 'Running',
          field: 'running',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
        },
      ],
      timestamp: 9,
    })

    expect(payload?.series[0]?.formatted).toBe('Running')
  })

  it('returns null when there are no timestamps or visible series', () => {
    expect(
      buildColumnarTooltipPayload({
        data: { timestamps: new Float64Array(), columns: {} },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
        timestamp: 10,
      }),
    ).toBeNull()

    expect(
      buildColumnarTooltipPayload({
        data: {
          timestamps: new Float64Array([10]),
          columns: { temp: new Float64Array([1]) },
        },
        series: [{ key: 'temp', label: 'Temperature', field: 'temp', visible: false }],
        timestamp: 10,
      }),
    ).toBeNull()
  })
})
