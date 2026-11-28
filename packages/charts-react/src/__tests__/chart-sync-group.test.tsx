import { createChartLayout } from '@pitant/charts'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartSyncGroup, resolveSyncedCursor, useChartSync } from '../chart-sync-group.js'

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

function YRangeSpy({ chartKey }: { chartKey: string }) {
  const { canReceive, syncState, updateYRange } = useChartSync(chartKey)
  return (
    <>
      <span data-testid={chartKey}>
        {canReceive('yRange') ? JSON.stringify(syncState.yRange) : 'rejected'}
      </span>
      <button data-testid={`${chartKey} set`} type="button" onClick={() => updateYRange([8, 12])}>
        Set Y range
      </button>
    </>
  )
}

describe('ChartSyncGroup', () => {
  it('filters group publication and receiving charts independently', () => {
    render(
      <ChartSyncGroup
        sync={['yRange']}
        filters={{
          publish: (event) => event.source !== 'unauthorized',
          receive: (_, chartKey) => chartKey !== 'different-unit',
        }}
      >
        <YRangeSpy chartKey="source" />
        <YRangeSpy chartKey="same-unit" />
        <YRangeSpy chartKey="different-unit" />
        <YRangeSpy chartKey="unauthorized" />
      </ChartSyncGroup>,
    )
    fireEvent.click(screen.getByTestId('unauthorized set'))
    expect(screen.getByTestId('same-unit').textContent).toBe('rejected')
    fireEvent.click(screen.getByTestId('source set'))
    expect(screen.getByTestId('same-unit').textContent).toBe('[8,12]')
    expect(screen.getByTestId('source').textContent).toBe('rejected')
    expect(screen.getByTestId('different-unit').textContent).toBe('rejected')
  })

  it('maps relative cursor coordinates onto the receiving chart domains', () => {
    const layout = createChartLayout({ width: 200, height: 100, padding: 0 })
    const state = {
      cursorTimestamp: 500,
      cursorPosition: { xRatio: 0.25, yRatio: 0.75, y: 15 },
      xRange: null,
      source: 'leader',
    }
    const viewport = { layout, xRange: [0, 100] as const, yRange: [0, 20] as const, xOrigin: 700 }
    expect(resolveSyncedCursor(state, { x: 'relative', y: 'relative' }, viewport)).toEqual({
      timestamp: 725,
      x: 50,
      y: 75,
    })
    expect(resolveSyncedCursor(state, { x: 'value', y: 'value' }, viewport)).toEqual({
      timestamp: null,
      x: null,
      y: 25,
    })
  })

  it('maps the same synchronized ratios to a rotated receiving plot', () => {
    const layout = createChartLayout({
      width: 200,
      height: 100,
      padding: 0,
      orientation: 'rotated',
    })
    const state = {
      cursorTimestamp: 725,
      cursorPosition: { xRatio: 0.25, yRatio: 0.75, y: 15 },
      xRange: null,
      source: 'leader',
    }
    const viewport = { layout, xRange: [0, 100] as const, yRange: [0, 20] as const, xOrigin: 700 }
    expect(resolveSyncedCursor(state, { x: 'relative', y: 'relative' }, viewport)).toEqual({
      timestamp: 725,
      x: 50,
      y: 25,
    })
    expect(resolveSyncedCursor(state, { x: 'value', y: 'value' }, viewport)).toEqual({
      timestamp: 725,
      x: 150,
      y: 25,
    })
  })

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
