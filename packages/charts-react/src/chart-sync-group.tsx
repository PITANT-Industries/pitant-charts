'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useState } from 'react'

// ── Public types ─────────────────────────────────────────────

export type SyncMode = 'cursor' | 'xRange' | 'zoom'

export interface SyncState {
  /** Cursor position in data-space (timestamp). */
  cursorTimestamp: number | null
  /** Visible X-axis range [start, end] in data-space. */
  xRange: [number, number] | null
  /** Source chart key (to avoid echo). */
  source: string | null
}

export interface ChartSyncGroupProps {
  /** Which behaviours to synchronize. @default ["cursor","xRange"] */
  sync?: SyncMode[]
  children: ReactNode
  className?: string
}

// ── Context ──────────────────────────────────────────────────

interface SyncContextValue {
  state: SyncState
  dispatch: (update: Partial<SyncState>) => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

// ── Default state ────────────────────────────────────────────

const DEFAULT_STATE: SyncState = {
  cursorTimestamp: null,
  xRange: null,
  source: null,
}

// ── Component ────────────────────────────────────────────────

export function ChartSyncGroup({
  sync = ['cursor', 'xRange'],
  children,
  className,
}: ChartSyncGroupProps) {
  const [state, setState] = useState<SyncState>(DEFAULT_STATE)

  const dispatch = useCallback(
    (update: Partial<SyncState>) => {
      setState((prev) => {
        const next = { ...prev, ...update }
        if (!sync.includes('cursor')) next.cursorTimestamp = prev.cursorTimestamp
        if (!sync.includes('xRange') && !sync.includes('zoom')) next.xRange = prev.xRange
        return next
      })
    },
    [sync],
  )

  return (
    <SyncContext.Provider value={{ state, dispatch }}>
      <div className={className}>{children}</div>
    </SyncContext.Provider>
  )
}

ChartSyncGroup.displayName = 'ChartSyncGroup'

// ── Hook ─────────────────────────────────────────────────────

/**
 * Hook for chart components to participate in sync.
 * @param chartKey — Unique identifier for this chart (to avoid self-echo).
 */
export function useChartSync(chartKey: string) {
  const ctx = useContext(SyncContext)

  const updateCursor = useCallback(
    (timestamp: number | null) => {
      ctx?.dispatch({ cursorTimestamp: timestamp, source: chartKey })
    },
    [ctx, chartKey],
  )

  const updateXRange = useCallback(
    (range: [number, number] | null) => {
      ctx?.dispatch({ xRange: range, source: chartKey })
    },
    [ctx, chartKey],
  )

  return {
    /** Current sync state (skip if source === chartKey to avoid echo). */
    syncState: ctx?.state ?? DEFAULT_STATE,
    /** Report cursor position to sync group. */
    updateCursor,
    /** Report X range change to sync group. */
    updateXRange,
    /** Whether this chart is inside a sync group. */
    isSynced: ctx !== null,
  }
}
