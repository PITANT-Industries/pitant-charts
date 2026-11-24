import { StartupOverlay, type StartupOverlayData } from '../../../index'
import '../../../charts.css'

function trace(eventTime: number, readings: readonly (readonly [number, number | null])[]) {
  return readings.map(([offset, value]) => ({ time: eventTime + offset, value }))
}

const data: StartupOverlayData = {
  window: [-4, 28],
  step: 1,
  deadline: 12,
  signals: [
    { id: 'pressure', label: 'Outlet pressure', unit: 'bar', maxGap: 8 },
    { id: 'current', label: 'Motor current', unit: 'A', maxGap: 8 },
  ],
  runs: [
    {
      id: 'pump-01',
      label: 'Pump start 01',
      eventTime: 100,
      readyTime: 108,
      observedUntil: 128,
      traces: {
        pressure: trace(100, [[-4, 0.2], [0, 0.3], [4, 3.5], [8, 6.0], [14, 6.1], [21, 6.0], [28, 6.0]]),
        current: trace(100, [[-4, 0], [0, 19.5], [3, 12.0], [8, 7.9], [14, 7.2], [21, 7.2], [28, 7.1]]),
      },
    },
    {
      id: 'pump-02',
      label: 'Pump start 02',
      eventTime: 240,
      readyTime: 252,
      observedUntil: 268,
      traces: {
        pressure: trace(240, [[-4, 0.3], [0, 0.4], [4, 2.9], [8, 5.1], [12, 6.0], [20, 6.1], [28, 6.0]]),
        current: trace(240, [[-4, 0], [0, 17.8], [4, 12.5], [8, 9.3], [12, 7.8], [20, 7.3], [28, 7.2]]),
      },
    },
    {
      id: 'pump-03',
      label: 'Pump start 03',
      eventTime: 480,
      readyTime: 498,
      observedUntil: 508,
      traces: {
        pressure: trace(480, [[-4, 0.2], [0, 0.5], [4, 1.9], [8, null], [12, 4.2], [18, 6.0], [24, 6.1], [28, 6.0]]),
        current: trace(480, [[-4, 0], [0, 22.2], [4, 16.5], [9, 14.2], [14, 11.6], [18, 8.1], [24, 7.4], [28, 7.3]]),
      },
    },
    {
      id: 'pump-04',
      label: 'Pump start 04',
      eventTime: 750,
      observedUntil: 778,
      failed: true,
      traces: {
        pressure: trace(750, [[-4, 0.3], [0, 0.5], [4, 1.5], [8, 2.0], [14, 1.8], [21, 0.6], [28, 0.3]]),
        current: trace(750, [[-4, 0], [0, 23.4], [4, 20.1], [8, 19.7], [14, 18.8], [21, 0], [28, 0]]),
      },
    },
    {
      id: 'pump-05',
      label: 'Pump start 05',
      eventTime: 910,
      observedUntil: 938,
      traces: {
        pressure: trace(910, [[-4, 0.2], [0, 0.4], [4, 1.8], [8, 2.3], [14, 3.1], [21, 3.7], [28, 4.0]]),
        current: trace(910, [[-4, 0], [0, 19.5], [4, 16.0], [8, 13.6], [14, 12.8], [21, 11.7], [28, 11.1]]),
      },
    },
    {
      id: 'pump-06',
      label: 'Pump start 06',
      eventTime: 1100,
      observedUntil: 1107,
      traces: {
        pressure: trace(1100, [[-4, 0.2], [0, 0.4], [4, 2.0], [7, 3.2]]),
        current: trace(1100, [[-4, 0], [0, 18.7], [4, 13.8], [7, 11.5]]),
      },
    },
  ],
}

export function ExampleStartupOverlay() {
  return (
    <StartupOverlay
      data={data}
      title="Synthetic pump startups"
      initialRun="pump-03"
      caption="Six simulated starts aligned to their start commands. Readiness records mark the first time outlet pressure reached 6 bar. One simulated failure is recorded. The shortest follow-up is 7 seconds."
    />
  )
}
