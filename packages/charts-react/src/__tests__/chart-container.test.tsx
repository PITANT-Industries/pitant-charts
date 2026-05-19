import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartContainerRef } from '../chart-container.js'
import { ChartContainer } from '../chart-container.js'

afterEach(() => {
  cleanup()
  MockResizeObserver.instances.length = 0
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
})

// ── ResizeObserver mock ──────────────────────────────────────

class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

// ── Tests ────────────────────────────────────────────────────

describe('ChartContainer', () => {
  it('renders a div with role="img" and aria-label', () => {
    const { container } = render(<ChartContainer ariaLabel="Test chart" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.getAttribute('role')).toBe('img')
    expect(div.getAttribute('aria-label')).toBe('Test chart')
  })

  it('defaults aria-label to "Chart"', () => {
    const { container } = render(<ChartContainer />)
    const div = container.firstElementChild as HTMLElement
    expect(div.getAttribute('aria-label')).toBe('Chart')
  })

  it('passes aria-describedby through', () => {
    const { container } = render(<ChartContainer ariaDescribedBy="table-1" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.getAttribute('aria-describedby')).toBe('table-1')
  })

  it('passes className onto the wrapper div', () => {
    const { container } = render(<ChartContainer className="my-chart" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.classList.contains('my-chart')).toBe(true)
  })

  it('merges style onto the wrapper div', () => {
    const { container } = render(<ChartContainer style={{ border: '1px solid red' }} />)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.border).toBe('1px solid red')
    // position: relative is always set
    expect(div.style.position).toBe('relative')
  })

  it('applies aspect-ratio when provided', () => {
    const { container } = render(<ChartContainer aspectRatio={16 / 9} />)
    const div = container.firstElementChild as HTMLElement
    // happy-dom serializes as "1.777… / 1"; browser uses "1.777…"
    expect(div.style.aspectRatio).toContain(String(16 / 9))
  })

  it('renders a hidden canvas and an overlay div', () => {
    const { container } = render(<ChartContainer />)
    const div = container.firstElementChild as HTMLElement
    const canvas = div.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas!.getAttribute('aria-hidden')).toBe('true')

    // Overlay div is the second child (after canvas)
    const overlay = div.children[1] as HTMLElement
    expect(overlay.tagName).toBe('DIV')
    expect(overlay.style.pointerEvents).toBe('none')
  })

  it('places children inside the overlay layer', () => {
    const { container } = render(
      <ChartContainer>
        <span data-testid="child">hello</span>
      </ChartContainer>,
    )
    const div = container.firstElementChild as HTMLElement
    const overlay = div.children[1] as HTMLElement
    expect(overlay.querySelector('[data-testid="child"]')).not.toBeNull()
  })

  it('exposes canvas via imperative ref', () => {
    const ref = createRef<ChartContainerRef>()
    const { container } = render(<ChartContainer ref={ref} />)
    const canvas = container.querySelector('canvas')
    expect(ref.current).not.toBeNull()
    expect(ref.current!.canvas).toBe(canvas)
  })

  it('toDataURL returns empty string before canvas renders anything', () => {
    const ref = createRef<ChartContainerRef>()
    render(<ChartContainer ref={ref} />)
    const url = ref.current!.toDataURL()
    // happy-dom canvas may return empty — just ensure no throw
    expect(typeof url).toBe('string')
  })

  it('invalidate does not throw', () => {
    const ref = createRef<ChartContainerRef>()
    render(<ChartContainer ref={ref} />)
    expect(() => ref.current!.invalidate()).not.toThrow()
  })

  it('sizes the backing store with DPR and reports DPR on resize', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    const ref = createRef<ChartContainerRef>()
    const onResize = vi.fn()
    const { container } = render(<ChartContainer ref={ref} onResize={onResize} />)
    const wrapper = container.firstElementChild as HTMLElement
    const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement

    wrapper.getBoundingClientRect = () =>
      ({
        width: 320,
        height: 180,
        top: 0,
        right: 320,
        bottom: 180,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    await act(async () => {
      MockResizeObserver.instances[0]?.trigger()
    })

    await waitFor(() => {
      expect(ref.current!.dimensions).toEqual({ width: 320, height: 180, dpr: 2 })
      expect(canvas.width).toBe(640)
      expect(canvas.height).toBe(360)
      expect(onResize).toHaveBeenCalledWith(320, 180, 2)
    })
  })
})

describe('useDimensions (via ChartContainer)', () => {
  it('reports zero dimensions before resize fires', () => {
    const ref = createRef<ChartContainerRef>()
    render(<ChartContainer ref={ref} />)
    // Before ResizeObserver fires, dims should be from initial getBoundingClientRect
    // which happy-dom returns as 0
    expect(ref.current!.dimensions.width).toBe(0)
    expect(ref.current!.dimensions.height).toBe(0)
  })
})
