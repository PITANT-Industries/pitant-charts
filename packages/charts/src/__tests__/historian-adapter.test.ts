import { describe, expect, it } from 'vitest'
import {
  HISTORIAN_QUALITY_CODE,
  historianQueryToTimeSeries,
  historianTrendFixtureToTimeSeries,
  normalizeQualityClass,
} from '../index.js'

describe('historian adapters', () => {
  it('converts historian query rows into TimeSeries columnar data', () => {
    const result = historianQueryToTimeSeries({
      rows: [
        {
          kind: 'observation',
          tag_id: 'TT-101.PV',
          value: 98.6,
          quality: 'GOOD',
          timestamp: '2026-04-20T14:30:00.000Z',
          engineering_unit: 'degC',
        },
        {
          kind: 'gap',
          start: '2026-04-20T14:30:02.000Z',
          end: '2026-04-20T14:30:05.000Z',
          reason: 'COMM_LOSS',
          acknowledged: false,
        },
        {
          kind: 'observation',
          tag_id: 'TT-101.PV',
          value: 99.8,
          quality: 'UNCERTAIN_LAST_USABLE_VALUE',
          timestamp: '2026-04-20T14:30:06.000Z',
          engineering_unit: 'degC',
        },
      ],
      next_cursor: 'cursor-1',
    })

    expect(Array.from(result.data.timestamps)).toEqual([
      Date.parse('2026-04-20T14:30:00.000Z'),
      Date.parse('2026-04-20T14:30:06.000Z'),
    ])
    expect(Array.from(result.data.columns['TT-101.PV'] ?? [])).toEqual([98.6, 99.8])
    expect(Array.from(result.data.quality?.['TT-101.PV'] ?? [])).toEqual([
      HISTORIAN_QUALITY_CODE.good,
      HISTORIAN_QUALITY_CODE.uncertain,
    ])
    expect(result.data.gaps).toEqual([{ startIndex: 1, endIndex: 1 }])
    expect(result.series).toEqual([
      {
        key: 'TT-101.PV',
        label: 'TT-101.PV (degC)',
        field: 'TT-101.PV',
      },
    ])
    expect(result.units).toEqual({ 'TT-101.PV': 'degC' })
    expect(result.nextCursor).toBe('cursor-1')
    expect(result.warnings).toEqual([])
  })

  it('maps configured multi-tag responses onto a shared timestamp column', () => {
    const result = historianQueryToTimeSeries(
      {
        rows: [
          {
            kind: 'observation',
            tag_id: 'TT-101.PV',
            value: 80,
            normalized_quality: 'good',
            timestamp: '2026-05-08T08:02:00Z',
          },
          {
            kind: 'observation',
            tag_id: 'PT-202.PV',
            value: 2.4,
            normalized_quality: 'bad',
            timestamp: '2026-05-08T08:02:01Z',
          },
        ],
      },
      {
        series: [
          { tagId: 'TT-101.PV', key: 'temp', field: 'temp', label: 'Temperature' },
          { tagId: 'PT-202.PV', key: 'pressure', field: 'pressure', label: 'Pressure' },
        ],
      },
    )

    expect(Array.from(result.data.columns['temp'] ?? [])).toEqual([80, Number.NaN])
    expect(Array.from(result.data.columns['pressure'] ?? [])).toEqual([Number.NaN, 2.4])
    expect(Array.from(result.data.quality?.['temp'] ?? [])).toEqual([
      HISTORIAN_QUALITY_CODE.good,
      HISTORIAN_QUALITY_CODE.unknown,
    ])
    expect(Array.from(result.data.quality?.['pressure'] ?? [])).toEqual([
      HISTORIAN_QUALITY_CODE.unknown,
      HISTORIAN_QUALITY_CODE.bad,
    ])
    expect(result.series.map((series) => series.field)).toEqual(['temp', 'pressure'])
  })

  it('reads historian trend frontend fixture wrappers', () => {
    const result = historianTrendFixtureToTimeSeries({
      responses: {
        'GET /query': {
          rows: [
            {
              kind: 'observation',
              tag_id: 'TT-101.PV',
              value: 81.4,
              quality_class: 'good',
              timestamp: '2026-05-08T08:02:00Z',
            },
          ],
        },
      },
    })

    expect(result.data.timestamps).toHaveLength(1)
    expect(result.series[0]?.key).toBe('TT-101.PV')
  })

  it('normalizes common historian quality spellings', () => {
    expect(normalizeQualityClass('GOOD')).toBe('good')
    expect(normalizeQualityClass('UNCERTAIN_LAST_USABLE_VALUE')).toBe('uncertain')
    expect(normalizeQualityClass('COMM_LOSS')).toBe('communication_failed')
    expect(normalizeQualityClass(undefined)).toBe('unknown')
  })
})
