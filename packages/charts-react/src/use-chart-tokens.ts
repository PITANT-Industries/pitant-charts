'use client'

import type { ChartTokens } from '@pitant/charts'
import { DEFAULT_TOKENS, resolveTokens } from '@pitant/charts'
import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

/**
 * React hook that resolves the chart CSS-variable token set from a
 * container DOM element.
 *
 * Re-resolves automatically when an ancestor's `class` attribute
 * changes (e.g. `document.documentElement.classList.toggle('dark')`).
 *
 * Returns `DEFAULT_TOKENS` until the ref mounts or when running in SSR.
 */
export function useChartTokens(containerRef: RefObject<HTMLElement | null>): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(DEFAULT_TOKENS)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resolve = () => {
      setTokens(resolveTokens(el))
    }

    // Initial resolve
    resolve()

    // Re-resolve on ancestor class changes (theme switches)
    const observer = new MutationObserver(resolve)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Also observe the element itself in case a closer wrapper toggles theme
    if (el !== document.documentElement) {
      observer.observe(el, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  return tokens
}
