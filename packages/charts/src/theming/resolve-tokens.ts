import type { ChartTokens, TokenMapping } from './types.js'

// ── Token Mapping Table ───────────────────────────────────────────────
// Single source of truth: CSS variable name → ChartTokens key.

const SERIES_COUNT = 8

const STRING_TOKENS: readonly TokenMapping[] = [
  { cssVar: '--chart-background', key: 'background' },
  { cssVar: '--chart-foreground', key: 'foreground' },
  { cssVar: '--chart-muted', key: 'muted' },
  { cssVar: '--chart-muted-foreground', key: 'mutedForeground' },
  { cssVar: '--chart-border', key: 'border' },
  { cssVar: '--chart-crosshair', key: 'crosshairColor' },
  { cssVar: '--chart-selection-fill', key: 'selectionFill' },
  { cssVar: '--chart-selection-stroke', key: 'selectionStroke' },
  { cssVar: '--chart-tooltip-background', key: 'tooltipBackground' },
  { cssVar: '--chart-tooltip-foreground', key: 'tooltipForeground' },
  { cssVar: '--chart-tooltip-border', key: 'tooltipBorder' },
  { cssVar: '--chart-tooltip-radius', key: 'tooltipRadius' },
  { cssVar: '--chart-tooltip-shadow', key: 'tooltipShadow' },
  { cssVar: '--chart-axis-color', key: 'axisColor' },
  { cssVar: '--chart-grid-color', key: 'gridColor' },
  { cssVar: '--chart-grid-dash', key: 'gridDash' },
  { cssVar: '--chart-font-family', key: 'fontFamily' },
  { cssVar: '--chart-font-size-sm', key: 'fontSizeSm' },
  { cssVar: '--chart-font-size-base', key: 'fontSizeBase' },
  { cssVar: '--chart-font-size-lg', key: 'fontSizeLg' },
  { cssVar: '--chart-padding', key: 'padding' },
  { cssVar: '--chart-gap', key: 'gap' },
  { cssVar: '--chart-legend-gap', key: 'legendGap' },
]

const NUMERIC_TOKENS: readonly TokenMapping[] = [
  { cssVar: '--chart-crosshair-width', key: 'crosshairWidth', numeric: true },
  { cssVar: '--chart-axis-width', key: 'axisWidth', numeric: true },
  { cssVar: '--chart-grid-width', key: 'gridWidth', numeric: true },
]

// ── Default Tokens ────────────────────────────────────────────────────
// Fallback values used when CSS variables are not defined or
// no DOM element is available (e.g. SSR).

export const DEFAULT_TOKENS: Readonly<ChartTokens> = Object.freeze({
  seriesColors: [
    'hsl(220, 70%, 50%)',
    'hsl(160, 60%, 45%)',
    'hsl(30, 80%, 55%)',
    'hsl(280, 65%, 60%)',
    'hsl(340, 75%, 55%)',
    'hsl(200, 70%, 50%)',
    'hsl(100, 60%, 45%)',
    'hsl(50, 80%, 50%)',
  ],
  background: 'hsl(0, 0%, 100%)',
  foreground: 'hsl(222, 47%, 11%)',
  muted: 'hsl(210, 40%, 96%)',
  mutedForeground: 'hsl(215, 16%, 47%)',
  border: 'hsl(214, 32%, 91%)',
  crosshairColor: 'hsl(222, 47%, 11%)',
  crosshairWidth: 1,
  selectionFill: 'hsl(220, 70%, 50%, 0.1)',
  selectionStroke: 'hsl(220, 70%, 50%)',
  tooltipBackground: 'hsl(0, 0%, 100%)',
  tooltipForeground: 'hsl(222, 47%, 11%)',
  tooltipBorder: 'hsl(214, 32%, 91%)',
  tooltipRadius: '0.5rem',
  tooltipShadow: '0 2px 8px hsl(0, 0%, 0%, 0.08)',
  axisColor: 'hsl(215, 16%, 47%)',
  axisWidth: 1,
  gridColor: 'hsl(210, 40%, 96%)',
  gridWidth: 1,
  gridDash: '4 4',
  fontFamily: 'system-ui, sans-serif',
  fontSizeSm: '0.75rem',
  fontSizeBase: '0.875rem',
  fontSizeLg: '1rem',
  padding: '1rem',
  gap: '0.5rem',
  legendGap: '0.75rem',
})

// ── Resolver ──────────────────────────────────────────────────────────

/**
 * Resolve the complete set of chart tokens from the computed style
 * of a DOM element.  Returns a new frozen `ChartTokens` object.
 *
 * Pass the chart container element so that CSS cascade / specificity
 * is correctly respected.
 */
export function resolveTokens(el: Element): ChartTokens {
  const style = getComputedStyle(el)

  const read = (varName: string, fallback: string): string => {
    const v = style.getPropertyValue(varName).trim()
    return v || fallback
  }

  const readNum = (varName: string, fallback: number): number => {
    const v = style.getPropertyValue(varName).trim()
    if (!v) return fallback
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  // Series palette
  const seriesColors: string[] = []
  for (let i = 1; i <= SERIES_COUNT; i++) {
    seriesColors.push(read(`--chart-${i}`, DEFAULT_TOKENS.seriesColors[i - 1] ?? ''))
  }

  // String tokens
  const result: Record<string, unknown> = { seriesColors }
  for (const t of STRING_TOKENS) {
    result[t.key] = read(t.cssVar, DEFAULT_TOKENS[t.key] as string)
  }

  // Numeric tokens
  for (const t of NUMERIC_TOKENS) {
    result[t.key] = readNum(t.cssVar, DEFAULT_TOKENS[t.key] as number)
  }

  return Object.freeze(result as unknown as ChartTokens)
}
