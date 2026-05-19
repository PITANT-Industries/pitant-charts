import { cleanup, render, screen } from '@testing-library/react'
import type { CSSProperties, ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ChartTooltipPayload } from '../chart-tooltip.js'
import { ChartTooltip } from '../chart-tooltip.js'

afterEach(cleanup)

const payload: ChartTooltipPayload = {
  timestamp: 1700000000000,
  label: '2023-11-14 12:00',
  series: [
    { key: 'cpu', label: 'CPU', color: 'hsl(220,70%,50%)', value: 72.3, formatted: '72.3%' },
    { key: 'mem', label: 'Memory', color: 'hsl(160,60%,45%)', value: 55.1, formatted: '55.1%' },
    { key: 'net', label: 'Network', color: 'hsl(30,80%,55%)', value: null, formatted: '—' },
  ],
}

const position = { x: 100, y: 80 }

/** Wrapper that acts as the positioned parent for tooltip positioning logic. */
function Wrapper({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 800,
        height: 400,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

describe('ChartTooltip', () => {
  // ── Visibility ──────────────────────────────────────────

  it('renders nothing when payload is null', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={null} position={position} />
      </Wrapper>,
    )
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('renders nothing when position is null', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={null} />
      </Wrapper>,
    )
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('renders tooltip when both payload and position are provided', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
  })

  // ── Accessibility ───────────────────────────────────────

  it('has role="tooltip"', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('has pointer-events: none', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    const el = screen.getByRole('tooltip') as HTMLElement
    expect(el.style.pointerEvents).toBe('none')
  })

  // ── Default content ─────────────────────────────────────

  it('shows timestamp label in header', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(screen.getByText('2023-11-14 12:00')).toBeTruthy()
  })

  it('shows series labels', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(screen.getByText('CPU')).toBeTruthy()
    expect(screen.getByText('Memory')).toBeTruthy()
    expect(screen.getByText('Network')).toBeTruthy()
  })

  it('shows formatted values for non-null series', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(screen.getByText('72.3%')).toBeTruthy()
    expect(screen.getByText('55.1%')).toBeTruthy()
  })

  it('shows em dash for null values', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    const tooltip = container.querySelector('[role="tooltip"]')!
    // The em dash character (U+2014)
    expect(tooltip.textContent).toContain('\u2014')
  })

  it('shows quality, gap, and provenance metadata when present', () => {
    const metadataPayload: ChartTooltipPayload = {
      ...payload,
      series: [
        {
          key: 'temp',
          label: 'Temperature',
          color: 'red',
          value: 12,
          formatted: '12 C',
          quality: 1,
          qualityLabel: 'uncertain',
          gap: true,
          provenance: { label: 'manual correction', source: 'audit-log' },
        },
      ],
    }

    render(
      <Wrapper>
        <ChartTooltip payload={metadataPayload} position={position} />
      </Wrapper>,
    )

    expect(screen.getByText('uncertain / gap / provenance: manual correction')).toBeTruthy()
  })

  it('renders series color swatches with aria-hidden', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    const swatches = container.querySelectorAll('[aria-hidden]')
    expect(swatches.length).toBe(3)
    const first = swatches[0] as HTMLElement
    expect(first.style.backgroundColor).toContain('hsl(220')
  })

  // ── Custom content ──────────────────────────────────────

  it('renders custom children instead of default content', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position}>
          {(p) => <span data-testid="custom">Custom: {p.label}</span>}
        </ChartTooltip>
      </Wrapper>,
    )
    expect(screen.getByTestId('custom').textContent).toBe('Custom: 2023-11-14 12:00')
    // Default content should not appear
    expect(screen.queryByText('CPU')).toBeNull()
  })

  // ── className passthrough ──────────────────────────────

  it('applies className to tooltip element', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} className="my-tip" />
      </Wrapper>,
    )
    const el = screen.getByRole('tooltip')
    expect(el.className).toBe('my-tip')
  })

  // ── CSS variable styling ───────────────────────────────

  it('uses CSS variables for background, border, font', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    const el = container.querySelector('[role="tooltip"]') as HTMLElement
    const html = el.outerHTML
    // happy-dom resolves some var() to fallback values; font-family and box-shadow are preserved
    expect(html).toContain('--chart-font-family')
    expect(html).toContain('--chart-tooltip-shadow')
  })

  // ── Positioning ─────────────────────────────────────────

  it('sets absolute position with left/top styles', () => {
    render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    const el = screen.getByRole('tooltip') as HTMLElement
    expect(el.style.position).toBe('absolute')
    // left and top should be set (exact values depend on adjustment)
    expect(el.style.left).toBeTruthy()
    expect(el.style.top).toBeTruthy()
  })

  // ── Payload updates ─────────────────────────────────────

  it('updates content when payload changes', () => {
    const { rerender } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(screen.getByText('2023-11-14 12:00')).toBeTruthy()

    const updated: ChartTooltipPayload = {
      timestamp: 1700100000000,
      label: '2023-11-15 04:00',
      series: [
        { key: 'cpu', label: 'CPU', color: 'hsl(220,70%,50%)', value: 90, formatted: '90%' },
      ],
    }
    rerender(
      <Wrapper>
        <ChartTooltip payload={updated} position={position} />
      </Wrapper>,
    )
    expect(screen.getByText('2023-11-15 04:00')).toBeTruthy()
    expect(screen.getByText('90%')).toBeTruthy()
  })

  it('hides tooltip when payload becomes null after being visible', () => {
    const { container, rerender } = render(
      <Wrapper>
        <ChartTooltip payload={payload} position={position} />
      </Wrapper>,
    )
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    rerender(
      <Wrapper>
        <ChartTooltip payload={null} position={position} />
      </Wrapper>,
    )
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })
})
