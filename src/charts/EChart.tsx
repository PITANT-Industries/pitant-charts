import { connect, disconnect, dispose, init } from 'echarts'
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

const groupUsers = new Map<string, number>()

function joinGroup(chart: EChartsType, group: string) {
  const count = groupUsers.get(group) ?? 0
  chart.group = group
  groupUsers.set(group, count + 1)
  if (!count) connect(group)
  return () => {
    const remaining = (groupUsers.get(group) ?? 1) - 1
    if (remaining) groupUsers.set(group, remaining)
    else {
      groupUsers.delete(group)
      disconnect(group)
    }
  }
}

function prepareOption(option: EChartsOption) {
  const prepared = applyTooltipStyle(option)
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? { ...prepared, animation: false } : prepared
}

export function EChart({ option, label, compact, onEvents, group, chartRef, renderer = 'svg', onReady }: EChartProps) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<EChartsType>(null)
  const props = useRef({ onReady, onEvents, option })
  const activePoint = useRef(-1)
  const applied = useRef<EChartsOption>(null)
  props.current = { onReady, onEvents, option }
  const events = Object.keys(onEvents ?? {}).filter((event) => onEvents?.[event]).sort().join(' ')

  useEffect(() => {
    const element = host.current
    if (!element) return
    const chart = init(element, undefined, { renderer })
    instance.current = chart
    if (chartRef) chartRef.current = chart
    const leaveGroup = group ? joinGroup(chart, group) : undefined
    const subscriptions = events ? events.split(' ') : []
    for (const event of subscriptions) chart.on(event, (payload) => props.current.onEvents?.[event]?.(payload))
    chart.setOption(prepareOption(props.current.option))
    applied.current = props.current.option
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
      applied.current = null
      dispose(chart)
      leaveGroup?.()
    }
  }, [renderer, group, events, chartRef])

  useEffect(() => {
    if (!instance.current || applied.current === option) return
    instance.current.setOption(prepareOption(option), { notMerge: true })
    applied.current = option
  }, [option])

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const chart = instance.current
    if (!chart || event.target !== event.currentTarget) return
    const series = Array.isArray(option.series) ? option.series[0] : option.series
    const seriesData = series && 'data' in series ? series.data : undefined
    if (!seriesData || !Array.isArray(seriesData) || !seriesData.length) return
    const index = Math.min(activePoint.current, seriesData.length - 1)
    const last = seriesData.length - 1
    const previous = index < 0 ? 0 : Math.max(0, index - 1)
    const following = Math.min(last, index + 1)
    const next = { ArrowLeft: previous, ArrowRight: following, ArrowUp: previous, ArrowDown: following, Home: 0, End: last }[event.key]
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
