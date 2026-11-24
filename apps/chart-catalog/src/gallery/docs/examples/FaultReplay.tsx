import { FaultReplay, type FaultReplayData } from '../../../index'
import '../../../charts.css'

const data: FaultReplayData = {
  start: 0,
  end: 80,
  signals: [
    {
      id: 'pressure',
      label: 'Outlet pressure',
      unit: 'bar',
      maxAge: 10,
      samples: [
        { time: 0, value: 5.0 },
        { time: 8, value: 5.1 },
        { time: 16, value: 4.8 },
        { time: 24, value: 4.2 },
        { time: 27, value: 3.5 },
        { time: 31, value: 2.9 },
        { time: 37, value: 2.7 },
        { time: 41, value: null },
        { time: 53, value: 4.5 },
        { time: 59, value: 5.0 },
        { time: 67, value: 5.1 },
        { time: 79, value: 5.0 },
      ],
    },
    {
      id: 'current',
      label: 'Motor current',
      unit: 'A',
      maxAge: 12,
      samples: [
        { time: 0, value: 7.2 },
        { time: 13, value: 7.1 },
        { time: 22, value: 7.6 },
        { time: 32, value: 8.3 },
        { time: 41, value: 0 },
        { time: 49, value: 9.6 },
        { time: 59, value: 7.3 },
        { time: 69, value: 7.2 },
        { time: 80, value: 7.2 },
      ],
    },
  ],
  states: [
    { id: 'initial-run', label: 'Running', start: 0, end: 41 },
    { id: 'stopped', label: 'Stopped', start: 41, end: 49 },
    { id: 'startup', label: 'Starting', start: 49, end: 56 },
    { id: 'final-run', label: 'Running', start: 56 },
  ],
  alarms: [
    { id: 'pressure-low', label: 'Low outlet pressure', start: 27, end: 53 },
  ],
  actions: [
    { id: 'acknowledge', label: 'Acknowledge pressure alarm', time: 34 },
    { id: 'stop', label: 'Stop pump', time: 41 },
    { id: 'restart', label: 'Restart pump', time: 49 },
  ],
}

export function ExampleFaultReplay() {
  return (
    <FaultReplay
      data={data}
      title="Simulated pump trip and restart"
      initialTime={27}
      caption="Synthetic measurements and event records. The pressure logger has a data gap from 41 to 53 seconds."
    />
  )
}
