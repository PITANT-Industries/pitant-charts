// SPDX-License-Identifier: MPL-2.0

'use client'

import {
  ChartLegend,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
  type UseTimeSeriesReturn,
} from '@pitant/charts-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const INITIAL_COUNT = 360
const CHUNK_COUNT = 12
const STEP_MS = 1_000
const START = 1_735_689_600_000
const WINDOW_SIZE = 240

function buildInitialData(): TimeSeriesColumnData {
  return buildChunk(START, INITIAL_COUNT, 0)
}

function buildChunk(start: number, count: number, offset: number): TimeSeriesColumnData {
  const timestamps = new Float64Array(count)
  const throughput = new Float64Array(count)
  const vibration = new Float64Array(count)
  const quality = new Uint8Array(count)

  for (let index = 0; index < count; index++) {
    const sample = offset + index
    timestamps[index] = start + index * STEP_MS
    throughput[index] = 820 + Math.sin(sample / 18) * 24 + Math.sin(sample / 5) * 4
    vibration[index] = 2.6 + Math.cos(sample / 22) * 0.28 + Math.sin(sample / 4) * 0.05
    quality[index] = sample % 157 > 146 ? 1 : 0
  }

  return {
    timestamps,
    columns: { throughput, vibration },
    quality: { throughput: quality },
    provenance: { throughput: 'live adapter', vibration: 'live adapter' },
  }
}

function StreamingAppender({ chart }: { chart: UseTimeSeriesReturn }) {
  const [sampleCount, setSampleCount] = useState(INITIAL_COUNT)
  const nextTimestampRef = useRef(START + INITIAL_COUNT * STEP_MS)
  const sampleOffsetRef = useRef(INITIAL_COUNT)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const chunk = buildChunk(nextTimestampRef.current, CHUNK_COUNT, sampleOffsetRef.current)
      chart.append(chunk)
      nextTimestampRef.current += CHUNK_COUNT * STEP_MS
      sampleOffsetRef.current += CHUNK_COUNT
      setSampleCount((value) => value + CHUNK_COUNT)
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [chart])

  return (
    <div className="absolute right-3 top-2 pointer-events-none rounded border bg-background/90 px-2 py-1 text-xs tabular-nums text-foreground shadow-sm">
      {sampleCount.toLocaleString()} samples
    </div>
  )
}

export function PitantStreamingTrendBlock() {
  const data = useMemo(buildInitialData, [])
  const config = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'throughput',
          label: 'Throughput',
          field: 'throughput',
          color: 'hsl(220 70% 50%)',
          rgba: [0.18, 0.39, 0.86, 1],
        },
        {
          key: 'vibration',
          label: 'Vibration',
          field: 'vibration',
          color: 'hsl(30 80% 55%)',
          rgba: [0.89, 0.42, 0.12, 1],
        },
      ],
      xAxis: {
        label: 'Live window',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'Process',
        paddingRatio: 0.08,
      },
      renderer: 'auto',
    }),
    [],
  )

  return (
    <section className="grid gap-3">
      <div className="text-sm font-medium text-foreground">Live production trend</div>
      <TimeSeries
        ariaLabel="Live production trend"
        aspectRatio={16 / 9}
        config={config}
        data={data}
        streaming={{ enabled: true, liveEdge: true, windowSize: WINDOW_SIZE }}
      >
        {(chart) => (
          <>
            <div className="absolute left-3 top-2 pointer-events-auto">
              <ChartLegend
                items={[...chart.legendItems]}
                onToggle={(key) => chart.toggleSeries(key)}
              />
            </div>
            <StreamingAppender chart={chart} />
          </>
        )}
      </TimeSeries>
    </section>
  )
}

export default PitantStreamingTrendBlock
