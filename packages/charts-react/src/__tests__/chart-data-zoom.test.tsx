import { createChartLayout } from '@pitant/charts'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartDataZoom } from '../chart-data-zoom.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const layout = createChartLayout({
  width: 800,
  height: 420,
  padding: 12,
  legend: { visible: true, position: 'top', size: 40, gap: 8 },
  xAxis: { visible: true, size: 34 },
  yAxis: { visible: true, size: 58 },
  xRange: [0, 100],
  yRange: [-10, 10],
})

const timestamps = new Float64Array([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
const values = new Float64Array([0, 1, 0, 2, 1, 3, 2, 4, 3, 5, 4])

function renderDataZoom(onRangeChange = vi.fn()) {
  render(
    <ChartDataZoom
      color="#2563eb"
      fullRange={[0, 100]}
      layout={layout}
      onRangeChange={onRangeChange}
      timestamps={timestamps}
      values={values}
      visibleRange={[20, 40]}
    />,
  )
  const dataZoom = screen.getByTestId('chart-data-zoom')
  vi.spyOn(dataZoom, 'getBoundingClientRect').mockReturnValue({
    bottom: 400,
    height: 22,
    left: 70,
    right: 788,
    top: 378,
    width: 718,
    x: 70,
    y: 378,
    toJSON: () => ({}),
  })

  return { dataZoom, onRangeChange }
}

describe('ChartDataZoom', () => {
  it('renders a sampled minimap and current range window', () => {
    renderDataZoom()

    expect(screen.getByTestId('chart-data-zoom')).toBeTruthy()
    expect(screen.getByTestId('chart-data-zoom-window')).toBeTruthy()
    expect(screen.getByTestId('chart-data-zoom-handle-start')).toBeTruthy()
    expect(screen.getByTestId('chart-data-zoom-handle-end')).toBeTruthy()
  })

  it('recenters the current range when clicking outside the selected window', () => {
    const { dataZoom, onRangeChange } = renderDataZoom()

    fireEvent.pointerDown(dataZoom, {
      button: 0,
      clientX: 70 + 718 * 0.7,
      clientY: 389,
      pointerId: 1,
    })

    expect(onRangeChange.mock.calls[0]?.[0][0]).toBeCloseTo(60)
    expect(onRangeChange.mock.calls[0]?.[0][1]).toBeCloseTo(80)
  })

  it('pans the selected window while dragging inside it', () => {
    const { dataZoom, onRangeChange } = renderDataZoom()

    fireEvent.pointerDown(dataZoom, {
      button: 0,
      clientX: 70 + 718 * 0.3,
      clientY: 389,
      pointerId: 1,
    })
    fireEvent.pointerMove(dataZoom, {
      clientX: 70 + 718 * 0.4,
      clientY: 389,
      pointerId: 1,
    })

    expect(onRangeChange).toHaveBeenCalledWith([30, 50])
  })

  it('displays and drags the time window vertically on a rotated chart', () => {
    const rotated = createChartLayout({
      width: 100,
      height: 200,
      padding: 0,
      orientation: 'rotated',
    })
    const onRangeChange = vi.fn()
    render(
      <ChartDataZoom
        fullRange={[0, 100]}
        layout={rotated}
        onRangeChange={onRangeChange}
        timestamps={timestamps}
        values={values}
        visibleRange={[20, 40]}
      />,
    )
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      bottom: 210,
      height: 200,
      left: 5,
      right: 21,
      top: 10,
      width: 16,
      x: 5,
      y: 10,
      toJSON: () => ({}),
    })

    expect(slider.getAttribute('aria-orientation')).toBe('vertical')
    const window = screen.getByTestId('chart-data-zoom-window')
    expect(window.style.top).toBe('40px')
    expect(window.style.height).toBe('40px')
    fireEvent.pointerDown(slider, { button: 0, clientX: 10, clientY: 70, pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 10, clientY: 90, pointerId: 1 })
    const range = onRangeChange.mock.lastCall?.[0]
    expect(range?.[0]).toBeCloseTo(30)
    expect(range?.[1]).toBeCloseTo(50)
  })

  it('resizes the selected window from either handle', () => {
    const { dataZoom, onRangeChange } = renderDataZoom()

    fireEvent.pointerDown(dataZoom, {
      button: 0,
      clientX: 70 + 718 * 0.2,
      clientY: 389,
      pointerId: 1,
    })
    fireEvent.pointerMove(dataZoom, {
      clientX: 70 + 718 * 0.1,
      clientY: 389,
      pointerId: 1,
    })

    expect(onRangeChange.mock.calls[0]?.[0][0]).toBeCloseTo(10)
    expect(onRangeChange.mock.calls[0]?.[0][1]).toBeCloseTo(40)
  })
})
