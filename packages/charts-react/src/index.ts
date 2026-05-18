// @pitant/charts-react — Public API
// React 19 bindings for @pitant/charts

// Accessibility
export type {
  AccessibleDataTableProps,
  AccessibleDataTableSeries,
  AnnouncerProps,
  KeyboardNavConfig,
} from './accessibility.js'
export {
  AccessibleDataTable,
  Announcer,
  useKeyboardNavigation,
  useReducedMotion,
} from './accessibility.js'

export type { ChartCanvasProps } from './chart-canvas.js'
export { ChartCanvas } from './chart-canvas.js'

// Container
export type { ChartContainerProps, ChartContainerRef } from './chart-container.js'
export { ChartContainer } from './chart-container.js'
// Legend
export type { ChartLegendItem, ChartLegendProps } from './chart-legend.js'
export { ChartLegend } from './chart-legend.js'
// Sync
export type {
  ChartSyncGroupProps,
  SyncMode,
  SyncState,
} from './chart-sync-group.js'
export { ChartSyncGroup, useChartSync } from './chart-sync-group.js'
// Tooltip
export type {
  ChartTooltipPayload,
  ChartTooltipProps,
  ChartTooltipSeries,
} from './chart-tooltip.js'
export { ChartTooltip } from './chart-tooltip.js'
// Chart hook
export type {
  AxisConfig,
  ChartConfig,
  ChartStats,
  ExportOptions,
  SeriesConfig,
  StreamingConfig,
  UseChartOptions,
  UseChartReturn,
} from './use-chart.js'
export { useChart } from './use-chart.js'
// Theming
export { useChartTokens } from './use-chart-tokens.js'
export type { Dimensions } from './use-dimensions.js'
export { useDimensions } from './use-dimensions.js'
