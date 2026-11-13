import { SunburstPlot } from '../charts/polarflow/SunburstPlot'
import type { SunburstNode } from '../charts/polarflow/upstream/sunburst-data'
import { sumValues } from '../charts/polarflow/upstream/sunburst-layout'
import type { ChartFrameProps } from './ChartFrame'
import { ChartFrame } from './ChartFrame'

export type { SunburstNode }

export interface SunburstChartProps extends ChartFrameProps {
  /** Root of the hierarchy. Branch values are sums of the positive leaf values. */
  data: SunburstNode
  legend?: boolean
}

export function SunburstChart({ data, label, height, className, legend }: SunburstChartProps) {
  return (
    <ChartFrame label={label} height={height} className={className}>
      {data.children?.length && sumValues(data) > 0 ? (
        <SunburstPlot label={label} root={data} legend={legend} />
      ) : (
        <div className="cl-chart-empty">No data to display</div>
      )}
    </ChartFrame>
  )
}
