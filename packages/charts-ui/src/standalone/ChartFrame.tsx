import type { CSSProperties, ReactNode } from 'react'
import { ChartThemeContext, useChartHostTheme } from '../charts/theme'

export interface ChartFrameProps {
  /** Accessible description of the data shown by this chart. */
  label: string
  className?: string
  /** Any CSS length, or a height in pixels. */
  height?: number | string
}

export function ChartFrame({
  label,
  className,
  height,
  children,
}: ChartFrameProps & { children: ReactNode }) {
  const { host, theme } = useChartHostTheme()
  const style = {
    height,
    '--cl-ink': theme.text,
    '--cl-quiet': theme.muted,
    '--cl-surface': theme.surface,
    '--cl-focus': theme.ring,
  } as CSSProperties

  return (
    // biome-ignore lint/a11y/useSemanticElements: Charts group visual and interactive content, not form inputs.
    <div
      ref={host}
      className={['cl-chart', className].filter(Boolean).join(' ')}
      style={style}
      role="group"
      aria-label={label}
    >
      <ChartThemeContext.Provider value={theme}>{children}</ChartThemeContext.Provider>
    </div>
  )
}
