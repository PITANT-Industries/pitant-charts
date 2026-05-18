import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKENS, resolveTokens } from '../theming/resolve-tokens.js'
import type { ChartTokens } from '../theming/types.js'

describe('DEFAULT_TOKENS', () => {
  it('has 8 series colors', () => {
    expect(DEFAULT_TOKENS.seriesColors).toHaveLength(8)
  })

  it('all series colors are non-empty strings', () => {
    for (const c of DEFAULT_TOKENS.seriesColors) {
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })

  it('numeric tokens are finite numbers', () => {
    expect(Number.isFinite(DEFAULT_TOKENS.crosshairWidth)).toBe(true)
    expect(Number.isFinite(DEFAULT_TOKENS.axisWidth)).toBe(true)
    expect(Number.isFinite(DEFAULT_TOKENS.gridWidth)).toBe(true)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_TOKENS)).toBe(true)
  })
})

describe('resolveTokens', () => {
  it('returns defaults when no CSS vars are set', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const tokens = resolveTokens(el)

    expect(tokens.background).toBe(DEFAULT_TOKENS.background)
    expect(tokens.foreground).toBe(DEFAULT_TOKENS.foreground)
    expect(tokens.crosshairWidth).toBe(DEFAULT_TOKENS.crosshairWidth)
    expect(tokens.seriesColors).toHaveLength(8)

    document.body.removeChild(el)
  })

  it('reads CSS variables when set on the element', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    el.style.setProperty('--chart-background', 'red')
    el.style.setProperty('--chart-1', 'blue')
    el.style.setProperty('--chart-crosshair-width', '3px')

    const tokens = resolveTokens(el)

    expect(tokens.background).toBe('red')
    expect(tokens.seriesColors[0]).toBe('blue')
    expect(tokens.crosshairWidth).toBe(3)

    document.body.removeChild(el)
  })

  it('reads CSS variables set directly on the resolved element', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    el.style.setProperty('--chart-foreground', 'green')

    const tokens = resolveTokens(el)

    expect(tokens.foreground).toBe('green')

    document.body.removeChild(el)
  })

  it('returns a frozen object', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const tokens = resolveTokens(el)
    expect(Object.isFrozen(tokens)).toBe(true)

    document.body.removeChild(el)
  })

  it('falls back to default for invalid numeric values', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    el.style.setProperty('--chart-crosshair-width', 'invalid')

    const tokens = resolveTokens(el)
    expect(tokens.crosshairWidth).toBe(DEFAULT_TOKENS.crosshairWidth)

    document.body.removeChild(el)
  })

  it('resolves all string token keys', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const tokens = resolveTokens(el)
    const stringKeys: (keyof ChartTokens)[] = [
      'background',
      'foreground',
      'muted',
      'mutedForeground',
      'border',
      'crosshairColor',
      'selectionFill',
      'selectionStroke',
      'tooltipBackground',
      'tooltipForeground',
      'tooltipBorder',
      'tooltipRadius',
      'tooltipShadow',
      'axisColor',
      'gridColor',
      'gridDash',
      'fontFamily',
      'fontSizeSm',
      'fontSizeBase',
      'fontSizeLg',
      'padding',
      'gap',
      'legendGap',
    ]

    for (const key of stringKeys) {
      expect(typeof tokens[key]).toBe('string')
      expect((tokens[key] as string).length).toBeGreaterThan(0)
    }

    document.body.removeChild(el)
  })
})

describe('public API exports', () => {
  it('exports ChartTokens type, DEFAULT_TOKENS, and resolveTokens', async () => {
    const api = await import('../index.js')
    expect(api.DEFAULT_TOKENS).toBeDefined()
    expect(api.resolveTokens).toBeDefined()
    expect(typeof api.resolveTokens).toBe('function')
  })
})
