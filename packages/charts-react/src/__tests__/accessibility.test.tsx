import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AccessibleDataTable,
  Announcer,
  useKeyboardNavigation,
  useReducedMotion,
} from '../accessibility.js'

afterEach(cleanup)

// ── AccessibleDataTable ──────────────────────────────────────

describe('AccessibleDataTable', () => {
  const series = [
    {
      key: 'temp',
      label: 'Temperature',
      data: [
        { timestamp: 1000, value: 23.5 },
        { timestamp: 2000, value: 24.1 },
        { timestamp: 3000, value: null },
      ],
    },
    {
      key: 'humidity',
      label: 'Humidity',
      data: [
        { timestamp: 1000, value: 45 },
        { timestamp: 2000, value: 46 },
        { timestamp: 3000, value: 47 },
      ],
    },
  ]

  it('renders a table with caption', () => {
    render(<AccessibleDataTable label="Sensor Data" series={series} />)
    expect(screen.getByText('Sensor Data')).toBeTruthy()
  })

  it('renders column headers for time + each series', () => {
    render(<AccessibleDataTable label="Test" series={series} />)
    expect(screen.getByText('Time')).toBeTruthy()
    expect(screen.getByText('Temperature')).toBeTruthy()
    expect(screen.getByText('Humidity')).toBeTruthy()
  })

  it('renders all data rows', () => {
    render(<AccessibleDataTable label="Test" series={series} />)
    const rows = screen.getAllByRole('row')
    // 1 header + 3 data rows
    expect(rows).toHaveLength(4)
  })

  it('formats values with default formatter', () => {
    render(<AccessibleDataTable label="Test" series={series} />)
    expect(screen.getByText('23.50')).toBeTruthy()
    expect(screen.getByText('24.10')).toBeTruthy()
  })

  it('shows dash for null values', () => {
    render(<AccessibleDataTable label="Test" series={series} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('uses custom formatTimestamp', () => {
    render(<AccessibleDataTable label="Test" series={series} formatTimestamp={(ts) => `t=${ts}`} />)
    expect(screen.getByText('t=1000')).toBeTruthy()
    expect(screen.getByText('t=2000')).toBeTruthy()
  })

  it('uses custom formatValue', () => {
    render(
      <AccessibleDataTable
        label="Test"
        series={series}
        formatValue={(val) => (val !== null ? `${val}°` : 'N/A')}
      />,
    )
    expect(screen.getByText('23.5°')).toBeTruthy()
    expect(screen.getByText('N/A')).toBeTruthy()
  })

  it('samples rows when exceeding maxRows', () => {
    const bigSeries = [
      {
        key: 'a',
        label: 'A',
        data: Array.from({ length: 200 }, (_, i) => ({
          timestamp: i,
          value: i,
        })),
      },
    ]
    render(<AccessibleDataTable label="Big" series={bigSeries} maxRows={50} />)
    const rows = screen.getAllByRole('row')
    // 1 header + ≤50 data rows
    expect(rows.length).toBeLessThanOrEqual(51)
    expect(rows.length).toBeGreaterThan(1)
  })

  it('has sr-only styling (visually hidden)', () => {
    const { container } = render(<AccessibleDataTable label="Test" series={series} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.position).toBe('absolute')
    expect(wrapper.style.overflow).toBe('hidden')
  })

  it('applies className', () => {
    const { container } = render(
      <AccessibleDataTable label="Test" series={series} className="custom" />,
    )
    expect(container.querySelector('.custom')).not.toBeNull()
  })

  it('has aria-label on region', () => {
    render(<AccessibleDataTable label="Sensor Data" series={series} />)
    expect(screen.getByRole('region')).toBeTruthy()
    expect(screen.getByRole('region').getAttribute('aria-label')).toBe('Sensor Data data table')
  })

  it('handles empty series gracefully', () => {
    render(<AccessibleDataTable label="Empty" series={[]} />)
    const rows = screen.getAllByRole('row')
    // Just header
    expect(rows).toHaveLength(1)
  })
})

// ── useKeyboardNavigation ────────────────────────────────────

describe('useKeyboardNavigation', () => {
  function NavHarness({ totalPoints }: { totalPoints: number }) {
    const [index, setIndex] = useState(0)
    const [activateCount, setActivateCount] = useState(0)
    const { handleKeyDown } = useKeyboardNavigation({
      focusedIndex: index,
      totalPoints,
      onFocusChange: setIndex,
      onActivate: () => setActivateCount((c) => c + 1),
    })
    return (
      <div data-testid="nav" role="application" onKeyDown={handleKeyDown}>
        <span data-testid="index">{index}</span>
        <span data-testid="activated">{String(activateCount)}</span>
      </div>
    )
  }

  function getIndex() {
    return Number(screen.getByTestId('index').textContent)
  }

  function press(key: string) {
    fireEvent.keyDown(screen.getByTestId('nav'), { key })
  }

  it('ArrowRight increments index', () => {
    render(<NavHarness totalPoints={10} />)
    press('ArrowRight')
    expect(getIndex()).toBe(1)
  })

  it('ArrowDown increments index', () => {
    render(<NavHarness totalPoints={10} />)
    press('ArrowDown')
    expect(getIndex()).toBe(1)
  })

  it('ArrowLeft decrements but not below 0', () => {
    render(<NavHarness totalPoints={10} />)
    press('ArrowLeft')
    expect(getIndex()).toBe(0)
  })

  it('ArrowUp decrements but not below 0', () => {
    render(<NavHarness totalPoints={10} />)
    press('ArrowUp')
    expect(getIndex()).toBe(0)
  })

  it('End goes to last index', () => {
    render(<NavHarness totalPoints={10} />)
    press('End')
    expect(getIndex()).toBe(9)
  })

  it('Home goes to first index', () => {
    render(<NavHarness totalPoints={10} />)
    press('End')
    press('Home')
    expect(getIndex()).toBe(0)
  })

  it('PageDown jumps by 10', () => {
    render(<NavHarness totalPoints={100} />)
    press('PageDown')
    expect(getIndex()).toBe(10)
  })

  it('PageUp jumps back by 10', () => {
    render(<NavHarness totalPoints={100} />)
    press('End')
    press('PageUp')
    expect(getIndex()).toBe(89)
  })

  it('clamps at max', () => {
    render(<NavHarness totalPoints={5} />)
    press('End')
    press('ArrowRight')
    expect(getIndex()).toBe(4)
  })

  it('Enter activates', () => {
    render(<NavHarness totalPoints={10} />)
    press('Enter')
    expect(screen.getByTestId('activated').textContent).toBe('1')
  })

  it('Space activates', () => {
    render(<NavHarness totalPoints={10} />)
    press(' ')
    expect(screen.getByTestId('activated').textContent).toBe('1')
  })

  it('unrelated keys are ignored', () => {
    render(<NavHarness totalPoints={10} />)
    press('a')
    expect(getIndex()).toBe(0)
  })
})

// ── useReducedMotion ─────────────────────────────────────────

describe('useReducedMotion', () => {
  function MotionHarness() {
    const reduced = useReducedMotion()
    return <span data-testid="reduced">{String(reduced)}</span>
  }

  it('returns false by default (no preference)', () => {
    render(<MotionHarness />)
    // happy-dom matchMedia defaults to not matching
    expect(screen.getByTestId('reduced').textContent).toBe('false')
  })
})

// ── Announcer ────────────────────────────────────────────────

describe('Announcer', () => {
  it('renders message in aria-live region', () => {
    render(<Announcer message="Point 5: 23.5°C" />)
    const live = screen.getByText('Point 5: 23.5°C')
    expect(live.closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('is visually hidden', () => {
    const { container } = render(<Announcer message="test" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.position).toBe('absolute')
    expect(el.style.overflow).toBe('hidden')
  })

  it('updates message on re-render', () => {
    const { rerender } = render(<Announcer message="first" />)
    expect(screen.getByText('first')).toBeTruthy()
    rerender(<Announcer message="second" />)
    expect(screen.getByText('second')).toBeTruthy()
  })

  it('has aria-atomic=true', () => {
    render(<Announcer message="test" />)
    const el = screen.getByText('test').closest('[aria-atomic]')
    expect(el?.getAttribute('aria-atomic')).toBe('true')
  })
})
