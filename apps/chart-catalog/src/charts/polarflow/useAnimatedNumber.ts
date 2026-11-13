import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(value: number, enabled: boolean) {
  const previous = useRef(value)
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previous.current = value
      setDisplay(value)
      return
    }
    const start = performance.now()
    const from = previous.current
    let frame = 0
    function update(time: number) {
      const elapsed = Math.min(1, Math.max(0, (time - start) / 240))
      const next = from + (value - from) * (1 - (1 - elapsed) ** 3)
      previous.current = next
      setDisplay(next)
      if (elapsed < 1) frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [value, enabled])
  return enabled ? display : value
}
