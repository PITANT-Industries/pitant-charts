import type { ReactNode } from 'react'
import { DonutPlot } from '../charts/polarflow/DonutPlot'
import type { ChartCenterContext } from '../types'
import type { ChartFrameProps } from './ChartFrame'
import { ChartFrame } from './ChartFrame'

export interface DonutSlice {
  name: string
  /** A finite positive value. Zero and invalid values are omitted from the plot. */
  value: number
  color?: string
}

export interface DonutChartProps extends ChartFrameProps {
  data: readonly DonutSlice[]
  legend?: boolean
  totalLabel?: string
  renderCenter?: (context: ChartCenterContext) => ReactNode
}

export function DonutChart({
  data,
  label,
  height,
  className,
  legend,
  totalLabel,
  renderCenter,
}: DonutChartProps) {
  return (
    <ChartFrame label={label} height={height} className={className}>
      {data.some((slice) => Number.isFinite(slice.value) && slice.value > 0) ? (
        <DonutPlot
          label={label}
          rows={data}
          legend={legend}
          totalLabel={totalLabel}
          renderCenter={renderCenter}
        />
      ) : (
        <div className="cl-chart-empty">No data to display</div>
      )}
    </ChartFrame>
  )
}
