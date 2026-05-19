// @pitant/charts — WebGPU-first scientific charting library
// Core public API

export type {
  HistorianAdapterOptions,
  HistorianChartData,
  HistorianGapRow,
  HistorianObservationRow,
  HistorianQualityClass,
  HistorianQueryResponse,
  HistorianQueryRow,
  HistorianSeriesOption,
  HistorianTimeSeriesAdapterResult,
  HistorianTrendFixture,
} from './adapters/index.js'
export {
  HISTORIAN_QUALITY_CODE,
  historianQueryToTimeSeries,
  historianTrendFixtureToTimeSeries,
  normalizeQualityClass,
  qualityCodeForHistorianRow,
} from './adapters/index.js'
export type {
  AxisLayoutOptions,
  AxisTick,
  ChartClientPoint,
  ChartDataPoint,
  ChartGuideOptions,
  ChartLayout,
  ChartLayoutOptions,
  ChartPoint,
  ChartPointerCoordinates,
  ChartPointerMappingOptions,
  ChartPointerViewport,
  ChartRect,
  CommandFrameSvgInput,
  CommandFrameSvgOptions,
  DigitalChannelChartCreateOptions,
  DigitalChannelChartOptions,
  DigitalChannelCommandFrame,
  DigitalChannelDataSet,
  DigitalChannelFrameOptions,
  DigitalChannelPlannedSeries,
  DigitalChannelRenderOptions,
  DigitalChannelRenderPlan,
  DigitalChannelSegment,
  DigitalChannelSeries,
  EdgeInsets,
  GridLayoutOptions,
  LegendLayoutOptions,
  LegendPosition,
  MapChartPointToDataInput,
  MapDataPointToChartInput,
  MapPointerToChartCoordinatesInput,
  NearestTimestampResult,
  NumericRange,
  PanRangeByPixelsInput,
  RgbaColor,
  TimeSeriesBand,
  TimeSeriesBandSegment,
  TimeSeriesChartCreateOptions,
  TimeSeriesChartOptions,
  TimeSeriesCommandFrame,
  TimeSeriesDataSet,
  TimeSeriesEnvelopeBand,
  TimeSeriesFrameOptions,
  TimeSeriesInterpolation,
  TimeSeriesLineSegment,
  TimeSeriesPlannedBand,
  TimeSeriesPlannedSeries,
  TimeSeriesRenderOptions,
  TimeSeriesRenderPlan,
  TimeSeriesSeries,
  TimeSeriesValueBand,
  ZoomRangeAroundAnchorInput,
} from './charts/index.js'
export {
  addChartGuidesToCommandList,
  addDigitalChannelToCommandList,
  addTimeSeriesBandsToCommandList,
  addTimeSeriesToCommandList,
  buildDigitalChannelCommandFrame,
  buildDigitalChannelRenderPlan,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  clampRangeToBounds,
  clientPointToChartPoint,
  commandFrameToSvg,
  createChartLayout,
  createDigitalChannelViewTransform,
  createPlotViewportTransform,
  createTimeSeriesViewTransform,
  createViewportTransform,
  DEFAULT_CHART_COLORS,
  DigitalChannelChart,
  drawCommandList,
  findNearestTimestampIndex,
  mapChartPointToDataPoint,
  mapDataPointToChartPoint,
  mapPointerToChartCoordinates,
  panRangeByPixels,
  panRangeByValue,
  rangesEqual,
  renderDigitalChannelPlan,
  renderTimeSeriesPlan,
  resolveChartLayout,
  TimeSeriesChart,
  zoomRangeAroundAnchor,
  zoomRangeAroundCenter,
} from './charts/index.js'
export type {
  BinarySchema,
  ColumnarData,
  DataInput,
  ValidationIssue,
  ViewportQuery,
  ViewportResult,
} from './data-engine/columnar.js'
export { toBigIntTimestamps, toColumnar, validateColumnar } from './data-engine/columnar.js'
export { DataEngine } from './data-engine/data-engine.js'
export type { DataSourceOptions } from './data-engine/data-source.js'
// E3.2 — Columnar data model
export { DataSource } from './data-engine/data-source.js'
export type {
  IngestOptions,
  QueryResult,
  SeriesStats,
} from './data-engine/types.js'

export { createRenderContext } from './renderer/create-render-context.js'
export {
  type DrawCommand,
  RenderCommandList,
  ZLayer,
} from './renderer/render-command-list.js'
export type {
  FillOptions,
  LineOptions,
  RectOptions,
  RenderContext,
  RenderContextOptions,
  RendererCapabilities,
  RendererType,
  TextOptions,
} from './renderer/types.js'
export { ViewTransform } from './renderer/view-transform.js'
export { DEFAULT_TOKENS, resolveTokens } from './theming/resolve-tokens.js'
// Theming
export type { ChartTokens, TokenMapping } from './theming/types.js'
