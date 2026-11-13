import { useSyncExternalStore } from 'react'

export interface ChartTheme {
  colors: string[]
  muted: string
  grid: string
  surface: string
  text: string
}

const fallback: ChartTheme = {
  colors: ['#6d4bef', '#a78bf8', '#4e90ed', '#20aeaa', '#eb8497', '#f3a33f', '#79a850', '#7d839b'],
  muted: '#69677a',
  grid: '#e9e8f0',
  surface: '#ffffff',
  text: '#211d35',
}

let snapshot = fallback

function subscribe(change: () => void) {
  const root = document.documentElement
  const observer = new MutationObserver(change)
  observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', change)
  window.addEventListener('chart-theme-change', change)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', change)
    window.removeEventListener('chart-theme-change', change)
  }
}

function getSnapshot() {
  if (typeof document === 'undefined') return fallback
  const styles = getComputedStyle(document.documentElement)
  const read = (token: string, defaultValue: string) => styles.getPropertyValue(token).trim() || defaultValue
  const next = {
    colors: fallback.colors.map((color, index) => read(`--chart-${index + 1}`, color)),
    muted: read('--muted-foreground', fallback.muted),
    grid: read('--border', fallback.grid),
    surface: read('--card', fallback.surface),
    text: read('--foreground', fallback.text),
  }
  if (JSON.stringify(snapshot) !== JSON.stringify(next)) snapshot = next
  return snapshot
}

export function useChartTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback)
}
