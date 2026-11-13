import { connect, dispose, init } from 'echarts'
import type { EChartsOption, EChartsType } from 'echarts'
import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { applyTooltipStyle } from './evil-tooltip'

export interface EChartProps {
  option: EChartsOption
  label: string
  compact?: boolean
  onEvents?: Record<string, ((event: any) => void) | undefined>
  group?: string
  chartRef?: RefObject<EChartsType | null>
  renderer?: 'canvas' | 'svg'
  onReady?: (instance: EChartsType) => void
}

export function EChart({ option, label, compact, onEvents, group, chartRef, renderer = 'svg', onReady }: EChartProps) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<EChartsType>(null)
  const props = useRef({ onReady, onEvents, option })
  const activePoint = useRef(-1)
  props.current = { onReady, onEvents, option }
  const events = Object.keys(onEvents ?? {}).filter((event) => onEvents?.[event]).sort().join(' ')

  useEffect(() => {
    const element = host.current
    if (!element) return
    const chart = init(element, undefined, { renderer })
    instance.current = chart
    if (chartRef) chartRef.current = chart
    if (group) {
      chart.group = group
      connect(group)
    }
    const subscriptions = events ? events.split(' ') : []
    for (const event of subscriptions) chart.on(event, (payload) => props.current.onEvents?.[event]?.(payload))
    chart.setOption(applyTooltipStyle(props.current.option))
    props.current.onReady?.(chart)
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (element.clientWidth > 0 && element.clientHeight > 0) chart.resize()
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      if (chartRef?.current === chart) chartRef.current = null
      instance.current = null
      dispose(chart)
    }
  }, [renderer, group, events, chartRef])

  useEffect(() => {
    instance.current?.setOption(applyTooltipStyle(option), { notMerge: true })
  }, [option])

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const chart = instance.current
    if (!chart || event.target !== event.currentTarget) return
    const series = Array.isArray(option.series) ? option.series[0] : option.series
    const seriesData = series && 'data' in series ? series.data : undefined
    if (!seriesData || !Array.isArray(seriesData) || !seriesData.length) return
    const index = Math.min(activePoint.current, seriesData.length - 1)
    const last = seriesData.length - 1
    const next = { ArrowLeft: index < 0 ? 0 : Math.max(0, index - 1), ArrowRight: Math.min(last, index + 1), Home: 0, End: last }[event.key]
    if (event.key === 'Escape') {
      chart.dispatchAction({ type: 'hideTip' })
      chart.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      activePoint.current = -1
    }
    if (next === undefined) return
    event.preventDefault()
    activePoint.current = next
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: next })
    chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: next })
  }

  return <div ref={host} className="chart-renderer" role="img" aria-roledescription="chart" aria-label={label} tabIndex={compact ? undefined : 0} onKeyDown={handleKey} />
}

export default EChart
