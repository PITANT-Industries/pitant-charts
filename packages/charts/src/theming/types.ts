/**
 * Resolved chart theme tokens.
 * Canvas/WebGPU renderers consume this typed object instead of reading
 * CSS variables directly.
 */
export interface ChartTokens {
  /** Series palette — up to 8 colours (CSS color strings) */
  readonly seriesColors: readonly string[]

  /* ── Surface ──────────────────────────────────────────── */
  readonly background: string
  readonly foreground: string
  readonly muted: string
  readonly mutedForeground: string
  readonly border: string

  /* ── Interaction ──────────────────────────────────────── */
  readonly crosshairColor: string
  readonly crosshairWidth: number
  readonly selectionFill: string
  readonly selectionStroke: string
  readonly tooltipBackground: string
  readonly tooltipForeground: string
  readonly tooltipBorder: string
  readonly tooltipRadius: string
  readonly tooltipShadow: string

  /* ── Axis / Grid ──────────────────────────────────────── */
  readonly axisColor: string
  readonly axisWidth: number
  readonly gridColor: string
  readonly gridWidth: number
  readonly gridDash: string

  /* ── Typography ───────────────────────────────────────── */
  readonly fontFamily: string
  readonly fontSizeSm: string
  readonly fontSizeBase: string
  readonly fontSizeLg: string

  /* ── Layout ───────────────────────────────────────────── */
  readonly padding: string
  readonly gap: string
  readonly legendGap: string
}

/** CSS variable name → ChartTokens key mapping entry. */
export interface TokenMapping {
  readonly cssVar: string
  readonly key: keyof ChartTokens
  /** When true the resolved value is parsed as a number (px). */
  readonly numeric?: boolean
}
