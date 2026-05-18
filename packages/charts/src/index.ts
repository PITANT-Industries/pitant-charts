// @pitant/charts — WebGPU-first scientific charting library
// Core public API

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
