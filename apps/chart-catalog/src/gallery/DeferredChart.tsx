import { useEffect, useRef, useState } from 'react'

const chartVisibility = new WeakMap<Element, (visible: boolean) => void>()
let chartObserver: IntersectionObserver | undefined

export function useNearViewport<T extends HTMLElement>() {
  const host = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = host.current
    if (!element) return
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }
    const observer = chartObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) chartVisibility.get(entry.target)?.(entry.isIntersecting)
    }, { rootMargin: '220px' })
    chartVisibility.set(element, setVisible)
    observer.observe(element)
    return () => {
      observer.unobserve(element)
      chartVisibility.delete(element)
    }
  }, [])
  return [host, visible] as const
}
