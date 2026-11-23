// SPDX-License-Identifier: MPL-2.0

'use client'

import {
  ChartLegend,
  DigitalChannel,
  type DigitalChannelColumnData,
  type DigitalChannelConfig,
} from '@pitant/charts-react'
import { useMemo } from 'react'

const SAMPLE_COUNT = 240
const STEP_MS = 10_000
const START = 1_735_689_600_000

function buildData(): DigitalChannelColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const running = new Float64Array(SAMPLE_COUNT)
  const valve = new Float64Array(SAMPLE_COUNT)
  const permissive = new Float64Array(SAMPLE_COUNT)
  const permissiveQuality = new Uint8Array(SAMPLE_COUNT)
  const provenance = new Uint8Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    running[index] = index % 80 < 56 ? 1 : 0
    valve[index] = index % 60 > 12 ? 1 : 0
    permissive[index] = index > 120 && index < 154 ? 0 : 1
    permissiveQuality[index] = index > 120 && index < 154 ? 10 : 0
    provenance[index] = index > 120 && index < 154 ? 1 : 0
  }

  return {
    timestamps,
    columns: { running, valve, permissive },
    quality: { permissive: permissiveQuality },
    provenance: {
      permissive: {
        labels: ['live adapter', 'interlock replay'],
        codes: provenance,
      },
    },
    gaps: [{ startIndex: 120, endIndex: 154 }],
  }
}

export function PitantDigitalChannelBlock() {
  const data = useMemo(buildData, [])
  const config = useMemo<DigitalChannelConfig>(
    () => ({
      channels: [
        {
          key: 'running',
          label: 'Pump running',
          field: 'running',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
          color: 'hsl(160 60% 45%)',
          rgba: [0.11, 0.62, 0.44, 1],
        },
        {
          key: 'valve',
          label: 'Inlet valve',
          field: 'valve',
          stateLabels: { 0: 'Closed', 1: 'Open' },
          color: 'hsl(220 70% 50%)',
          rgba: [0.18, 0.39, 0.86, 1],
        },
        {
          key: 'permissive',
          label: 'Permissive',
          field: 'permissive',
          stateLabels: { 0: 'Blocked', 1: 'OK' },
          color: 'hsl(30 80% 55%)',
          rgba: [0.89, 0.42, 0.12, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        gapThreshold: STEP_MS * 4,
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      channelHeight: 26,
      channelGap: 8,
      renderer: 'auto',
    }),
    [],
  )

  return (
    <section className="grid gap-3">
      <div className="text-sm font-medium text-foreground">Interlock and permissive lanes</div>
      <DigitalChannel
        ariaLabel="Interlock and permissive lanes"
        aspectRatio={16 / 7}
        config={config}
        data={data}
      >
        {(chart) => (
          <div className="absolute left-3 top-2 pointer-events-auto">
            <ChartLegend
              items={[...chart.legendItems]}
              onToggle={(key) => chart.toggleSeries(key)}
            />
          </div>
        )}
      </DigitalChannel>
    </section>
  )
}

export default PitantDigitalChannelBlock
