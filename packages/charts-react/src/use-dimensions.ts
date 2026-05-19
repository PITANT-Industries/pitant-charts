'use client'

import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface Dimensions {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

const ZERO: Dimensions = { width: 0, height: 0, dpr: 1 }

/**
 * Tracks the content-box size of an element via `ResizeObserver` and
 * reports the current `devicePixelRatio`.
 *
 * Returns `{ width: 0, height: 0, dpr: 1 }` until the element mounts.
 */
export function useDimensions(ref: RefObject<HTMLElement | null>): Dimensions {
  const [dims, setDims] = useState<Dimensions>(ZERO)
  const lastRef = useRef<string>('')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let media: MediaQueryList | null = null

    const update = () => {
      const rect = el.getBoundingClientRect()
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const key = `${rect.width}|${rect.height}|${dpr}`
      if (key !== lastRef.current) {
        lastRef.current = key
        setDims({ width: rect.width, height: rect.height, dpr })
      }
    }

    const observer = new ResizeObserver(() => {
      update()
    })

    observer.observe(el)
    update() // initial read

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', update)
      if (typeof window.matchMedia === 'function') {
        media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
        media.addEventListener?.('change', update)
      }
    }

    return () => {
      observer.disconnect()
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', update)
      }
      media?.removeEventListener?.('change', update)
    }
  }, [ref])

  return dims
}
