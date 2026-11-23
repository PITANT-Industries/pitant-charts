// SPDX-License-Identifier: MPL-2.0

'use client'

import {
  ChartLegend,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
  type UseTimeSeriesReturn,
} from '@pitant/charts-react'
import { useMemo, useState } from 'react'

const SAMPLE_COUNT = 480
const STEP_MS = 15_000
const START = 1_735_689_600_000

function buildData(): TimeSeriesColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const yieldRate = new Float64Array(SAMPLE_COUNT)
  const rejects = new Float64Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    yieldRate[index] = 96.5 + Math.sin(index / 24) * 1.1 - Math.cos(index / 9) * 0.2
    rejects[index] = 1.8 + Math.cos(index / 22) * 0.5 + Math.sin(index / 6) * 0.12
  }

  return {
    timestamps,
    columns: { yieldRate, rejects },
    provenance: { yieldRate: 'quality historian', rejects: 'quality historian' },
  }
}

function ExportButton({ chart }: { chart: UseTimeSeriesReturn }) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const blob = await chart.exportImage('png', {
        background: 'white',
        pixelRatio: 2,
      })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = 'pitant-chart-export.png'
      anchor.click()
      URL.revokeObjectURL(href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className="absolute right-3 top-2 pointer-events-auto rounded border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm disabled:opacity-50"
      disabled={busy || !chart.ready}
      onClick={() => {
        void handleExport()
      }}
      type="button"
    >
      {busy ? 'Exporting' : 'PNG'}
    </button>
  )
}

export function PitantExportBlock() {
  const data = useMemo(buildData, [])
  const config = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'yieldRate',
          label: 'Yield',
          field: 'yieldRate',
          color: 'hsl(160 60% 45%)',
          rgba: [0.11, 0.62, 0.44, 1],
        },
        {
          key: 'rejects',
          label: 'Rejects',
          field: 'rejects',
          color: 'hsl(340 75% 55%)',
          rgba: [0.86, 0.18, 0.47, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'Percent',
        paddingRatio: 0.08,
      },
      renderer: 'auto',
    }),
    [],
  )

  return (
    <section className="grid gap-3">
      <div className="text-sm font-medium text-foreground">Quality export trend</div>
      <TimeSeries ariaLabel="Quality export trend" aspectRatio={16 / 9} config={config} data={data}>
        {(chart) => (
          <>
            <div className="absolute left-3 top-2 pointer-events-auto">
              <ChartLegend
                items={[...chart.legendItems]}
                onToggle={(key) => chart.toggleSeries(key)}
              />
            </div>
            <ExportButton chart={chart} />
          </>
        )}
      </TimeSeries>
    </section>
  )
}

export default PitantExportBlock
