import { CumulativeFlow, type CumulativeFlowData } from '../../../index'
import '../../../charts.css'

const data: CumulativeFlowData = {
  start: 0,
  end: 60,
  stages: [
    { id: 'queue', label: 'Waiting for machining' },
    { id: 'machining', label: 'Machining' },
    { id: 'inspection', label: 'Inspection' },
  ],
  initial: [
    { jobId: 'A', stage: 'machining', enteredAt: -7 },
    { jobId: 'B', stage: 'queue', enteredAt: -3 },
  ],
  events: [
    { time: 0, jobId: 'C', stage: 'queue' },
    { time: 4, jobId: 'A', stage: 'inspection' },
    { time: 4, jobId: 'B', stage: 'machining' },
    { time: 6, jobId: 'D', stage: 'queue' },
    { time: 7, jobId: 'E', stage: 'queue' },
    { time: 10, jobId: 'B', stage: 'inspection' },
    { time: 12, jobId: 'A', stage: null },
    { time: 13, jobId: 'C', stage: 'machining' },
    { time: 18, jobId: 'C', stage: 'inspection' },
    { time: 18, jobId: 'B', stage: 'machining' },
    { time: 22, jobId: 'F', stage: 'queue' },
    { time: 24, jobId: 'B', stage: 'inspection' },
    { time: 24, jobId: 'D', stage: 'machining' },
    { time: 26, jobId: 'C', stage: null },
    { time: 28, jobId: 'B', stage: null },
    { time: 31, jobId: 'D', stage: 'inspection' },
    { time: 36, jobId: 'D', stage: null },
    { time: 38, jobId: 'E', stage: 'machining' },
    { time: 44, jobId: 'E', stage: 'inspection' },
    { time: 51, jobId: 'E', stage: null },
  ],
}

export function ExampleCumulativeFlow() {
  return (
    <CumulativeFlow
      data={data}
      title="Synthetic machining job flow"
      initialTime={7}
      initialStage="queue"
      caption="Six simulated jobs over 60 seconds. Two jobs are present at the opening, job B returns to machining after inspection, and job F is still waiting at the end."
    />
  )
}
