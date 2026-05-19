import { createChartLayout } from '@pitant/charts'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import { ChartRegionZoomLayer, type ChartRegionZoomLayerProps } from '../chart-interactions.js'

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

function fakeContainerRef(): RefObject<ChartContainerRef | null> {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    bottom: 440,
    height: 420,
    left: 10,
    right: 810,
    top: 20,
    width: 800,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  })

  return {
    current: {
      canvas,
      dimensions: { width: 800, height: 420, dpr: 1 },
      toDataURL: () => '',
      invalidate: () => undefined,
    },
  }
}

function renderLayer(onRangeChange = vi.fn(), overrides: Partial<ChartRegionZoomLayerProps> = {}) {
  const props: ChartRegionZoomLayerProps = {
    containerRef: fakeContainerRef(),
    fullRange: overrides.fullRange ?? [1000, 1100],
    layout: overrides.layout ?? layout,
    onRangeChange,
    xOrigin: overrides.xOrigin ?? 1000,
    xRange: overrides.xRange ?? [0, 100],
    yRange: overrides.yRange ?? [-10, 10],
  }
  if (overrides.wheelZoom !== undefined) props.wheelZoom = overrides.wheelZoom
  if (overrides.crosshair !== undefined) props.crosshair = overrides.crosshair
  if (overrides.onHoverChange !== undefined) props.onHoverChange = overrides.onHoverChange
  if (overrides.syncedCursorX !== undefined) props.syncedCursorX = overrides.syncedCursorX
  if (overrides.touchNavigation !== undefined) props.touchNavigation = overrides.touchNavigation

  render(<ChartRegionZoomLayer {...props} />)
  return { layer: screen.getByTestId('chart-region-zoom-layer'), onRangeChange }
}

function fireWheelAt(
  layer: HTMLElement,
  options: {
    clientX: number
    clientY: number
    deltaY: number
    deltaMode?: number
    deltaX?: number
    shiftKey?: boolean
  },
) {
  const event = createEvent.wheel(layer, {
    cancelable: true,
    deltaX: options.deltaX ?? 0,
    deltaMode: options.deltaMode ?? 0,
    deltaY: options.deltaY,
    shiftKey: options.shiftKey ?? false,
  })
  Object.defineProperty(event, 'clientX', { value: options.clientX })
  Object.defineProperty(event, 'clientY', { value: options.clientY })
  fireEvent(layer, event)
}

describe('ChartRegionZoomLayer', () => {
  it('zooms to a dragged plot region', () => {
    const { layer, onRangeChange } = renderLayer()
    const startX = 10 + layout.plotArea.x + layout.plotArea.width * 0.25
    const endX = 10 + layout.plotArea.x + layout.plotArea.width * 0.75
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireEvent.pointerDown(layer, { button: 0, clientX: startX, clientY, pointerId: 1 })
    fireEvent.pointerMove(layer, { clientX: endX, clientY, pointerId: 1 })

    expect(screen.getByTestId('chart-region-zoom-selection')).toBeTruthy()

    fireEvent.pointerUp(layer, { clientX: endX, clientY, pointerId: 1 })

    expect(onRangeChange).toHaveBeenCalledWith([1025, 1075])
  })

  it('resets to the full range on double click', () => {
    const { layer, onRangeChange } = renderLayer()

    fireEvent.doubleClick(layer)

    expect(onRangeChange).toHaveBeenCalledWith([1000, 1100])
  })

  it('zooms the x-axis around the wheel cursor anchor', () => {
    const { layer, onRangeChange } = renderLayer()
    const anchorRatio = 0.25
    const clientX = 10 + layout.plotArea.x + layout.plotArea.width * anchorRatio
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireWheelAt(layer, { clientX, clientY, deltaY: -100 })

    const expectedSpan = 100 * Math.exp(-100 * 0.002)
    const anchorX = 1025
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange.mock.calls[0]?.[0][0]).toBeCloseTo(anchorX - expectedSpan * anchorRatio)
    expect(onRangeChange.mock.calls[0]?.[0][1]).toBeCloseTo(
      anchorX + expectedSpan * (1 - anchorRatio),
    )
  })

  it('clamps wheel zoom out to the full source range', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), {
      xOrigin: 1025,
      xRange: [0, 50],
    })
    const clientX = 10 + layout.plotArea.x + layout.plotArea.width / 2
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireWheelAt(layer, { clientX, clientY, deltaY: 1000 })

    expect(onRangeChange).toHaveBeenCalledWith([1000, 1100])
  })

  it('ignores wheel zoom outside the plot and x-axis', () => {
    const { layer, onRangeChange } = renderLayer()

    fireWheelAt(layer, { clientX: 15, clientY: 25, deltaY: -100 })

    expect(onRangeChange).not.toHaveBeenCalled()
  })

  it('can disable wheel zoom while keeping drag zoom available', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), { wheelZoom: false })
    const clientX = 10 + layout.plotArea.x + layout.plotArea.width / 2
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireWheelAt(layer, { clientX, clientY, deltaY: -100 })

    expect(onRangeChange).not.toHaveBeenCalled()
  })

  it('pans the x-range with horizontal wheel or shifted scroll input', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), {
      xOrigin: 1020,
      xRange: [0, 40],
    })
    const clientX = 10 + layout.plotArea.x + layout.plotArea.width / 2
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireWheelAt(layer, {
      clientX,
      clientY,
      deltaX: layout.plotArea.width * 0.25,
      deltaY: 0,
    })

    expect(onRangeChange).toHaveBeenCalledWith([1030, 1070])
  })

  it('pans the x-range with an alt-drag gesture without drawing a selection', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), {
      xOrigin: 1020,
      xRange: [0, 40],
    })
    const startX = 10 + layout.plotArea.x + layout.plotArea.width / 2
    const endX = startX - layout.plotArea.width * 0.25
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireEvent.pointerDown(layer, {
      altKey: true,
      button: 0,
      clientX: startX,
      clientY,
      pointerId: 1,
    })
    fireEvent.pointerMove(layer, { altKey: true, clientX: endX, clientY, pointerId: 1 })

    expect(onRangeChange).toHaveBeenCalledWith([1030, 1070])
    expect(screen.queryByTestId('chart-region-zoom-selection')).toBeNull()

    fireEvent.pointerUp(layer, { altKey: true, clientX: endX, clientY, pointerId: 1 })
  })

  it('supports keyboard pan, zoom, and full-range reset', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), {
      xOrigin: 1020,
      xRange: [0, 40],
    })

    layer.focus()
    fireEvent.keyDown(layer, { key: 'ArrowRight' })
    fireEvent.keyDown(layer, { key: 'ArrowUp' })
    fireEvent.keyDown(layer, { key: '0' })

    expect(onRangeChange).toHaveBeenNthCalledWith(1, [1024, 1064])
    expect(onRangeChange).toHaveBeenNthCalledWith(2, [1024, 1056])
    expect(onRangeChange).toHaveBeenNthCalledWith(3, [1000, 1100])
  })

  it('pans the x-range with a one-finger touch drag', () => {
    const { layer, onRangeChange } = renderLayer(vi.fn(), {
      xOrigin: 1020,
      xRange: [0, 40],
    })
    const startX = 10 + layout.plotArea.x + layout.plotArea.width / 2
    const endX = startX - layout.plotArea.width * 0.25
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireEvent.pointerDown(layer, {
      button: 0,
      clientX: startX,
      clientY,
      pointerId: 11,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(layer, {
      clientX: endX,
      clientY,
      pointerId: 11,
      pointerType: 'touch',
    })

    expect(onRangeChange).toHaveBeenCalledWith([1030, 1070])
    expect(screen.queryByTestId('chart-region-zoom-selection')).toBeNull()

    fireEvent.pointerUp(layer, { clientX: endX, clientY, pointerId: 11, pointerType: 'touch' })
  })

  it('zooms the x-range with a two-finger pinch gesture', () => {
    const { layer, onRangeChange } = renderLayer()
    const leftStart = 10 + layout.plotArea.x + layout.plotArea.width * 0.25
    const rightStart = 10 + layout.plotArea.x + layout.plotArea.width * 0.75
    const leftEnd = 10 + layout.plotArea.x + layout.plotArea.width * 0.2
    const rightEnd = 10 + layout.plotArea.x + layout.plotArea.width * 0.8
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireEvent.pointerDown(layer, {
      button: 0,
      clientX: leftStart,
      clientY,
      pointerId: 21,
      pointerType: 'touch',
    })
    fireEvent.pointerDown(layer, {
      button: 0,
      clientX: rightStart,
      clientY,
      pointerId: 22,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(layer, {
      clientX: leftEnd,
      clientY,
      pointerId: 21,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(layer, {
      clientX: rightEnd,
      clientY,
      pointerId: 22,
      pointerType: 'touch',
    })

    expect(onRangeChange).toHaveBeenCalled()
    const range = onRangeChange.mock.calls.at(-1)?.[0]
    expect(range?.[0]).toBeCloseTo(1008.333, 3)
    expect(range?.[1]).toBeCloseTo(1091.667, 3)
  })

  it('reports hover coordinates and renders a plot-bounded crosshair', () => {
    const onHoverChange = vi.fn()
    const { layer } = renderLayer(vi.fn(), { onHoverChange })
    const clientX = 10 + layout.plotArea.x + layout.plotArea.width * 0.4
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height * 0.6

    fireEvent.pointerMove(layer, { clientX, clientY, pointerId: 7 })

    expect(onHoverChange).toHaveBeenCalledWith(
      expect.objectContaining({
        insidePlot: true,
        dataX: 1040,
      }),
    )
    expect(screen.getByTestId('chart-crosshair-vertical')).toBeTruthy()
    expect(screen.getByTestId('chart-crosshair-horizontal')).toBeTruthy()

    fireEvent.pointerLeave(layer)

    expect(onHoverChange).toHaveBeenLastCalledWith(null)
    expect(screen.queryByTestId('chart-crosshair-vertical')).toBeNull()
  })

  it('renders a synced cursor line without a local horizontal crosshair', () => {
    renderLayer(vi.fn(), { syncedCursorX: layout.plotArea.x + 42 })

    expect(screen.getByTestId('chart-crosshair-vertical')).toBeTruthy()
    expect(screen.queryByTestId('chart-crosshair-horizontal')).toBeNull()
  })

  it('ignores short drags and drags that start outside the plot', () => {
    const { layer, onRangeChange } = renderLayer()
    const clientY = 20 + layout.plotArea.y + layout.plotArea.height / 2

    fireEvent.pointerDown(layer, {
      button: 0,
      clientX: 10 + layout.plotArea.x + 10,
      clientY,
      pointerId: 1,
    })
    fireEvent.pointerMove(layer, {
      clientX: 10 + layout.plotArea.x + 12,
      clientY,
      pointerId: 1,
    })
    fireEvent.pointerUp(layer, {
      clientX: 10 + layout.plotArea.x + 12,
      clientY,
      pointerId: 1,
    })

    fireEvent.pointerDown(layer, { button: 0, clientX: 15, clientY: 25, pointerId: 2 })
    fireEvent.pointerMove(layer, {
      clientX: 10 + layout.plotArea.x + 300,
      clientY,
      pointerId: 2,
    })
    fireEvent.pointerUp(layer, {
      clientX: 10 + layout.plotArea.x + 300,
      clientY,
      pointerId: 2,
    })

    expect(onRangeChange).not.toHaveBeenCalled()
  })
})
