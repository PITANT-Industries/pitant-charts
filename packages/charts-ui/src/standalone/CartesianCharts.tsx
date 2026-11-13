import {
  Bar,
  CartesianGrid,
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
}

export interface CartesianChartProps<Row> extends ChartFrameProps {
  data: readonly Row[]
  category: (row: Row) => string
  series: readonly CartesianSeries<Row>[]
  formatValue?: (value: number) => string
}

const linePatterns = [undefined, '6 3', '2 3', '8 3 2 3']

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
  formatValue = (value) => value.toLocaleString(),
  kind,
}: Omit<CartesianChartProps<Row>, keyof ChartFrameProps> & { kind: 'line' | 'bar' }) {
  const theme = useChartTheme()
  const rows = data.map((item) => ({
    category: category(item),
    values: series.map(({ value }) => {
      const point = value(item)
      return typeof point === 'number' && Number.isFinite(point) ? point : null
    }),
  }))
  const marks = series.map(({ name, color }, index) => ({
    name,
    color: color ?? theme.colors[index % theme.colors.length],
    dataKey: `values[${index}]`,
  }))

  if (!rows.some((row) => row.values.some((value) => value !== null))) {
    return <div className="cl-chart-empty">No data to display</div>
  }

  const props = {
    data: rows,
    accessibilityLayer: true,
    margin: { top: 12, right: 12, bottom: 0, left: 0 },
  }
  const axis = { tick: { fill: theme.muted, fontSize: 12 }, tickLine: false, axisLine: false }
  const grid = <CartesianGrid vertical={false} stroke={theme.grid} />
  const x = <XAxis {...axis} dataKey="category" tickMargin={8} minTickGap={24} />
  const y = <YAxis {...axis} width="auto" tickMargin={8} tickFormatter={formatValue} />
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
            <strong>{label}</strong>
            {payload.map(
              (item) =>
                typeof item.value === 'number' && (
                  <div className="cl-chart-tooltip-row" key={String(item.dataKey)}>
                    <i aria-hidden="true" style={{ background: item.color }} />
                    <span style={{ color: theme.muted }}>{item.name}</span>
                    <b>{formatValue(item.value)}</b>
                  </div>
                ),
            )}
          </div>
        )
      }
    />
  )

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      {kind === 'line' ? (
        <RechartsLineChart {...props}>
          {grid}
          {x}
          {y}
          {tip}
          {marks.map((mark, index) => (
            <Line
              key={mark.dataKey}
              name={mark.name}
              dataKey={mark.dataKey}
              type="linear"
              stroke={mark.color}
              strokeWidth={2}
              strokeDasharray={linePatterns[index % linePatterns.length]}
              isAnimationActive={false}
              dot={data.length <= 12 && { r: 2.5, fill: mark.color }}
            />
          ))}
        </RechartsLineChart>
      ) : (
        <RechartsBarChart {...props} barCategoryGap="22%">
          {grid}
          {x}
          {y}
          {tip}
          {marks.map((mark) => (
            <Bar
              key={mark.dataKey}
              name={mark.name}
              dataKey={mark.dataKey}
              fill={mark.color}
              radius={4}
              maxBarSize={64}
              isAnimationActive={false}
            />
          ))}
        </RechartsBarChart>
      )}
    </ResponsiveContainer>
  )
}
