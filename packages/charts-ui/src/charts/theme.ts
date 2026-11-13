import { createContext, useContext, useEffect, useRef, useState } from 'react'

export interface ChartTheme {
  colors: string[]
  muted: string
  grid: string
  tooltipBorder: string
  surface: string
  text: string
  popover: string
  popoverText: string
  ring: string
}

const day: ChartTheme = {
  colors: ['#4338ca', '#d15d16', '#178d89', '#751f2b', '#3c405e', '#416fac', '#4e5d25', '#8f4378'],
  muted: '#64748b',
  grid: '#e2e8f0',
  tooltipBorder: '#e2e8f0',
  surface: '#fff',
  text: '#020817',
  popover: '#fff',
  popoverText: '#020817',
  ring: '#4f46e5',
}

const night: ChartTheme = {
  colors: ['#a5b4fc', '#eab265', '#b7f8e3', '#e4506b', '#9f9eb1', '#368fef', '#cbde59', '#b26bb8'],
  muted: '#8b98a5',
  grid: '#1f2833',
  tooltipBorder: '#1f2833',
  surface: '#121821',
  text: '#e6edf3',
  popover: '#121821',
  popoverText: '#e6edf3',
  ring: '#8b9aff',
}

export const ChartThemeContext = createContext<ChartTheme>(day)

function readChartTheme(element: HTMLElement): ChartTheme {
  const scope = element.closest('.dark, [data-theme="dark"], [data-theme="light"]')
  const fallback = scope?.matches('.dark, [data-theme="dark"]') ? night : day
  const styles = getComputedStyle(element)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })

  function color(token: string, defaultColor: string) {
    const value = styles.getPropertyValue(token).trim()
    if (!value) return defaultColor
    const complete = CSS.supports('color', value) ? value : `hsl(${value})`
    if (!CSS.supports('color', complete)) return defaultColor
    if (!context) return complete
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = defaultColor
    context.fillStyle = complete
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, opacity] = context.getImageData(0, 0, 1, 1).data
    return `rgba(${red}, ${green}, ${blue}, ${+(opacity / 255).toFixed(3)})`
  }

  return {
    colors: fallback.colors.map((value, index) =>
      color(`--chart-${index + 1}`, index === 0 ? color('--link', value) : value),
    ),
    muted: color(
      '--chart-axis-color',
      color('--chart-muted-foreground', color('--muted-foreground', fallback.muted)),
    ),
    grid: color('--chart-grid-color', color('--chart-border', color('--border', fallback.grid))),
    tooltipBorder: color('--chart-tooltip-border', color('--border', fallback.tooltipBorder)),
    surface: color('--card', fallback.surface),
    text: color('--foreground', fallback.text),
    popover: color('--chart-tooltip-background', color('--popover', fallback.popover)),
    popoverText: color(
      '--chart-tooltip-foreground',
      color('--popover-foreground', fallback.popoverText),
    ),
    ring: color('--ring', fallback.ring),
  }
}

export function useChartHostTheme() {
  const host = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState(day)

  useEffect(() => {
    const element = host.current
    if (!element) return
    let frame = 0
    const read = () => {
      const next = readChartTheme(element)
      setTheme((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(read)
    }
    const observer = new MutationObserver(schedule)
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme'],
      })
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', schedule)
    window.addEventListener('chart-theme-change', schedule)
    read()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      media.removeEventListener('change', schedule)
      window.removeEventListener('chart-theme-change', schedule)
    }
  }, [])

  return { host, theme }
}

export function useChartTheme() {
  return useContext(ChartThemeContext)
}
