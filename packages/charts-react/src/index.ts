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
export type { ChartDisplayItemsOptions } from './chart-display-items.js'
export type {
  ChartCrosshairOptions,
  ChartRangeSelection,
  ChartRegionZoomLayerProps,
  ChartSelectionOptions,
} from './chart-interactions.js'
export { ChartRegionZoomLayer } from './chart-interactions.js'
// Legend
export type { ChartLegendItem, ChartLegendProps } from './chart-legend.js'
export { ChartLegend } from './chart-legend.js'
// Sync
export type {
  ChartSyncCursorMode,
  ChartSyncCursorOptions,
  ChartSyncCursorPosition,
  ChartSyncEvent,
  ChartSyncFilters,
  ChartSyncGroupProps,
  ChartSyncSeriesVisibilityEvent,
  SyncMode,
  SyncState,
} from './chart-sync-group.js'
export { ChartSyncGroup, useChartSync } from './chart-sync-group.js'
// Tooltip
export type {
  ChartTooltipLayout,
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
  SeriesHoverIndex,
  SeriesHoverIndexContext,
} from './chart-tooltip-data.js'
// Correlation matrix
export type {
  CorrelationColorStopConfig,
  CorrelationMatrixConfig,
  CorrelationMatrixData,
  CorrelationMatrixLabelConfig,
  CorrelationMatrixProps,
  CorrelationMatrixStats,
  UseCorrelationMatrixOptions,
  UseCorrelationMatrixReturn,
} from './correlation-matrix.js'
export { CorrelationMatrix, useCorrelationMatrix } from './correlation-matrix.js'
// Digital channel
export type {
  DigitalChannelColumnData,
  DigitalChannelConfig,
  DigitalChannelConfigSeries,
  DigitalChannelInteractionOptions,
  DigitalChannelProps,
  DigitalChannelStats,
  UseDigitalChannelOptions,
  UseDigitalChannelReturn,
} from './digital-channel.js'
export { DigitalChannel, useDigitalChannel } from './digital-channel.js'
// Distribution
export type {
  DistributionColumnData,
  DistributionConfig,
  DistributionMarkerConfig,
  DistributionProps,
  DistributionSeriesConfig,
  DistributionStats,
  UseDistributionOptions,
  UseDistributionReturn,
} from './distribution.js'
export { Distribution, useDistribution } from './distribution.js'
// KPI strip
export type {
  KpiSparklineConfig,
  KpiStripConfig,
  KpiStripData,
  KpiStripItemData,
  KpiStripProps,
  KpiStripStats,
  UseKpiStripOptions,
  UseKpiStripReturn,
} from './kpi-strip.js'
export { KpiStrip, useKpiStrip } from './kpi-strip.js'
// Scatter plot
export type {
  ScatterPlotColumnData,
  ScatterPlotConfig,
  ScatterPlotProps,
  ScatterPlotSeriesConfig,
  ScatterPlotStats,
  UseScatterPlotOptions,
  UseScatterPlotReturn,
} from './scatter-plot.js'
export { ScatterPlot, useScatterPlot } from './scatter-plot.js'
// Spectrogram and Heatmap
export type {
  HeatmapConfig,
  HeatmapProps,
  HeatmapStats,
  SpectrogramColorStopConfig,
  SpectrogramConfig,
  SpectrogramMatrixData,
  SpectrogramProps,
  SpectrogramStats,
  UseHeatmapOptions,
  UseHeatmapReturn,
  UseSpectrogramOptions,
  UseSpectrogramReturn,
} from './spectrogram.js'
export { Heatmap, Spectrogram, useHeatmap, useSpectrogram } from './spectrogram.js'
// Spectrum
export type {
  SpectrumColumnData,
  SpectrumConfig,
  SpectrumFrequencyBandConfig,
  SpectrumPeakMarkerConfig,
  SpectrumProps,
  SpectrumSeriesConfig,
  SpectrumStats,
  UseSpectrumOptions,
  UseSpectrumReturn,
} from './spectrum.js'
export { Spectrum, useSpectrum } from './spectrum.js'
// Time series
export type {
  TimeSeriesAnnotationConfig,
  TimeSeriesAnomalyTrackConfig,
  TimeSeriesBandConfig,
  TimeSeriesColumnData,
  TimeSeriesConfig,
  TimeSeriesDerivedSeriesConfig,
  TimeSeriesEnvelopeBandConfig,
  TimeSeriesEventMarkerConfig,
  TimeSeriesInteractionOptions,
  TimeSeriesProps,
  TimeSeriesRulerAnnotationConfig,
  TimeSeriesSeriesConfig,
  TimeSeriesSpcRuleMarkerConfig,
  TimeSeriesSpcTrackConfig,
  TimeSeriesStats,
  TimeSeriesValueBandConfig,
  TimeSeriesXLineAnnotationConfig,
  TimeSeriesXRangeAnnotationConfig,
  TimeSeriesYAxisConfig,
  TimeSeriesYLineAnnotationConfig,
  TimeSeriesYRangeAnnotationConfig,
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
