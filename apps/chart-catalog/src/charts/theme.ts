import { createContext, useContext } from 'react'

export interface ChartTheme {
  colors: string[]
  muted: string
  grid: string
  surface: string
  text: string
  fontFamily: string
}

export const fallbackChartTheme: ChartTheme = {
  colors: ['#6d4bef', '#a78bf8', '#4e90ed', '#20aeaa', '#eb8497', '#f3a33f', '#79a850', '#7d839b'],
  muted: '#69677a',
  grid: '#e9e8f0',
  surface: '#ffffff',
  text: '#211d35',
  fontFamily: 'system-ui, sans-serif',
}

export const ChartThemeContext = createContext<ChartTheme>(fallbackChartTheme)

export function readChartTheme(element: HTMLElement): ChartTheme {
  const probe = document.createElement('span')
  probe.hidden = true
  element.append(probe)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  function color(token: string, fallback: string) {
    probe.style.color = `var(${token}, ${fallback})`
    const value = getComputedStyle(probe).color || fallback
    if (!context || /^rgba?\(/.test(value)) return value
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = fallback
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, opacity] = context.getImageData(0, 0, 1, 1).data
    return `rgba(${red}, ${green}, ${blue}, ${+(opacity / 255).toFixed(3)})`
  }
  try {
    const fallback = fallbackChartTheme
    return {
      colors: fallback.colors.map((value, index) => color(`--chart-${index + 1}`, value)),
      muted: color('--muted-foreground', fallback.muted),
      grid: color('--border', fallback.grid),
      surface: color('--card', fallback.surface),
      text: color('--foreground', fallback.text),
      fontFamily: getComputedStyle(element).fontFamily || fallback.fontFamily,
    }
  } finally {
    probe.remove()
  }
}

export function useChartTheme() {
  return useContext(ChartThemeContext)
}
