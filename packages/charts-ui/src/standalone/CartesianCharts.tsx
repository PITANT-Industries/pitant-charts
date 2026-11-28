import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartTheme } from '../charts/theme'
import type { ChartFrameProps } from './ChartFrame'
import { ChartFrame } from './ChartFrame'

export interface CartesianSeries<Row> {
  name: string
  value: (row: Row) => number | null | undefined
  /** CSS color, including a custom property reference. */
  color?: string
  yAxisKey?: string
  mark?: 'line' | 'bar' | 'area' | 'point'
  interpolation?: 'linear' | 'stepBefore' | 'stepAfter' | 'monotone'
  spanGaps?: boolean
  stack?: string
}

export interface CartesianValueAxis {
  key: string
  side?: 'left' | 'right'
  label?: string
  range?: readonly [number, number]
  scale?: 'linear' | 'log' | 'sqrt' | 'symlog'
  reverse?: boolean
  ticks?: readonly number[]
  formatValue?: (value: number) => string
}

export interface CartesianDomainAxis<Row> {
  /** Omit for category spacing. Supply numeric values or epoch milliseconds for a continuous axis. */
  value?: (row: Row) => number
  scale?: 'linear' | 'log' | 'time' | 'utc'
  range?: readonly [number, number]
  reverse?: boolean
  ticks?: readonly number[]
  timeZone?: string
  formatValue?: (value: number) => string
}

export interface CartesianChartProps<Row> extends ChartFrameProps {
  data: readonly Row[]
  category: (row: Row) => string
  series: readonly CartesianSeries<Row>[]
  formatValue?: (value: number) => string
  xAxis?: CartesianDomainAxis<Row>
  yAxes?: readonly CartesianValueAxis[]
  orientation?: 'horizontal' | 'vertical'
  stackOffset?: 'none' | 'sign' | 'expand'
}

const linePatterns = [undefined, '6 3', '2 3', '8 3 2 3']

function numberFormat(value: number): string {
  return value.toLocaleString()
}

export function LineChart<Row>(props: CartesianChartProps<Row>) {
  return <CartesianChart {...props} kind="line" />
}

export function BarChart<Row>(props: CartesianChartProps<Row>) {
  return <CartesianChart {...props} kind="bar" />
}

function CartesianChart<Row>({
  label,
  className,
  height,
  kind,
  ...plot
}: CartesianChartProps<Row> & { kind: 'line' | 'bar' }) {
  return (
    <ChartFrame label={label} className={className} height={height}>
      <CartesianPlot {...plot} kind={kind} />
    </ChartFrame>
  )
}

function CartesianPlot<Row>({
  data,
  category,
  series,
  formatValue = numberFormat,
  xAxis,
  yAxes,
  orientation = 'horizontal',
  stackOffset = 'none',
  kind,
}: Omit<CartesianChartProps<Row>, keyof ChartFrameProps> & { kind: 'line' | 'bar' }) {
  const theme = useChartTheme()
  const primary = yAxes?.[0]?.key ?? 0
  const axesByKey = new Map(yAxes?.map((axis) => [axis.key, axis]))
  const logarithmic = series.map(
    (item) => axesByKey.get(item.yAxisKey ?? String(primary))?.scale === 'log',
  )
  const rows = data.flatMap((item) => {
    const coordinate = xAxis?.value?.(item)
    if (
      xAxis?.value &&
      (!Number.isFinite(coordinate) || (xAxis.scale === 'log' && Number(coordinate) <= 0))
    ) {
      return []
    }
    return [
      {
        category: category(item),
        coordinate,
        values: series.map(({ value }, index) => {
          const point = value(item)
          return typeof point === 'number' &&
            Number.isFinite(point) &&
            (!logarithmic[index] || point > 0)
            ? point
            : null
        }),
      },
    ]
  })
  const marks = series.flatMap((item, index) => {
    if (item.yAxisKey !== undefined && !axesByKey.has(item.yAxisKey)) return []
    return [
      {
        ...item,
        index,
        color: item.color ?? theme.colors[index % theme.colors.length],
        axis: item.yAxisKey ?? primary,
        dataKey: `values[${index}]`,
        pattern: linePatterns[index % linePatterns.length],
      },
    ]
  })

  if (!rows.some((row) => marks.some((mark) => typeof row.values[mark.index] === 'number'))) {
    return <div className="cl-chart-empty">No data to display</div>
  }

  const props = {
    data: rows,
    layout: orientation,
    stackOffset,
    accessibilityLayer: true,
    margin: { top: 12, right: 12, bottom: 0, left: 0 },
  }
  const rotated = orientation === 'vertical'
  const axis = { tick: { fill: theme.muted, fontSize: 12 }, tickLine: false, axisLine: false }
  const grid = (
    <CartesianGrid
      vertical={rotated}
      horizontal={!rotated}
      stroke={theme.grid}
      xAxisId={rotated ? primary : 0}
      yAxisId={rotated ? 0 : primary}
    />
  )
  const dateFormat = xAxis?.timeZone
    ? new Intl.DateTimeFormat(undefined, {
        timeZone: xAxis.timeZone,
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : undefined
  const formatDomain = (value: number | string) =>
    typeof value === 'number'
      ? (xAxis?.formatValue?.(value) ?? dateFormat?.format(value) ?? String(value))
      : value
  const domainProps = {
    ...axis,
    dataKey: xAxis?.value ? 'coordinate' : 'category',
    type: xAxis?.value ? ('number' as const) : ('category' as const),
    reversed: xAxis?.reverse ?? false,
    ...(xAxis?.value
      ? {
          scale: xAxis.scale ?? (xAxis.timeZone ? 'utc' : 'linear'),
          domain: xAxis.range ? [xAxis.range[0], xAxis.range[1]] : ['dataMin', 'dataMax'],
          ...(xAxis.ticks ? { ticks: [...xAxis.ticks], interval: 0 } : {}),
          tickFormatter: formatDomain,
        }
      : {}),
  }
  const domain = rotated ? (
    <YAxis {...domainProps} width="auto" tickMargin={8} />
  ) : (
    <XAxis {...domainProps} tickMargin={8} minTickGap={24} />
  )
  const valueAxes = (yAxes?.length ? yAxes : [undefined]).map((item) => {
    const id = item?.key ?? 0
    const side = item?.side ?? (id === primary ? 'left' : 'right')
    const config = {
      ...axis,
      scale: item?.scale ?? ('linear' as const),
      reversed: item?.reverse ?? false,
      tickFormatter: item?.formatValue ?? formatValue,
      tickMargin: 8,
      ...(item?.ticks ? { ticks: [...item.ticks], interval: 0 } : {}),
      ...(item?.range
        ? { domain: [item.range[0], item.range[1]], allowDataOverflow: true }
        : item?.scale === 'log'
          ? { domain: ['dataMin', 'dataMax'] }
          : {}),
      ...(item?.label !== undefined ? { label: item.label } : {}),
    }
    return rotated ? (
      <XAxis
        key={id}
        {...config}
        xAxisId={id}
        type="number"
        orientation={side === 'left' ? 'bottom' : 'top'}
      />
    ) : (
      <YAxis key={id} {...config} yAxisId={id} width="auto" orientation={side} />
    )
  })
  const formatByDataKey = new Map(
    marks.map((mark) => [
      mark.dataKey,
      (typeof mark.axis === 'string' ? axesByKey.get(mark.axis)?.formatValue : undefined) ??
        formatValue,
    ]),
  )
  const tip = (
    <Tooltip
      cursor={kind === 'bar' ? { fill: theme.grid, opacity: 0.3 } : { stroke: theme.grid }}
      content={({ active, label, payload }) =>
        active &&
        payload.length > 0 && (
          <div
            className="cl-chart-tooltip"
            style={{
              background: theme.popover,
              color: theme.popoverText,
              borderColor: theme.tooltipBorder,
            }}
          >
            <strong>{typeof label === 'number' ? formatDomain(label) : label}</strong>
            {payload.map(
              (item) =>
                typeof item.value === 'number' && (
                  <div className="cl-chart-tooltip-row" key={String(item.dataKey)}>
                    <i aria-hidden="true" style={{ background: item.color }} />
                    <span style={{ color: theme.muted }}>{item.name}</span>
                    <b>{(formatByDataKey.get(String(item.dataKey)) ?? formatValue)(item.value)}</b>
                  </div>
                ),
            )}
          </div>
        )
      }
    />
  )
  const composed = marks.some((mark) => mark.mark !== undefined && mark.mark !== kind)
  const Plot = composed ? ComposedChart : kind === 'bar' ? RechartsBarChart : RechartsLineChart
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <Plot {...props} {...(kind === 'bar' || composed ? { barCategoryGap: '22%' } : {})}>
        {grid}
        {domain}
        {valueAxes}
        {tip}
        {marks.map((mark) => {
          const id = rotated ? { xAxisId: mark.axis } : { yAxisId: mark.axis }
          const markProps = {
            name: mark.name,
            dataKey: mark.dataKey,
            isAnimationActive: false,
            ...id,
          }
          const shape = mark.mark ?? kind
          if (shape === 'bar')
            return (
              <Bar
                key={mark.dataKey}
                {...markProps}
                fill={mark.color}
                stackId={mark.stack}
                radius={4}
                maxBarSize={64}
              />
            )
          if (shape === 'area')
            return (
              <Area
                key={mark.dataKey}
                {...markProps}
                fill={mark.color}
                fillOpacity={0.25}
                stroke={mark.color}
                stackId={mark.stack}
                type={mark.interpolation ?? 'linear'}
                connectNulls={mark.spanGaps}
              />
            )
          return (
            <Line
              key={mark.dataKey}
              {...markProps}
              type={mark.interpolation ?? 'linear'}
              stroke={shape === 'point' ? 'none' : mark.color}
              strokeWidth={2}
              strokeDasharray={mark.pattern}
              connectNulls={mark.spanGaps}
              dot={(shape === 'point' || data.length <= 12) && { r: 2.5, fill: mark.color }}
            />
          )
        })}
      </Plot>
    </ResponsiveContainer>
  )
}
