import { HotellingProcessMonitor, type HotellingData } from '../../../index'
import '../../../charts.css'

// Simulated shaft machining runs. Values follow the order in channels.
const data: HotellingData = {
  alpha: 0.05,
  channels: [
    { id: 'diameter', label: 'Shaft diameter', unit: 'mm' },
    { id: 'spindle-load', label: 'Spindle load', unit: '%' },
    { id: 'motor-current', label: 'Motor current', unit: 'A' },
  ],
  reference: [
    { id: 'Reference 01', values: [20.003, 47, 8.5] },
    { id: 'Reference 02', values: [19.996, 38, 7.6] },
    { id: 'Reference 03', values: [20.007, 52, 8.1] },
    { id: 'Reference 04', values: [20.0, 44, 7.5] },
    { id: 'Reference 05', values: [20.004, 46, 8.8] },
    { id: 'Reference 06', values: [19.994, 37, 7.9] },
    { id: 'Reference 07', values: [20.002, 45, 7.3] },
    { id: 'Reference 08', values: [19.999, 43, 8.0] },
    { id: 'Reference 09', values: [20.008, 51, 8.6] },
    { id: 'Reference 10', values: [19.993, 39, 7.2] },
    { id: 'Reference 11', values: [20.005, 48, 8.2] },
    { id: 'Reference 12', values: [19.997, 41, 8.3] },
    { id: 'Reference 13', values: [20.001, 46, 7.7] },
    { id: 'Reference 14', values: [19.995, 40, 7.8] },
    { id: 'Reference 15', values: [20.006, 49, 8.4] },
    { id: 'Reference 16', values: [19.998, 42, 8.1] },
  ],
  runs: [
    { id: 'Run 01', values: [20.002, 46, 8.2] },
    { id: 'Run 02', values: [19.997, 41, 7.8] },
    { id: 'Run 03', values: [20.004, 51, 8.1] },
    { id: 'Run 04', values: [20.004, 52, 9.2] },
    { id: 'Run 05', values: [20.002, 50, 8.5] },
    { id: 'Run 06', values: [20.0, 44, 7.8] },
    { id: 'Run 07', values: [20.003, 48, 8.1] },
    { id: 'Run 08', values: [20.005, 49, 8.2] },
  ],
}

export function ExampleHotellingProcessMonitor() {
  return (
    <HotellingProcessMonitor
      data={data}
      initialRun="Run 04"
      label="Simulated shaft machining runs"
    />
  )
}
