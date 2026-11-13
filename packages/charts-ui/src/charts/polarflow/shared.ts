import type { ChartTheme } from '../theme'

export interface Metric {
  name: string
  value: number
  color?: string
}

export const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function sum(rows: readonly Metric[]) {
  return rows.reduce((total, row) => total + Math.max(0, row.value), 0)
}

export function percent(part: number, total: number) {
  return total > 0 ? (100 * part) / total : 0
}

export function tone(theme: ChartTheme, index: number, color?: string) {
  return color ?? theme.colors[index % theme.colors.length]
}

export function point(cx: number, cy: number, radius: number, angle: number) {
  const radians = (Math.PI * angle) / 180
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)] as const
}

export function nextChartFocus(key: string, current: number | null, count: number) {
  if (!count) return undefined
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowLeft' || key === 'ArrowUp')
    return current === null ? count - 1 : (current - 1 + count) % count
  if (key === 'ArrowRight' || key === 'ArrowDown')
    return current === null ? 0 : (current + 1) % count
}
