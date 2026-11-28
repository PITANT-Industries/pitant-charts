import { describe, expect, it, vi } from 'vitest'
import { buildColumnarTooltipPayload, type SeriesHoverIndexContext } from '../chart-tooltip-data.js'

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

  it('chooses each series hover sample on its own grid and reports matching source metadata', () => {
    const customHoverIndex = vi.fn(({ nearestIndex }: SeriesHoverIndexContext) =>
      nearestIndex === 2 ? 0 : undefined,
    )
    const pressureTimestamps = new Float64Array([1002, 1012, 1022])
    const payload = buildColumnarTooltipPayload({
      data: {
        timestamps: new Float64Array([1000, 1010, 1020]),
        columns: {
          temp: new Float64Array([10, 11, 12]),
          pressure: new Float64Array([100, 110, 120]),
        },
        seriesTimestamps: { pressure: pressureTimestamps },
        sampleKinds: { pressure: new Uint8Array([0, 1, 0]) },
        quality: { pressure: new Uint8Array([0, 1, 2]) },
        provenance: { pressure: ['PLC', 'Missed sample', 'Manual correction'] },
        gaps: [{ startIndex: 1, endIndex: 1 }],
      },
      series: [
        { key: 'previous', label: 'Previous', field: 'temp', hoverIndex: 'previous' },
        { key: 'next', label: 'Next', field: 'temp', hoverIndex: 'next' },
        { key: 'exact', label: 'Exact', field: 'pressure', hoverIndex: 'exact' },
        { key: 'custom', label: 'Custom', field: 'pressure', hoverIndex: customHoverIndex },
        { key: 'fallback', label: 'Fallback', field: 'pressure', hoverIndex: () => undefined },
        { key: 'ignored', label: 'Ignored', field: 'pressure', hoverIndex: () => null },
        { key: 'invalid', label: 'Invalid', field: 'pressure', hoverIndex: () => 99 },
      ],
      timestamp: 1018,
    })

    expect(payload?.timestamp).toBe(1020)
    expect(payload?.series).toEqual([
      expect.objectContaining({ key: 'previous', value: 11, sampleTimestamp: 1010, gap: true }),
      expect.objectContaining({ key: 'next', value: 12, sampleTimestamp: 1020 }),
      expect.objectContaining({ key: 'exact', value: null }),
      expect.objectContaining({
        key: 'custom',
        value: 100,
        sampleTimestamp: 1002,
        quality: 0,
        provenance: { label: 'PLC' },
      }),
      expect.objectContaining({ key: 'fallback', value: 120, sampleTimestamp: 1022 }),
      expect.objectContaining({ key: 'ignored', value: null }),
      expect.objectContaining({ key: 'invalid', value: null }),
    ])
    expect(customHoverIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesKey: 'custom',
        field: 'pressure',
        timestamp: 1018,
        timestamps: pressureTimestamps,
        quality: new Uint8Array([0, 1, 2]),
        nearestIndex: 2,
      }),
    )
  })

  it('leaves directional samples blank outside their available side of the timeline', () => {
    const data = {
      timestamps: new Float64Array([10, 20]),
      columns: { temp: new Float64Array([1, 2]) },
    }
    const previous = {
      key: 'before',
      label: 'Previous',
      field: 'temp',
      hoverIndex: 'previous',
    } as const
    const next = { key: 'after', label: 'Next', field: 'temp', hoverIndex: 'next' } as const
    expect(
      buildColumnarTooltipPayload({ data, series: [previous], timestamp: 5 })?.series[0]?.value,
    ).toBe(null)
    expect(
      buildColumnarTooltipPayload({ data, series: [next], timestamp: 25 })?.series[0]?.value,
    ).toBe(null)
    expect(
      buildColumnarTooltipPayload({ data, series: [previous], timestamp: 10 })?.series[0]?.value,
    ).toBe(1)
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
