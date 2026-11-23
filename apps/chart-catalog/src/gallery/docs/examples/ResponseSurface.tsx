import { ResponseSurface, type ResponseSurfaceData } from '../../../index'
import '../../../charts.css'

// Illustrative factor settings, responses, and an analytic quadratic model.
const data: ResponseSurfaceData = {
  xAxis: { label: 'Temperature', unit: '°C' },
  yAxis: { label: 'Duration', unit: 'min' },
  responseAxis: { label: 'Response', unit: 'a.u.' },
  domain: [[55, 20], [60, 10], [80, 10], [85, 20], [80, 30], [60, 30]],
  trials: [
    { id: 'Run 1', x: 55, y: 20, response: 72.4 },
    { id: 'Run 2', x: 60, y: 10, response: 70.5 },
    { id: 'Run 3', x: 80, y: 10, response: 73.8 },
    { id: 'Run 4', x: 85, y: 20, response: 79.8 },
    { id: 'Run 5', x: 80, y: 30, response: 82.6 },
    { id: 'Run 6', x: 60, y: 30, response: 74.0 },
    { id: 'Run 7', x: 70, y: 20, response: 82.4 },
  ],
  evaluate(temperature, duration) {
    const x = (temperature - 70) / 15
    const y = (duration - 20) / 10
    return 82 + 4 * x + 3 * y - 6 * x ** 2 - 4 * y ** 2 + 2 * x * y
  },
  initialPosition: [70, 20],
  sectionAxis: 'y',
}

export function ExampleResponseSurface() {
  return <ResponseSurface data={data} label="Illustrative response surface" />
}
