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
export type { ChartDataZoomProps } from './chart-data-zoom.js'
export { ChartDataZoom } from './chart-data-zoom.js'
export type { ChartRegionZoomLayerProps } from './chart-interactions.js'
export { ChartRegionZoomLayer } from './chart-interactions.js'
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
  ChartTooltipProvenance,
  ChartTooltipSeries,
} from './chart-tooltip.js'
export { ChartTooltip } from './chart-tooltip.js'
export type {
  ColumnarTooltipProvenanceColumn,
  ColumnarTooltipProvenanceField,
  ColumnarTooltipProvenanceMap,
  ColumnarTooltipProvenanceValue,
} from './chart-tooltip-data.js'
// Digital channel
export type {
  DigitalChannelColumnData,
  DigitalChannelConfig,
  DigitalChannelConfigSeries,
  DigitalChannelProps,
  DigitalChannelStats,
  UseDigitalChannelOptions,
  UseDigitalChannelReturn,
} from './digital-channel.js'
export { DigitalChannel, useDigitalChannel } from './digital-channel.js'
// Time series
export type {
  TimeSeriesBandConfig,
  TimeSeriesColumnData,
  TimeSeriesConfig,
  TimeSeriesDerivedSeriesConfig,
  TimeSeriesEnvelopeBandConfig,
  TimeSeriesProps,
  TimeSeriesSeriesConfig,
  TimeSeriesStats,
  TimeSeriesValueBandConfig,
  UseTimeSeriesOptions,
  UseTimeSeriesReturn,
} from './time-series.js'
export { TimeSeries, useTimeSeries } from './time-series.js'
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
