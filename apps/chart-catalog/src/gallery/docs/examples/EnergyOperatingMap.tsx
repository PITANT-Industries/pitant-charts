import { EnergyOperatingMap, type EnergyOperatingMapData } from '../../../index'
import '../../../charts.css'

const data: EnergyOperatingMapData = {
  unit: 'part',
  speed: { label: 'Spindle speed', unit: 'rpm' },
  load: { label: 'Spindle torque', unit: 'N·m' },
  runs: [
    {
      id: 'slow-light-a', label: '600 rpm and 8 N·m, repeat A', speed: 600, load: 8,
      units: 2, start: 0, end: 40, maxGap: 10,
      readings: [
        { time: -5, watts: 720 }, { time: 5, watts: 1080 }, { time: 15, watts: 1260 },
        { time: 25, watts: 1260 }, { time: 35, watts: 1080 }, { time: 45, watts: 720 },
      ],
    },
    {
      id: 'slow-light-b', label: '600 rpm and 8 N·m, repeat B', speed: 600, load: 8,
      units: 2, start: 0, end: 40, maxGap: 10,
      readings: [
        { time: 0, watts: 900 }, { time: 10, watts: 1080 }, { time: 20, watts: 1260 },
        { time: 30, watts: 1080 }, { time: 40, watts: 900 },
      ],
    },
    {
      id: 'fast-light', label: '900 rpm and 8 N·m', speed: 900, load: 8,
      units: 2, start: 0, end: 30, maxGap: 10,
      readings: [
        { time: 0, watts: 1080 }, { time: 10, watts: 1440 },
        { time: 20, watts: 1440 }, { time: 30, watts: 1080 },
      ],
    },
    {
      id: 'slow-heavy', label: '600 rpm and 12 N·m', speed: 600, load: 12,
      units: 2, start: 0, end: 45, maxGap: 15,
      readings: [
        { time: 0, watts: 1260 }, { time: 15, watts: 1440 },
        { time: 30, watts: 1620 }, { time: 45, watts: 1260 },
      ],
    },
    {
      id: 'fast-heavy', label: '900 rpm and 12 N·m', speed: 900, load: 12,
      units: 2, start: 0, end: 40, maxGap: 10,
      readings: [
        { time: 0, watts: 1440 }, { time: 10, watts: 1800 }, { time: 20, watts: null },
        { time: 30, watts: 1800 }, { time: 40, watts: 1440 },
      ],
    },
  ],
}

export function ExampleEnergyOperatingMap() {
  return (
    <EnergyOperatingMap
      data={data}
      title="Synthetic machining trials"
      initialRun="slow-light-a"
      caption="The two trials at 600 rpm and 8 N·m have a median of 6.1875 Wh per part. The trial at 900 rpm and 12 N·m has 9 Wh of observed energy over 20 of its 40 seconds. Its energy per part is unavailable."
    />
  )
}
