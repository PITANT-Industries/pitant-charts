import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartSyncGroup, useChartSync } from '../chart-sync-group.js'

afterEach(cleanup)

/** Test harness that exposes sync state + dispatch helpers via buttons & text. */
function ChartSpy({ chartKey }: { chartKey: string }) {
  const { syncState, updateCursor, updateXRange, isSynced } = useChartSync(chartKey)

  return (
    <div data-testid={chartKey}>
      <span data-testid={`${chartKey}-synced`}>{String(isSynced)}</span>
      <span data-testid={`${chartKey}-cursor`}>{String(syncState.cursorTimestamp)}</span>
      <span data-testid={`${chartKey}-xRange`}>{JSON.stringify(syncState.xRange)}</span>
      <span data-testid={`${chartKey}-source`}>{String(syncState.source)}</span>
      <button
        type="button"
        data-testid={`${chartKey}-setCursor`}
        onClick={() => updateCursor(1000)}
      >
        cursor
      </button>
      <button
        type="button"
        data-testid={`${chartKey}-clearCursor`}
        onClick={() => updateCursor(null)}
      >
        clear
      </button>
      <button
        type="button"
        data-testid={`${chartKey}-setRange`}
        onClick={() => updateXRange([100, 200])}
      >
        range
      </button>
      <button
        type="button"
        data-testid={`${chartKey}-clearRange`}
        onClick={() => updateXRange(null)}
      >
        clear range
      </button>
    </div>
  )
}

describe('ChartSyncGroup', () => {
  // ── Basic rendering ──────────────────────────────────────

  it('renders children', () => {
    render(
      <ChartSyncGroup>
        <span>hello</span>
      </ChartSyncGroup>,
    )
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('applies className to wrapper div', () => {
    const { container } = render(
      <ChartSyncGroup className="sync-wrap">
        <span>hi</span>
      </ChartSyncGroup>,
    )
    expect(container.querySelector('.sync-wrap')).not.toBeNull()
  })

  // ── isSynced ─────────────────────────────────────────────

  it('reports isSynced=true inside sync group', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
      </ChartSyncGroup>,
    )
    expect(screen.getByTestId('a-synced').textContent).toBe('true')
  })

  it('reports isSynced=false outside sync group', () => {
    render(<ChartSpy chartKey="a" />)
    expect(screen.getByTestId('a-synced').textContent).toBe('false')
  })

  // ── Cursor sync ──────────────────────────────────────────

  it('syncs cursor between two charts', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    // Initial state
    expect(screen.getByTestId('a-cursor').textContent).toBe('null')
    expect(screen.getByTestId('b-cursor').textContent).toBe('null')

    // Chart A sets cursor
    fireEvent.click(screen.getByTestId('a-setCursor'))

    // Both charts see the update
    expect(screen.getByTestId('a-cursor').textContent).toBe('1000')
    expect(screen.getByTestId('b-cursor').textContent).toBe('1000')
    expect(screen.getByTestId('a-source').textContent).toBe('a')
  })

  it('clears cursor when set to null', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setCursor'))
    expect(screen.getByTestId('b-cursor').textContent).toBe('1000')

    fireEvent.click(screen.getByTestId('a-clearCursor'))
    expect(screen.getByTestId('b-cursor').textContent).toBe('null')
  })

  // ── XRange sync ──────────────────────────────────────────

  it('syncs xRange between two charts', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setRange'))

    expect(screen.getByTestId('a-xRange').textContent).toBe('[100,200]')
    expect(screen.getByTestId('b-xRange').textContent).toBe('[100,200]')
  })

  it('clears xRange when set to null', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setRange'))
    expect(screen.getByTestId('b-xRange').textContent).toBe('[100,200]')

    fireEvent.click(screen.getByTestId('a-clearRange'))
    expect(screen.getByTestId('b-xRange').textContent).toBe('null')
  })

  // ── Echo suppression ─────────────────────────────────────

  it('sets source to dispatching chart key', () => {
    render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('b-setCursor'))
    expect(screen.getByTestId('a-source').textContent).toBe('b')
    expect(screen.getByTestId('b-source').textContent).toBe('b')
  })

  // ── Selective sync modes ─────────────────────────────────

  it('sync=["cursor"] blocks xRange updates', () => {
    render(
      <ChartSyncGroup sync={['cursor']}>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setRange'))
    // xRange should NOT update
    expect(screen.getByTestId('b-xRange').textContent).toBe('null')

    // cursor should still work
    fireEvent.click(screen.getByTestId('a-setCursor'))
    expect(screen.getByTestId('b-cursor').textContent).toBe('1000')
  })

  it('sync=["xRange"] blocks cursor updates', () => {
    render(
      <ChartSyncGroup sync={['xRange']}>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setCursor'))
    // cursor should NOT update
    expect(screen.getByTestId('b-cursor').textContent).toBe('null')

    // xRange should still work
    fireEvent.click(screen.getByTestId('a-setRange'))
    expect(screen.getByTestId('b-xRange').textContent).toBe('[100,200]')
  })

  it('sync=["zoom"] allows xRange updates', () => {
    render(
      <ChartSyncGroup sync={['zoom']}>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setRange'))
    expect(screen.getByTestId('b-xRange').textContent).toBe('[100,200]')
  })

  // ── Standalone (no sync group) ───────────────────────────

  it('returns default state when not inside sync group', () => {
    render(<ChartSpy chartKey="a" />)
    expect(screen.getByTestId('a-cursor').textContent).toBe('null')
    expect(screen.getByTestId('a-xRange').textContent).toBe('null')
    expect(screen.getByTestId('a-source').textContent).toBe('null')
  })

  it('updateCursor is a no-op outside sync group', () => {
    render(<ChartSpy chartKey="a" />)
    // Should not throw
    fireEvent.click(screen.getByTestId('a-setCursor'))
    expect(screen.getByTestId('a-cursor').textContent).toBe('null')
  })

  // ── Dynamic charts ───────────────────────────────────────

  it('newly mounted chart reads current sync state', () => {
    const { rerender } = render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setCursor'))

    // Add chart B
    rerender(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    expect(screen.getByTestId('b-cursor').textContent).toBe('1000')
  })

  it('removed chart does not affect remaining charts', () => {
    const { rerender } = render(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
        <ChartSpy chartKey="b" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('a-setCursor'))
    expect(screen.getByTestId('b-cursor').textContent).toBe('1000')

    // Remove chart B
    rerender(
      <ChartSyncGroup>
        <ChartSpy chartKey="a" />
      </ChartSyncGroup>,
    )
    // Chart A still has the state
    expect(screen.getByTestId('a-cursor').textContent).toBe('1000')
  })
})
