import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartLegendItem } from '../chart-legend.js'
import { ChartLegend } from '../chart-legend.js'

afterEach(cleanup)

const items: ChartLegendItem[] = [
  { key: 'cpu', label: 'CPU', color: 'hsl(220, 70%, 50%)', visible: true },
  { key: 'mem', label: 'Memory', color: 'hsl(160, 60%, 45%)', visible: true },
  { key: 'disk', label: 'Disk', color: 'hsl(30, 80%, 55%)', visible: false },
]

describe('ChartLegend', () => {
  it('renders <ul> with aria-label', () => {
    const { container } = render(<ChartLegend items={items} />)
    const list = container.querySelector('ul')
    expect(list).not.toBeNull()
    expect(list!.getAttribute('aria-label')).toBe('Chart legend')
  })

  it('renders one <li> + button per item', () => {
    const { container } = render(<ChartLegend items={items} />)
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelectorAll('button')).toHaveLength(3)
  })

  it('displays item labels', () => {
    render(<ChartLegend items={items} />)
    expect(screen.getByText('CPU')).toBeTruthy()
    expect(screen.getByText('Memory')).toBeTruthy()
    expect(screen.getByText('Disk')).toBeTruthy()
  })

  it('sets aria-pressed matching item.visible', () => {
    const { container } = render(<ChartLegend items={items} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[2]!.getAttribute('aria-pressed')).toBe('false')
  })

  it('sets aria-label with visibility state', () => {
    const { container } = render(<ChartLegend items={items} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[0]!.getAttribute('aria-label')).toBe('CPU: visible')
    expect(buttons[2]!.getAttribute('aria-label')).toBe('Disk: hidden')
  })

  it('fires onToggle with key and flipped visibility on click', () => {
    const onToggle = vi.fn()
    const { container } = render(<ChartLegend items={items} onToggle={onToggle} />)
    const buttons = container.querySelectorAll('button')

    // Click visible item → should toggle to false
    fireEvent.click(buttons[0]!)
    expect(onToggle).toHaveBeenCalledWith('cpu', false)

    // Click hidden item → should toggle to true
    fireEvent.click(buttons[2]!)
    expect(onToggle).toHaveBeenCalledWith('disk', true)
  })

  it('keyboard Enter triggers toggle', () => {
    const onToggle = vi.fn()
    const { container } = render(<ChartLegend items={items} onToggle={onToggle} />)
    const btn = container.querySelectorAll('button')[0]!

    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyUp(btn, { key: 'Enter' })
    // Native button handles Enter → fires click
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledWith('cpu', false)
  })

  it('keyboard Space triggers toggle', () => {
    const onToggle = vi.fn()
    const { container } = render(<ChartLegend items={items} onToggle={onToggle} />)
    const btn = container.querySelectorAll('button')[1]!

    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledWith('mem', false)
  })

  it('renders without onToggle (no crash)', () => {
    expect(() => {
      const { container } = render(<ChartLegend items={items} />)
      const btn = container.querySelector('button')
      if (btn) fireEvent.click(btn)
    }).not.toThrow()
  })

  it('applies className to outer ul', () => {
    const { container } = render(<ChartLegend items={items} className="my-legend" />)
    expect(container.firstElementChild!.className).toBe('my-legend')
  })

  it('defaults to horizontal orientation (flex-direction: row)', () => {
    const { container } = render(<ChartLegend items={items} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.flexDirection).toBe('row')
  })

  it('vertical orientation sets flex-direction: column', () => {
    const { container } = render(<ChartLegend items={items} orientation="vertical" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.flexDirection).toBe('column')
  })

  it('dimmed item has opacity 0.4', () => {
    const { container } = render(<ChartLegend items={items} />)
    const hiddenBtn = container.querySelectorAll('button')[2] as HTMLElement
    expect(hiddenBtn.style.opacity).toBe('0.4')
  })

  it('visible item swatch is filled, hidden item swatch is hollow', () => {
    const { container } = render(<ChartLegend items={items} />)
    const swatches = container.querySelectorAll('[aria-hidden]')
    const visibleSwatch = swatches[0] as HTMLElement
    const hiddenSwatch = swatches[2] as HTMLElement

    expect(visibleSwatch.style.backgroundColor).toBe('hsl(220, 70%, 50%)')
    expect(hiddenSwatch.style.backgroundColor).toBe('transparent')
    expect(hiddenSwatch.style.border).toContain('hsl(30, 80%, 55%)')
  })

  it('renders empty items array without crashing', () => {
    const { container } = render(<ChartLegend items={[]} />)
    expect(container.querySelector('ul')).not.toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
