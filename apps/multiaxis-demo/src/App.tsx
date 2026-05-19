import { type CSSProperties, type PointerEvent, useMemo, useState } from 'react'

type AxisSide = 'left' | 'right'

type SeriesId = 'pressure' | 'torque' | 'temperature' | 'vibration' | 'cycleState' | 'lubrication'
type ViewMode = 'rows' | 'focus' | 'single' | 'normalized' | 'residual' | 'allAxes'
type ZoomLevel = 1 | 2 | 4
type OverlayId =
  | 'alarmBands'
  | 'anomalyBands'
  | 'rollingAverage'
  | 'eventMarkers'
  | 'statusPoints'
  | 'minorGrid'
  | 'legend'
  | 'dataTip'
type OverlayPresetId = 'monitor' | 'review' | 'full'
type SignalStatus = 'normal' | 'warning' | 'anomaly' | 'alarm'
type AbnormalStatus = Extract<SignalStatus, 'anomaly' | 'alarm'>
type EventSeverity = 'info' | 'maintenance' | 'quality' | 'alarm'

interface Sample {
  cycle: number
  time: number
  pressure: number
  torque: number
  temperature: number
  vibration: number
  cycleState: number
  lubrication: number
}

interface SeriesConfig {
  id: SeriesId
  label: string
  shortLabel: string
  unit: string
  color: string
  domain: readonly [number, number]
  side: AxisSide
  axisIndex: number
  decimals: number
  ticks: readonly number[]
  thresholds?: ThresholdConfig
  format?: (value: number) => string
  stepped?: boolean
}

interface ThresholdConfig {
  warning: readonly [low: number, high: number]
  alarm: readonly [low: number, high: number]
  anomaly: readonly [low: number, high: number]
  target?: number
}

interface Segment {
  startCycle: number
  endCycle: number
  state: number
}

interface AbnormalRegion {
  startCycle: number
  endCycle: number
  status: AbnormalStatus
}

interface PlotArea {
  left: number
  right: number
  top: number
  bottom: number
}

interface ViewModeConfig {
  id: ViewMode
  label: string
  eyebrow: string
  title: string
  useWhen: string
  avoidWhen: string
}

interface EventMarker {
  cycle: number
  label: string
  severity: EventSeverity
}

interface OverlayPreset {
  id: OverlayPresetId
  label: string
  overlays: Record<OverlayId, boolean>
}

interface AnalyticsSummary {
  min: number
  max: number
  mean: number
  sampleCount: number
  warningCount: number
  anomalyCount: number
  alarmCount: number
}

interface ForecastPoint {
  cycle: number
  expected: number
  low: number
  high: number
}

interface ForecastInsight {
  points: readonly ForecastPoint[]
  slope: number
  spread: number
  crossingLabel: string
}

interface RulItem {
  series: SeriesConfig
  cycles: number | undefined
  status: SignalStatus
}

interface ResidualInsight {
  values: readonly number[]
  selectedResidual: number
  maxAbs: number
  rms: number
}

interface AnomalyContributor {
  series: SeriesConfig
  value: number
  status: SignalStatus
  residual: number
  score: number
}

interface AnomalyInsight {
  confidence: number
  contributors: readonly AnomalyContributor[]
}

interface CorrelationInsight {
  series: SeriesConfig
  correlation: number
  lag: number
}

interface PhaseStat {
  state: number
  label: string
  color: string
  min: number
  max: number
  average: number
  width: number
}

interface SpcInsight {
  mean: number
  sigma: number
  ucl: number
  lcl: number
  selectedZ: number
  violations: number
  values: readonly number[]
}

interface SpectrumBin {
  bin: number
  label: string
  magnitude: number
  width: number
}

interface EventImpact {
  event: EventMarker
  before: number
  after: number
  delta: number
  width: number
  status: SignalStatus
}

interface DataQualityInsight {
  completeness: number
  gapCount: number
  heldCount: number
  spikeCount: number
  noiseRms: number
}

interface RateChangeInsight {
  rates: readonly number[]
  currentRate: number
  maxRise: number
  maxFall: number
}

interface DistributionBin {
  label: string
  count: number
  width: number
}

interface DistributionInsight {
  bins: readonly DistributionBin[]
  mean: number
  p05: number
  p50: number
  p95: number
}

interface AutocorrelationPoint {
  lag: number
  correlation: number
  width: number
}

interface EnvelopePoint {
  phase: number
  low: number
  median: number
  high: number
}

interface CycleRepeatability {
  label: string
  peak: number
  rms: number
  deviation: number
  width: number
}

interface AlarmWindow {
  label: string
  warning: number
  anomaly: number
  alarm: number
  total: number
}

interface DriftItem {
  series: SeriesConfig
  slope: number
  width: number
  status: SignalStatus
}

interface FeatureInsight {
  rms: number
  crestFactor: number
  p95: number
  timeAboveWarning: number
  area: number
}

interface HealthContribution {
  series: SeriesConfig
  risk: number
  status: SignalStatus
  width: number
}

interface HealthInsight {
  score: number
  status: SignalStatus
  contributions: readonly HealthContribution[]
}

interface ChangePoint {
  cycle: number
  magnitude: number
  direction: 'rise' | 'fall'
  status: SignalStatus
  width: number
}

interface LeadLagPair {
  source: SeriesConfig
  target: SeriesConfig
  lag: number
  correlation: number
  width: number
}

interface ForecastBacktestInsight {
  errors: readonly number[]
  mae: number
  rmse: number
  maxError: number
}

interface ThresholdSensitivityItem {
  series: SeriesConfig
  warningMargin: number
  alarmMargin: number
  status: SignalStatus
  width: number
}

interface AlarmParetoItem {
  series: SeriesConfig
  weightedCount: number
  status: SignalStatus
  width: number
}

interface StateOccupancy {
  label: string
  color: string
  samples: number
  risk: number
  width: number
}

interface MaintenanceAction {
  label: string
  driver: string
  priority: number
  status: SignalStatus
  width: number
}

interface UncertaintyInsight {
  measurement: number
  process: number
  model: number
  combined: number
  coverage: number
}

interface CapabilityInsight {
  cp: number
  cpk: number
  mean: number
  sigma: number
  status: SignalStatus
}

interface RunRuleItem {
  label: string
  count: number
  status: SignalStatus
  width: number
}

interface HysteresisPoint {
  x: number
  y: number
}

interface HysteresisInsight {
  xSeries: SeriesConfig
  ySeries: SeriesConfig
  points: readonly HysteresisPoint[]
  loopArea: number
  closureError: number
}

interface CrossSpectrumBin {
  label: string
  value: number
  width: number
}

interface CrossSpectrumInsight {
  pairLabel: string
  peakLabel: string
  bins: readonly CrossSpectrumBin[]
}

interface EnergyBand {
  label: string
  value: number
  width: number
  color: string
}

interface CycleClusterItem {
  label: string
  cluster: string
  distance: number
  status: SignalStatus
  width: number
}

interface TwinResidualInsight {
  driver: SeriesConfig
  residuals: readonly number[]
  currentResidual: number
  rms: number
}

interface ChatterItem {
  series: SeriesConfig
  transitions: number
  shortestDwell: number
  status: SignalStatus
  width: number
}

interface ScenarioForecastItem {
  label: string
  value: number
  delta: number
  status: SignalStatus
  width: number
}

interface EwmaInsight {
  values: readonly number[]
  current: number
  ucl: number
  lcl: number
  violations: number
}

interface CusumInsight {
  positive: readonly number[]
  negative: readonly number[]
  maxPositive: number
  maxNegative: number
  status: SignalStatus
}

interface KalmanInsight {
  estimates: readonly number[]
  residuals: readonly number[]
  currentEstimate: number
  currentResidual: number
  gain: number
}

interface DecompositionInsight {
  trend: readonly number[]
  residual: readonly number[]
  bands: readonly EnergyBand[]
}

interface StationarityInsight {
  meanShift: number
  varianceRatio: number
  status: SignalStatus
  width: number
}

interface SpectralEntropyInsight {
  entropy: number
  status: SignalStatus
  bins: readonly SpectrumBin[]
}

interface PcaContribution {
  series: SeriesConfig
  loading: number
  contribution: number
  width: number
}

interface PcaInsight {
  variance: number
  contributions: readonly PcaContribution[]
}

interface MahalanobisInsight {
  distances: readonly number[]
  current: number
  threshold: number
  status: SignalStatus
}

interface RecurrenceInsight {
  rate: number
  determinism: number
  points: readonly HysteresisPoint[]
}

interface MatrixProfileInsight {
  profile: readonly number[]
  windowSize: number
  motifStart: number
  motifMatch: number
  discordStart: number
  motifDistance: number
  discordDistance: number
}

interface DtwCycleItem {
  label: string
  distance: number
  status: SignalStatus
  width: number
}

interface LagCausalityItem {
  source: SeriesConfig
  target: SeriesConfig
  lag: number
  score: number
  status: SignalStatus
  width: number
}

interface BayesianAlarmInsight {
  probability: number
  status: SignalStatus
  evidence: readonly HealthContribution[]
}

interface HazardPoint {
  label: string
  probability: number
  status: SignalStatus
  width: number
}

interface FusionConsistencyInsight {
  pairLabel: string
  residuals: readonly number[]
  current: number
  rms: number
  status: SignalStatus
}

interface CalibrationOffsetItem {
  series: SeriesConfig
  offset: number
  status: SignalStatus
  width: number
}

interface HeatmapCell {
  row: number
  column: number
  value: number
  width: number
}

interface SpectrogramInsight {
  rows: readonly string[]
  columns: readonly string[]
  cells: readonly HeatmapCell[]
  peakLabel: string
  peakMagnitude: number
}

interface RollingCorrelationRow {
  series: SeriesConfig
  values: readonly number[]
}

interface RollingCorrelationInsight {
  rows: readonly RollingCorrelationRow[]
  columns: readonly string[]
  strongestLabel: string
}

interface ResidualQqInsight {
  points: readonly HysteresisPoint[]
  deviation: number
  status: SignalStatus
}

interface WhitenessInsight {
  qStatistic: number
  threshold: number
  status: SignalStatus
  lags: readonly AutocorrelationPoint[]
}

interface PredictionCoverageInsight {
  coverage: number
  misses: number
  meanWidth: number
  status: SignalStatus
  errors: readonly number[]
}

interface ReliabilityBand {
  label: string
  expected: number
  observed: number
  status: SignalStatus
  width: number
}

interface TransferGainItem {
  source: SeriesConfig
  lag: number
  gain: number
  correlation: number
  status: SignalStatus
  width: number
}

interface StateTransitionItem {
  from: string
  to: string
  probability: number
  count: number
  status: SignalStatus
  width: number
}

interface EarlyWarningLeadItem {
  series: SeriesConfig
  leadCycles: number | undefined
  status: SignalStatus
  width: number
}

interface FatigueDamageBin {
  label: string
  count: number
  damage: number
  status: SignalStatus
  width: number
}

interface DamageAccumulationInsight {
  values: readonly number[]
  current: number
  projected: number
  status: SignalStatus
}

interface RegimeProbabilityItem {
  label: string
  probability: number
  status: SignalStatus
  width: number
  color: string
}

interface AnomalyScoreInsight {
  scores: readonly number[]
  current: number
  p95: number
  status: SignalStatus
}

interface SensorVoteItem {
  label: SignalStatus
  count: number
  width: number
}

interface SensorVoteInsight {
  agreement: number
  status: SignalStatus
  votes: readonly SensorVoteItem[]
}

interface MaintenanceWindowItem {
  label: string
  score: number
  risk: number
  status: SignalStatus
  width: number
}

interface MaintenanceDecisionInsight {
  label: string
  description: string
  status: SignalStatus
  width: number
}

interface PhaseComparisonInsight {
  label: string
  average: number
  delta: number
  status: SignalStatus
  width: number
}

interface PredictiveMaintenanceInsight {
  values: readonly number[]
  lowValues: readonly number[]
  highValues: readonly number[]
  selectedRisk: number
  riskUncertainty: number
  horizonRisk: number
  modelConfidence: number
  assetHealth: number
  assetHealthValues: readonly number[]
  runCostIndex: number
  plannedCostIndex: number
  status: SignalStatus
  soonestRul: RulItem | undefined
  bestWindow: MaintenanceWindowItem | undefined
  action: MaintenanceAction | undefined
  decision: MaintenanceDecisionInsight
  faultModes: readonly FaultSignatureItem[]
  lead: EarlyWarningLeadItem | undefined
  whatIf: CounterfactualSensitivityItem | undefined
  phaseComparison: PhaseComparisonInsight
}

interface MatrixHeatmapInsight {
  rows: readonly string[]
  columns: readonly string[]
  cells: readonly HeatmapCell[]
  peakLabel: string
  peakValue: number
}

interface FaultSignatureItem {
  label: string
  probability: number
  status: SignalStatus
  width: number
  color: string
}

interface RootCauseItem {
  series: SeriesConfig
  contribution: number
  direction: 'high' | 'low'
  status: SignalStatus
  width: number
}

interface InterventionItem {
  label: string
  driver: string
  reduction: number
  status: SignalStatus
  width: number
}

interface ThresholdSweepItem {
  label: string
  truePositiveRate: number
  falsePositiveRate: number
  status: SignalStatus
  width: number
}

interface ConfusionMatrixInsight {
  rows: readonly string[]
  columns: readonly string[]
  cells: readonly HeatmapCell[]
  accuracy: number
}

interface DwellTimeItem {
  label: string
  p50: number
  p95: number
  status: SignalStatus
  width: number
  color: string
}

interface CounterfactualSensitivityItem {
  series: SeriesConfig
  deltaRisk: number
  status: SignalStatus
  width: number
}

interface ImputationItem {
  series: SeriesConfig
  gapCount: number
  heldCount: number
  imputedCount: number
  status: SignalStatus
  width: number
}

interface SensorSaturationItem {
  series: SeriesConfig
  lowCount: number
  highCount: number
  percent: number
  status: SignalStatus
  width: number
}

interface LatencyInsight {
  values: readonly number[]
  current: number
  p95: number
  status: SignalStatus
}

interface AlarmSuppressionItem {
  series: SeriesConfig
  rawCount: number
  suppressedCount: number
  status: SignalStatus
  width: number
}

interface AlarmFloodWindow {
  label: string
  count: number
  status: SignalStatus
  width: number
}

interface FeatureStabilityItem {
  label: string
  drift: number
  status: SignalStatus
  width: number
}

interface ResidualRegimeItem {
  label: string
  rms: number
  status: SignalStatus
  width: number
  color: string
}

interface SlaComplianceItem {
  label: string
  compliance: number
  status: SignalStatus
  width: number
}

interface DataFreshnessInsight {
  values: readonly number[]
  currentAge: number
  p95Age: number
  status: SignalStatus
}

const VIEWBOX_WIDTH = 1200
const VIEWBOX_HEIGHT = 680
const ROW_VIEWBOX_HEIGHT = 620
const ANALYSIS_VIEWBOX_HEIGHT = 930
const PLOT = {
  left: 220,
  right: 1000,
  top: 72,
  bottom: 570,
} as const
const ROW_HEIGHT = 78
const ROW_STEP = ROW_HEIGHT
const ROW_TOP = 74
const ANALYSIS_TOP = 96
const ANALYSIS_LANE_HEIGHT = 54
const ANALYSIS_LANE_STEP = 70
const ANALYSIS_RAIL_X = 900

const STAGE_LABELS = ['Idle', 'Clamp', 'Press', 'Dwell', 'Return', 'Lube'] as const
const STAGE_COLORS = ['#8b95a5', '#2563eb', '#dc2626', '#7c3aed', '#16a34a', '#0891b2'] as const
const GRID_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const
const MINOR_GRID_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const
const NORMALIZED_TICKS = [0, 25, 50, 75, 100] as const
const ROLLING_WINDOW = 9
const ZOOM_LEVELS: readonly ZoomLevel[] = [1, 2, 4]
const ZOOM_WINDOW_BY_LEVEL: Record<ZoomLevel, number> = {
  1: 120,
  2: 60,
  4: 30,
}
const SHOW_SEPARATE_ANALYTICS_WORKBENCH = false
const VIEW_MODES: readonly ViewModeConfig[] = [
  {
    id: 'rows',
    label: 'Rows',
    eyebrow: 'Operator view',
    title: 'Separate rows, shared cycle timeline',
    useWhen:
      'Use for daily monitoring, handoff reviews, and any case where operators need real units without axis clutter.',
    avoidWhen:
      'Do not use when the main question is whether two signals have the same shape at the same moment.',
  },
  {
    id: 'focus',
    label: 'Focus axis',
    eyebrow: 'Analysis view',
    title: 'One active y-axis, all visible signals overlaid',
    useWhen: 'Use when one signal is primary and the rest are context around it.',
    avoidWhen:
      'Do not use for exact comparison between non-active signals because their axes are hidden.',
  },
  {
    id: 'single',
    label: 'Single tag',
    eyebrow: 'Tag view',
    title: 'One selected signal with no background traces',
    useWhen:
      'Use when you need to inspect one sensor precisely without visual interference from other tags.',
    avoidWhen:
      'Do not use when relationships, lag, or cause-effect between multiple signals are the question.',
  },
  {
    id: 'normalized',
    label: 'Normalized',
    eyebrow: 'Correlation view',
    title: 'All visible signals scaled to 0-100%',
    useWhen: 'Use to compare timing, shape, lag, spikes, and correlation across different units.',
    avoidWhen: 'Do not use when absolute values or alarm thresholds in real units matter.',
  },
  {
    id: 'residual',
    label: 'Residual',
    eyebrow: 'Fault isolation',
    title: 'Active signal deviation from rolling baseline',
    useWhen:
      'Use to see drift, sudden departures, and repeatable faults that are hidden in the raw trend.',
    avoidWhen:
      'Do not use when the operator needs the actual process value instead of deviation from baseline.',
  },
  {
    id: 'allAxes',
    label: 'All axes',
    eyebrow: 'Expert view',
    title: 'Every selected metric keeps a visible y-axis',
    useWhen:
      'Use for debugging scale mapping or for expert users who need every axis visible at once.',
    avoidWhen:
      'Do not use as the default operator view; it becomes noisy as soon as many signals are enabled.',
  },
] as const

const EVENTS: readonly EventMarker[] = [
  { cycle: 18, label: 'Recipe load', severity: 'info' },
  { cycle: 34, label: 'Pressure spike', severity: 'alarm' },
  { cycle: 52, label: 'Tool change', severity: 'maintenance' },
  { cycle: 88, label: 'Vibration spike', severity: 'alarm' },
  { cycle: 103, label: 'Lube drop', severity: 'quality' },
] as const

const DEFAULT_OVERLAYS: Record<OverlayId, boolean> = {
  alarmBands: true,
  anomalyBands: false,
  rollingAverage: false,
  eventMarkers: true,
  statusPoints: true,
  minorGrid: false,
  legend: true,
  dataTip: true,
}

const OVERLAY_PRESETS: readonly OverlayPreset[] = [
  {
    id: 'monitor',
    label: 'Monitor',
    overlays: DEFAULT_OVERLAYS,
  },
  {
    id: 'review',
    label: 'Alarm Review',
    overlays: {
      alarmBands: true,
      anomalyBands: true,
      rollingAverage: false,
      eventMarkers: true,
      statusPoints: true,
      minorGrid: false,
      legend: true,
      dataTip: true,
    },
  },
  {
    id: 'full',
    label: 'Full Diagnostic',
    overlays: {
      alarmBands: true,
      anomalyBands: true,
      rollingAverage: true,
      eventMarkers: true,
      statusPoints: true,
      minorGrid: true,
      legend: true,
      dataTip: true,
    },
  },
] as const

const CYCLE_INFO_SERIES: SeriesConfig = {
  id: 'cycleState',
  label: 'Cycle info',
  shortLabel: 'Cycle',
  unit: 'stage',
  color: '#77ac30',
  domain: [0, 5],
  side: 'right',
  axisIndex: 1,
  decimals: 0,
  ticks: [0, 1, 2, 3, 4, 5],
  format: (value) => STAGE_LABELS[Math.round(value)] ?? String(value),
  stepped: true,
}

const SERIES: readonly SeriesConfig[] = [
  {
    id: 'pressure',
    label: 'Pressure',
    shortLabel: 'Pressure',
    unit: 'bar',
    color: '#0072bd',
    domain: [60, 190],
    side: 'left',
    axisIndex: 0,
    decimals: 0,
    ticks: [60, 90, 120, 150, 180],
    thresholds: {
      warning: [70, 165],
      alarm: [65, 180],
      anomaly: [72, 172],
      target: 125,
    },
  },
  {
    id: 'torque',
    label: 'Torque',
    shortLabel: 'Torque',
    unit: 'N m',
    color: '#d95319',
    domain: [90, 360],
    side: 'left',
    axisIndex: 1,
    decimals: 0,
    ticks: [100, 160, 220, 280, 340],
    thresholds: {
      warning: [115, 315],
      alarm: [95, 350],
      anomaly: [105, 330],
      target: 210,
    },
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'Temp',
    unit: 'C',
    color: '#edb120',
    domain: [30, 120],
    side: 'left',
    axisIndex: 2,
    decimals: 0,
    ticks: [40, 60, 80, 100, 120],
    thresholds: {
      warning: [36, 105],
      alarm: [32, 116],
      anomaly: [38, 108],
      target: 72,
    },
  },
  {
    id: 'vibration',
    label: 'Vibration',
    shortLabel: 'Vibration',
    unit: 'mm/s',
    color: '#7e2f8e',
    domain: [0, 14],
    side: 'right',
    axisIndex: 0,
    decimals: 1,
    ticks: [0, 3, 6, 9, 12],
    thresholds: {
      warning: [0.3, 9],
      alarm: [0, 12],
      anomaly: [0.4, 10.5],
      target: 3,
    },
  },
  CYCLE_INFO_SERIES,
  {
    id: 'lubrication',
    label: 'Lubrication',
    shortLabel: 'Lube',
    unit: '%',
    color: '#4dbeee',
    domain: [0, 100],
    side: 'right',
    axisIndex: 2,
    decimals: 0,
    ticks: [0, 25, 50, 75, 100],
    thresholds: {
      warning: [18, 88],
      alarm: [10, 96],
      anomaly: [16, 90],
      target: 45,
    },
  },
] as const

const AXIS_POSITIONS = {
  left: [180, 120, 60],
  right: [1040, 1095, 1150],
} as const

function getStage(cycle: number): number {
  const phase = cycle % 24
  if (phase < 3) return 0
  if (phase < 7) return 1
  if (phase < 14) return 2
  if (phase < 17) return 3
  if (phase < 22) return 4
  return 5
}

function generateSamples(): Sample[] {
  return Array.from({ length: 121 }, (_, cycle) => {
    const stage = getStage(cycle)
    const phase = cycle % 24
    const pressPulse = stage === 2 ? Math.sin(((phase - 7) / 7) * Math.PI) : 0
    const clampPulse = stage === 1 ? (phase - 3) / 4 : 0
    const returnPulse = stage === 4 ? Math.sin(((phase - 17) / 5) * Math.PI) : 0
    const lubricationPulse = stage === 5 ? 82 - (phase - 22) * 15 : 28 + Math.sin(cycle / 8) * 6
    const pressureSpike = cycle === 34 || cycle === 35 ? 22 : 0
    const torqueSpike = cycle === 34 ? 72 : 0
    const temperatureDrift = cycle >= 96 && cycle <= 102 ? 20 : 0
    const vibrationSpike = cycle === 88 ? 5.4 : 0
    const lubricationDrop = cycle >= 101 && cycle <= 105 ? -22 : 0

    return {
      cycle,
      time: cycle * 0.5,
      pressure: 82 + pressPulse * 86 + clampPulse * 18 + Math.sin(cycle / 5) * 5 + pressureSpike,
      torque: 145 + pressPulse * 154 + returnPulse * 55 + Math.cos(cycle / 7) * 14 + torqueSpike,
      temperature: 48 + cycle * 0.42 + pressPulse * 8 + Math.sin(cycle / 11) * 3 + temperatureDrift,
      vibration:
        1.8 +
        pressPulse * 7.8 +
        returnPulse * 3.2 +
        Math.abs(Math.sin(cycle / 2.6)) * 1.1 +
        vibrationSpike,
      cycleState: stage,
      lubrication: Math.max(4, Math.min(96, lubricationPulse + lubricationDrop)),
    }
  })
}

function buildSegments(samples: readonly Sample[]): Segment[] {
  const first = samples[0]
  if (!first) return []

  const segments: Segment[] = []
  let startCycle = first.cycle
  let state = first.cycleState

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    if (sample.cycleState !== state) {
      const previous = samples[index - 1]
      if (previous) {
        segments.push({ startCycle, endCycle: previous.cycle, state })
      }
      startCycle = sample.cycle
      state = sample.cycleState
    }
  }

  const last = samples[samples.length - 1]
  if (last) {
    segments.push({ startCycle, endCycle: last.cycle, state })
  }

  return segments
}

function plotWidth(area: PlotArea): number {
  return area.right - area.left
}

function plotHeight(area: PlotArea): number {
  return area.bottom - area.top
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getCycleRange(samples: readonly Sample[]): readonly [number, number] {
  const first = samples[0]?.cycle ?? 0
  const last = samples[samples.length - 1]?.cycle ?? first + 1
  return [first, last]
}

function samplesForZoom(
  samples: readonly Sample[],
  selectedIndex: number,
  zoomLevel: ZoomLevel,
): readonly Sample[] {
  if (zoomLevel === 1) return samples

  const [firstCycle, lastCycle] = getCycleRange(samples)
  const windowCycles = ZOOM_WINDOW_BY_LEVEL[zoomLevel]
  const centerCycle = samples[selectedIndex]?.cycle ?? firstCycle
  const maxStartCycle = Math.max(firstCycle, lastCycle - windowCycles)
  const startCycle = Math.round(clamp(centerCycle - windowCycles / 2, firstCycle, maxStartCycle))
  const endCycle = Math.min(lastCycle, startCycle + windowCycles)

  return samples.filter((sample) => sample.cycle >= startCycle && sample.cycle <= endCycle)
}

function cycleTickStep(samples: readonly Sample[]): number {
  const [firstCycle, lastCycle] = getCycleRange(samples)
  const span = Math.max(1, lastCycle - firstCycle)

  if (span <= 30) return 5
  if (span <= 60) return 10
  return 20
}

function cycleTicks(samples: readonly Sample[]): number[] {
  const [firstCycle, lastCycle] = getCycleRange(samples)
  const step = cycleTickStep(samples)
  const ticks = new Set<number>([firstCycle, lastCycle])

  for (let tick = Math.ceil(firstCycle / step) * step; tick <= lastCycle; tick += step) {
    ticks.add(tick)
  }

  return Array.from(ticks).sort((a, b) => a - b)
}

function minorCycleTicks(samples: readonly Sample[]): number[] {
  const majorTicks = cycleTicks(samples)
  const minorTicks: number[] = []

  for (let index = 1; index < majorTicks.length; index += 1) {
    const previous = majorTicks[index - 1]
    const next = majorTicks[index]
    if (previous === undefined || next === undefined) continue
    minorTicks.push((previous + next) / 2)
  }

  return minorTicks
}

function formatCycleTick(tick: number): string {
  return Number.isInteger(tick) ? String(tick) : tick.toFixed(1)
}

function xForArea(cycle: number, samples: readonly Sample[], area: PlotArea): number {
  const first = samples[0]?.cycle ?? 0
  const last = samples[samples.length - 1]?.cycle ?? 1
  return area.left + ((cycle - first) / Math.max(1, last - first)) * plotWidth(area)
}

function yForArea(value: number, domain: readonly [number, number], area: PlotArea): number {
  const [min, max] = domain
  return area.bottom - ((value - min) / (max - min)) * plotHeight(area)
}

function xFor(cycle: number, samples: readonly Sample[]): number {
  return xForArea(cycle, samples, PLOT)
}

function yFor(value: number, domain: readonly [number, number]): number {
  return yForArea(value, domain, PLOT)
}

function analysisLaneArea(index: number): PlotArea {
  const top = ANALYSIS_TOP + index * ANALYSIS_LANE_STEP
  return {
    left: PLOT.left,
    right: 860,
    top,
    bottom: top + ANALYSIS_LANE_HEIGHT,
  }
}

function buildValuePathByIndex(
  samples: readonly Sample[],
  values: readonly number[],
  area: PlotArea,
  domain: readonly [number, number],
): string {
  const length = Math.min(samples.length, values.length)
  const firstSample = samples[0]
  const firstValue = values[0]
  if (length === 0 || !firstSample || firstValue === undefined) return ''

  let path = `M ${xForArea(firstSample.cycle, samples, area).toFixed(2)} ${yForArea(firstValue, domain, area).toFixed(2)}`

  for (let index = 1; index < length; index += 1) {
    const sample = samples[index]
    const value = values[index]
    if (!sample || value === undefined) continue
    path += ` L ${xForArea(sample.cycle, samples, area).toFixed(2)} ${yForArea(value, domain, area).toFixed(2)}`
  }

  return path
}

function buildBandPathByIndex(
  samples: readonly Sample[],
  lowValues: readonly number[],
  highValues: readonly number[],
  area: PlotArea,
  domain: readonly [number, number],
): string {
  const length = Math.min(samples.length, lowValues.length, highValues.length)
  if (length === 0) return ''

  const highPoints = samples
    .slice(0, length)
    .map((sample, index) => {
      const value = highValues[index] ?? 0
      return `${xForArea(sample.cycle, samples, area).toFixed(2)} ${yForArea(value, domain, area).toFixed(2)}`
    })
    .join(' ')
  const lowPoints = samples
    .slice(0, length)
    .reverse()
    .map((sample, reverseIndex) => {
      const index = length - 1 - reverseIndex
      const value = lowValues[index] ?? 0
      return `${xForArea(sample.cycle, samples, area).toFixed(2)} ${yForArea(value, domain, area).toFixed(2)}`
    })
    .join(' ')

  return `${highPoints} ${lowPoints}`
}

function valueFor(sample: Sample, id: SeriesId): number {
  return sample[id]
}

function formatValue(value: number, series: SeriesConfig): string {
  if (series.format) return series.format(value)
  return `${value.toFixed(series.decimals)} ${series.unit}`
}

function formatTickValue(value: number, series: SeriesConfig): string {
  if (series.format) return series.format(value)
  return value.toFixed(series.decimals)
}

function isOutsideBand(value: number, band: readonly [number, number]): boolean {
  return value < band[0] || value > band[1]
}

function statusForValue(value: number, series: SeriesConfig): SignalStatus {
  const thresholds = series.thresholds
  if (!thresholds) return 'normal'
  if (isOutsideBand(value, thresholds.alarm)) return 'alarm'
  if (isOutsideBand(value, thresholds.anomaly)) return 'anomaly'
  if (isOutsideBand(value, thresholds.warning)) return 'warning'
  return 'normal'
}

function abnormalStatusForValue(value: number, series: SeriesConfig): AbnormalStatus | undefined {
  const status = statusForValue(value, series)
  return status === 'alarm' || status === 'anomaly' ? status : undefined
}

function buildAbnormalRegions(samples: readonly Sample[], series: SeriesConfig): AbnormalRegion[] {
  if (!series.thresholds) return []

  const regions: AbnormalRegion[] = []
  let current: AbnormalRegion | undefined

  for (const sample of samples) {
    const status = abnormalStatusForValue(valueFor(sample, series.id), series)

    if (!status) {
      if (current) {
        regions.push(current)
        current = undefined
      }
      continue
    }

    if (!current) {
      current = {
        startCycle: sample.cycle,
        endCycle: sample.cycle,
        status,
      }
      continue
    }

    if (sample.cycle <= current.endCycle + 1) {
      current.endCycle = sample.cycle
      if (status === 'alarm') {
        current.status = 'alarm'
      }
    } else {
      regions.push(current)
      current = {
        startCycle: sample.cycle,
        endCycle: sample.cycle,
        status,
      }
    }
  }

  if (current) {
    regions.push(current)
  }

  return regions
}

function buildAnalyticsSummary(samples: readonly Sample[], series: SeriesConfig): AnalyticsSummary {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let total = 0
  let warningCount = 0
  let anomalyCount = 0
  let alarmCount = 0

  for (const sample of samples) {
    const value = valueFor(sample, series.id)
    const status = statusForValue(value, series)
    min = Math.min(min, value)
    max = Math.max(max, value)
    total += value

    if (status === 'warning') warningCount += 1
    if (status === 'anomaly') anomalyCount += 1
    if (status === 'alarm') alarmCount += 1
  }

  return {
    min,
    max,
    mean: samples.length > 0 ? total / samples.length : 0,
    sampleCount: samples.length,
    warningCount,
    anomalyCount,
    alarmCount,
  }
}

function rollingAverageAt(
  samples: readonly Sample[],
  series: SeriesConfig,
  index: number,
  windowSize = ROLLING_WINDOW,
): number {
  const start = Math.max(0, index - windowSize + 1)
  let total = 0
  let count = 0

  for (let cursor = start; cursor <= index; cursor += 1) {
    const sample = samples[cursor]
    if (!sample) continue
    total += valueFor(sample, series.id)
    count += 1
  }

  return count > 0 ? total / count : 0
}

function normalizeValue(value: number, domain: readonly [number, number]): number {
  const [min, max] = domain
  return ((value - min) / (max - min)) * 100
}

function getSeriesById(id: SeriesId): SeriesConfig {
  const series = SERIES.find((candidate) => candidate.id === id)
  if (!series) {
    throw new Error(`Unknown series: ${id}`)
  }
  return series
}

function getViewModeConfig(id: ViewMode): ViewModeConfig {
  const mode = VIEW_MODES.find((candidate) => candidate.id === id)
  if (!mode) {
    throw new Error(`Unknown view mode: ${id}`)
  }
  return mode
}

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'rows'

  const mode = new URLSearchParams(window.location.search).get('mode')
  return VIEW_MODES.some((candidate) => candidate.id === mode) ? (mode as ViewMode) : 'rows'
}

function writeModeToUrl(mode: ViewMode): void {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  window.history.replaceState(null, '', url)
}

function getInitialOverlays(): Record<OverlayId, boolean> {
  if (typeof window === 'undefined') return DEFAULT_OVERLAYS

  const presetId = new URLSearchParams(window.location.search).get('preset')
  const preset = OVERLAY_PRESETS.find((candidate) => candidate.id === presetId)
  return preset ? preset.overlays : DEFAULT_OVERLAYS
}

function writeOverlayPresetToUrl(presetId: OverlayPresetId | 'custom'): void {
  const url = new URL(window.location.href)
  url.searchParams.set('preset', presetId)
  window.history.replaceState(null, '', url)
}

function getInitialZoomLevel(): ZoomLevel {
  if (typeof window === 'undefined') return 1

  const zoom = Number(new URLSearchParams(window.location.search).get('zoom'))
  return ZOOM_LEVELS.includes(zoom as ZoomLevel) ? (zoom as ZoomLevel) : 1
}

function writeZoomToUrl(level: ZoomLevel): void {
  const url = new URL(window.location.href)
  url.searchParams.set('zoom', String(level))
  window.history.replaceState(null, '', url)
}

function overlaysMatch(
  current: Record<OverlayId, boolean>,
  candidate: Record<OverlayId, boolean>,
): boolean {
  return (Object.keys(candidate) as OverlayId[]).every((key) => current[key] === candidate[key])
}

function getActiveOverlayPreset(overlays: Record<OverlayId, boolean>): OverlayPresetId | undefined {
  return OVERLAY_PRESETS.find((preset) => overlaysMatch(overlays, preset.overlays))?.id
}

function rowArea(index: number): PlotArea {
  const top = ROW_TOP + index * ROW_STEP
  return {
    left: PLOT.left,
    right: PLOT.right,
    top,
    bottom: top + ROW_HEIGHT,
  }
}

function buildLinePathForArea(
  samples: readonly Sample[],
  series: SeriesConfig,
  area: PlotArea,
  domain: readonly [number, number] = series.domain,
  readValue: (sample: Sample) => number = (sample) => valueFor(sample, series.id),
): string {
  const first = samples[0]
  if (!first) return ''

  let path = `M ${xForArea(first.cycle, samples, area).toFixed(2)} ${yForArea(readValue(first), domain, area).toFixed(2)}`

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    const previous = samples[index - 1]
    if (!sample || !previous) continue

    const x = xForArea(sample.cycle, samples, area)
    const y = yForArea(readValue(sample), domain, area)

    if (series.stepped) {
      const previousY = yForArea(readValue(previous), domain, area)
      path += ` L ${x.toFixed(2)} ${previousY.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
  }

  return path
}

function buildLinePath(samples: readonly Sample[], series: SeriesConfig): string {
  return buildLinePathForArea(samples, series, PLOT)
}

function buildRollingAveragePathForArea(
  samples: readonly Sample[],
  series: SeriesConfig,
  area: PlotArea,
  domain: readonly [number, number] = series.domain,
  readValue: (sample: Sample) => number = (sample) => valueFor(sample, series.id),
  windowSize = ROLLING_WINDOW,
): string {
  let path = ''

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    const start = Math.max(0, index - windowSize + 1)
    let total = 0
    let count = 0

    for (let cursor = start; cursor <= index; cursor += 1) {
      const windowSample = samples[cursor]
      if (!windowSample) continue
      total += readValue(windowSample)
      count += 1
    }

    const average = count > 0 ? total / count : readValue(sample)
    const x = xForArea(sample.cycle, samples, area)
    const y = yForArea(average, domain, area)
    path += `${path === '' ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `
  }

  return path.trim()
}

function nearestSampleIndex(samples: readonly Sample[], cycle: number): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    const distance = Math.abs(sample.cycle - cycle)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }

  return nearestIndex
}

function axisX(series: SeriesConfig): number {
  return AXIS_POSITIONS[series.side][series.axisIndex] ?? PLOT.left
}

function numericSeries(seriesList: readonly SeriesConfig[] = SERIES): SeriesConfig[] {
  return seriesList.filter((series) => series.id !== 'cycleState')
}

function sampleValues(samples: readonly Sample[], series: SeriesConfig): number[] {
  return samples.map((sample) => valueFor(sample, series.id))
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const center = average(values)
  const variance =
    values.reduce((total, value) => total + (value - center) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const position = clamp(percentileValue, 0, 1) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const lowerValue = sorted[lower] ?? 0
  const upperValue = sorted[upper] ?? lowerValue

  return lowerValue + (upperValue - lowerValue) * (position - lower)
}

function severityRank(status: SignalStatus): number {
  if (status === 'alarm') return 3
  if (status === 'anomaly') return 2
  if (status === 'warning') return 1
  return 0
}

function linearSlopeForSeries(
  samples: readonly Sample[],
  series: SeriesConfig,
  windowSize = 18,
): number {
  const recent = samples.slice(Math.max(0, samples.length - windowSize))
  if (recent.length < 2) return 0

  const xValues = recent.map((sample) => sample.cycle)
  const yValues = sampleValues(recent, series)
  const xMean = average(xValues)
  const yMean = average(yValues)
  let numerator = 0
  let denominator = 0

  for (let index = 0; index < recent.length; index += 1) {
    const x = xValues[index] ?? 0
    const y = yValues[index] ?? 0
    numerator += (x - xMean) * (y - yMean)
    denominator += (x - xMean) ** 2
  }

  return denominator > 0 ? numerator / denominator : 0
}

function linearFitResidualSpread(
  samples: readonly Sample[],
  series: SeriesConfig,
  slope: number,
  windowSize = 18,
): number {
  const recent = samples.slice(Math.max(0, samples.length - windowSize))
  if (recent.length < 2) return (series.domain[1] - series.domain[0]) * 0.02

  const xMean = average(recent.map((sample) => sample.cycle))
  const yMean = average(sampleValues(recent, series))
  const intercept = yMean - slope * xMean
  const residuals = recent.map(
    (sample) => valueFor(sample, series.id) - (intercept + slope * sample.cycle),
  )
  return Math.max(standardDeviation(residuals), (series.domain[1] - series.domain[0]) * 0.012)
}

function estimateCyclesToAlarm(
  samples: readonly Sample[],
  series: SeriesConfig,
): number | undefined {
  const thresholds = series.thresholds
  const last = samples[samples.length - 1]
  if (!thresholds || !last) return undefined

  const value = valueFor(last, series.id)
  if (statusForValue(value, series) === 'alarm') return 0

  const slope = linearSlopeForSeries(samples, series)
  if (Math.abs(slope) < 0.01) return undefined

  const cycles =
    slope > 0
      ? (thresholds.alarm[1] - value) / slope
      : (value - thresholds.alarm[0]) / Math.abs(slope)

  if (!Number.isFinite(cycles) || cycles > 240) return undefined
  return Math.max(0, Math.ceil(cycles))
}

function estimateThresholdCrossing(
  samples: readonly Sample[],
  series: SeriesConfig,
  slope: number,
): string {
  const thresholds = series.thresholds
  const last = samples[samples.length - 1]
  if (!thresholds || !last) return 'No threshold model'
  if (Math.abs(slope) < 0.01) return 'Stable over forecast horizon'

  const value = valueFor(last, series.id)
  const target = slope > 0 ? thresholds.alarm[1] : thresholds.alarm[0]
  const cycles = slope > 0 ? (target - value) / slope : (value - target) / Math.abs(slope)

  if (!Number.isFinite(cycles)) return 'Stable over forecast horizon'
  if (cycles <= 0) return 'Already beyond alarm band'
  if (cycles <= 120) return `${Math.ceil(cycles)} cycles to ${slope > 0 ? 'high' : 'low'} alarm`
  return 'Stable over forecast horizon'
}

function buildForecastInsight(samples: readonly Sample[], series: SeriesConfig): ForecastInsight {
  const last = samples[samples.length - 1]
  const slope = linearSlopeForSeries(samples, series)
  const spread = linearFitResidualSpread(samples, series, slope)

  if (!last) {
    return {
      points: [],
      slope,
      spread,
      crossingLabel: 'No samples',
    }
  }

  const currentValue = valueFor(last, series.id)
  const points = Array.from({ length: 12 }, (_, index) => {
    const step = index + 1
    const expected = currentValue + slope * step
    const uncertainty = spread * (1 + Math.sqrt(step) * 0.28)
    return {
      cycle: last.cycle + step,
      expected,
      low: expected - uncertainty,
      high: expected + uncertainty,
    }
  })

  return {
    points,
    slope,
    spread,
    crossingLabel: estimateThresholdCrossing(samples, series, slope),
  }
}

function buildRulItems(samples: readonly Sample[]): RulItem[] {
  return numericSeries().map((series) => {
    const cycles = estimateCyclesToAlarm(samples, series)
    let status: SignalStatus = 'normal'

    if (cycles !== undefined) {
      if (cycles <= 12) status = 'alarm'
      else if (cycles <= 30) status = 'anomaly'
      else if (cycles <= 60) status = 'warning'
    }

    return { series, cycles, status }
  })
}

function residualValuesForSeries(samples: readonly Sample[], series: SeriesConfig): number[] {
  return samples.map(
    (sample, index) => valueFor(sample, series.id) - rollingAverageAt(samples, series, index, 11),
  )
}

function buildResidualInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): ResidualInsight {
  const values = residualValuesForSeries(samples, series)
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)))
  const rms = Math.sqrt(average(values.map((value) => value ** 2)))

  return {
    values,
    selectedResidual: values[selectedIndex] ?? 0,
    maxAbs,
    rms,
  }
}

function buildAnomalyInsight(samples: readonly Sample[], selectedIndex: number): AnomalyInsight {
  const selected = samples[selectedIndex]
  if (!selected) return { confidence: 0, contributors: [] }

  const contributors = numericSeries()
    .map((series) => {
      const residuals = residualValuesForSeries(samples, series)
      const residual = residuals[selectedIndex] ?? 0
      const sigma = Math.max(
        standardDeviation(residuals),
        (series.domain[1] - series.domain[0]) * 0.01,
      )
      const value = valueFor(selected, series.id)
      const status = statusForValue(value, series)

      return {
        series,
        value,
        status,
        residual,
        score: Math.abs(residual) / sigma,
      }
    })
    .sort((a, b) => severityRank(b.status) - severityRank(a.status) || b.score - a.score)
    .slice(0, 4)

  const top = contributors[0]
  const confidence = top ? clamp(44 + top.score * 13 + severityRank(top.status) * 10, 0, 99) : 0

  return { confidence, contributors }
}

function pearsonCorrelation(aValues: readonly number[], bValues: readonly number[]): number {
  const length = Math.min(aValues.length, bValues.length)
  if (length < 3) return 0

  const a = aValues.slice(0, length)
  const b = bValues.slice(0, length)
  const aMean = average(a)
  const bMean = average(b)
  let numerator = 0
  let aDenominator = 0
  let bDenominator = 0

  for (let index = 0; index < length; index += 1) {
    const aDelta = (a[index] ?? 0) - aMean
    const bDelta = (b[index] ?? 0) - bMean
    numerator += aDelta * bDelta
    aDenominator += aDelta ** 2
    bDenominator += bDelta ** 2
  }

  const denominator = Math.sqrt(aDenominator * bDenominator)
  return denominator > 0 ? numerator / denominator : 0
}

function laggedCorrelation(
  samples: readonly Sample[],
  activeSeries: SeriesConfig,
  candidateSeries: SeriesConfig,
  lag: number,
): number {
  const activeValues: number[] = []
  const candidateValues: number[] = []

  for (let index = 0; index < samples.length; index += 1) {
    const candidateIndex = index + lag
    const activeSample = samples[index]
    const candidateSample = samples[candidateIndex]
    if (!activeSample || !candidateSample) continue
    activeValues.push(valueFor(activeSample, activeSeries.id))
    candidateValues.push(valueFor(candidateSample, candidateSeries.id))
  }

  return pearsonCorrelation(activeValues, candidateValues)
}

function buildCorrelationInsights(
  samples: readonly Sample[],
  activeSeries: SeriesConfig,
  visibleSeries: readonly SeriesConfig[],
): CorrelationInsight[] {
  const candidates = numericSeries(visibleSeries).filter((series) => series.id !== activeSeries.id)
  const source =
    candidates.length > 0
      ? candidates
      : numericSeries().filter((series) => series.id !== activeSeries.id)

  return source
    .map((series) => {
      const correlations = Array.from({ length: 11 }, (_, index) => {
        const lag = index - 5
        return {
          lag,
          correlation: laggedCorrelation(samples, activeSeries, series, lag),
        }
      })
      const best = correlations.reduce(
        (currentBest, candidate) =>
          Math.abs(candidate.correlation) > Math.abs(currentBest.correlation)
            ? candidate
            : currentBest,
        correlations[5] ?? { lag: 0, correlation: 0 },
      )

      return {
        series,
        correlation: best.correlation,
        lag: best.lag,
      }
    })
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
}

function buildPhaseStats(samples: readonly Sample[], series: SeriesConfig): PhaseStat[] {
  return STAGE_LABELS.map((label, state) => {
    const values = sampleValues(
      samples.filter((sample) => sample.cycleState === state),
      series,
    )
    const averageValue = average(values)

    return {
      state,
      label,
      color: STAGE_COLORS[state] ?? '#667085',
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      average: averageValue,
      width: clamp(normalizeValue(averageValue, series.domain), 0, 100),
    }
  })
}

function buildSpcInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): SpcInsight {
  const values = sampleValues(samples, series)
  const mean = average(values)
  const sigma = standardDeviation(values)
  const stableSigma = Math.max(sigma, (series.domain[1] - series.domain[0]) * 0.001)
  const ucl = mean + stableSigma * 3
  const lcl = mean - stableSigma * 3
  const selectedValue = values[selectedIndex] ?? mean

  return {
    mean,
    sigma: stableSigma,
    ucl,
    lcl,
    selectedZ: (selectedValue - mean) / stableSigma,
    violations: values.filter((value) => value > ucl || value < lcl).length,
    values,
  }
}

function buildSpectrumBins(samples: readonly Sample[]): SpectrumBin[] {
  const vibrationSeries = getSeriesById('vibration')
  const values = sampleValues(samples, vibrationSeries)
  const center = average(values)
  const centered = values.map((value) => value - center)
  const sampleIntervalSeconds = 0.5
  const bins = Array.from({ length: 12 }, (_, index) => {
    const bin = index + 1
    let real = 0
    let imaginary = 0

    for (let sampleIndex = 0; sampleIndex < centered.length; sampleIndex += 1) {
      const angle = (2 * Math.PI * bin * sampleIndex) / Math.max(1, centered.length)
      const value = centered[sampleIndex] ?? 0
      real += value * Math.cos(angle)
      imaginary -= value * Math.sin(angle)
    }

    const magnitude = Math.sqrt(real ** 2 + imaginary ** 2) / Math.max(1, centered.length)
    const frequency = bin / (Math.max(1, centered.length) * sampleIntervalSeconds)

    return {
      bin,
      label: `${frequency.toFixed(2)} Hz`,
      magnitude,
      width: 0,
    }
  })
  const maxMagnitude = Math.max(1, ...bins.map((bin) => bin.magnitude))

  return bins.map((bin) => ({
    ...bin,
    width: (bin.magnitude / maxMagnitude) * 100,
  }))
}

function windowAverageByCycle(
  samples: readonly Sample[],
  series: SeriesConfig,
  startCycle: number,
  endCycle: number,
): number {
  const values = sampleValues(
    samples.filter((sample) => sample.cycle >= startCycle && sample.cycle <= endCycle),
    series,
  )
  return average(values)
}

function statusForEventSeverity(severity: EventSeverity): SignalStatus {
  if (severity === 'alarm') return 'alarm'
  if (severity === 'quality') return 'anomaly'
  if (severity === 'maintenance') return 'warning'
  return 'normal'
}

function buildEventImpacts(samples: readonly Sample[], series: SeriesConfig): EventImpact[] {
  const rawImpacts = EVENTS.map((event) => {
    const before = windowAverageByCycle(samples, series, event.cycle - 6, event.cycle - 1)
    const after = windowAverageByCycle(samples, series, event.cycle, event.cycle + 6)
    return {
      event,
      before,
      after,
      delta: after - before,
      width: 0,
      status: statusForEventSeverity(event.severity),
    }
  })
  const maxDelta = Math.max(1, ...rawImpacts.map((impact) => Math.abs(impact.delta)))

  return rawImpacts.map((impact) => ({
    ...impact,
    width: (Math.abs(impact.delta) / maxDelta) * 100,
  }))
}

function buildDataQualityInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): DataQualityInsight {
  const values = sampleValues(samples, series)
  const [firstCycle, lastCycle] = getCycleRange(samples)
  const expectedSamples = Math.max(1, lastCycle - firstCycle + 1)
  const completeness = (samples.length / expectedSamples) * 100
  let gapCount = 0
  let heldCount = 0
  const rates: number[] = []
  const deadband = (series.domain[1] - series.domain[0]) * 0.0005

  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index]
    const previous = samples[index - 1]
    const currentValue = values[index] ?? 0
    const previousValue = values[index - 1] ?? currentValue
    if (!current || !previous) continue

    if (current.time - previous.time > 0.75) gapCount += 1
    if (Math.abs(currentValue - previousValue) <= deadband) heldCount += 1
    rates.push(currentValue - previousValue)
  }

  const rateSigma = standardDeviation(rates)
  const spikeThreshold = Math.max(rateSigma * 3, (series.domain[1] - series.domain[0]) * 0.08)
  const spikeCount = rates.filter((rate) => Math.abs(rate) > spikeThreshold).length
  const residuals = residualValuesForSeries(samples, series)
  const noiseRms = Math.sqrt(average(residuals.map((value) => value ** 2)))

  return {
    completeness: clamp(completeness, 0, 100),
    gapCount,
    heldCount,
    spikeCount,
    noiseRms,
  }
}

function buildRateChangeInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): RateChangeInsight {
  const values = sampleValues(samples, series)
  const rates = values.map((value, index) => value - (values[index - 1] ?? value))

  return {
    rates,
    currentRate: rates[selectedIndex] ?? 0,
    maxRise: Math.max(0, ...rates),
    maxFall: Math.min(0, ...rates),
  }
}

function buildDistributionInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): DistributionInsight {
  const values = sampleValues(samples, series)
  const binCount = 10
  const [domainMin, domainMax] = series.domain
  const binSize = (domainMax - domainMin) / binCount
  const counts = Array.from({ length: binCount }, () => 0)

  for (const value of values) {
    const binIndex = clamp(Math.floor((value - domainMin) / binSize), 0, binCount - 1)
    counts[binIndex] = (counts[binIndex] ?? 0) + 1
  }

  const maxCount = Math.max(1, ...counts)
  const bins = counts.map((count, index) => {
    const low = domainMin + binSize * index
    const high = low + binSize
    return {
      label: `${formatTickValue(low, series)}-${formatTickValue(high, series)}`,
      count,
      width: (count / maxCount) * 100,
    }
  })

  return {
    bins,
    mean: average(values),
    p05: percentile(values, 0.05),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  }
}

function buildAutocorrelation(
  samples: readonly Sample[],
  series: SeriesConfig,
): AutocorrelationPoint[] {
  const values = sampleValues(samples, series)
  return Array.from({ length: 12 }, (_, index) => {
    const lag = index + 1
    const correlation = pearsonCorrelation(values.slice(0, -lag), values.slice(lag))
    return {
      lag,
      correlation,
      width: Math.abs(correlation) * 100,
    }
  })
}

function buildEnvelope(samples: readonly Sample[], series: SeriesConfig): EnvelopePoint[] {
  return Array.from({ length: 24 }, (_, phase) => {
    const values = sampleValues(
      samples.filter((sample) => sample.cycle % 24 === phase),
      series,
    )

    return {
      phase,
      low: percentile(values, 0.1),
      median: percentile(values, 0.5),
      high: percentile(values, 0.9),
    }
  })
}

function buildCycleRepeatability(
  samples: readonly Sample[],
  series: SeriesConfig,
): CycleRepeatability[] {
  const cycleMap = new Map<number, number[]>()
  for (const sample of samples) {
    const cycleId = Math.floor(sample.cycle / 24)
    const values = cycleMap.get(cycleId) ?? []
    values.push(valueFor(sample, series.id))
    cycleMap.set(cycleId, values)
  }

  const raw = Array.from(cycleMap.entries()).map(([cycleId, values]) => {
    const peak = Math.max(...values)
    const rms = Math.sqrt(average(values.map((value) => value ** 2)))
    return {
      label: `${cycleId * 24}-${cycleId * 24 + 23}`,
      peak,
      rms,
      deviation: 0,
      width: 0,
    }
  })
  const averagePeak = average(raw.map((item) => item.peak))
  const maxDeviation = Math.max(1, ...raw.map((item) => Math.abs(item.peak - averagePeak)))

  return raw.map((item) => ({
    ...item,
    deviation: item.peak - averagePeak,
    width: (Math.abs(item.peak - averagePeak) / maxDeviation) * 100,
  }))
}

function buildAlarmWindows(samples: readonly Sample[]): AlarmWindow[] {
  const windows: AlarmWindow[] = []
  const [firstCycle, lastCycle] = getCycleRange(samples)

  for (let startCycle = firstCycle; startCycle <= lastCycle; startCycle += 20) {
    const endCycle = Math.min(startCycle + 19, lastCycle)
    const windowSamples = samples.filter(
      (sample) => sample.cycle >= startCycle && sample.cycle <= endCycle,
    )
    let warning = 0
    let anomaly = 0
    let alarm = 0

    for (const sample of windowSamples) {
      for (const series of numericSeries()) {
        const status = statusForValue(valueFor(sample, series.id), series)
        if (status === 'warning') warning += 1
        if (status === 'anomaly') anomaly += 1
        if (status === 'alarm') alarm += 1
      }
    }

    windows.push({
      label: `${startCycle}-${endCycle}`,
      warning,
      anomaly,
      alarm,
      total: warning + anomaly + alarm,
    })
  }

  return windows
}

function driftStatusForSlope(series: SeriesConfig, slope: number): SignalStatus {
  const normalizedSlope = Math.abs(slope) / Math.max(1, series.domain[1] - series.domain[0])
  if (normalizedSlope > 0.02) return 'alarm'
  if (normalizedSlope > 0.01) return 'anomaly'
  if (normalizedSlope > 0.004) return 'warning'
  return 'normal'
}

function buildDriftItems(samples: readonly Sample[]): DriftItem[] {
  const raw = numericSeries().map((series) => {
    const slope = linearSlopeForSeries(samples, series, 60)
    return {
      series,
      slope,
      width: 0,
      status: driftStatusForSlope(series, slope),
    }
  })
  const maxSlope = Math.max(1, ...raw.map((item) => Math.abs(item.slope)))

  return raw
    .map((item) => ({
      ...item,
      width: (Math.abs(item.slope) / maxSlope) * 100,
    }))
    .sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope))
}

function buildFeatureInsight(samples: readonly Sample[], series: SeriesConfig): FeatureInsight {
  const values = sampleValues(samples, series)
  const rms = Math.sqrt(average(values.map((value) => value ** 2)))
  const maxAbs = Math.max(0, ...values.map((value) => Math.abs(value)))
  const warning = series.thresholds?.warning
  const timeAboveWarning = warning
    ? values.filter((value) => value < warning[0] || value > warning[1]).length * 0.5
    : 0
  let area = 0

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (!previous || !current) continue
    area +=
      ((valueFor(previous, series.id) + valueFor(current, series.id)) / 2) *
      (current.time - previous.time)
  }

  return {
    rms,
    crestFactor: rms > 0 ? maxAbs / rms : 0,
    p95: percentile(values, 0.95),
    timeAboveWarning,
    area,
  }
}

function statusFromRisk(risk: number): SignalStatus {
  if (risk >= 80) return 'alarm'
  if (risk >= 55) return 'anomaly'
  if (risk >= 30) return 'warning'
  return 'normal'
}

function distanceToBand(value: number, band: readonly [number, number]): number {
  if (value < band[0]) return value - band[0]
  if (value > band[1]) return band[1] - value
  return Math.min(value - band[0], band[1] - value)
}

function thresholdRiskForValue(value: number, series: SeriesConfig): number {
  const thresholds = series.thresholds
  if (!thresholds) return 0

  const alarmMargin = distanceToBand(value, thresholds.alarm)
  const warningMargin = distanceToBand(value, thresholds.warning)
  const span = Math.max(1, series.domain[1] - series.domain[0])

  if (alarmMargin < 0) return 80
  if (warningMargin < 0) return 45
  return clamp(30 - (warningMargin / span) * 240, 0, 30)
}

function buildHealthInsight(samples: readonly Sample[], selectedIndex: number): HealthInsight {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) {
    return { score: 100, status: 'normal', contributions: [] }
  }

  const contributions = numericSeries()
    .map((series) => {
      const value = valueFor(selected, series.id)
      const residuals = residualValuesForSeries(samples, series)
      const residual = residuals[selectedIndex] ?? 0
      const sigma = Math.max(
        standardDeviation(residuals),
        (series.domain[1] - series.domain[0]) * 0.01,
      )
      const status = statusForValue(value, series)
      const risk = clamp(
        severityRank(status) * 22 +
          Math.abs(residual / sigma) * 9 +
          thresholdRiskForValue(value, series),
        0,
        100,
      )

      return {
        series,
        risk,
        status: statusFromRisk(Math.max(risk, severityRank(status) * 30)),
        width: risk,
      }
    })
    .sort((a, b) => b.risk - a.risk)

  const averageRisk = average(contributions.map((item) => item.risk))
  const score = clamp(100 - averageRisk, 0, 100)

  return {
    score,
    status: statusFromRisk(100 - score),
    contributions,
  }
}

function buildChangePoints(samples: readonly Sample[], series: SeriesConfig): ChangePoint[] {
  const rates = sampleValues(samples, series).map(
    (value, index, values) => value - (values[index - 1] ?? value),
  )
  const sigma = Math.max(standardDeviation(rates), (series.domain[1] - series.domain[0]) * 0.01)
  const raw = rates
    .map((rate, index) => ({
      cycle: samples[index]?.cycle ?? index,
      magnitude: rate,
      direction: rate >= 0 ? ('rise' as const) : ('fall' as const),
      status: statusFromRisk((Math.abs(rate) / sigma) * 28),
      width: 0,
    }))
    .filter((point) => point.cycle > 0)
    .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))
    .slice(0, 5)
  const maxMagnitude = Math.max(1, ...raw.map((point) => Math.abs(point.magnitude)))

  return raw.map((point) => ({
    ...point,
    width: (Math.abs(point.magnitude) / maxMagnitude) * 100,
  }))
}

function buildLeadLagPairs(
  samples: readonly Sample[],
  visibleSeries: readonly SeriesConfig[],
): LeadLagPair[] {
  const candidates = numericSeries(visibleSeries)
  const source = candidates.length >= 2 ? candidates : numericSeries()
  const pairs: LeadLagPair[] = []

  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < source.length; targetIndex += 1) {
      const sourceSeries = source[sourceIndex]
      const targetSeries = source[targetIndex]
      if (!sourceSeries || !targetSeries) continue

      const best = Array.from({ length: 13 }, (_, index) => {
        const lag = index - 6
        return {
          lag,
          correlation: laggedCorrelation(samples, sourceSeries, targetSeries, lag),
        }
      }).reduce(
        (currentBest, candidate) =>
          Math.abs(candidate.correlation) > Math.abs(currentBest.correlation)
            ? candidate
            : currentBest,
        { lag: 0, correlation: 0 },
      )

      pairs.push({
        source: sourceSeries,
        target: targetSeries,
        lag: best.lag,
        correlation: best.correlation,
        width: Math.abs(best.correlation) * 100,
      })
    }
  }

  return pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 5)
}

function buildForecastBacktest(
  samples: readonly Sample[],
  series: SeriesConfig,
): ForecastBacktestInsight {
  const errors: number[] = []

  for (let index = 20; index < samples.length; index += 1) {
    const history = samples.slice(Math.max(0, index - 18), index)
    const previous = samples[index - 1]
    const current = samples[index]
    if (!previous || !current || history.length < 4) continue

    const slope = linearSlopeForSeries(history, series, history.length)
    const predicted = valueFor(previous, series.id) + slope
    errors.push(valueFor(current, series.id) - predicted)
  }

  const absErrors = errors.map((error) => Math.abs(error))
  const mae = average(absErrors)
  const rmse = Math.sqrt(average(errors.map((error) => error ** 2)))

  return {
    errors,
    mae,
    rmse,
    maxError: Math.max(0, ...absErrors),
  }
}

function buildThresholdSensitivity(
  samples: readonly Sample[],
  selectedIndex: number,
): ThresholdSensitivityItem[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) return []

  return numericSeries()
    .map((series) => {
      const thresholds = series.thresholds
      const value = valueFor(selected, series.id)
      const span = Math.max(1, series.domain[1] - series.domain[0])
      const warningMargin = thresholds ? distanceToBand(value, thresholds.warning) : span
      const alarmMargin = thresholds ? distanceToBand(value, thresholds.alarm) : span
      const normalizedMargin = (alarmMargin / span) * 100
      const risk = alarmMargin <= 0 ? 100 : clamp(100 - normalizedMargin * 7, 0, 100)

      return {
        series,
        warningMargin,
        alarmMargin,
        status: statusFromRisk(risk),
        width: risk,
      }
    })
    .sort((a, b) => a.alarmMargin - b.alarmMargin)
}

function buildAlarmParetoItems(samples: readonly Sample[]): AlarmParetoItem[] {
  const raw = numericSeries().map((series) => {
    let weightedCount = 0
    let worstStatus: SignalStatus = 'normal'

    for (const sample of samples) {
      const status = statusForValue(valueFor(sample, series.id), series)
      weightedCount += severityRank(status)
      if (severityRank(status) > severityRank(worstStatus)) {
        worstStatus = status
      }
    }

    return {
      series,
      weightedCount,
      status: worstStatus,
      width: 0,
    }
  })
  const maxCount = Math.max(1, ...raw.map((item) => item.weightedCount))

  return raw
    .map((item) => ({
      ...item,
      width: (item.weightedCount / maxCount) * 100,
    }))
    .sort((a, b) => b.weightedCount - a.weightedCount)
}

function buildStateOccupancy(samples: readonly Sample[]): StateOccupancy[] {
  const totalSamples = Math.max(1, samples.length)

  return STAGE_LABELS.map((label, state) => {
    const stateSamples = samples.filter((sample) => sample.cycleState === state)
    let weightedRisk = 0

    for (const sample of stateSamples) {
      for (const series of numericSeries()) {
        weightedRisk += severityRank(statusForValue(valueFor(sample, series.id), series))
      }
    }

    const maxRisk = Math.max(1, stateSamples.length * numericSeries().length * 3)

    return {
      label,
      color: STAGE_COLORS[state] ?? '#667085',
      samples: stateSamples.length,
      risk: (weightedRisk / maxRisk) * 100,
      width: (stateSamples.length / totalSamples) * 100,
    }
  })
}

function actionLabelForSeries(id: SeriesId): string {
  if (id === 'pressure') return 'Inspect pressure circuit'
  if (id === 'torque') return 'Review tooling load'
  if (id === 'temperature') return 'Check thermal drift'
  if (id === 'vibration') return 'Balance vibration path'
  if (id === 'lubrication') return 'Service lubrication'
  return 'Review cycle state'
}

function buildMaintenanceActions(
  samples: readonly Sample[],
  selectedIndex: number,
): MaintenanceAction[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  const pareto = buildAlarmParetoItems(samples)
  const drift = buildDriftItems(samples)
  const maxPareto = Math.max(1, ...pareto.map((item) => item.weightedCount))
  const raw = numericSeries().map((series) => {
    const value = selected ? valueFor(selected, series.id) : 0
    const status = statusForValue(value, series)
    const paretoItem = pareto.find((item) => item.series.id === series.id)
    const driftItem = drift.find((item) => item.series.id === series.id)
    const cyclesToAlarm = estimateCyclesToAlarm(samples, series)
    const priority = clamp(
      severityRank(status) * 20 +
        ((paretoItem?.weightedCount ?? 0) / maxPareto) * 35 +
        (driftItem?.width ?? 0) * 0.2 +
        (cyclesToAlarm === undefined ? 0 : Math.max(0, 30 - cyclesToAlarm)),
      0,
      100,
    )

    return {
      label: actionLabelForSeries(series.id),
      driver: series.shortLabel,
      priority,
      status: statusFromRisk(priority),
      width: priority,
    }
  })

  return raw.sort((a, b) => b.priority - a.priority).slice(0, 5)
}

function buildUncertaintyInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): UncertaintyInsight {
  const measurement = (series.domain[1] - series.domain[0]) * 0.005
  const process = buildSpcInsight(samples, series, samples.length - 1).sigma
  const model = buildForecastInsight(samples, series).spread
  const combined = Math.sqrt(measurement ** 2 + process ** 2 + model ** 2)

  return {
    measurement,
    process,
    model,
    combined,
    coverage: combined * 1.96,
  }
}

function rootMeanSquare(values: readonly number[]): number {
  return Math.sqrt(average(values.map((value) => value ** 2)))
}

function movingAverageValues(values: readonly number[], windowSize: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1)
    return average(values.slice(start, index + 1))
  })
}

function buildCapabilityInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): CapabilityInsight {
  const values = sampleValues(samples, series)
  const thresholds = series.thresholds
  const lowerSpec = thresholds?.alarm[0] ?? series.domain[0]
  const upperSpec = thresholds?.alarm[1] ?? series.domain[1]
  const mean = average(values)
  const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
  const cp = (upperSpec - lowerSpec) / (6 * sigma)
  const cpk = Math.min((upperSpec - mean) / (3 * sigma), (mean - lowerSpec) / (3 * sigma))
  let status: SignalStatus = 'normal'

  if (cpk < 0.67) status = 'alarm'
  else if (cpk < 1) status = 'anomaly'
  else if (cpk < 1.33) status = 'warning'

  return { cp, cpk, mean, sigma, status }
}

function buildRunRules(samples: readonly Sample[], series: SeriesConfig): RunRuleItem[] {
  const values = sampleValues(samples, series)
  const center = average(values)
  const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
  const zValues = values.map((value) => (value - center) / sigma)
  let outside3 = 0
  let twoOfThree = 0
  let fourOfFive = 0
  let eightSameSide = 0

  for (let index = 0; index < zValues.length; index += 1) {
    const z = zValues[index] ?? 0
    if (Math.abs(z) > 3) outside3 += 1

    const three = zValues.slice(Math.max(0, index - 2), index + 1)
    if (
      three.length === 3 &&
      (three.filter((value) => value > 2).length >= 2 ||
        three.filter((value) => value < -2).length >= 2)
    ) {
      twoOfThree += 1
    }

    const five = zValues.slice(Math.max(0, index - 4), index + 1)
    if (
      five.length === 5 &&
      (five.filter((value) => value > 1).length >= 4 ||
        five.filter((value) => value < -1).length >= 4)
    ) {
      fourOfFive += 1
    }

    const eight = zValues.slice(Math.max(0, index - 7), index + 1)
    if (
      eight.length === 8 &&
      (eight.every((value) => value > 0) || eight.every((value) => value < 0))
    ) {
      eightSameSide += 1
    }
  }

  const raw = [
    { label: '1 beyond 3 sigma', count: outside3 },
    { label: '2 of 3 beyond 2 sigma', count: twoOfThree },
    { label: '4 of 5 beyond 1 sigma', count: fourOfFive },
    { label: '8 same side', count: eightSameSide },
  ]
  const maxCount = Math.max(1, ...raw.map((item) => item.count))

  return raw.map((item) => ({
    ...item,
    status: statusFromRisk(item.count * 20),
    width: (item.count / maxCount) * 100,
  }))
}

function buildHysteresisInsight(samples: readonly Sample[]): HysteresisInsight {
  const xSeries = getSeriesById('pressure')
  const ySeries = getSeriesById('torque')
  const points = samples.map((sample) => ({
    x: clamp(normalizeValue(valueFor(sample, xSeries.id), xSeries.domain), 0, 100),
    y: clamp(normalizeValue(valueFor(sample, ySeries.id), ySeries.domain), 0, 100),
  }))
  let signedArea = 0

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue
    signedArea += previous.x * current.y - current.x * previous.y
  }

  const first = points[0] ?? { x: 0, y: 0 }
  const last = points[points.length - 1] ?? first
  const closureError = Math.hypot(last.x - first.x, last.y - first.y)

  return {
    xSeries,
    ySeries,
    points,
    loopArea: Math.abs(signedArea) / 200,
    closureError,
  }
}

function dftMagnitude(values: readonly number[], bin: number): number {
  const center = average(values)
  let real = 0
  let imaginary = 0

  for (let index = 0; index < values.length; index += 1) {
    const angle = (2 * Math.PI * bin * index) / Math.max(1, values.length)
    const value = (values[index] ?? 0) - center
    real += value * Math.cos(angle)
    imaginary -= value * Math.sin(angle)
  }

  return Math.sqrt(real ** 2 + imaginary ** 2) / Math.max(1, values.length)
}

function buildCrossSpectrum(
  samples: readonly Sample[],
  activeSeries: SeriesConfig,
): CrossSpectrumInsight {
  const candidate =
    buildCorrelationInsights(samples, activeSeries, numericSeries())[0]?.series ??
    getSeriesById('torque')
  const activeValues = sampleValues(samples, activeSeries)
  const candidateValues = sampleValues(samples, candidate)
  const sampleIntervalSeconds = 0.5
  const raw = Array.from({ length: 10 }, (_, index) => {
    const bin = index + 1
    const value = dftMagnitude(activeValues, bin) * dftMagnitude(candidateValues, bin)
    const frequency = bin / (Math.max(1, samples.length) * sampleIntervalSeconds)
    return {
      label: `${frequency.toFixed(2)} Hz`,
      value,
      width: 0,
    }
  })
  const maxValue = Math.max(1, ...raw.map((bin) => bin.value))
  const bins = raw.map((bin) => ({
    ...bin,
    width: (bin.value / maxValue) * 100,
  }))
  const firstBin = bins[0] ?? { label: '0.00 Hz', value: 0, width: 0 }
  const peak = bins.reduce(
    (current, candidateBin) => (candidateBin.value > current.value ? candidateBin : current),
    firstBin,
  )

  return {
    pairLabel: `${activeSeries.shortLabel} x ${candidate.shortLabel}`,
    peakLabel: peak?.label ?? '0.00 Hz',
    bins,
  }
}

function buildMultiresolutionEnergy(
  samples: readonly Sample[],
  series: SeriesConfig,
): EnergyBand[] {
  const values = sampleValues(samples, series)
  const shortDiff = values.map((value, index) => value - (values[index - 1] ?? value))
  const mediumResidual = values.map(
    (value, index) => value - (movingAverageValues(values, 5)[index] ?? value),
  )
  const longTrend = movingAverageValues(values, 15)
  const raw = [
    { label: 'Fast', value: rootMeanSquare(shortDiff), color: '#d92d20' },
    { label: 'Medium', value: rootMeanSquare(mediumResidual), color: '#d95319' },
    { label: 'Slow', value: standardDeviation(longTrend), color: '#0072bd' },
  ]
  const maxValue = Math.max(1, ...raw.map((item) => item.value))

  return raw.map((item) => ({
    ...item,
    width: (item.value / maxValue) * 100,
  }))
}

function buildCycleClusters(samples: readonly Sample[], series: SeriesConfig): CycleClusterItem[] {
  const repeatability = buildCycleRepeatability(samples, series)
  const averageDistance = average(repeatability.map((item) => Math.abs(item.deviation)))
  const maxDistance = Math.max(1, ...repeatability.map((item) => Math.abs(item.deviation)))

  return repeatability.map((item) => {
    const distance = Math.abs(item.deviation)
    let cluster = 'nominal'
    if (distance > averageDistance * 1.6 && item.deviation > 0) cluster = 'high peak'
    if (distance > averageDistance * 1.6 && item.deviation < 0) cluster = 'low response'

    return {
      label: item.label,
      cluster,
      distance,
      status: statusFromRisk((distance / maxDistance) * 75),
      width: (distance / maxDistance) * 100,
    }
  })
}

function buildTwinResidual(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): TwinResidualInsight {
  const driver =
    buildCorrelationInsights(samples, series, numericSeries())[0]?.series ?? getSeriesById('torque')
  const xValues = sampleValues(samples, driver)
  const yValues = sampleValues(samples, series)
  const xMean = average(xValues)
  const yMean = average(yValues)
  let numerator = 0
  let denominator = 0

  for (let index = 0; index < samples.length; index += 1) {
    const x = xValues[index] ?? 0
    const y = yValues[index] ?? 0
    numerator += (x - xMean) * (y - yMean)
    denominator += (x - xMean) ** 2
  }

  const slope = denominator > 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean
  const residuals = samples.map((sample) => {
    const expected = intercept + slope * valueFor(sample, driver.id)
    return valueFor(sample, series.id) - expected
  })

  return {
    driver,
    residuals,
    currentResidual: residuals[selectedIndex] ?? 0,
    rms: rootMeanSquare(residuals),
  }
}

function buildChatterItems(samples: readonly Sample[]): ChatterItem[] {
  const raw = numericSeries().map((series) => {
    let transitions = 0
    let shortestDwell = samples.length
    let dwell = 1
    let previousStatus = samples[0]
      ? statusForValue(valueFor(samples[0], series.id), series)
      : 'normal'

    for (let index = 1; index < samples.length; index += 1) {
      const sample = samples[index]
      if (!sample) continue
      const status = statusForValue(valueFor(sample, series.id), series)

      if (status !== previousStatus) {
        transitions += 1
        shortestDwell = Math.min(shortestDwell, dwell)
        dwell = 1
        previousStatus = status
      } else {
        dwell += 1
      }
    }

    shortestDwell = Math.min(shortestDwell, dwell)

    return {
      series,
      transitions,
      shortestDwell,
      status: statusFromRisk(transitions * 9 + (shortestDwell <= 2 ? 25 : 0)),
      width: 0,
    }
  })
  const maxTransitions = Math.max(1, ...raw.map((item) => item.transitions))

  return raw
    .map((item) => ({
      ...item,
      width: (item.transitions / maxTransitions) * 100,
    }))
    .sort((a, b) => b.transitions - a.transitions)
}

function buildScenarioForecasts(
  samples: readonly Sample[],
  series: SeriesConfig,
): ScenarioForecastItem[] {
  const last = samples[samples.length - 1]
  if (!last) return []

  const current = valueFor(last, series.id)
  const slope = linearSlopeForSeries(samples, series)
  const spread = buildForecastInsight(samples, series).spread
  const raw = [
    { label: 'Current trend', value: current + slope * 12 },
    { label: 'Stress case', value: current + slope * 16 + spread * 0.8 },
    { label: 'Recovery case', value: current + slope * 6 - spread * 0.5 },
  ]
  const maxDelta = Math.max(1, ...raw.map((item) => Math.abs(item.value - current)))

  return raw.map((item) => ({
    ...item,
    delta: item.value - current,
    status: statusForValue(item.value, series),
    width: (Math.abs(item.value - current) / maxDelta) * 100,
  }))
}

function buildEwmaInsight(samples: readonly Sample[], series: SeriesConfig): EwmaInsight {
  const values = sampleValues(samples, series)
  const lambda = 0.22
  const mean = average(values)
  const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
  const controlSigma = sigma * Math.sqrt(lambda / (2 - lambda))
  const ewmaValues: number[] = []
  let current = values[0] ?? mean

  for (const value of values) {
    current = lambda * value + (1 - lambda) * current
    ewmaValues.push(current)
  }

  const ucl = mean + 3 * controlSigma
  const lcl = mean - 3 * controlSigma

  return {
    values: ewmaValues,
    current: ewmaValues[ewmaValues.length - 1] ?? mean,
    ucl,
    lcl,
    violations: ewmaValues.filter((value) => value > ucl || value < lcl).length,
  }
}

function buildCusumInsight(samples: readonly Sample[], series: SeriesConfig): CusumInsight {
  const values = sampleValues(samples, series)
  const target = average(values)
  const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
  const slack = 0.5 * sigma
  const positive: number[] = []
  const negative: number[] = []
  let positiveSum = 0
  let negativeSum = 0

  for (const value of values) {
    positiveSum = Math.max(0, positiveSum + value - target - slack)
    negativeSum = Math.min(0, negativeSum + value - target + slack)
    positive.push(positiveSum)
    negative.push(negativeSum)
  }

  const maxPositive = Math.max(0, ...positive)
  const maxNegative = Math.min(0, ...negative)
  const decisionLimit = 5 * sigma

  return {
    positive,
    negative,
    maxPositive,
    maxNegative,
    status: statusFromRisk((Math.max(maxPositive, Math.abs(maxNegative)) / decisionLimit) * 85),
  }
}

function buildKalmanInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): KalmanInsight {
  const values = sampleValues(samples, series)
  const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
  const processNoise = sigma ** 2 * 0.03
  const measurementNoise = sigma ** 2 * 0.22
  const estimates: number[] = []
  const residuals: number[] = []
  let estimate = values[0] ?? 0
  let error = sigma ** 2
  let gain = 0

  for (const measurement of values) {
    error += processNoise
    gain = error / (error + measurementNoise)
    estimate += gain * (measurement - estimate)
    error *= 1 - gain
    estimates.push(estimate)
    residuals.push(measurement - estimate)
  }

  return {
    estimates,
    residuals,
    currentEstimate: estimates[selectedIndex] ?? estimate,
    currentResidual: residuals[selectedIndex] ?? 0,
    gain,
  }
}

function buildDecompositionInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): DecompositionInsight {
  const values = sampleValues(samples, series)
  const trend = movingAverageValues(values, 17)
  const phaseMeans = Array.from({ length: 24 }, (_, phase) =>
    average(
      samples
        .map((sample, index) => ({ sample, value: values[index] ?? 0 }))
        .filter((item) => item.sample.cycle % 24 === phase)
        .map((item) => item.value),
    ),
  )
  const globalMean = average(values)
  const seasonal = samples.map(
    (sample) => (phaseMeans[sample.cycle % 24] ?? globalMean) - globalMean,
  )
  const residual = values.map(
    (value, index) => value - (trend[index] ?? value) - (seasonal[index] ?? 0),
  )
  const raw = [
    { label: 'Trend', value: standardDeviation(trend), color: '#0072bd' },
    { label: 'Seasonal', value: rootMeanSquare(seasonal), color: '#7c3aed' },
    { label: 'Residual', value: rootMeanSquare(residual), color: '#d92d20' },
  ]
  const maxValue = Math.max(1, ...raw.map((item) => item.value))

  return {
    trend,
    residual,
    bands: raw.map((item) => ({
      ...item,
      width: (item.value / maxValue) * 100,
    })),
  }
}

function buildStationarityInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): StationarityInsight {
  const values = sampleValues(samples, series)
  const midpoint = Math.floor(values.length / 2)
  const first = values.slice(0, midpoint)
  const second = values.slice(midpoint)
  const firstMean = average(first)
  const secondMean = average(second)
  const firstSigma = Math.max(
    standardDeviation(first),
    (series.domain[1] - series.domain[0]) * 0.001,
  )
  const secondSigma = Math.max(
    standardDeviation(second),
    (series.domain[1] - series.domain[0]) * 0.001,
  )
  const pooledSigma = Math.max((firstSigma + secondSigma) / 2, 1)
  const meanShift = (secondMean - firstMean) / pooledSigma
  const varianceRatio =
    Math.max(firstSigma, secondSigma) / Math.max(0.001, Math.min(firstSigma, secondSigma))
  const risk = Math.abs(meanShift) * 18 + Math.max(0, varianceRatio - 1) * 18

  return {
    meanShift,
    varianceRatio,
    status: statusFromRisk(risk),
    width: clamp(risk, 0, 100),
  }
}

function buildSpectralEntropy(
  samples: readonly Sample[],
  series: SeriesConfig,
): SpectralEntropyInsight {
  const values = sampleValues(samples, series)
  const raw = Array.from({ length: 12 }, (_, index) => {
    const bin = index + 1
    const magnitude = dftMagnitude(values, bin)
    const frequency = bin / (Math.max(1, samples.length) * 0.5)
    return {
      bin,
      label: `${frequency.toFixed(2)} Hz`,
      magnitude,
      width: 0,
    }
  })
  const total = Math.max(
    1,
    raw.reduce((sum, bin) => sum + bin.magnitude, 0),
  )
  const entropy =
    -raw.reduce((sum, bin) => {
      const probability = bin.magnitude / total
      return probability > 0 ? sum + probability * Math.log(probability) : sum
    }, 0) / Math.log(raw.length)
  const maxMagnitude = Math.max(1, ...raw.map((bin) => bin.magnitude))

  return {
    entropy,
    status: statusFromRisk(entropy * 70),
    bins: raw.map((bin) => ({
      ...bin,
      width: (bin.magnitude / maxMagnitude) * 100,
    })),
  }
}

function buildPcaInsight(samples: readonly Sample[]): PcaInsight {
  const seriesList = numericSeries()
  const standardized = seriesList.map((series) => {
    const values = sampleValues(samples, series)
    const mean = average(values)
    const sigma = Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001)
    return values.map((value) => (value - mean) / sigma)
  })
  const score = samples.map((_, sampleIndex) =>
    average(standardized.map((values) => values[sampleIndex] ?? 0)),
  )
  const contributions = seriesList
    .map((series, index) => {
      const loading = pearsonCorrelation(standardized[index] ?? [], score)
      return {
        series,
        loading,
        contribution: Math.abs(loading),
        width: 0,
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
  const totalContribution = Math.max(
    1,
    contributions.reduce((sum, item) => sum + item.contribution, 0),
  )

  return {
    variance: clamp((standardDeviation(score) ** 2 / Math.max(1, seriesList.length)) * 100, 0, 100),
    contributions: contributions.map((item) => ({
      ...item,
      width: (item.contribution / totalContribution) * 100,
    })),
  }
}

function buildMahalanobisInsight(
  samples: readonly Sample[],
  selectedIndex: number,
): MahalanobisInsight {
  const seriesList = numericSeries()
  const stats = seriesList.map((series) => {
    const values = sampleValues(samples, series)
    return {
      series,
      mean: average(values),
      sigma: Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001),
    }
  })
  const distances = samples.map((sample) =>
    Math.sqrt(
      average(
        stats.map((item) => ((valueFor(sample, item.series.id) - item.mean) / item.sigma) ** 2),
      ),
    ),
  )
  const threshold = percentile(distances, 0.95)
  const current = distances[selectedIndex] ?? 0

  return {
    distances,
    current,
    threshold,
    status: current > threshold ? 'anomaly' : 'normal',
  }
}

function buildRecurrenceInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): RecurrenceInsight {
  const values = sampleValues(samples, series).map((value) => normalizeValue(value, series.domain))
  const step = 3
  const threshold = 8
  const points: HysteresisPoint[] = []
  let recurrent = 0
  let diagonal = 0
  let total = 0

  for (let i = 0; i < values.length; i += step) {
    for (let j = 0; j < values.length; j += step) {
      total += 1
      const isRecurrent = Math.abs((values[i] ?? 0) - (values[j] ?? 0)) <= threshold
      if (isRecurrent) {
        recurrent += 1
        if (points.length < 90) {
          points.push({
            x: (i / Math.max(1, values.length - 1)) * 100,
            y: (j / Math.max(1, values.length - 1)) * 100,
          })
        }
        if (
          Math.abs(
            (values[i + step] ?? Number.NaN) - (values[j + step] ?? Number.POSITIVE_INFINITY),
          ) <= threshold
        ) {
          diagonal += 1
        }
      }
    }
  }

  return {
    rate: total > 0 ? (recurrent / total) * 100 : 0,
    determinism: recurrent > 0 ? (diagonal / recurrent) * 100 : 0,
    points,
  }
}

function zNormalizedWindow(values: readonly number[], start: number, windowSize: number): number[] {
  const window = values.slice(start, start + windowSize)
  const center = average(window)
  const sigma = Math.max(standardDeviation(window), 0.001)
  return window.map((value) => (value - center) / sigma)
}

function windowDistance(
  values: readonly number[],
  startA: number,
  startB: number,
  windowSize: number,
): number {
  const a = zNormalizedWindow(values, startA, windowSize)
  const b = zNormalizedWindow(values, startB, windowSize)
  return rootMeanSquare(a.map((value, index) => value - (b[index] ?? value)))
}

function buildMatrixProfile(
  samples: readonly Sample[],
  series: SeriesConfig,
): MatrixProfileInsight {
  const values = sampleValues(samples, series)
  const windowSize = 12
  const count = Math.max(1, values.length - windowSize + 1)
  const profile = Array.from({ length: count }, () => Number.POSITIVE_INFINITY)
  const matches = Array.from({ length: count }, () => 0)

  for (let start = 0; start < count; start += 1) {
    for (let candidate = 0; candidate < count; candidate += 1) {
      if (Math.abs(candidate - start) < windowSize) continue
      const distance = windowDistance(values, start, candidate, windowSize)
      if (distance < (profile[start] ?? Number.POSITIVE_INFINITY)) {
        profile[start] = distance
        matches[start] = candidate
      }
    }
  }

  const finiteProfile = profile.map((value) => (Number.isFinite(value) ? value : 0))
  const motifDistance = Math.min(...finiteProfile)
  const discordDistance = Math.max(...finiteProfile)
  const motifStart = Math.max(0, finiteProfile.indexOf(motifDistance))
  const discordStart = Math.max(0, finiteProfile.indexOf(discordDistance))

  return {
    profile: finiteProfile,
    windowSize,
    motifStart,
    motifMatch: matches[motifStart] ?? 0,
    discordStart,
    motifDistance,
    discordDistance,
  }
}

function dtwDistance(aValues: readonly number[], bValues: readonly number[]): number {
  const table = Array.from({ length: aValues.length + 1 }, () =>
    Array.from({ length: bValues.length + 1 }, () => Number.POSITIVE_INFINITY),
  )
  const firstRow = table[0]
  if (firstRow) {
    firstRow[0] = 0
  }

  for (let row = 1; row <= aValues.length; row += 1) {
    for (let column = 1; column <= bValues.length; column += 1) {
      const cost = Math.abs((aValues[row - 1] ?? 0) - (bValues[column - 1] ?? 0))
      const currentRow = table[row]
      if (!currentRow) continue
      currentRow[column] =
        cost +
        Math.min(
          table[row - 1]?.[column] ?? Number.POSITIVE_INFINITY,
          currentRow[column - 1] ?? Number.POSITIVE_INFINITY,
          table[row - 1]?.[column - 1] ?? Number.POSITIVE_INFINITY,
        )
    }
  }

  return (
    (table[aValues.length]?.[bValues.length] ?? 0) / Math.max(1, aValues.length + bValues.length)
  )
}

function buildDtwCycleItems(samples: readonly Sample[], series: SeriesConfig): DtwCycleItem[] {
  const normalize = (value: number) => normalizeValue(value, series.domain) / 100
  const baseline = samples
    .filter((sample) => sample.cycle >= 0 && sample.cycle < 24)
    .map((sample) => normalize(valueFor(sample, series.id)))
  const raw: DtwCycleItem[] = []

  for (let startCycle = 0; startCycle <= 120; startCycle += 24) {
    const values = samples
      .filter((sample) => sample.cycle >= startCycle && sample.cycle < startCycle + 24)
      .map((sample) => normalize(valueFor(sample, series.id)))
    if (values.length < 4) continue
    const distance = dtwDistance(baseline, values)
    raw.push({
      label: `${startCycle}-${startCycle + values.length - 1}`,
      distance,
      status: statusFromRisk(distance * 140),
      width: 0,
    })
  }

  const maxDistance = Math.max(1, ...raw.map((item) => item.distance))
  return raw.map((item) => ({ ...item, width: (item.distance / maxDistance) * 100 }))
}

function buildLagCausalityItems(
  samples: readonly Sample[],
  targetSeries: SeriesConfig,
): LagCausalityItem[] {
  const targetValues = sampleValues(samples, targetSeries)
  const baselineAutocorr = Math.max(
    0,
    ...Array.from({ length: 5 }, (_, index) =>
      Math.abs(
        pearsonCorrelation(targetValues.slice(0, -(index + 1)), targetValues.slice(index + 1)),
      ),
    ),
  )
  const raw = numericSeries()
    .filter((series) => series.id !== targetSeries.id)
    .map((source) => {
      const lagScores = Array.from({ length: 6 }, (_, index) => {
        const lag = index + 1
        return {
          lag,
          correlation: Math.abs(laggedCorrelation(samples, source, targetSeries, lag)),
        }
      })
      const best = lagScores.reduce(
        (current, candidate) => (candidate.correlation > current.correlation ? candidate : current),
        lagScores[0] ?? { lag: 1, correlation: 0 },
      )
      const score = Math.max(0, best.correlation - baselineAutocorr * 0.45)

      return {
        source,
        target: targetSeries,
        lag: best.lag,
        score,
        status: statusFromRisk(score * 90),
        width: 0,
      }
    })
    .sort((a, b) => b.score - a.score)
  const maxScore = Math.max(1, ...raw.map((item) => item.score))

  return raw.map((item) => ({ ...item, width: (item.score / maxScore) * 100 }))
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function buildBayesianAlarmInsight(
  samples: readonly Sample[],
  selectedIndex: number,
): BayesianAlarmInsight {
  const evidence = buildHealthInsight(samples, selectedIndex).contributions.slice(0, 4)
  const probability = sigmoid(-2.2 + average(evidence.map((item) => item.risk)) / 18) * 100

  return {
    probability,
    status: statusFromRisk(probability),
    evidence,
  }
}

function buildHazardCurve(samples: readonly Sample[]): HazardPoint[] {
  const rulItems = buildRulItems(samples)

  return [12, 24, 48, 72, 120].map((horizon) => {
    const probability =
      average(
        rulItems.map((item) =>
          item.cycles === undefined ? 0.08 : clamp(1 - item.cycles / horizon, 0, 1),
        ),
      ) * 100

    return {
      label: `${horizon} cycles`,
      probability,
      status: statusFromRisk(probability),
      width: probability,
    }
  })
}

function buildFusionConsistency(
  samples: readonly Sample[],
  targetSeries: SeriesConfig,
  selectedIndex: number,
): FusionConsistencyInsight {
  const pair =
    buildCorrelationInsights(samples, targetSeries, numericSeries())[0]?.series ??
    getSeriesById('torque')
  const residuals = samples.map((sample) => {
    const targetValue = normalizeValue(valueFor(sample, targetSeries.id), targetSeries.domain)
    const pairValue = normalizeValue(valueFor(sample, pair.id), pair.domain)
    return targetValue - pairValue
  })
  const rms = rootMeanSquare(residuals)
  const current = residuals[selectedIndex] ?? 0

  return {
    pairLabel: `${targetSeries.shortLabel} vs ${pair.shortLabel}`,
    residuals,
    current,
    rms,
    status: statusFromRisk(Math.abs(current) * 2 + rms),
  }
}

function buildCalibrationOffsets(samples: readonly Sample[]): CalibrationOffsetItem[] {
  return numericSeries()
    .map((series) => {
      const target = series.thresholds?.target ?? (series.domain[0] + series.domain[1]) / 2
      const offset = average(sampleValues(samples, series)) - target
      const width = (Math.abs(offset) / Math.max(1, series.domain[1] - series.domain[0])) * 100

      return {
        series,
        offset,
        status: statusFromRisk(width * 5),
        width,
      }
    })
    .sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset))
}

function buildSpectrogramInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): SpectrogramInsight {
  const windowSize = 24
  const sampleIntervalSeconds = 0.5
  const starts = [0, 24, 48, 72, 96]
  const bins = [1, 2, 3, 4, 5]
  const rows = bins.map((bin) => `${(bin / (windowSize * sampleIntervalSeconds)).toFixed(2)} Hz`)
  const columns = starts.map((start) => `${start}-${start + windowSize - 1}`)
  const rawCells = starts.flatMap((start, column) => {
    const windowValues = sampleValues(
      samples.filter((sample) => sample.cycle >= start && sample.cycle < start + windowSize),
      series,
    )

    return bins.map((bin, row) => ({
      row,
      column,
      value: dftMagnitude(windowValues, bin),
      width: 0,
    }))
  })
  const maxMagnitude = Math.max(1, ...rawCells.map((cell) => cell.value))
  const cells = rawCells.map((cell) => ({ ...cell, width: (cell.value / maxMagnitude) * 100 }))
  const peak = cells.reduce(
    (current, candidate) => (candidate.value > current.value ? candidate : current),
    cells[0] ?? { row: 0, column: 0, value: 0, width: 0 },
  )

  return {
    rows,
    columns,
    cells,
    peakLabel: `${columns[peak.column] ?? '-'} / ${rows[peak.row] ?? '-'}`,
    peakMagnitude: peak.value,
  }
}

function buildRollingCorrelationMap(
  samples: readonly Sample[],
  targetSeries: SeriesConfig,
): RollingCorrelationInsight {
  const windowSize = 24
  const starts = [0, 24, 48, 72, 96]
  const columns = starts.map((start) => `${start}-${start + windowSize - 1}`)
  const rows = numericSeries()
    .filter((series) => series.id !== targetSeries.id)
    .map((series) => {
      const values = starts.map((start) => {
        const windowSamples = samples.filter(
          (sample) => sample.cycle >= start && sample.cycle < start + windowSize,
        )
        return pearsonCorrelation(
          sampleValues(windowSamples, targetSeries),
          sampleValues(windowSamples, series),
        )
      })

      return { series, values }
    })
  let strongestLabel = 'none'
  let strongestValue = 0

  for (const row of rows) {
    for (let index = 0; index < row.values.length; index += 1) {
      const value = row.values[index] ?? 0
      if (Math.abs(value) > Math.abs(strongestValue)) {
        strongestValue = value
        strongestLabel = `${row.series.shortLabel} ${columns[index] ?? ''}`.trim()
      }
    }
  }

  return { rows, columns, strongestLabel }
}

function normalQuantile(probability: number): number {
  const p = clamp(probability, 0.001, 0.999)
  const tail = p < 0.5 ? p : 1 - p
  const t = Math.sqrt(-2 * Math.log(tail))
  const numerator = 2.515517 + 0.802853 * t + 0.010328 * t ** 2
  const denominator = 1 + 1.432788 * t + 0.189269 * t ** 2 + 0.001308 * t ** 3
  const z = t - numerator / denominator

  return p < 0.5 ? -z : z
}

function residualValues(samples: readonly Sample[], series: SeriesConfig): number[] {
  return samples.map(
    (sample, index) => valueFor(sample, series.id) - rollingAverageAt(samples, series, index, 11),
  )
}

function buildResidualQqInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): ResidualQqInsight {
  const residuals = residualValues(samples, series)
  const sigma = Math.max(standardDeviation(residuals), 0.001)
  const sorted = residuals.map((value) => value / sigma).sort((a, b) => a - b)
  const step = Math.max(1, Math.floor(sorted.length / 28))
  const points = sorted
    .filter((_, index) => index % step === 0)
    .map((value, index, selected) => {
      const probability = (index + 0.5) / Math.max(1, selected.length)
      return {
        x: normalQuantile(probability),
        y: value,
      }
    })
  const deviation = rootMeanSquare(points.map((point) => point.y - point.x))

  return {
    points,
    deviation,
    status: statusFromRisk(deviation * 42),
  }
}

function buildWhitenessInsight(samples: readonly Sample[], series: SeriesConfig): WhitenessInsight {
  const residuals = residualValues(samples, series)
  const n = residuals.length
  const lags = Array.from({ length: 8 }, (_, index) => {
    const lag = index + 1
    const correlation = pearsonCorrelation(residuals.slice(0, -lag), residuals.slice(lag))

    return {
      lag,
      correlation,
      width: Math.abs(correlation) * 100,
    }
  })
  const qStatistic =
    n *
    (n + 2) *
    lags.reduce((total, point) => total + point.correlation ** 2 / Math.max(1, n - point.lag), 0)
  const threshold = 15.5

  return {
    qStatistic,
    threshold,
    status: statusFromRisk((qStatistic / threshold) * 55),
    lags,
  }
}

function predictionErrors(samples: readonly Sample[], series: SeriesConfig): number[] {
  const values = sampleValues(samples, series)
  if (values.length < 2) return []

  return values.slice(1).map((value, index) => {
    const history = values.slice(Math.max(0, index - 11), index + 1)
    return value - average(history)
  })
}

function buildPredictionCoverageInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
): PredictionCoverageInsight {
  const errors = predictionErrors(samples, series)
  const sigma = Math.max(standardDeviation(errors), 0.001)
  const interval = 1.96 * sigma
  const misses = errors.filter((error) => Math.abs(error) > interval).length
  const coverage = errors.length > 0 ? ((errors.length - misses) / errors.length) * 100 : 100

  return {
    coverage,
    misses,
    meanWidth: interval * 2,
    status: statusFromRisk(Math.abs(95 - coverage) * 8 + misses * 1.2),
    errors,
  }
}

function buildReliabilityBands(
  samples: readonly Sample[],
  series: SeriesConfig,
): ReliabilityBand[] {
  const errors = predictionErrors(samples, series)
  const sigma = Math.max(standardDeviation(errors), 0.001)
  const specs = [
    { label: '50%', expected: 50, z: 0.674 },
    { label: '80%', expected: 80, z: 1.282 },
    { label: '95%', expected: 95, z: 1.96 },
    { label: '99%', expected: 99, z: 2.576 },
  ]

  return specs.map((spec) => {
    const observed =
      errors.length > 0
        ? (errors.filter((error) => Math.abs(error) <= spec.z * sigma).length / errors.length) * 100
        : 100

    return {
      label: spec.label,
      expected: spec.expected,
      observed,
      status: statusFromRisk(Math.abs(observed - spec.expected) * 7),
      width: observed,
    }
  })
}

function regressionGain(
  sourceValues: readonly number[],
  targetValues: readonly number[],
): { gain: number; correlation: number } {
  const length = Math.min(sourceValues.length, targetValues.length)
  if (length < 3) return { gain: 0, correlation: 0 }

  const source = sourceValues.slice(0, length)
  const target = targetValues.slice(0, length)
  const sourceMean = average(source)
  const targetMean = average(target)
  let covariance = 0
  let variance = 0

  for (let index = 0; index < length; index += 1) {
    const sourceDelta = (source[index] ?? sourceMean) - sourceMean
    covariance += sourceDelta * ((target[index] ?? targetMean) - targetMean)
    variance += sourceDelta ** 2
  }

  return {
    gain: variance > 0 ? covariance / variance : 0,
    correlation: pearsonCorrelation(source, target),
  }
}

function buildTransferGainItems(
  samples: readonly Sample[],
  targetSeries: SeriesConfig,
): TransferGainItem[] {
  const targetValues = sampleValues(samples, targetSeries)
  const raw = numericSeries()
    .filter((series) => series.id !== targetSeries.id)
    .map((source) => {
      const sourceValues = sampleValues(samples, source)
      const candidates = Array.from({ length: 6 }, (_, lag) => {
        const sourceWindow = sourceValues.slice(0, Math.max(0, sourceValues.length - lag))
        const targetWindow = targetValues.slice(lag)
        const result = regressionGain(sourceWindow, targetWindow)

        return { lag, ...result }
      })
      const best = candidates.reduce(
        (current, candidate) =>
          Math.abs(candidate.correlation) > Math.abs(current.correlation) ? candidate : current,
        candidates[0] ?? { lag: 0, gain: 0, correlation: 0 },
      )

      return {
        source,
        lag: best.lag,
        gain: best.gain,
        correlation: best.correlation,
        status: statusFromRisk(Math.abs(best.correlation) * 80),
        width: 0,
      }
    })
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
  const maxGain = Math.max(1, ...raw.map((item) => Math.abs(item.gain)))

  return raw.map((item) => ({ ...item, width: (Math.abs(item.gain) / maxGain) * 100 }))
}

function buildStateTransitionItems(samples: readonly Sample[]): StateTransitionItem[] {
  const counts = new Map<string, number>()
  const fromCounts = new Map<number, number>()

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (!previous || !current || previous.cycleState === current.cycleState) continue

    const from = previous.cycleState
    const to = current.cycleState
    const key = `${from}:${to}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    fromCounts.set(from, (fromCounts.get(from) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [fromRaw, toRaw] = key.split(':')
      const from = Number(fromRaw)
      const to = Number(toRaw)
      const probability = (count / Math.max(1, fromCounts.get(from) ?? 1)) * 100
      const expectedTo = (from + 1) % STAGE_LABELS.length
      const unexpected = to !== expectedTo

      return {
        from: STAGE_LABELS[from] ?? String(from),
        to: STAGE_LABELS[to] ?? String(to),
        probability,
        count,
        status: unexpected ? statusFromRisk(probability + 45) : 'normal',
        width: probability,
      }
    })
    .sort((a, b) => b.count - a.count || b.probability - a.probability)
    .slice(0, 6)
}

function buildEarlyWarningLeadItems(samples: readonly Sample[]): EarlyWarningLeadItem[] {
  return numericSeries()
    .filter((series) => series.thresholds)
    .map((series) => {
      const warningIndex = samples.findIndex((sample) => {
        const status = statusForValue(valueFor(sample, series.id), series)
        return severityRank(status) >= 1
      })
      const alarmIndex = samples.findIndex((sample) => {
        const status = statusForValue(valueFor(sample, series.id), series)
        return severityRank(status) >= 3
      })

      if (alarmIndex < 0) {
        return {
          series,
          leadCycles: undefined,
          status: 'normal' as const,
          width: 12,
        }
      }

      const warningSample = samples[Math.max(0, warningIndex)]
      const alarmSample = samples[alarmIndex]
      const leadCycles =
        warningSample && alarmSample ? Math.max(0, alarmSample.cycle - warningSample.cycle) : 0

      return {
        series,
        leadCycles,
        status: statusFromRisk(90 - clamp(leadCycles * 8, 0, 80)),
        width: clamp(leadCycles * 8, 8, 100),
      }
    })
    .sort(
      (a, b) =>
        (a.leadCycles ?? Number.POSITIVE_INFINITY) - (b.leadCycles ?? Number.POSITIVE_INFINITY),
    )
}

function buildWaveletScalogram(
  samples: readonly Sample[],
  series: SeriesConfig,
): SpectrogramInsight {
  const windowSize = 24
  const starts = [0, 24, 48, 72, 96]
  const scales = [2, 4, 8, 12, 16]
  const values = sampleValues(samples, series)
  const rows = scales.map((scale) => `${scale} pt`)
  const columns = starts.map((start) => `${start}-${start + windowSize - 1}`)
  const rawCells = starts.flatMap((startCycle, column) => {
    const startIndex = nearestSampleIndex(samples, startCycle)
    const endIndex = nearestSampleIndex(samples, startCycle + windowSize - 1)

    return scales.map((scale, row) => {
      const energyValues: number[] = []
      for (let index = startIndex + scale; index <= endIndex; index += 1) {
        const current = values[index]
        const previous = values[index - scale]
        if (current === undefined || previous === undefined) continue
        energyValues.push(current - previous)
      }

      return {
        row,
        column,
        value: rootMeanSquare(energyValues),
        width: 0,
      }
    })
  })
  const maxEnergy = Math.max(1, ...rawCells.map((cell) => cell.value))
  const cells = rawCells.map((cell) => ({ ...cell, width: (cell.value / maxEnergy) * 100 }))
  const peak = cells.reduce(
    (current, candidate) => (candidate.value > current.value ? candidate : current),
    cells[0] ?? { row: 0, column: 0, value: 0, width: 0 },
  )

  return {
    rows,
    columns,
    cells,
    peakLabel: `${columns[peak.column] ?? '-'} / ${rows[peak.row] ?? '-'}`,
    peakMagnitude: peak.value,
  }
}

function buildEnvelopeSpectrum(samples: readonly Sample[]): SpectrumBin[] {
  const vibrationSeries = getSeriesById('vibration')
  const residuals = residualValues(samples, vibrationSeries)
  const envelope = residuals.map(Math.abs)
  const sampleIntervalSeconds = 0.5
  const rawBins = Array.from({ length: 10 }, (_, index) => {
    const bin = index + 1
    const frequency = bin / (Math.max(1, envelope.length) * sampleIntervalSeconds)

    return {
      bin,
      label: `${frequency.toFixed(2)} Hz`,
      magnitude: dftMagnitude(envelope, bin),
      width: 0,
    }
  })
  const maxMagnitude = Math.max(1, ...rawBins.map((bin) => bin.magnitude))

  return rawBins.map((bin) => ({ ...bin, width: (bin.magnitude / maxMagnitude) * 100 }))
}

function buildOrderTracking(samples: readonly Sample[], series: SeriesConfig): SpectrumBin[] {
  const phaseValues = Array.from({ length: 24 }, (_, phase) =>
    average(
      sampleValues(
        samples.filter((sample) => sample.cycle % 24 === phase),
        series,
      ),
    ),
  )
  const rawBins = Array.from({ length: 6 }, (_, index) => {
    const order = index + 1

    return {
      bin: order,
      label: `${order}x`,
      magnitude: dftMagnitude(phaseValues, order),
      width: 0,
    }
  })
  const maxMagnitude = Math.max(1, ...rawBins.map((bin) => bin.magnitude))

  return rawBins.map((bin) => ({ ...bin, width: (bin.magnitude / maxMagnitude) * 100 }))
}

function turningPointValues(values: readonly number[]): number[] {
  const points: number[] = []
  for (let index = 1; index < values.length - 1; index += 1) {
    const previous = values[index - 1]
    const current = values[index]
    const next = values[index + 1]
    if (previous === undefined || current === undefined || next === undefined) continue
    if ((current >= previous && current > next) || (current <= previous && current < next)) {
      points.push(current)
    }
  }

  return points
}

function buildFatigueDamageBins(
  samples: readonly Sample[],
  series: SeriesConfig,
): FatigueDamageBin[] {
  const domainSpan = Math.max(1, series.domain[1] - series.domain[0])
  const points = turningPointValues(sampleValues(samples, series))
  const buckets = [
    { label: '0-20%', low: 0, high: 0.2 },
    { label: '20-40%', low: 0.2, high: 0.4 },
    { label: '40-60%', low: 0.4, high: 0.6 },
    { label: '60-80%', low: 0.6, high: 0.8 },
    { label: '80%+', low: 0.8, high: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({ ...bucket, count: 0, damage: 0 }))

  for (let index = 1; index < points.length; index += 1) {
    const range = Math.abs((points[index] ?? 0) - (points[index - 1] ?? 0)) / domainSpan
    const bucket = buckets.find((candidate) => range >= candidate.low && range < candidate.high)
    if (!bucket) continue
    bucket.count += 1
    bucket.damage += range ** 3
  }

  const maxDamage = Math.max(1, ...buckets.map((bucket) => bucket.damage))
  return buckets.map((bucket) => {
    const width = (bucket.damage / maxDamage) * 100

    return {
      label: bucket.label,
      count: bucket.count,
      damage: bucket.damage,
      status: statusFromRisk(width * 0.9),
      width,
    }
  })
}

function buildDamageAccumulation(
  samples: readonly Sample[],
  series: SeriesConfig,
): DamageAccumulationInsight {
  const values = sampleValues(samples, series)
  const span = Math.max(1, series.domain[1] - series.domain[0])
  const accumulated: number[] = []
  let total = 0

  for (let index = 1; index < values.length; index += 1) {
    const delta = Math.abs((values[index] ?? 0) - (values[index - 1] ?? 0)) / span
    total += delta ** 3 * 100
    accumulated.push(total)
  }

  const current = accumulated[accumulated.length - 1] ?? 0
  const projected = current * (144 / Math.max(1, samples.length))

  return {
    values: accumulated,
    current,
    projected,
    status: statusFromRisk(projected),
  }
}

function buildRegimeProbabilityItems(
  samples: readonly Sample[],
  selectedIndex: number,
): RegimeProbabilityItem[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) return []

  const pressure = normalizeValue(selected.pressure, getSeriesById('pressure').domain)
  const torque = normalizeValue(selected.torque, getSeriesById('torque').domain)
  const temperature = normalizeValue(selected.temperature, getSeriesById('temperature').domain)
  const vibration = normalizeValue(selected.vibration, getSeriesById('vibration').domain)
  const lubeRisk = 100 - normalizeValue(selected.lubrication, getSeriesById('lubrication').domain)
  const raw = [
    {
      label: 'Nominal',
      value: clamp(100 - Math.max(pressure, torque, temperature, vibration, lubeRisk), 0, 100),
      color: '#027a48',
    },
    { label: 'High load', value: average([pressure, torque]), color: '#dc6803' },
    { label: 'Thermal', value: temperature, color: '#f59e0b' },
    { label: 'Vibration', value: vibration, color: '#7e2f8e' },
    { label: 'Lube risk', value: lubeRisk, color: '#0891b2' },
  ]
  const total = Math.max(
    1,
    raw.reduce((sum, item) => sum + item.value, 0),
  )

  return raw
    .map((item) => {
      const probability = (item.value / total) * 100

      return {
        label: item.label,
        probability,
        status: item.label === 'Nominal' ? 'normal' : statusFromRisk(probability * 2.6),
        width: probability,
        color: item.color,
      }
    })
    .sort((a, b) => b.probability - a.probability)
}

function buildAnomalyScoreInsight(
  samples: readonly Sample[],
  selectedIndex: number,
): AnomalyScoreInsight {
  const stats = numericSeries().map((series) => {
    const values = sampleValues(samples, series)
    return {
      series,
      mean: average(values),
      sigma: Math.max(standardDeviation(values), (series.domain[1] - series.domain[0]) * 0.001),
    }
  })
  const scores = samples.map((sample) =>
    clamp(
      average(
        stats.map((item) => {
          const value = valueFor(sample, item.series.id)
          const zScore = Math.abs(value - item.mean) / item.sigma
          const severity = severityRank(statusForValue(value, item.series)) * 28
          return zScore * 16 + severity
        }),
      ),
      0,
      100,
    ),
  )
  const current = scores[selectedIndex] ?? scores[scores.length - 1] ?? 0
  const p95 = percentile(scores, 0.95)

  return {
    scores,
    current,
    p95,
    status: statusFromRisk(Math.max(current, p95 * 0.8)),
  }
}

function buildSensorVoteInsight(
  samples: readonly Sample[],
  selectedIndex: number,
): SensorVoteInsight {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  const counts: Record<SignalStatus, number> = {
    normal: 0,
    warning: 0,
    anomaly: 0,
    alarm: 0,
  }

  if (selected) {
    for (const series of numericSeries()) {
      counts[statusForValue(valueFor(selected, series.id), series)] += 1
    }
  }

  const total = Math.max(1, numericSeries().length)
  const votes: SensorVoteItem[] = (['normal', 'warning', 'anomaly', 'alarm'] as const).map(
    (label) => ({
      label,
      count: counts[label],
      width: (counts[label] / total) * 100,
    }),
  )
  const dominant = votes.reduce(
    (current, candidate) => (candidate.count > current.count ? candidate : current),
    votes[0] ?? { label: 'normal' as const, count: 0, width: 0 },
  )
  const agreement = dominant.width

  return {
    agreement,
    status:
      dominant.label === 'normal'
        ? statusFromRisk(100 - agreement)
        : statusFromRisk(severityRank(dominant.label) * 30 + (100 - agreement) * 0.2),
    votes,
  }
}

function buildMaintenanceWindows(samples: readonly Sample[]): MaintenanceWindowItem[] {
  const windowSize = 12
  const raw = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108].map((start) => {
    const windowSamples = samples.filter(
      (sample) => sample.cycle >= start && sample.cycle < start + windowSize,
    )
    const risk = average(
      windowSamples.map((sample) =>
        average(
          numericSeries().map(
            (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) * 30,
          ),
        ),
      ),
    )
    const score = clamp(100 - risk, 0, 100)

    return {
      label: `${start}-${start + windowSize - 1}`,
      score,
      risk,
      status: statusFromRisk(risk),
      width: score,
    }
  })

  return raw.sort((a, b) => b.score - a.score).slice(0, 5)
}

function buildCorrelationMatrix(
  samples: readonly Sample[],
  useResiduals = false,
): MatrixHeatmapInsight {
  const seriesList = numericSeries()
  const rows = seriesList.map((series) => series.shortLabel)
  const columns = rows
  const valuesBySeries = seriesList.map((series) =>
    useResiduals
      ? residualValues(samples, series)
      : sampleValues(samples, series).map((value) => normalizeValue(value, series.domain)),
  )
  const cells = seriesList.flatMap((_rowSeries, row) =>
    seriesList.map((_columnSeries, column) => {
      const value =
        row === column
          ? 1
          : pearsonCorrelation(valuesBySeries[row] ?? [], valuesBySeries[column] ?? [])

      return {
        row,
        column,
        value,
        width: Math.abs(value) * 100,
      }
    }),
  )
  const offDiagonal = cells.filter((cell) => cell.row !== cell.column)
  const peak = offDiagonal.reduce(
    (current, candidate) =>
      Math.abs(candidate.value) > Math.abs(current.value) ? candidate : current,
    offDiagonal[0] ?? { row: 0, column: 0, value: 0, width: 0 },
  )

  return {
    rows,
    columns,
    cells,
    peakLabel: `${rows[peak.row] ?? '-'} / ${columns[peak.column] ?? '-'}`,
    peakValue: peak.value,
  }
}

function buildFaultSignatureItems(
  samples: readonly Sample[],
  selectedIndex: number,
): FaultSignatureItem[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) return []

  const vector = {
    pressure: normalizeValue(selected.pressure, getSeriesById('pressure').domain) / 100,
    torque: normalizeValue(selected.torque, getSeriesById('torque').domain) / 100,
    temperature: normalizeValue(selected.temperature, getSeriesById('temperature').domain) / 100,
    vibration: normalizeValue(selected.vibration, getSeriesById('vibration').domain) / 100,
    lubrication:
      1 - normalizeValue(selected.lubrication, getSeriesById('lubrication').domain) / 100,
  }
  const templates = [
    {
      label: 'High load',
      color: '#dc6803',
      values: {
        pressure: 0.78,
        torque: 0.82,
        temperature: 0.48,
        vibration: 0.36,
        lubrication: 0.22,
      },
    },
    {
      label: 'Lube loss',
      color: '#0891b2',
      values: {
        pressure: 0.38,
        torque: 0.45,
        temperature: 0.55,
        vibration: 0.74,
        lubrication: 0.92,
      },
    },
    {
      label: 'Thermal drift',
      color: '#f59e0b',
      values: {
        pressure: 0.42,
        torque: 0.38,
        temperature: 0.9,
        vibration: 0.28,
        lubrication: 0.35,
      },
    },
    {
      label: 'Resonance',
      color: '#7e2f8e',
      values: {
        pressure: 0.36,
        torque: 0.52,
        temperature: 0.38,
        vibration: 0.94,
        lubrication: 0.42,
      },
    },
    {
      label: 'Restriction',
      color: '#155eef',
      values: {
        pressure: 0.88,
        torque: 0.28,
        temperature: 0.36,
        vibration: 0.3,
        lubrication: 0.26,
      },
    },
  ]

  return templates
    .map((template) => {
      const distance = rootMeanSquare(
        Object.entries(template.values).map(([key, expected]) => {
          const actual = vector[key as keyof typeof vector]
          return (actual ?? 0) - expected
        }),
      )
      const probability = clamp((1 - distance) * 100, 0, 100)

      return {
        label: template.label,
        probability,
        status: statusFromRisk(probability),
        width: probability,
        color: template.color,
      }
    })
    .sort((a, b) => b.probability - a.probability)
}

function buildRootCauseItems(samples: readonly Sample[], selectedIndex: number): RootCauseItem[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) return []

  const health = buildHealthInsight(samples, selectedIndex)
  const maxRisk = Math.max(1, ...health.contributions.map((item) => item.risk))

  return health.contributions.map((item) => {
    const value = valueFor(selected, item.series.id)
    const baseline = rollingAverageAt(samples, item.series, selectedIndex, 11)

    return {
      series: item.series,
      contribution: item.risk,
      direction: value >= baseline ? 'high' : 'low',
      status: item.status,
      width: (item.risk / maxRisk) * 100,
    }
  })
}

function buildInterventionItems(
  samples: readonly Sample[],
  selectedIndex: number,
): InterventionItem[] {
  const causes = buildRootCauseItems(samples, selectedIndex)
  const templates = causes.map((cause) => {
    const actionBySeries: Record<SeriesId, string> = {
      pressure: 'Inspect pressure circuit',
      torque: 'Review tooling load',
      temperature: 'Cool thermal path',
      vibration: 'Balance vibration path',
      cycleState: 'Review sequence logic',
      lubrication: 'Service lubrication',
    }
    const reduction = clamp(
      cause.contribution * (cause.series.id === 'lubrication' ? 1.3 : 1.05),
      0,
      100,
    )

    return {
      label: actionBySeries[cause.series.id],
      driver: cause.series.shortLabel,
      reduction,
      status: statusFromRisk(reduction),
      width: reduction,
    }
  })

  return templates.sort((a, b) => b.reduction - a.reduction).slice(0, 5)
}

function anomalyScoreForSample(sample: Sample, samples: readonly Sample[]): number {
  return clamp(
    average(
      numericSeries().map((series) => {
        const values = sampleValues(samples, series)
        const sigma = Math.max(
          standardDeviation(values),
          (series.domain[1] - series.domain[0]) * 0.001,
        )
        const zScore = Math.abs(valueFor(sample, series.id) - average(values)) / sigma
        return zScore * 18 + severityRank(statusForValue(valueFor(sample, series.id), series)) * 28
      }),
    ),
    0,
    100,
  )
}

function maintenanceRiskForSample(sample: Sample, samples: readonly Sample[]): number {
  const severityRisk = average(
    numericSeries().map(
      (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) * 33,
    ),
  )
  const anomalyRisk = anomalyScoreForSample(sample, samples)
  const lubricationRisk = clamp((55 - sample.lubrication) / 55, 0, 1) * 100
  const vibrationRisk = normalizeValue(sample.vibration, getSeriesById('vibration').domain)
  const temperatureRisk = normalizeValue(sample.temperature, getSeriesById('temperature').domain)

  return clamp(
    severityRisk * 0.34 +
      anomalyRisk * 0.28 +
      lubricationRisk * 0.2 +
      vibrationRisk * 0.12 +
      temperatureRisk * 0.06,
    0,
    100,
  )
}

function buildMaintenanceDecisionInsight(
  risk: number,
  horizonRisk: number,
  rulCycles: number | undefined,
  modelConfidence: number,
  runCostIndex: number,
  plannedCostIndex: number,
): MaintenanceDecisionInsight {
  if (modelConfidence < 45) {
    return {
      label: 'Validate data',
      description: 'sensor confidence low',
      status: 'warning',
      width: 45,
    }
  }

  if (risk >= 80 || horizonRisk >= 75 || (rulCycles ?? Number.POSITIVE_INFINITY) <= 3) {
    return {
      label: 'Stop now',
      description: 'failure risk is immediate',
      status: 'alarm',
      width: 100,
    }
  }

  if (risk >= 60 || horizonRisk >= 55 || (rulCycles ?? Number.POSITIVE_INFINITY) <= 12) {
    return {
      label: 'Schedule maintenance',
      description: 'planned stop is lower risk',
      status: 'anomaly',
      width: 82,
    }
  }

  if (risk >= 40 || runCostIndex > plannedCostIndex * 1.8) {
    return {
      label: 'Inspect next stop',
      description: 'confirm driver before run extension',
      status: 'warning',
      width: 58,
    }
  }

  if (risk >= 25) {
    return {
      label: 'Watch',
      description: 'trend is elevated but controlled',
      status: 'warning',
      width: 36,
    }
  }

  return {
    label: 'Run',
    description: 'risk remains inside monitor band',
    status: 'normal',
    width: 18,
  }
}

function buildPhaseComparisonInsight(
  samples: readonly Sample[],
  series: SeriesConfig,
  selectedIndex: number,
): PhaseComparisonInsight {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) {
    return { label: 'Phase', average: 0, delta: 0, status: 'normal', width: 0 }
  }

  const phase = buildPhaseStats(samples, series).find((item) => item.state === selected.cycleState)
  const averageValue = phase?.average ?? rollingAverageAt(samples, series, selectedIndex)
  const delta = valueFor(selected, series.id) - averageValue
  const sigma = Math.max(
    standardDeviation(
      sampleValues(
        samples.filter((sample) => sample.cycleState === selected.cycleState),
        series,
      ),
    ),
    (series.domain[1] - series.domain[0]) * 0.01,
  )
  const zScore = Math.abs(delta) / sigma

  return {
    label: phase?.label ?? 'Phase',
    average: averageValue,
    delta,
    status: statusFromRisk(zScore * 28),
    width: clamp(zScore * 24, 4, 100),
  }
}

function buildPredictiveMaintenanceInsight(
  samples: readonly Sample[],
  selectedIndex: number,
  series: SeriesConfig,
): PredictiveMaintenanceInsight {
  const values = samples.map((sample) => maintenanceRiskForSample(sample, samples))
  const selectedRisk = values[selectedIndex] ?? values[values.length - 1] ?? 0
  const sensorVote = buildSensorVoteInsight(samples, selectedIndex)
  const freshness = buildDataFreshnessInsight(samples)
  const latency = buildLatencyInsight(samples)
  const modelConfidence = clamp(
    average([
      sensorVote.agreement,
      100 - freshness.p95Age * 90,
      100 - Math.max(0, latency.p95 - 45) * 0.9,
      100 - standardDeviation(values) * 0.28,
    ]),
    0,
    100,
  )
  const riskUncertainty = clamp(
    8 + (100 - modelConfidence) * 0.22 + standardDeviation(values) * 0.12,
    6,
    32,
  )
  const lowValues = values.map((value) => clamp(value - riskUncertainty, 0, 100))
  const highValues = values.map((value) => clamp(value + riskUncertainty, 0, 100))
  const rulItems = buildRulItems(samples).sort((a, b) => {
    if (a.cycles === undefined && b.cycles === undefined) return 0
    if (a.cycles === undefined) return 1
    if (b.cycles === undefined) return -1
    return a.cycles - b.cycles
  })
  const soonestRul = rulItems[0]
  const horizonRisk =
    buildHazardCurve(samples).find((item) => item.label === '24 cycles')?.probability ?? 0
  const bestWindow = buildMaintenanceWindows(samples)[0]
  const action = buildMaintenanceActions(samples, selectedIndex)[0]
  const leadItems = buildEarlyWarningLeadItems(samples)
  const lead =
    leadItems
      .filter((item) => item.leadCycles !== undefined)
      .sort((a, b) => (a.leadCycles ?? 999) - (b.leadCycles ?? 999))[0] ?? leadItems[0]
  const counterfactual = buildCounterfactualSensitivityItems(samples, selectedIndex)
  const whatIf =
    counterfactual
      .filter((item) => item.deltaRisk < 0)
      .sort((a, b) => a.deltaRisk - b.deltaRisk)[0] ?? counterfactual[0]
  const faultModes = buildFaultSignatureItems(samples, selectedIndex).slice(0, 3)
  const phaseComparison = buildPhaseComparisonInsight(samples, series, selectedIndex)
  const assetHealthValues = values.map((value) => clamp(100 - value, 0, 100))
  const assetHealth =
    assetHealthValues[selectedIndex] ?? assetHealthValues[assetHealthValues.length - 1] ?? 100
  const runCostIndex = clamp(
    selectedRisk * 0.75 +
      horizonRisk * 0.55 +
      (soonestRul?.cycles === undefined ? 0 : Math.max(0, 48 - soonestRul.cycles) * 0.9),
    0,
    100,
  )
  const plannedCostIndex = clamp(
    22 + (bestWindow?.risk ?? 0) * 0.35 + (action?.priority ?? 0) * 0.18,
    0,
    100,
  )
  const decision = buildMaintenanceDecisionInsight(
    selectedRisk,
    horizonRisk,
    soonestRul?.cycles,
    modelConfidence,
    runCostIndex,
    plannedCostIndex,
  )
  const status = statusFromRisk(
    Math.max(
      selectedRisk,
      horizonRisk,
      action?.priority ?? 0,
      100 - modelConfidence,
      decision.width,
      soonestRul?.cycles === 0 ? 100 : 0,
    ),
  )

  return {
    values,
    lowValues,
    highValues,
    selectedRisk,
    riskUncertainty,
    horizonRisk,
    modelConfidence,
    assetHealth,
    assetHealthValues,
    runCostIndex,
    plannedCostIndex,
    status,
    soonestRul,
    bestWindow,
    action,
    decision,
    faultModes,
    lead,
    whatIf,
    phaseComparison,
  }
}

function buildThresholdSweepItems(samples: readonly Sample[]): ThresholdSweepItem[] {
  const scored = samples.map((sample) => ({
    score: anomalyScoreForSample(sample, samples),
    actual: numericSeries().some(
      (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) >= 2,
    ),
  }))

  return [20, 35, 50, 65, 80].map((threshold) => {
    let tp = 0
    let fp = 0
    let tn = 0
    let fn = 0
    for (const item of scored) {
      const predicted = item.score >= threshold
      if (predicted && item.actual) tp += 1
      if (predicted && !item.actual) fp += 1
      if (!predicted && !item.actual) tn += 1
      if (!predicted && item.actual) fn += 1
    }
    const truePositiveRate = (tp / Math.max(1, tp + fn)) * 100
    const falsePositiveRate = (fp / Math.max(1, fp + tn)) * 100

    return {
      label: `>${threshold}`,
      truePositiveRate,
      falsePositiveRate,
      status: statusFromRisk(falsePositiveRate * 0.7 + (100 - truePositiveRate) * 0.4),
      width: truePositiveRate,
    }
  })
}

function buildConfusionMatrixInsight(samples: readonly Sample[]): ConfusionMatrixInsight {
  const rows = ['actual ok', 'actual fault']
  const columns = ['pred ok', 'pred fault']
  const scored = samples.map((sample) => {
    const score = anomalyScoreForSample(sample, samples)
    const actual = numericSeries().some(
      (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) >= 2,
    )
    return { actual, predicted: score >= 50 }
  })
  const counts = [
    [0, 0],
    [0, 0],
  ]
  for (const item of scored) {
    const row = item.actual ? 1 : 0
    const column = item.predicted ? 1 : 0
    const rowCounts = counts[row]
    if (rowCounts) {
      rowCounts[column] = (rowCounts[column] ?? 0) + 1
    }
  }
  const maxCount = Math.max(1, ...counts.flat())
  const cells = counts.flatMap((rowCounts, row) =>
    rowCounts.map((count, column) => ({
      row,
      column,
      value: count,
      width: (count / maxCount) * 100,
    })),
  )
  const correct = (counts[0]?.[0] ?? 0) + (counts[1]?.[1] ?? 0)

  return {
    rows,
    columns,
    cells,
    accuracy: (correct / Math.max(1, scored.length)) * 100,
  }
}

function buildDwellTimeItems(samples: readonly Sample[]): DwellTimeItem[] {
  const segments = buildSegments(samples)
  return STAGE_LABELS.map((label, state) => {
    const durations = segments
      .filter((segment) => segment.state === state)
      .map((segment) => segment.endCycle - segment.startCycle + 1)
    const p50 = percentile(durations, 0.5)
    const p95 = percentile(durations, 0.95)
    const width = clamp((p95 / 24) * 100, 0, 100)

    return {
      label,
      p50,
      p95,
      status: statusFromRisk(width * 0.6),
      width,
      color: STAGE_COLORS[state] ?? '#475467',
    }
  })
}

function buildCounterfactualSensitivityItems(
  samples: readonly Sample[],
  selectedIndex: number,
): CounterfactualSensitivityItem[] {
  const selected = samples[selectedIndex] ?? samples[samples.length - 1]
  if (!selected) return []

  const baseRisk = average(
    numericSeries().map((series) => {
      const value = valueFor(selected, series.id)
      return normalizeValue(value, series.domain) + severityRank(statusForValue(value, series)) * 22
    }),
  )

  return numericSeries()
    .map((series) => {
      const target = series.thresholds?.target ?? average(series.domain)
      const adjustedRisk = average(
        numericSeries().map((candidate) => {
          const value = candidate.id === series.id ? target : valueFor(selected, candidate.id)
          return (
            normalizeValue(value, candidate.domain) +
            severityRank(statusForValue(value, candidate)) * 22
          )
        }),
      )
      const deltaRisk = adjustedRisk - baseRisk
      const width = clamp(Math.abs(deltaRisk) * 2.2, 4, 100)

      return {
        series,
        deltaRisk,
        status: statusFromRisk(Math.abs(deltaRisk) * 2.4),
        width,
      }
    })
    .sort((a, b) => Math.abs(b.deltaRisk) - Math.abs(a.deltaRisk))
}

function buildImputationItems(samples: readonly Sample[]): ImputationItem[] {
  const medianDt = percentile(
    samples.slice(1).map((sample, index) => sample.time - (samples[index]?.time ?? sample.time)),
    0.5,
  )

  return numericSeries()
    .map((series) => {
      const values = sampleValues(samples, series)
      let gapCount = 0
      let heldCount = 0

      for (let index = 1; index < samples.length; index += 1) {
        const previousSample = samples[index - 1]
        const currentSample = samples[index]
        if (!previousSample || !currentSample) continue
        if (currentSample.time - previousSample.time > medianDt * 1.5) gapCount += 1

        const previousValue = values[index - 1]
        const currentValue = values[index]
        const tolerance = (series.domain[1] - series.domain[0]) * 0.001
        if (
          previousValue !== undefined &&
          currentValue !== undefined &&
          Math.abs(currentValue - previousValue) <= tolerance
        ) {
          heldCount += 1
        }
      }

      const imputedCount = gapCount * 2 + heldCount
      const width = (imputedCount / Math.max(1, samples.length)) * 100

      return {
        series,
        gapCount,
        heldCount,
        imputedCount,
        status: statusFromRisk(width * 4),
        width,
      }
    })
    .sort((a, b) => b.imputedCount - a.imputedCount)
}

function buildSensorSaturationItems(samples: readonly Sample[]): SensorSaturationItem[] {
  return numericSeries()
    .map((series) => {
      const span = Math.max(1, series.domain[1] - series.domain[0])
      const lowLimit = series.domain[0] + span * 0.05
      const highLimit = series.domain[1] - span * 0.05
      const values = sampleValues(samples, series)
      const lowCount = values.filter((value) => value <= lowLimit).length
      const highCount = values.filter((value) => value >= highLimit).length
      const percent = ((lowCount + highCount) / Math.max(1, values.length)) * 100

      return {
        series,
        lowCount,
        highCount,
        percent,
        status: statusFromRisk(percent * 3),
        width: percent,
      }
    })
    .sort((a, b) => b.percent - a.percent)
}

function buildLatencyInsight(samples: readonly Sample[]): LatencyInsight {
  const values = samples.map((sample, index) => {
    const risk =
      average(
        numericSeries().map(
          (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) * 18,
        ),
      ) +
      Math.abs(Math.sin(index / 5)) * 12
    return 38 + risk
  })
  const current = values[values.length - 1] ?? 0
  const p95 = percentile(values, 0.95)

  return {
    values,
    current,
    p95,
    status: statusFromRisk((p95 - 50) * 1.4),
  }
}

function buildAlarmSuppressionItems(samples: readonly Sample[]): AlarmSuppressionItem[] {
  return numericSeries()
    .filter((series) => series.thresholds)
    .map((series) => {
      const alarmIndexes = samples
        .map((sample, index) => ({
          index,
          active: severityRank(statusForValue(valueFor(sample, series.id), series)) >= 1,
        }))
        .filter((item) => item.active)
        .map((item) => item.index)
      let accepted = 0
      let lastAccepted = -999

      for (const index of alarmIndexes) {
        const sustained =
          alarmIndexes.includes(index - 1) ||
          alarmIndexes.includes(index + 1) ||
          alarmIndexes.includes(index + 2)
        if (sustained && index - lastAccepted >= 6) {
          accepted += 1
          lastAccepted = index
        }
      }

      const suppressedCount = Math.max(0, alarmIndexes.length - accepted)
      const width = (suppressedCount / Math.max(1, alarmIndexes.length)) * 100

      return {
        series,
        rawCount: alarmIndexes.length,
        suppressedCount,
        status: statusFromRisk(width),
        width,
      }
    })
    .sort((a, b) => b.suppressedCount - a.suppressedCount)
}

function buildAlarmFloodWindows(samples: readonly Sample[]): AlarmFloodWindow[] {
  const windowSize = 12
  const windows = Array.from({ length: 10 }, (_, index) => index * windowSize).map((start) => {
    const windowSamples = samples.filter(
      (sample) => sample.cycle >= start && sample.cycle < start + windowSize,
    )
    const count = windowSamples.reduce(
      (total, sample) =>
        total +
        numericSeries().filter(
          (series) => severityRank(statusForValue(valueFor(sample, series.id), series)) >= 1,
        ).length,
      0,
    )

    return {
      label: `${start}-${start + windowSize - 1}`,
      count,
      status: statusFromRisk(count * 4),
      width: 0,
    }
  })
  const maxCount = Math.max(1, ...windows.map((window) => window.count))

  return windows
    .map((window) => ({ ...window, width: (window.count / maxCount) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}

function buildFeatureStabilityItems(
  samples: readonly Sample[],
  series: SeriesConfig,
): FeatureStabilityItem[] {
  const values = sampleValues(samples, series)
  const first = values.slice(0, Math.floor(values.length / 2))
  const second = values.slice(Math.floor(values.length / 2))
  const featurePairs = [
    { label: 'Mean', first: average(first), second: average(second) },
    { label: 'Sigma', first: standardDeviation(first), second: standardDeviation(second) },
    { label: 'P95', first: percentile(first, 0.95), second: percentile(second, 0.95) },
    {
      label: 'Lag 1',
      first: pearsonCorrelation(first.slice(0, -1), first.slice(1)),
      second: pearsonCorrelation(second.slice(0, -1), second.slice(1)),
    },
    {
      label: 'Range',
      first: Math.max(...first) - Math.min(...first),
      second: Math.max(...second) - Math.min(...second),
    },
  ]
  const maxDrift = Math.max(1, ...featurePairs.map((item) => Math.abs(item.second - item.first)))

  return featurePairs.map((item) => {
    const drift = item.second - item.first
    const width = (Math.abs(drift) / maxDrift) * 100

    return {
      label: item.label,
      drift,
      status: statusFromRisk(width * 0.8),
      width,
    }
  })
}

function buildResidualRegimeItems(
  samples: readonly Sample[],
  series: SeriesConfig,
): ResidualRegimeItem[] {
  const residuals = residualValues(samples, series)
  const raw = STAGE_LABELS.map((label, state) => {
    const stateResiduals = samples
      .map((sample, index) => (sample.cycleState === state ? residuals[index] : undefined))
      .filter((value): value is number => value !== undefined)
    const rms = rootMeanSquare(stateResiduals)

    return {
      label,
      rms,
      status: 'normal' as SignalStatus,
      width: 0,
      color: STAGE_COLORS[state] ?? '#475467',
    }
  })
  const maxRms = Math.max(1, ...raw.map((item) => item.rms))

  return raw.map((item) => ({
    ...item,
    status: statusFromRisk((item.rms / maxRms) * 80),
    width: (item.rms / maxRms) * 100,
  }))
}

function buildSlaComplianceItems(
  samples: readonly Sample[],
  series: SeriesConfig,
): SlaComplianceItem[] {
  const dataQuality = buildDataQualityInsight(samples, series)
  const latency = buildLatencyInsight(samples)
  const coverage = buildPredictionCoverageInsight(samples, series)
  const alarmFloods = buildAlarmFloodWindows(samples)
  const freshness = buildDataFreshnessInsight(samples)
  const items = [
    { label: 'Completeness', compliance: dataQuality.completeness },
    { label: 'Latency', compliance: clamp(100 - Math.max(0, latency.p95 - 60) * 1.5, 0, 100) },
    { label: 'Coverage', compliance: clamp(100 - Math.abs(95 - coverage.coverage) * 2, 0, 100) },
    {
      label: 'Alarm load',
      compliance: clamp(100 - (alarmFloods[0]?.count ?? 0) * 1.5, 0, 100),
    },
    { label: 'Freshness', compliance: clamp(100 - freshness.p95Age * 40, 0, 100) },
  ]

  return items.map((item) => ({
    ...item,
    status: statusFromRisk(100 - item.compliance),
    width: item.compliance,
  }))
}

function buildDataFreshnessInsight(samples: readonly Sample[]): DataFreshnessInsight {
  const values = samples.map((sample, index) => {
    const severity = average(
      numericSeries().map((series) =>
        severityRank(statusForValue(valueFor(sample, series.id), series)),
      ),
    )
    return 0.18 + Math.abs(Math.sin(index / 9)) * 0.16 + severity * 0.04
  })
  const currentAge = values[values.length - 1] ?? 0
  const p95Age = percentile(values, 0.95)

  return {
    values,
    currentAge,
    p95Age,
    status: statusFromRisk(p95Age * 90),
  }
}

function formatSignedValue(value: number, series: SeriesConfig): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(series.decimals)} ${series.unit}`
}

function formatRateValue(value: number, series: SeriesConfig): string {
  const sign = value > 0 ? '+' : ''
  const decimals = Math.abs(value) < 1 ? Math.max(2, series.decimals) : series.decimals
  return `${sign}${value.toFixed(decimals)} ${series.unit}`
}

function formatSignedNumber(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}`
}

function formatCycles(cycles: number | undefined): string {
  if (cycles === undefined) return 'stable'
  if (cycles === 0) return 'now'
  return `${cycles} cycles`
}

function barStyle(width: number, color: string): CSSProperties {
  return {
    '--bar-size': `${clamp(width, 0, 100).toFixed(1)}%`,
    '--bar-color': color,
  } as CSSProperties
}

function App(): React.JSX.Element {
  const samples = useMemo(() => generateSamples(), [])
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [activeSeriesId, setActiveSeriesId] = useState<SeriesId>('pressure')
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(getInitialZoomLevel)
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>(getInitialOverlays)
  const [visible, setVisible] = useState<Record<SeriesId, boolean>>({
    pressure: true,
    torque: true,
    temperature: true,
    vibration: true,
    cycleState: true,
    lubrication: true,
  })
  const [selectedIndex, setSelectedIndex] = useState(samples.length - 28)
  const [zoomAnchorIndex, setZoomAnchorIndex] = useState(samples.length - 28)
  const selected = samples[selectedIndex] ?? samples[0]
  const displaySamples = useMemo(
    () => samplesForZoom(samples, zoomAnchorIndex, zoomLevel),
    [samples, zoomAnchorIndex, zoomLevel],
  )
  const displaySegments = useMemo(() => buildSegments(displaySamples), [displaySamples])
  const [displayStartCycle, displayEndCycle] = getCycleRange(displaySamples)

  const activeSeries = getSeriesById(activeSeriesId)
  const modeConfig = getViewModeConfig(viewMode)
  const visibleSeries = useMemo(() => SERIES.filter((series) => visible[series.id]), [visible])
  const activeAnalytics = useMemo(
    () => buildAnalyticsSummary(samples, activeSeries),
    [samples, activeSeries],
  )
  const activeRollingAverage = selected ? rollingAverageAt(samples, activeSeries, selectedIndex) : 0
  const activeStatus = selected
    ? statusForValue(valueFor(selected, activeSeries.id), activeSeries)
    : 'normal'
  const activeOverlayPreset = getActiveOverlayPreset(overlays)

  function toggleSeries(id: SeriesId): void {
    setVisible((current) => ({ ...current, [id]: !current[id] }))
  }

  function chooseActiveSeries(id: SeriesId): void {
    setActiveSeriesId(id)
    setVisible((current) => ({ ...current, [id]: true }))
  }

  function toggleOverlay(id: OverlayId): void {
    setOverlays((current) => ({ ...current, [id]: !current[id] }))
    writeOverlayPresetToUrl('custom')
  }

  function chooseViewMode(mode: ViewMode): void {
    setViewMode(mode)
    writeModeToUrl(mode)
  }

  function chooseOverlayPreset(preset: OverlayPreset): void {
    setOverlays(preset.overlays)
    writeOverlayPresetToUrl(preset.id)
  }

  function chooseZoomLevel(level: ZoomLevel): void {
    setZoomAnchorIndex(selectedIndex)
    setZoomLevel(level)
    writeZoomToUrl(level)
  }

  function updateCursor(event: PointerEvent<SVGSVGElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH
    if (pointerX < PLOT.left || pointerX > PLOT.right) return

    const [firstCycle, lastCycle] = getCycleRange(displaySamples)
    const cycle = firstCycle + ((pointerX - PLOT.left) / plotWidth(PLOT)) * (lastCycle - firstCycle)
    const nextSample = displaySamples[nearestSampleIndex(displaySamples, cycle)]
    const nextIndex = nextSample
      ? samples.findIndex((sample) => sample.cycle === nextSample.cycle)
      : -1
    if (nextIndex >= 0) {
      setSelectedIndex(nextIndex)
    }
  }

  return (
    <main className="app-shell">
      <section className="control-panel" aria-label="Signal controls">
        <div className="panel-heading">
          <p className="eyebrow">Industrial cycle</p>
          <h1>Multi-axis graph</h1>
          <p className="panel-copy">
            Switch layouts to trade off detail, clarity, and axis density.
          </p>
        </div>

        <fieldset className="mode-switch">
          <legend className="control-label">Display mode</legend>
          {VIEW_MODES.map((mode) => (
            <button
              aria-pressed={viewMode === mode.id}
              className="mode-button"
              key={mode.id}
              type="button"
              onClick={() => chooseViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="zoom-picker">
          <legend className="control-label">Zoom</legend>
          <div className="zoom-grid">
            {ZOOM_LEVELS.map((level) => (
              <button
                aria-pressed={zoomLevel === level}
                className="zoom-button"
                key={level}
                type="button"
                onClick={() => chooseZoomLevel(level)}
              >
                <span>{level}x</span>
                <small>{ZOOM_WINDOW_BY_LEVEL[level]} cycles</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="axis-picker">
          <legend className="control-label">Active axis</legend>
          <div className="axis-picker-grid">
            {SERIES.map((series) => (
              <button
                aria-pressed={activeSeriesId === series.id}
                className="axis-button"
                key={series.id}
                style={{ '--series-color': series.color } as CSSProperties}
                type="button"
                onClick={() => chooseActiveSeries(series.id)}
              >
                {series.shortLabel}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="overlay-preset">
          <legend className="control-label">Layer preset</legend>
          <div className="preset-grid">
            {OVERLAY_PRESETS.map((preset) => (
              <button
                aria-pressed={activeOverlayPreset === preset.id}
                className="preset-button"
                key={preset.id}
                type="button"
                onClick={() => chooseOverlayPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="overlay-picker">
          <legend className="control-label">Analytics layers</legend>
          <div className="overlay-options">
            <label>
              <input
                checked={overlays.alarmBands}
                name="alarmBands"
                type="checkbox"
                onChange={() => toggleOverlay('alarmBands')}
              />
              Warning/alarm limits
            </label>
            <label>
              <input
                checked={overlays.anomalyBands}
                name="anomalyBands"
                type="checkbox"
                onChange={() => toggleOverlay('anomalyBands')}
              />
              Abnormal areas
            </label>
            <label>
              <input
                checked={overlays.rollingAverage}
                name="rollingAverage"
                type="checkbox"
                onChange={() => toggleOverlay('rollingAverage')}
              />
              Rolling average
            </label>
            <label>
              <input
                checked={overlays.eventMarkers}
                name="eventMarkers"
                type="checkbox"
                onChange={() => toggleOverlay('eventMarkers')}
              />
              Event markers
            </label>
            <label>
              <input
                checked={overlays.statusPoints}
                name="statusPoints"
                type="checkbox"
                onChange={() => toggleOverlay('statusPoints')}
              />
              Alarm/anomaly points
            </label>
            <label>
              <input
                checked={overlays.minorGrid}
                name="minorGrid"
                type="checkbox"
                onChange={() => toggleOverlay('minorGrid')}
              />
              Minor grid
            </label>
            <label>
              <input
                checked={overlays.legend}
                name="legend"
                type="checkbox"
                onChange={() => toggleOverlay('legend')}
              />
              Legend
            </label>
            <label>
              <input
                checked={overlays.dataTip}
                name="dataTip"
                type="checkbox"
                onChange={() => toggleOverlay('dataTip')}
              />
              Data tip
            </label>
          </div>
        </fieldset>

        <div className="series-list">
          {SERIES.map((series) => (
            <label className="series-toggle" key={series.id}>
              <input
                checked={visible[series.id]}
                name={`series-${series.id}`}
                type="checkbox"
                onChange={() => toggleSeries(series.id)}
              />
              <span className="swatch" style={{ backgroundColor: series.color }} />
              <span>
                <strong>{series.label}</strong>
                <small>
                  {series.domain[0]}-{series.domain[1]} {series.unit}
                </small>
              </span>
            </label>
          ))}
        </div>

        <dl className="readout">
          <div>
            <dt>Cycle</dt>
            <dd>{selected?.cycle ?? 0}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{(selected?.time ?? 0).toFixed(1)}s</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{selected ? formatValue(selected.cycleState, CYCLE_INFO_SERIES) : 'Idle'}</dd>
          </div>
        </dl>
      </section>

      <section className="chart-panel" aria-label="Multi-axis machine graph">
        <div className="chart-toolbar">
          <div>
            <p className="eyebrow">{modeConfig.eyebrow}</p>
            <h2>{modeConfig.title}</h2>
          </div>
          <div className="selected-pill">
            cycle {selected?.cycle ?? 0} / {zoomLevel}x / {displayStartCycle}-{displayEndCycle}
          </div>
        </div>

        <div className="mode-guidance">
          <div>
            <strong>Use when</strong>
            <p>{modeConfig.useWhen}</p>
          </div>
          <div>
            <strong>Do not use when</strong>
            <p>{modeConfig.avoidWhen}</p>
          </div>
        </div>

        <AnalyticsPanel
          activeSeries={activeSeries}
          rollingAverage={activeRollingAverage}
          selected={selected}
          status={activeStatus}
          summary={activeAnalytics}
        />

        {overlays.legend ? (
          <ScientificLegend
            activeSeries={activeSeries}
            overlays={overlays}
            visibleSeries={visibleSeries}
          />
        ) : null}

        <div className={`chart-frame mode-${viewMode}`}>
          {viewMode === 'rows' ? (
            <RowsChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'focus' ? (
            <FocusAxisChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'single' ? (
            <SingleTagChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'normalized' ? (
            <NormalizedChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'residual' ? (
            <ResidualChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'allAxes' ? (
            <MultiAxisChart
              samples={displaySamples}
              segments={displaySegments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          <IntegratedAnalysisGraphic
            activeSeries={activeSeries}
            overlays={overlays}
            samples={displaySamples}
            segments={displaySegments}
            selected={selected}
            onPointerMove={updateCursor}
          />
        </div>

        <div className="detail-grid">
          {SERIES.map((series) => {
            const value = selected ? valueFor(selected, series.id) : 0
            const status = statusForValue(value, series)
            return (
              <button
                aria-pressed={activeSeriesId === series.id}
                className={`detail-tile status-${status}`}
                key={series.id}
                type="button"
                onClick={() => chooseActiveSeries(series.id)}
              >
                <span className="detail-dot" style={{ backgroundColor: series.color }} />
                <span>{series.shortLabel}</span>
                <strong style={{ color: series.color }}>{formatValue(value, series)}</strong>
              </button>
            )
          })}
        </div>

        {SHOW_SEPARATE_ANALYTICS_WORKBENCH ? (
          <AnalyticsWorkbench
            activeSeries={activeSeries}
            samples={samples}
            selectedIndex={selectedIndex}
            visibleSeries={visibleSeries}
          />
        ) : null}
      </section>
    </main>
  )
}

interface MultiAxisChartProps {
  samples: readonly Sample[]
  segments: readonly Segment[]
  selected: Sample | undefined
  visibleSeries: readonly SeriesConfig[]
  activeSeries: SeriesConfig
  overlays: Record<OverlayId, boolean>
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
}

interface ModeChartProps extends MultiAxisChartProps {
  activeSeries: SeriesConfig
}

interface CycleBandProps {
  area?: PlotArea
  samples: readonly Sample[]
  segments: readonly Segment[]
  y: number
  height: number
}

function CycleBand({
  area = PLOT,
  samples,
  segments,
  y,
  height,
}: CycleBandProps): React.JSX.Element {
  const [firstCycle, lastCycle] = getCycleRange(samples)

  return (
    <g aria-label="Cycle phase band">
      {segments.map((segment) => {
        const x = xForArea(segment.startCycle, samples, area)
        const endX = xForArea(clamp(segment.endCycle + 1, firstCycle, lastCycle), samples, area)
        const color = STAGE_COLORS[segment.state] ?? '#6b7280'
        return (
          <rect
            fill={color}
            key={`${segment.startCycle}-${segment.endCycle}-${segment.state}-${y}`}
            opacity="0.2"
            x={x}
            y={y}
            width={Math.max(2, endX - x)}
            height={height}
          />
        )
      })}
    </g>
  )
}

interface PlotGridProps {
  overlays: Record<OverlayId, boolean>
  samples: readonly Sample[]
}

function PlotGrid({ overlays, samples }: PlotGridProps): React.JSX.Element {
  const xTicks = cycleTicks(samples)

  return (
    <>
      <rect
        className="plot-bg"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />

      {overlays.minorGrid ? <MinorGrid area={PLOT} samples={samples} /> : null}

      {GRID_FRACTIONS.map((fraction) => {
        const y = PLOT.top + plotHeight(PLOT) * fraction
        return (
          <line
            className="grid-line"
            key={`grid-y-${fraction}`}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y}
            y2={y}
          />
        )
      })}

      {xTicks.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <g key={`x-${tick}`}>
            <line className="grid-line vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
            <text className="x-tick" x={x} y={PLOT.bottom + 34} textAnchor="middle">
              {formatCycleTick(tick)}
            </text>
          </g>
        )
      })}

      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 66}>
        Cycle index / elapsed time (s)
      </text>
    </>
  )
}

interface MinorGridProps {
  area: PlotArea
  samples: readonly Sample[]
}

function MinorGrid({ area, samples }: MinorGridProps): React.JSX.Element {
  return (
    <g className="minor-grid">
      {MINOR_GRID_FRACTIONS.map((fraction) => {
        const y = area.top + plotHeight(area) * fraction
        return (
          <line
            key={`minor-y-${area.top}-${fraction}`}
            x1={area.left}
            x2={area.right}
            y1={y}
            y2={y}
          />
        )
      })}
      {minorCycleTicks(samples).map((tick) => {
        const x = xForArea(tick, samples, area)
        return (
          <line key={`minor-x-${area.top}-${tick}`} x1={x} x2={x} y1={area.top} y2={area.bottom} />
        )
      })}
    </g>
  )
}

interface SingleAxisProps {
  series: SeriesConfig
}

function SingleAxis({ series }: SingleAxisProps): React.JSX.Element {
  const x = PLOT.left - 34

  return (
    <g className="axis-group focus-axis" style={{ color: series.color }}>
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        {series.label}
      </text>
      {series.ticks.map((tick) => {
        const y = yFor(tick, series.domain)
        return (
          <g key={`focus-${series.id}-${tick}`}>
            <line className="axis-tick" x1={x} x2={x + 8} y1={y} y2={y} />
            <text className="axis-tick-label" x={x - 12} y={y + 4} textAnchor="end">
              {formatTickValue(tick, series)}
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 18} textAnchor="middle">
        {series.unit}
      </text>
    </g>
  )
}

function NormalizedAxis(): React.JSX.Element {
  const x = PLOT.left - 34

  return (
    <g className="axis-group normalized-axis">
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        Normalized
      </text>
      {NORMALIZED_TICKS.map((tick) => {
        const y = yFor(tick, [0, 100])
        return (
          <g key={`normalized-${tick}`}>
            <line className="axis-tick" x1={x} x2={x + 8} y1={y} y2={y} />
            <text className="axis-tick-label" x={x - 12} y={y + 4} textAnchor="end">
              {tick}%
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 18} textAnchor="middle">
        0-100%
      </text>
    </g>
  )
}

interface CursorLayerProps {
  selected: Sample | undefined
  selectedX: number
  visibleSeries: readonly SeriesConfig[]
  activeSeries?: SeriesConfig
}

function CursorLayer({
  selected,
  selectedX,
  visibleSeries,
  activeSeries,
}: CursorLayerProps): React.JSX.Element | null {
  if (!selected) return null

  return (
    <g className="cursor-layer">
      <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
      <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
      <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
        {selected.cycle}
      </text>
      {visibleSeries.map((series) => {
        const y = yFor(valueFor(selected, series.id), series.domain)
        return (
          <circle
            className="cursor-dot"
            cx={selectedX}
            cy={y}
            fill={series.color}
            key={`dot-${series.id}`}
            r={activeSeries?.id === series.id ? 5.5 : 4.5}
          />
        )
      })}
    </g>
  )
}

interface EmptyStateProps {
  y: number
}

function EmptyState({ y }: EmptyStateProps): React.JSX.Element {
  return (
    <text className="empty-state" x={(PLOT.left + PLOT.right) / 2} y={y} textAnchor="middle">
      Select at least one signal
    </text>
  )
}

interface AnalyticsPanelProps {
  activeSeries: SeriesConfig
  rollingAverage: number
  selected: Sample | undefined
  status: SignalStatus
  summary: AnalyticsSummary
}

function AnalyticsPanel({
  activeSeries,
  rollingAverage,
  selected,
  status,
  summary,
}: AnalyticsPanelProps): React.JSX.Element {
  const selectedValue = selected ? valueFor(selected, activeSeries.id) : 0

  return (
    <section className="analytics-panel" aria-label="Active signal analytics">
      <div className="analytics-heading">
        <span className="control-label">Active signal</span>
        <strong>{activeSeries.label}</strong>
        <span className={`status-chip status-${status}`}>{status}</span>
      </div>

      <dl className="analytics-grid">
        <div>
          <dt>Value</dt>
          <dd>{formatValue(selectedValue, activeSeries)}</dd>
        </div>
        <div>
          <dt>Rolling avg</dt>
          <dd>{formatValue(rollingAverage, activeSeries)}</dd>
        </div>
        <div>
          <dt>Min / max</dt>
          <dd>
            {formatTickValue(summary.min, activeSeries)} /{' '}
            {formatTickValue(summary.max, activeSeries)}
          </dd>
        </div>
        <div>
          <dt>Mean</dt>
          <dd>{formatValue(summary.mean, activeSeries)}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{summary.warningCount}</dd>
        </div>
        <div>
          <dt>Anomalies</dt>
          <dd>{summary.anomalyCount}</dd>
        </div>
        <div>
          <dt>Alarms</dt>
          <dd>{summary.alarmCount}</dd>
        </div>
        <div>
          <dt>Samples</dt>
          <dd>{summary.sampleCount}</dd>
        </div>
        <div>
          <dt>Sample dt</dt>
          <dd>0.5 s</dd>
        </div>
      </dl>
    </section>
  )
}

interface IntegratedAnalysisGraphicProps {
  activeSeries: SeriesConfig
  overlays: Record<OverlayId, boolean>
  samples: readonly Sample[]
  segments: readonly Segment[]
  selected: Sample | undefined
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
}

interface AnalysisLaneProps {
  area: PlotArea
  children: React.ReactNode
  meta: string
  status?: SignalStatus
  title: string
}

function AnalysisLane({
  area,
  children,
  meta,
  status = 'normal',
  title,
}: AnalysisLaneProps): React.JSX.Element {
  return (
    <g className={`analysis-lane status-${status}`}>
      <text className="analysis-lane-title" x="48" y={area.top + 21}>
        {title}
      </text>
      <text className="analysis-lane-meta" x="48" y={area.top + 43}>
        {meta}
      </text>
      <rect
        className="analysis-lane-bg"
        x={area.left}
        y={area.top}
        width={plotWidth(area)}
        height={plotHeight(area)}
      />
      {children}
      <rect
        className="analysis-lane-border"
        x={area.left}
        y={area.top}
        width={plotWidth(area)}
        height={plotHeight(area)}
      />
    </g>
  )
}

interface AnalysisMetricBarProps {
  color?: string
  label: string
  status?: SignalStatus
  value: string
  width: number
  x: number
  y: number
}

function AnalysisMetricBar({
  color,
  label,
  status = 'normal',
  value,
  width,
  x,
  y,
}: AnalysisMetricBarProps): React.JSX.Element {
  const barWidth = 130
  return (
    <g className="analysis-metric">
      <text x={x} y={y + 8}>
        {label}
      </text>
      <rect className="analysis-bar-track" x={x + 92} y={y} width={barWidth} height="7" rx="3.5" />
      <rect
        className="analysis-bar-fill"
        fill={color ?? statusColor(status)}
        x={x + 92}
        y={y}
        width={(clamp(width, 0, 100) / 100) * barWidth}
        height="7"
        rx="3.5"
      />
      <text className="analysis-metric-value" x={x + 238} y={y + 8}>
        {value}
      </text>
    </g>
  )
}

interface AnalysisRailBlockProps {
  children: React.ReactNode
  height: number
  meta: string
  status?: SignalStatus
  title: string
  y: number
}

function AnalysisRailBlock({
  children,
  height,
  meta,
  status = 'normal',
  title,
  y,
}: AnalysisRailBlockProps): React.JSX.Element {
  return (
    <g className={`analysis-rail-block status-${status}`}>
      <rect
        className="analysis-rail-bg"
        x={ANALYSIS_RAIL_X}
        y={y}
        width="252"
        height={height}
        rx="7"
      />
      <text className="analysis-rail-title" x={ANALYSIS_RAIL_X + 12} y={y + 20}>
        {title}
      </text>
      <text className="analysis-rail-meta" x={ANALYSIS_RAIL_X + 12} y={y + 38}>
        {meta}
      </text>
      {children}
    </g>
  )
}

interface AnalysisHeatmapProps {
  cells: readonly HeatmapCell[]
  columns: readonly string[]
  rows: readonly string[]
  x: number
  y: number
}

function AnalysisHeatmap({ cells, columns, rows, x, y }: AnalysisHeatmapProps): React.JSX.Element {
  const cellWidth = 34
  const cellHeight = 9
  const labelFor = (label: string): string =>
    label === 'Pressure'
      ? 'P'
      : label === 'Torque'
        ? 'Tq'
        : label === 'Temp'
          ? 'Te'
          : label === 'Vibration'
            ? 'V'
            : label === 'Lube'
              ? 'L'
              : label

  return (
    <g className="analysis-heatmap">
      {rows.map((row, index) => (
        <text key={`heat-row-${row}`} x={x - 8} y={y + index * cellHeight + 8} textAnchor="end">
          {labelFor(row)}
        </text>
      ))}
      {columns.map((column, index) => (
        <text
          key={`heat-column-${column}`}
          textAnchor="middle"
          x={x + index * cellWidth + 16}
          y={y - 6}
        >
          {labelFor(column)}
        </text>
      ))}
      {cells.map((cell) => (
        <rect
          height={cellHeight - 1}
          key={`${cell.row}-${cell.column}`}
          style={{ fill: heatColor(cell.width) }}
          width={cellWidth - 1}
          x={x + cell.column * cellWidth}
          y={y + cell.row * cellHeight}
        />
      ))}
    </g>
  )
}

interface AnalysisSelectedDotProps {
  area: PlotArea
  color: string
  domain: readonly [number, number]
  samples: readonly Sample[]
  selected: Sample | undefined
  value: number
}

function AnalysisSelectedDot({
  area,
  color,
  domain,
  samples,
  selected,
  value,
}: AnalysisSelectedDotProps): React.JSX.Element | null {
  if (!selected) return null

  return (
    <circle
      className="analysis-selected-dot"
      cx={xForArea(selected.cycle, samples, area)}
      cy={yForArea(value, domain, area)}
      fill={color}
      r="4.5"
    />
  )
}

function IntegratedAnalysisGraphic({
  activeSeries,
  overlays,
  samples,
  segments,
  selected,
  onPointerMove,
}: IntegratedAnalysisGraphicProps): React.JSX.Element {
  const analysisSeries = activeSeries.id === 'cycleState' ? getSeriesById('pressure') : activeSeries
  const selectedIndex = selected
    ? nearestSampleIndex(samples, selected.cycle)
    : Math.max(0, samples.length - 1)
  const selectedX = selected ? xForArea(selected.cycle, samples, analysisLaneArea(0)) : PLOT.left
  const forecast = buildForecastInsight(samples, analysisSeries)
  const residual = buildResidualInsight(samples, analysisSeries, selectedIndex)
  const residualSigma = Math.max(
    residual.rms,
    (analysisSeries.domain[1] - analysisSeries.domain[0]) * 0.01,
  )
  const zScores = residual.values.map((value) => clamp(value / residualSigma, -3.5, 3.5))
  const selectedZ = clamp(residual.selectedResidual / residualSigma, -3.5, 3.5)
  const zDomain: readonly [number, number] = [-3.5, 3.5]
  const anomalyScore = buildAnomalyScoreInsight(samples, selectedIndex)
  const health = buildHealthInsight(samples, selectedIndex)
  const predictiveMaintenance = buildPredictiveMaintenanceInsight(
    samples,
    selectedIndex,
    analysisSeries,
  )
  const alarmDensity = samples.map((sample) => {
    const totalSeverity = numericSeries().reduce(
      (total, series) => total + severityRank(statusForValue(valueFor(sample, series.id), series)),
      0,
    )
    return (totalSeverity / Math.max(1, numericSeries().length * 3)) * 100
  })
  const spectrum = buildSpectrumBins(samples).slice(0, 4)
  const correlationMatrix = buildCorrelationMatrix(samples)
  const latency = buildLatencyInsight(samples)
  const freshness = buildDataFreshnessInsight(samples)
  const qualityScore = samples.map((sample, index) => {
    const worstSeverity = Math.max(
      ...numericSeries().map((series) =>
        severityRank(statusForValue(valueFor(sample, series.id), series)),
      ),
    )
    return clamp(
      100 -
        (freshness.values[index] ?? 0) * 70 -
        Math.max(0, (latency.values[index] ?? 0) - 55) * 0.55 -
        worstSeverity * 10,
      0,
      100,
    )
  })
  const sla = buildSlaComplianceItems(samples, analysisSeries)
  const lane0 = analysisLaneArea(0)
  const lane1 = analysisLaneArea(1)
  const lane2 = analysisLaneArea(2)
  const lane3 = analysisLaneArea(3)
  const lane4 = analysisLaneArea(4)
  const lane5 = analysisLaneArea(5)
  const lane6 = analysisLaneArea(6)
  const xTicks = cycleTicks(samples)
  const selectedValue = selected ? valueFor(selected, analysisSeries.id) : 0
  const selectedAverage = selected ? rollingAverageAt(samples, analysisSeries, selectedIndex) : 0
  const selectedWorstStatus = selected
    ? numericSeries().reduce<SignalStatus>((worst, series) => {
        const status = statusForValue(valueFor(selected, series.id), series)
        return severityRank(status) > severityRank(worst) ? status : worst
      }, 'normal')
    : 'normal'
  const averageSla = average(sla.map((item) => item.compliance))
  const forecastRiskWidth =
    (Math.abs(forecast.slope) / Math.max(1, analysisSeries.domain[1] - analysisSeries.domain[0])) *
    5000
  const maxSpectrumWidth = Math.max(1, ...spectrum.map((item) => item.width))
  const forecastRailY = ANALYSIS_TOP
  const predictiveRailY = ANALYSIS_TOP + 122
  const faultRailY = ANALYSIS_TOP + 300
  const decisionRailY = ANALYSIS_TOP + 434
  const relationshipRailY = ANALYSIS_TOP + 604
  const frequencyRailY = ANALYSIS_TOP + 730

  return (
    <svg
      aria-label="Integrated analytics graph with time-aligned diagnostics and context summaries"
      className="analysis-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${ANALYSIS_VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <rect
        className="analysis-bg"
        x="0"
        y="0"
        width={VIEWBOX_WIDTH}
        height={ANALYSIS_VIEWBOX_HEIGHT}
      />
      <text className="analysis-title" x="48" y="34">
        Analytical diagnostic graph
      </text>
      <text className="analysis-subtitle" x="48" y="55">
        Left lanes share cycle time. Right rail shows context that is not a time-series axis.
      </text>

      <AnalysisLane
        area={lane0}
        meta={`${formatValue(selectedValue, analysisSeries)} / avg ${formatValue(selectedAverage, analysisSeries)}`}
        status={statusForValue(selectedValue, analysisSeries)}
        title="Signal + baseline"
      >
        {overlays.minorGrid ? <MinorGrid area={lane0} samples={samples} /> : null}
        {overlays.anomalyBands ? (
          <AbnormalRegionLayer area={lane0} samples={samples} series={analysisSeries} />
        ) : null}
        <ThresholdOverlay
          area={lane0}
          overlays={overlays}
          series={analysisSeries}
          showLabels={false}
        />
        {selected ? (
          <line
            className="analysis-phase-line"
            x1={lane0.left}
            x2={lane0.right}
            y1={yForArea(
              predictiveMaintenance.phaseComparison.average,
              analysisSeries.domain,
              lane0,
            )}
            y2={yForArea(
              predictiveMaintenance.phaseComparison.average,
              analysisSeries.domain,
              lane0,
            )}
          />
        ) : null}
        <path
          className="analysis-line"
          d={buildLinePathForArea(samples, analysisSeries, lane0)}
          stroke={analysisSeries.color}
          strokeDasharray={analysisSeries.stepped ? '7 7' : undefined}
        />
        {!analysisSeries.stepped ? (
          <path
            className="analysis-reference-line"
            d={buildRollingAveragePathForArea(samples, analysisSeries, lane0)}
          />
        ) : null}
        <AnalysisSelectedDot
          area={lane0}
          color={analysisSeries.color}
          domain={analysisSeries.domain}
          samples={samples}
          selected={selected}
          value={selected ? valueFor(selected, analysisSeries.id) : 0}
        />
      </AnalysisLane>

      <AnalysisLane
        area={lane1}
        meta={`z ${selectedZ.toFixed(1)} / residual ${formatSignedValue(residual.selectedResidual, analysisSeries)}`}
        status={statusFromRisk(Math.abs(selectedZ) * 24)}
        title="Residual control"
      >
        {[-3, 3].map((value) => (
          <line
            className="analysis-alarm-line"
            key={`z-alarm-${value}`}
            x1={lane1.left}
            x2={lane1.right}
            y1={yForArea(value, zDomain, lane1)}
            y2={yForArea(value, zDomain, lane1)}
          />
        ))}
        {[-2, 2].map((value) => (
          <line
            className="analysis-warning-line"
            key={`z-warning-${value}`}
            x1={lane1.left}
            x2={lane1.right}
            y1={yForArea(value, zDomain, lane1)}
            y2={yForArea(value, zDomain, lane1)}
          />
        ))}
        <line
          className="analysis-zero-line"
          x1={lane1.left}
          x2={lane1.right}
          y1={yForArea(0, zDomain, lane1)}
          y2={yForArea(0, zDomain, lane1)}
        />
        <path
          className="analysis-line"
          d={buildValuePathByIndex(samples, zScores, lane1, zDomain)}
          stroke={analysisSeries.color}
        />
        <AnalysisSelectedDot
          area={lane1}
          color={statusColor(statusFromRisk(Math.abs(selectedZ) * 24))}
          domain={zDomain}
          samples={samples}
          selected={selected}
          value={selectedZ}
        />
      </AnalysisLane>

      <AnalysisLane
        area={lane2}
        meta={`health ${health.score.toFixed(0)} / anomaly p95 ${anomalyScore.p95.toFixed(0)}`}
        status={health.status}
        title="Anomaly + health"
      >
        <line
          className="analysis-warning-line"
          x1={lane2.left}
          x2={lane2.right}
          y1={yForArea(55, [0, 100], lane2)}
          y2={yForArea(55, [0, 100], lane2)}
        />
        <path
          className="analysis-line"
          d={buildValuePathByIndex(samples, anomalyScore.scores, lane2, [0, 100])}
          stroke={statusColor(anomalyScore.status)}
        />
        <path
          className="analysis-health-trend-line"
          d={buildValuePathByIndex(
            samples,
            predictiveMaintenance.assetHealthValues,
            lane2,
            [0, 100],
          )}
        />
        <rect
          className="analysis-health-band"
          x={lane2.left}
          y={lane2.top}
          width={(health.score / 100) * plotWidth(lane2)}
          height="6"
        />
        <AnalysisSelectedDot
          area={lane2}
          color={statusColor(anomalyScore.status)}
          domain={[0, 100]}
          samples={samples}
          selected={selected}
          value={anomalyScore.current}
        />
      </AnalysisLane>

      <AnalysisLane
        area={lane3}
        meta={`state ${selectedWorstStatus} / load ${Math.round(alarmDensity[selectedIndex] ?? 0)}%`}
        status={selectedWorstStatus}
        title="Alarm state"
      >
        {samples.map((sample, index) => {
          const next = samples[index + 1]
          const x = xForArea(sample.cycle, samples, lane3)
          const nextX = next ? xForArea(next.cycle, samples, lane3) : x + 4
          const value = alarmDensity[index] ?? 0
          const worstStatus = numericSeries().reduce<SignalStatus>((worst, series) => {
            const status = statusForValue(valueFor(sample, series.id), series)
            return severityRank(status) > severityRank(worst) ? status : worst
          }, 'normal')
          const height = (value / 100) * plotHeight(lane3)
          return (
            <rect
              className="analysis-density-bar"
              fill={statusColor(worstStatus)}
              height={height}
              key={`alarm-density-${sample.cycle}`}
              width={Math.max(1, nextX - x - 1)}
              x={x}
              y={lane3.bottom - height}
            />
          )
        })}
      </AnalysisLane>

      <AnalysisLane
        area={lane4}
        meta={`quality ${Math.round(qualityScore[selectedIndex] ?? 0)} / SLA ${averageSla.toFixed(0)}%`}
        status={statusFromRisk(100 - Math.min(qualityScore[selectedIndex] ?? 100, averageSla))}
        title="Data quality"
      >
        <line
          className="analysis-warning-line"
          x1={lane4.left}
          x2={lane4.right}
          y1={yForArea(80, [0, 100], lane4)}
          y2={yForArea(80, [0, 100], lane4)}
        />
        <path
          className="analysis-line"
          d={buildValuePathByIndex(samples, qualityScore, lane4, [0, 100])}
          stroke="#0891b2"
        />
        <AnalysisSelectedDot
          area={lane4}
          color={statusColor(statusFromRisk(100 - (qualityScore[selectedIndex] ?? 100)))}
          domain={[0, 100]}
          samples={samples}
          selected={selected}
          value={qualityScore[selectedIndex] ?? 100}
        />
      </AnalysisLane>

      <AnalysisLane
        area={lane5}
        meta={`risk ${predictiveMaintenance.selectedRisk.toFixed(0)} / RUL ${formatCycles(predictiveMaintenance.soonestRul?.cycles)}`}
        status={predictiveMaintenance.status}
        title="Predictive maintenance"
      >
        <line
          className="analysis-warning-line"
          x1={lane5.left}
          x2={lane5.right}
          y1={yForArea(60, [0, 100], lane5)}
          y2={yForArea(60, [0, 100], lane5)}
        />
        <line
          className="analysis-alarm-line"
          x1={lane5.left}
          x2={lane5.right}
          y1={yForArea(80, [0, 100], lane5)}
          y2={yForArea(80, [0, 100], lane5)}
        />
        <polygon
          className="analysis-risk-band"
          points={buildBandPathByIndex(
            samples,
            predictiveMaintenance.lowValues,
            predictiveMaintenance.highValues,
            lane5,
            [0, 100],
          )}
        />
        <path
          className="analysis-line"
          d={buildValuePathByIndex(samples, predictiveMaintenance.values, lane5, [0, 100])}
          stroke={statusColor(predictiveMaintenance.status)}
        />
        <rect
          className="analysis-maintenance-band"
          x={lane5.left}
          y={lane5.top}
          width={(predictiveMaintenance.horizonRisk / 100) * plotWidth(lane5)}
          height="6"
        />
        <AnalysisSelectedDot
          area={lane5}
          color={statusColor(predictiveMaintenance.status)}
          domain={[0, 100]}
          samples={samples}
          selected={selected}
          value={predictiveMaintenance.selectedRisk}
        />
      </AnalysisLane>

      <AnalysisLane
        area={lane6}
        meta={
          selected
            ? `stage ${formatValue(selected.cycleState, CYCLE_INFO_SERIES)}`
            : 'cycle context'
        }
        status={selectedWorstStatus}
        title="Cycle context"
      >
        <CycleBand
          area={lane6}
          samples={samples}
          segments={segments}
          y={lane6.top + 8}
          height={15}
        />
        {EVENTS.filter(
          (event) =>
            event.cycle >= (samples[0]?.cycle ?? event.cycle) &&
            event.cycle <= (samples[samples.length - 1]?.cycle ?? event.cycle),
        ).map((event) => {
          const x = xForArea(event.cycle, samples, lane6)
          return (
            <circle
              className="analysis-history-marker"
              cx={x}
              cy={lane6.bottom - 9}
              fill={statusColor(statusForEventSeverity(event.severity))}
              key={`analysis-history-${event.cycle}-${event.label}`}
              r={event.severity === 'alarm' ? 3.4 : 2.7}
            >
              <title>{event.label}</title>
            </circle>
          )
        })}
        {samples.map((sample, index) => {
          const next = samples[index + 1]
          const x = xForArea(sample.cycle, samples, lane6)
          const nextX = next ? xForArea(next.cycle, samples, lane6) : x + 4
          const value = alarmDensity[index] ?? 0
          return (
            <rect
              className="analysis-density-bar"
              fill={statusColor(statusFromRisk(value))}
              height={(value / 100) * 22}
              key={`cycle-load-${sample.cycle}`}
              width={Math.max(1, nextX - x - 1)}
              x={x}
              y={lane6.bottom - (value / 100) * 22}
            />
          )
        })}
      </AnalysisLane>

      <AnalysisRailBlock
        height={110}
        meta={forecast.crossingLabel}
        status={statusFromRisk(clamp(forecastRiskWidth, 0, 100))}
        title="Forecast horizon"
        y={forecastRailY}
      >
        <AnalysisMetricBar
          color={analysisSeries.color}
          label="Slope"
          value={formatRateValue(forecast.slope, analysisSeries)}
          width={forecastRiskWidth}
          x={ANALYSIS_RAIL_X + 12}
          y={forecastRailY + 48}
        />
        <AnalysisMetricBar
          color="#475467"
          label="Spread"
          value={formatValue(forecast.spread, analysisSeries)}
          width={
            (forecast.spread / Math.max(1, analysisSeries.domain[1] - analysisSeries.domain[0])) *
            500
          }
          x={ANALYSIS_RAIL_X + 12}
          y={forecastRailY + 68}
        />
        <AnalysisMetricBar
          color="#667085"
          label="95% band"
          value={formatValue(forecast.spread * 1.96, analysisSeries)}
          width={
            (forecast.spread / Math.max(1, analysisSeries.domain[1] - analysisSeries.domain[0])) *
            900
          }
          x={ANALYSIS_RAIL_X + 12}
          y={forecastRailY + 88}
        />
      </AnalysisRailBlock>

      <AnalysisRailBlock
        height={160}
        meta={`RUL ${formatCycles(predictiveMaintenance.soonestRul?.cycles)} +/- ${predictiveMaintenance.riskUncertainty.toFixed(0)} risk`}
        status={predictiveMaintenance.status}
        title="Predictive maintenance"
        y={predictiveRailY}
      >
        <AnalysisMetricBar
          color={statusColor(predictiveMaintenance.status)}
          label={predictiveMaintenance.soonestRul?.series.shortLabel ?? 'RUL'}
          value={formatCycles(predictiveMaintenance.soonestRul?.cycles)}
          width={
            predictiveMaintenance.soonestRul?.cycles === undefined
              ? 8
              : clamp(100 - (predictiveMaintenance.soonestRul.cycles / 90) * 100, 0, 100)
          }
          x={ANALYSIS_RAIL_X + 12}
          y={predictiveRailY + 48}
        />
        <AnalysisMetricBar
          color="#d92d20"
          label="Fail 24c"
          value={`${predictiveMaintenance.horizonRisk.toFixed(0)}%`}
          width={predictiveMaintenance.horizonRisk}
          x={ANALYSIS_RAIL_X + 12}
          y={predictiveRailY + 68}
        />
        <AnalysisMetricBar
          color="#f59e0b"
          label="Uncertain"
          value={`+/-${predictiveMaintenance.riskUncertainty.toFixed(0)}`}
          width={predictiveMaintenance.riskUncertainty * 3}
          x={ANALYSIS_RAIL_X + 12}
          y={predictiveRailY + 88}
        />
        <AnalysisMetricBar
          color="#12b76a"
          label="Asset"
          value={`${predictiveMaintenance.assetHealth.toFixed(0)}`}
          width={predictiveMaintenance.assetHealth}
          x={ANALYSIS_RAIL_X + 12}
          y={predictiveRailY + 108}
        />
        <AnalysisMetricBar
          color="#155eef"
          label="Confidence"
          value={`${predictiveMaintenance.modelConfidence.toFixed(0)}%`}
          width={predictiveMaintenance.modelConfidence}
          x={ANALYSIS_RAIL_X + 12}
          y={predictiveRailY + 128}
        />
      </AnalysisRailBlock>

      <AnalysisRailBlock
        height={126}
        meta="fault mode probabilities"
        status={predictiveMaintenance.faultModes[0]?.status ?? 'normal'}
        title="Fault modes"
        y={faultRailY}
      >
        {predictiveMaintenance.faultModes.map((mode, index) => (
          <AnalysisMetricBar
            color={mode.color}
            key={mode.label}
            label={mode.label}
            status={mode.status}
            value={`${mode.probability.toFixed(0)}%`}
            width={mode.width}
            x={ANALYSIS_RAIL_X + 12}
            y={faultRailY + 50 + index * 20}
          />
        ))}
      </AnalysisRailBlock>

      <AnalysisRailBlock
        height={154}
        meta={predictiveMaintenance.decision.description}
        status={predictiveMaintenance.decision.status}
        title="Decision support"
        y={decisionRailY}
      >
        <text
          className="analysis-decision-label"
          fill={statusColor(predictiveMaintenance.decision.status)}
          x={ANALYSIS_RAIL_X + 12}
          y={decisionRailY + 54}
        >
          {predictiveMaintenance.decision.label}
        </text>
        <AnalysisMetricBar
          color={statusColor(predictiveMaintenance.lead?.status ?? 'normal')}
          label={predictiveMaintenance.lead?.series.shortLabel ?? 'Lead'}
          value={formatCycles(predictiveMaintenance.lead?.leadCycles)}
          width={predictiveMaintenance.lead?.width ?? 0}
          x={ANALYSIS_RAIL_X + 12}
          y={decisionRailY + 72}
        />
        <AnalysisMetricBar
          color={statusColor(predictiveMaintenance.whatIf?.status ?? 'normal')}
          label={`${predictiveMaintenance.whatIf?.series.shortLabel ?? 'What-if'} tgt`}
          value={formatSignedNumber(predictiveMaintenance.whatIf?.deltaRisk ?? 0, 0)}
          width={predictiveMaintenance.whatIf?.width ?? 0}
          x={ANALYSIS_RAIL_X + 12}
          y={decisionRailY + 92}
        />
        <AnalysisMetricBar
          color={statusColor(predictiveMaintenance.phaseComparison.status)}
          label={predictiveMaintenance.phaseComparison.label}
          value={formatSignedValue(predictiveMaintenance.phaseComparison.delta, analysisSeries)}
          width={predictiveMaintenance.phaseComparison.width}
          x={ANALYSIS_RAIL_X + 12}
          y={decisionRailY + 112}
        />
        <AnalysisMetricBar
          color={
            predictiveMaintenance.runCostIndex > predictiveMaintenance.plannedCostIndex
              ? '#d92d20'
              : '#12b76a'
          }
          label="Cost gap"
          value={formatSignedNumber(
            predictiveMaintenance.runCostIndex - predictiveMaintenance.plannedCostIndex,
            0,
          )}
          width={Math.abs(
            predictiveMaintenance.runCostIndex - predictiveMaintenance.plannedCostIndex,
          )}
          x={ANALYSIS_RAIL_X + 12}
          y={decisionRailY + 132}
        />
      </AnalysisRailBlock>

      <AnalysisRailBlock
        height={112}
        meta={`${correlationMatrix.peakLabel} ${correlationMatrix.peakValue.toFixed(2)}`}
        status="normal"
        title="Relationship map"
        y={relationshipRailY}
      >
        <AnalysisHeatmap
          cells={correlationMatrix.cells}
          columns={correlationMatrix.columns}
          rows={correlationMatrix.rows}
          x={ANALYSIS_RAIL_X + 68}
          y={relationshipRailY + 58}
        />
      </AnalysisRailBlock>

      <AnalysisRailBlock
        height={92}
        meta={`peak ${spectrum[0]?.label ?? 'n/a'}`}
        status="normal"
        title="Frequency signature"
        y={frequencyRailY}
      >
        {spectrum.slice(0, 3).map((bin, index) => (
          <AnalysisMetricBar
            color="#7e2f8e"
            key={bin.label}
            label={bin.label}
            value={bin.magnitude.toFixed(2)}
            width={(bin.width / maxSpectrumWidth) * 100}
            x={ANALYSIS_RAIL_X + 12}
            y={frequencyRailY + 48 + index * 16}
          />
        ))}
      </AnalysisRailBlock>

      {overlays.eventMarkers ? (
        <EventLayer
          area={lane0}
          samples={samples}
          showLabels={false}
          y1={lane0.top - 6}
          y2={lane6.bottom}
        />
      ) : null}

      {selected ? (
        <g className="analysis-cursor">
          <line x1={selectedX} x2={selectedX} y1={lane0.top - 6} y2={lane6.bottom} />
          <rect x={selectedX - 32} y={lane6.bottom + 14} width="64" height="22" rx="5" />
          <text x={selectedX} y={lane6.bottom + 29} textAnchor="middle">
            {selected.cycle}
          </text>
        </g>
      ) : null}

      {xTicks.map((tick) => {
        const x = xForArea(tick, samples, lane6)
        return (
          <text
            className="x-tick"
            key={`analysis-x-${tick}`}
            x={x}
            y={lane6.bottom + 56}
            textAnchor="middle"
          >
            {formatCycleTick(tick)}
          </text>
        )
      })}
      <text className="x-label" x={(lane6.left + lane6.right) / 2} y={lane6.bottom + 72}>
        Cycle index
      </text>
    </svg>
  )
}

interface ScientificLegendProps {
  activeSeries: SeriesConfig
  overlays: Record<OverlayId, boolean>
  visibleSeries: readonly SeriesConfig[]
}

function ScientificLegend({
  activeSeries,
  overlays,
  visibleSeries,
}: ScientificLegendProps): React.JSX.Element {
  const hasReferenceLayer = overlays.alarmBands || overlays.anomalyBands || overlays.rollingAverage

  return (
    <section className="scientific-legend" aria-label="Scientific plot legend">
      <div className="legend-section">
        <span className="control-label">Signals</span>
        <div className="legend-items">
          {visibleSeries.map((series) => (
            <span className="legend-item" key={series.id}>
              <span className="legend-line" style={{ backgroundColor: series.color }} />
              <span>{series.label}</span>
              {activeSeries.id === series.id ? <strong>active</strong> : null}
            </span>
          ))}
        </div>
      </div>

      {hasReferenceLayer ? (
        <div className="legend-section">
          <span className="control-label">Reference layers</span>
          <div className="legend-items">
            {overlays.alarmBands ? (
              <>
                <span className="legend-item">
                  <span className="legend-line legend-warning" />
                  <span>warning</span>
                </span>
                <span className="legend-item">
                  <span className="legend-line legend-alarm" />
                  <span>alarm</span>
                </span>
                <span className="legend-item">
                  <span className="legend-line legend-target" />
                  <span>target</span>
                </span>
              </>
            ) : null}
            {overlays.anomalyBands ? (
              <span className="legend-item">
                <span className="legend-line legend-anomaly" />
                <span>abnormal area</span>
              </span>
            ) : null}
            {overlays.rollingAverage ? (
              <span className="legend-item">
                <span className="legend-line legend-rolling" />
                <span>rolling average</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

interface AnalyticsWorkbenchProps {
  activeSeries: SeriesConfig
  samples: readonly Sample[]
  selectedIndex: number
  visibleSeries: readonly SeriesConfig[]
}

function AnalyticsWorkbench({
  activeSeries,
  samples,
  selectedIndex,
  visibleSeries,
}: AnalyticsWorkbenchProps): React.JSX.Element {
  const analysisSeries = activeSeries.id === 'cycleState' ? getSeriesById('pressure') : activeSeries
  const forecast = buildForecastInsight(samples, analysisSeries)
  const rulItems = buildRulItems(samples)
  const residual = buildResidualInsight(samples, analysisSeries, selectedIndex)
  const anomaly = buildAnomalyInsight(samples, selectedIndex)
  const correlations = buildCorrelationInsights(samples, analysisSeries, visibleSeries)
  const phases = buildPhaseStats(samples, analysisSeries)
  const spc = buildSpcInsight(samples, analysisSeries, selectedIndex)
  const spectrum = buildSpectrumBins(samples)
  const eventImpacts = buildEventImpacts(samples, analysisSeries)
  const dataQuality = buildDataQualityInsight(samples, analysisSeries)
  const rateChange = buildRateChangeInsight(samples, analysisSeries, selectedIndex)
  const distribution = buildDistributionInsight(samples, analysisSeries)
  const autocorrelation = buildAutocorrelation(samples, analysisSeries)
  const envelope = buildEnvelope(samples, analysisSeries)
  const repeatability = buildCycleRepeatability(samples, analysisSeries)
  const alarmWindows = buildAlarmWindows(samples)
  const driftItems = buildDriftItems(samples)
  const features = buildFeatureInsight(samples, analysisSeries)
  const health = buildHealthInsight(samples, selectedIndex)
  const changePoints = buildChangePoints(samples, analysisSeries)
  const leadLagPairs = buildLeadLagPairs(samples, visibleSeries)
  const backtest = buildForecastBacktest(samples, analysisSeries)
  const thresholdSensitivity = buildThresholdSensitivity(samples, selectedIndex)
  const alarmPareto = buildAlarmParetoItems(samples)
  const stateOccupancy = buildStateOccupancy(samples)
  const maintenanceActions = buildMaintenanceActions(samples, selectedIndex)
  const uncertainty = buildUncertaintyInsight(samples, analysisSeries)
  const capability = buildCapabilityInsight(samples, analysisSeries)
  const runRules = buildRunRules(samples, analysisSeries)
  const hysteresis = buildHysteresisInsight(samples)
  const crossSpectrum = buildCrossSpectrum(samples, analysisSeries)
  const multiresolution = buildMultiresolutionEnergy(samples, analysisSeries)
  const clusters = buildCycleClusters(samples, analysisSeries)
  const twinResidual = buildTwinResidual(samples, analysisSeries, selectedIndex)
  const chatter = buildChatterItems(samples)
  const scenarios = buildScenarioForecasts(samples, analysisSeries)
  const ewma = buildEwmaInsight(samples, analysisSeries)
  const cusum = buildCusumInsight(samples, analysisSeries)
  const kalman = buildKalmanInsight(samples, analysisSeries, selectedIndex)
  const decomposition = buildDecompositionInsight(samples, analysisSeries)
  const stationarity = buildStationarityInsight(samples, analysisSeries)
  const spectralEntropy = buildSpectralEntropy(samples, analysisSeries)
  const pca = buildPcaInsight(samples)
  const mahalanobis = buildMahalanobisInsight(samples, selectedIndex)
  const recurrence = buildRecurrenceInsight(samples, analysisSeries)
  const matrixProfile = buildMatrixProfile(samples, analysisSeries)
  const dtwCycles = buildDtwCycleItems(samples, analysisSeries)
  const lagCausality = buildLagCausalityItems(samples, analysisSeries)
  const bayesianAlarm = buildBayesianAlarmInsight(samples, selectedIndex)
  const hazard = buildHazardCurve(samples)
  const fusion = buildFusionConsistency(samples, analysisSeries, selectedIndex)
  const calibration = buildCalibrationOffsets(samples)
  const spectrogram = buildSpectrogramInsight(samples, analysisSeries)
  const rollingCorrelationMap = buildRollingCorrelationMap(samples, analysisSeries)
  const residualQq = buildResidualQqInsight(samples, analysisSeries)
  const whiteness = buildWhitenessInsight(samples, analysisSeries)
  const predictionCoverage = buildPredictionCoverageInsight(samples, analysisSeries)
  const reliabilityBands = buildReliabilityBands(samples, analysisSeries)
  const transferGain = buildTransferGainItems(samples, analysisSeries)
  const stateTransitions = buildStateTransitionItems(samples)
  const earlyWarningLead = buildEarlyWarningLeadItems(samples)
  const wavelet = buildWaveletScalogram(samples, analysisSeries)
  const envelopeSpectrum = buildEnvelopeSpectrum(samples)
  const orderTracking = buildOrderTracking(samples, analysisSeries)
  const fatigueDamage = buildFatigueDamageBins(samples, analysisSeries)
  const damageAccumulation = buildDamageAccumulation(samples, analysisSeries)
  const regimes = buildRegimeProbabilityItems(samples, selectedIndex)
  const anomalyScore = buildAnomalyScoreInsight(samples, selectedIndex)
  const sensorVotes = buildSensorVoteInsight(samples, selectedIndex)
  const maintenanceWindows = buildMaintenanceWindows(samples)
  const correlationMatrix = buildCorrelationMatrix(samples)
  const residualMatrix = buildCorrelationMatrix(samples, true)
  const faultSignatures = buildFaultSignatureItems(samples, selectedIndex)
  const rootCauses = buildRootCauseItems(samples, selectedIndex)
  const interventions = buildInterventionItems(samples, selectedIndex)
  const thresholdSweep = buildThresholdSweepItems(samples)
  const confusion = buildConfusionMatrixInsight(samples)
  const dwellTimes = buildDwellTimeItems(samples)
  const counterfactual = buildCounterfactualSensitivityItems(samples, selectedIndex)
  const imputation = buildImputationItems(samples)
  const saturation = buildSensorSaturationItems(samples)
  const latency = buildLatencyInsight(samples)
  const alarmSuppression = buildAlarmSuppressionItems(samples)
  const alarmFloods = buildAlarmFloodWindows(samples)
  const featureStability = buildFeatureStabilityItems(samples, analysisSeries)
  const residualRegimes = buildResidualRegimeItems(samples, analysisSeries)
  const slaCompliance = buildSlaComplianceItems(samples, analysisSeries)
  const freshness = buildDataFreshnessInsight(samples)

  return (
    <section className="analytics-workbench" aria-label="Advanced time-series analytics">
      <ForecastPanel forecast={forecast} series={analysisSeries} />
      <RulPanel items={rulItems} />
      <BaselineResidualPanel
        residual={residual}
        samples={samples}
        selectedIndex={selectedIndex}
        series={analysisSeries}
      />
      <AnomalyExplanationPanel insight={anomaly} />
      <CorrelationLagPanel correlations={correlations} />
      <PhaseAlignmentPanel phases={phases} series={analysisSeries} />
      <SpcPanel insight={spc} series={analysisSeries} />
      <SpectrumPanel bins={spectrum} />
      <EventImpactPanel impacts={eventImpacts} series={analysisSeries} />
      <DataQualityPanel insight={dataQuality} series={analysisSeries} />
      <RateChangePanel insight={rateChange} series={analysisSeries} />
      <DistributionPanel insight={distribution} series={analysisSeries} />
      <AutocorrelationPanel points={autocorrelation} />
      <EnvelopePanel points={envelope} series={analysisSeries} />
      <RepeatabilityPanel items={repeatability} series={analysisSeries} />
      <AlarmTimelinePanel windows={alarmWindows} />
      <DriftPanel items={driftItems} />
      <FeatureExtractionPanel insight={features} series={analysisSeries} />
      <HealthIndexPanel insight={health} />
      <ChangePointPanel points={changePoints} series={analysisSeries} />
      <LeadLagPairPanel pairs={leadLagPairs} />
      <ForecastBacktestPanel insight={backtest} series={analysisSeries} />
      <ThresholdSensitivityPanel items={thresholdSensitivity} />
      <AlarmParetoPanel items={alarmPareto} />
      <StateOccupancyPanel states={stateOccupancy} />
      <MaintenancePriorityPanel actions={maintenanceActions} />
      <UncertaintyPanel insight={uncertainty} series={analysisSeries} />
      <CapabilityPanel insight={capability} series={analysisSeries} />
      <RunRulesPanel items={runRules} />
      <HysteresisPanel insight={hysteresis} />
      <CrossSpectrumPanel insight={crossSpectrum} />
      <MultiresolutionPanel bands={multiresolution} series={analysisSeries} />
      <CycleClusterPanel items={clusters} />
      <TwinResidualPanel insight={twinResidual} series={analysisSeries} />
      <AlarmChatterPanel items={chatter} />
      <ScenarioForecastPanel items={scenarios} series={analysisSeries} />
      <EwmaPanel insight={ewma} series={analysisSeries} />
      <CusumPanel insight={cusum} series={analysisSeries} />
      <KalmanPanel insight={kalman} series={analysisSeries} />
      <DecompositionPanel insight={decomposition} series={analysisSeries} />
      <StationarityPanel insight={stationarity} />
      <SpectralEntropyPanel insight={spectralEntropy} />
      <PcaPanel insight={pca} />
      <MahalanobisPanel insight={mahalanobis} />
      <RecurrencePanel insight={recurrence} series={analysisSeries} />
      <MatrixProfilePanel insight={matrixProfile} series={analysisSeries} />
      <MotifFinderPanel insight={matrixProfile} />
      <DiscordFinderPanel insight={matrixProfile} />
      <DtwCyclePanel items={dtwCycles} />
      <LagCausalityPanel items={lagCausality} />
      <BayesianAlarmPanel insight={bayesianAlarm} />
      <HazardCurvePanel points={hazard} />
      <FusionConsistencyPanel insight={fusion} />
      <CalibrationOffsetPanel items={calibration} />
      <SpectrogramPanel insight={spectrogram} series={analysisSeries} />
      <RollingCorrelationMapPanel insight={rollingCorrelationMap} series={analysisSeries} />
      <ResidualQqPanel insight={residualQq} />
      <WhitenessPanel insight={whiteness} />
      <PredictionCoveragePanel insight={predictionCoverage} series={analysisSeries} />
      <ReliabilityPanel bands={reliabilityBands} />
      <TransferGainPanel items={transferGain} series={analysisSeries} />
      <StateTransitionPanel items={stateTransitions} />
      <EarlyWarningLeadPanel items={earlyWarningLead} />
      <WaveletScalogramPanel insight={wavelet} series={analysisSeries} />
      <EnvelopeSpectrumPanel bins={envelopeSpectrum} />
      <OrderTrackingPanel bins={orderTracking} series={analysisSeries} />
      <RainflowDamagePanel bins={fatigueDamage} />
      <DamageAccumulationPanel insight={damageAccumulation} series={analysisSeries} />
      <RegimeProbabilityPanel items={regimes} />
      <AnomalyScorePanel insight={anomalyScore} />
      <SensorVotePanel insight={sensorVotes} />
      <MaintenanceWindowPanel items={maintenanceWindows} />
      <CovarianceMatrixPanel insight={correlationMatrix} />
      <ResidualCovariancePanel insight={residualMatrix} />
      <FaultSignaturePanel items={faultSignatures} />
      <RootCauseWaterfallPanel items={rootCauses} />
      <InterventionWhatIfPanel items={interventions} />
      <ThresholdSweepPanel items={thresholdSweep} />
      <ConfusionMatrixPanel insight={confusion} />
      <DwellTimePanel items={dwellTimes} />
      <CounterfactualSensitivityPanel items={counterfactual} />
      <ImputationBurdenPanel items={imputation} />
      <SensorSaturationPanel items={saturation} />
      <LatencyJitterPanel insight={latency} />
      <AlarmSuppressionPanel items={alarmSuppression} />
      <AlarmFloodPanel windows={alarmFloods} />
      <FeatureStabilityPanel items={featureStability} series={analysisSeries} />
      <ResidualByRegimePanel items={residualRegimes} series={analysisSeries} />
      <SlaCompliancePanel items={slaCompliance} />
      <DataFreshnessPanel insight={freshness} />
    </section>
  )
}

interface PanelHeaderProps {
  index: string
  meta: string
  title: string
}

function PanelHeader({ index, meta, title }: PanelHeaderProps): React.JSX.Element {
  return (
    <div className="workbench-panel-header">
      <span>{index}</span>
      <div>
        <h3>{title}</h3>
        <small>{meta}</small>
      </div>
    </div>
  )
}

interface ForecastPanelProps {
  forecast: ForecastInsight
  series: SeriesConfig
}

function ForecastPanel({ forecast, series }: ForecastPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="01" meta="12-cycle horizon" title="Prediction overlay" />
      <ForecastMiniChart forecast={forecast} series={series} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Slope</dt>
          <dd>{formatRateValue(forecast.slope, series)} / cycle</dd>
        </div>
        <div>
          <dt>Spread</dt>
          <dd>{formatValue(forecast.spread, series)}</dd>
        </div>
      </dl>
      <div className="workbench-note">{forecast.crossingLabel}</div>
    </article>
  )
}

interface RulPanelProps {
  items: readonly RulItem[]
}

function RulPanel({ items }: RulPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="02" meta="alarm-band projection" title="Remaining useful life" />
      <div className="rul-list">
        {items.map((item) => (
          <div className={`rul-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatCycles(item.cycles)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface BaselineResidualPanelProps {
  residual: ResidualInsight
  samples: readonly Sample[]
  selectedIndex: number
  series: SeriesConfig
}

function BaselineResidualPanel({
  residual,
  samples,
  selectedIndex,
  series,
}: BaselineResidualPanelProps): React.JSX.Element {
  const selected = samples[selectedIndex]
  const actual = selected ? valueFor(selected, series.id) : 0
  const baseline = selected ? rollingAverageAt(samples, series, selectedIndex, 11) : 0

  return (
    <article className="workbench-panel">
      <PanelHeader index="03" meta="rolling baseline residual" title="Baseline vs current" />
      <Sparkline
        color={series.color}
        label={`${series.label} residual sparkline`}
        symmetric
        values={residual.values}
      />
      <dl className="workbench-metrics">
        <div>
          <dt>Actual</dt>
          <dd>{formatValue(actual, series)}</dd>
        </div>
        <div>
          <dt>Baseline</dt>
          <dd>{formatValue(baseline, series)}</dd>
        </div>
        <div>
          <dt>Residual</dt>
          <dd>{formatSignedValue(residual.selectedResidual, series)}</dd>
        </div>
        <div>
          <dt>RMS</dt>
          <dd>{formatValue(residual.rms, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface AnomalyExplanationPanelProps {
  insight: AnomalyInsight
}

function AnomalyExplanationPanel({ insight }: AnomalyExplanationPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="04"
        meta={`${insight.confidence.toFixed(0)}% confidence`}
        title="Anomaly explanation"
      />
      <div className="ranked-list">
        {insight.contributors.map((contributor) => (
          <div className={`ranked-row status-${contributor.status}`} key={contributor.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: contributor.series.color }} />
            <span>{contributor.series.shortLabel}</span>
            <strong>{formatSignedNumber(contributor.score, 1)} sigma</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(Math.min(100, contributor.score * 24), contributor.series.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface CorrelationLagPanelProps {
  correlations: readonly CorrelationInsight[]
}

function CorrelationLagPanel({ correlations }: CorrelationLagPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="05" meta="best lag -5 to +5 cycles" title="Correlation and lag" />
      <div className="ranked-list">
        {correlations.slice(0, 4).map((item) => (
          <div
            className={item.correlation >= 0 ? 'ranked-row positive' : 'ranked-row negative'}
            key={item.series.id}
          >
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              r {formatSignedNumber(item.correlation, 2)} / lag {formatSignedNumber(item.lag, 0)}
            </strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(Math.abs(item.correlation) * 100, item.series.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface PhaseAlignmentPanelProps {
  phases: readonly PhaseStat[]
  series: SeriesConfig
}

function PhaseAlignmentPanel({ phases, series }: PhaseAlignmentPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="06" meta={series.label} title="Cycle phase alignment" />
      <div className="phase-list">
        {phases.map((phase) => (
          <div className="phase-row" key={phase.state}>
            <span>{phase.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(phase.width, phase.color)} />
            </div>
            <strong>{formatValue(phase.average, series)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface SpcPanelProps {
  insight: SpcInsight
  series: SeriesConfig
}

function SpcPanel({ insight, series }: SpcPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="07"
        meta={`${insight.violations} control violations`}
        title="SPC control chart"
      />
      <SpcMiniChart insight={insight} series={series} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Mean</dt>
          <dd>{formatValue(insight.mean, series)}</dd>
        </div>
        <div>
          <dt>Sigma</dt>
          <dd>{formatValue(insight.sigma, series)}</dd>
        </div>
        <div>
          <dt>Z</dt>
          <dd>{formatSignedNumber(insight.selectedZ, 2)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface SpectrumPanelProps {
  bins: readonly SpectrumBin[]
}

function SpectrumPanel({ bins }: SpectrumPanelProps): React.JSX.Element {
  const topBin = bins.reduce(
    (current, candidate) => (candidate.magnitude > current.magnitude ? candidate : current),
    bins[0] ?? { bin: 0, label: '0.00 Hz', magnitude: 0, width: 0 },
  )

  return (
    <article className="workbench-panel">
      <PanelHeader index="08" meta={`peak ${topBin.label}`} title="Vibration spectrum" />
      <div className="spectrum-bars">
        {bins.map((bin) => (
          <div
            className={bin.bin === topBin.bin ? 'spectrum-bin is-peak' : 'spectrum-bin'}
            key={bin.bin}
          >
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, '#7e2f8e')} />
            </div>
            <strong>{bin.magnitude.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface EventImpactPanelProps {
  impacts: readonly EventImpact[]
  series: SeriesConfig
}

function EventImpactPanel({ impacts, series }: EventImpactPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="09" meta="before vs after mean" title="Event impact" />
      <div className="ranked-list">
        {impacts.map((impact) => (
          <div
            className={`ranked-row event-row status-${impact.status}`}
            key={`${impact.event.cycle}-${impact.event.label}`}
          >
            <span>{impact.event.cycle}</span>
            <span>{impact.event.label}</span>
            <strong>{formatSignedValue(impact.delta, series)}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(impact.width, impact.delta >= 0 ? '#d95319' : '#0072bd')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface DataQualityPanelProps {
  insight: DataQualityInsight
  series: SeriesConfig
}

function DataQualityPanel({ insight, series }: DataQualityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="10" meta={series.label} title="Data quality" />
      <dl className="workbench-metrics">
        <div>
          <dt>Complete</dt>
          <dd>{insight.completeness.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Gaps</dt>
          <dd>{insight.gapCount}</dd>
        </div>
        <div>
          <dt>Held</dt>
          <dd>{insight.heldCount}</dd>
        </div>
        <div>
          <dt>Spikes</dt>
          <dd>{insight.spikeCount}</dd>
        </div>
        <div>
          <dt>Noise RMS</dt>
          <dd>{formatValue(insight.noiseRms, series)}</dd>
        </div>
      </dl>
      <div className="quality-meter">
        <span style={barStyle(insight.completeness, '#12b76a')} />
      </div>
    </article>
  )
}

interface RateChangePanelProps {
  insight: RateChangeInsight
  series: SeriesConfig
}

function RateChangePanel({ insight, series }: RateChangePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="11" meta="first derivative" title="Rate of change" />
      <Sparkline
        color={series.color}
        label={`${series.label} rate-of-change sparkline`}
        symmetric
        values={insight.rates}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{formatRateValue(insight.currentRate, series)}</dd>
        </div>
        <div>
          <dt>Max rise</dt>
          <dd>{formatRateValue(insight.maxRise, series)}</dd>
        </div>
        <div>
          <dt>Max fall</dt>
          <dd>{formatRateValue(insight.maxFall, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface DistributionPanelProps {
  insight: DistributionInsight
  series: SeriesConfig
}

function DistributionPanel({ insight, series }: DistributionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="12" meta="histogram and percentiles" title="Distribution" />
      <div className="histogram-bars">
        {insight.bins.map((bin) => (
          <div className="histogram-bin" key={bin.label}>
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, series.color)} />
            </div>
            <strong>{bin.count}</strong>
          </div>
        ))}
      </div>
      <dl className="workbench-metrics compact">
        <div>
          <dt>P05</dt>
          <dd>{formatValue(insight.p05, series)}</dd>
        </div>
        <div>
          <dt>P50</dt>
          <dd>{formatValue(insight.p50, series)}</dd>
        </div>
        <div>
          <dt>P95</dt>
          <dd>{formatValue(insight.p95, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface AutocorrelationPanelProps {
  points: readonly AutocorrelationPoint[]
}

function AutocorrelationPanel({ points }: AutocorrelationPanelProps): React.JSX.Element {
  const topPoint = points.reduce(
    (current, candidate) =>
      Math.abs(candidate.correlation) > Math.abs(current.correlation) ? candidate : current,
    points[0] ?? { lag: 0, correlation: 0, width: 0 },
  )

  return (
    <article className="workbench-panel">
      <PanelHeader index="13" meta={`dominant lag ${topPoint.lag}`} title="Autocorrelation" />
      <div className="spectrum-bars">
        {points.map((point) => (
          <div
            className={point.correlation >= 0 ? 'spectrum-bin positive' : 'spectrum-bin negative'}
            key={point.lag}
          >
            <span>lag {point.lag}</span>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(point.width, point.correlation >= 0 ? '#027a48' : '#be123c')}
              />
            </div>
            <strong>{formatSignedNumber(point.correlation, 2)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface EnvelopePanelProps {
  points: readonly EnvelopePoint[]
  series: SeriesConfig
}

function EnvelopePanel({ points, series }: EnvelopePanelProps): React.JSX.Element {
  const widest = points.reduce(
    (current, point) => (point.high - point.low > current.high - current.low ? point : current),
    points[0] ?? { phase: 0, low: 0, median: 0, high: 0 },
  )

  return (
    <article className="workbench-panel">
      <PanelHeader index="14" meta="P10-P90 by cycle phase" title="Operating envelope" />
      <EnvelopeMiniChart points={points} series={series} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Wide phase</dt>
          <dd>{widest.phase}</dd>
        </div>
        <div>
          <dt>P10</dt>
          <dd>{formatValue(widest.low, series)}</dd>
        </div>
        <div>
          <dt>P90</dt>
          <dd>{formatValue(widest.high, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface RepeatabilityPanelProps {
  items: readonly CycleRepeatability[]
  series: SeriesConfig
}

function RepeatabilityPanel({ items, series }: RepeatabilityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="15" meta="one row per 24-cycle run" title="Cycle repeatability" />
      <div className="ranked-list">
        {items.map((item) => (
          <div
            className={
              item.deviation >= 0
                ? 'ranked-row event-row positive'
                : 'ranked-row event-row negative'
            }
            key={item.label}
          >
            <span>{item.label}</span>
            <span>peak {formatValue(item.peak, series)}</span>
            <strong>{formatSignedValue(item.deviation, series)}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(item.width, item.deviation >= 0 ? '#d95319' : '#0072bd')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface AlarmTimelinePanelProps {
  windows: readonly AlarmWindow[]
}

function AlarmTimelinePanel({ windows }: AlarmTimelinePanelProps): React.JSX.Element {
  const maxTotal = Math.max(1, ...windows.map((window) => window.total))

  return (
    <article className="workbench-panel">
      <PanelHeader index="16" meta="20-cycle windows" title="Alarm timeline" />
      <div className="alarm-window-list">
        {windows.map((window) => (
          <div className="alarm-window-row" key={window.label}>
            <span>{window.label}</span>
            <div className="stack-track">
              <span
                className="stack-segment stack-warning"
                style={{ '--bar-size': `${(window.warning / maxTotal) * 100}%` } as CSSProperties}
              />
              <span
                className="stack-segment stack-anomaly"
                style={{ '--bar-size': `${(window.anomaly / maxTotal) * 100}%` } as CSSProperties}
              />
              <span
                className="stack-segment stack-alarm"
                style={{ '--bar-size': `${(window.alarm / maxTotal) * 100}%` } as CSSProperties}
              />
            </div>
            <strong>{window.total}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface DriftPanelProps {
  items: readonly DriftItem[]
}

function DriftPanel({ items }: DriftPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="17" meta="latest 60-cycle slope" title="Sensor drift" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatRateValue(item.slope, item.series)} / cycle</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface FeatureExtractionPanelProps {
  insight: FeatureInsight
  series: SeriesConfig
}

function FeatureExtractionPanel({
  insight,
  series,
}: FeatureExtractionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="18" meta={series.label} title="Feature extraction" />
      <dl className="workbench-metrics">
        <div>
          <dt>RMS</dt>
          <dd>{formatValue(insight.rms, series)}</dd>
        </div>
        <div>
          <dt>Crest</dt>
          <dd>{insight.crestFactor.toFixed(2)}</dd>
        </div>
        <div>
          <dt>P95</dt>
          <dd>{formatValue(insight.p95, series)}</dd>
        </div>
        <div>
          <dt>Warn time</dt>
          <dd>{insight.timeAboveWarning.toFixed(1)} s</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>{insight.area.toFixed(0)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface HealthIndexPanelProps {
  insight: HealthInsight
}

function HealthIndexPanel({ insight }: HealthIndexPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="19"
        meta={`${insight.score.toFixed(0)} / 100 score`}
        title="Health index"
      />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.score.toFixed(0)}</strong>
        <span>composite health</span>
      </div>
      <div className="ranked-list">
        {insight.contributions.slice(0, 4).map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{item.risk.toFixed(0)} risk</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ChangePointPanelProps {
  points: readonly ChangePoint[]
  series: SeriesConfig
}

function ChangePointPanel({ points, series }: ChangePointPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="20" meta={series.label} title="Change-point detector" />
      <div className="ranked-list">
        {points.map((point) => (
          <div className={`ranked-row event-row status-${point.status}`} key={point.cycle}>
            <span>{point.cycle}</span>
            <span>{point.direction}</span>
            <strong>{formatRateValue(point.magnitude, series)}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(point.width, point.direction === 'rise' ? '#d95319' : '#0072bd')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface LeadLagPairPanelProps {
  pairs: readonly LeadLagPair[]
}

function LeadLagPairPanel({ pairs }: LeadLagPairPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="21" meta="strongest pair links" title="Lead-lag pairs" />
      <div className="ranked-list">
        {pairs.map((pair) => (
          <div
            className={
              pair.correlation >= 0
                ? 'ranked-row pair-row positive'
                : 'ranked-row pair-row negative'
            }
            key={`${pair.source.id}-${pair.target.id}`}
          >
            <span>{pair.source.shortLabel}</span>
            <span>{pair.target.shortLabel}</span>
            <strong>
              r {formatSignedNumber(pair.correlation, 2)} / lag {formatSignedNumber(pair.lag, 0)}
            </strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(pair.width, pair.correlation >= 0 ? '#027a48' : '#be123c')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ForecastBacktestPanelProps {
  insight: ForecastBacktestInsight
  series: SeriesConfig
}

function ForecastBacktestPanel({ insight, series }: ForecastBacktestPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="22" meta="one-step historical error" title="Forecast backtest" />
      <Sparkline
        color={series.color}
        label={`${series.label} forecast backtest error`}
        symmetric
        values={insight.errors}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>MAE</dt>
          <dd>{formatValue(insight.mae, series)}</dd>
        </div>
        <div>
          <dt>RMSE</dt>
          <dd>{formatValue(insight.rmse, series)}</dd>
        </div>
        <div>
          <dt>Max</dt>
          <dd>{formatValue(insight.maxError, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface ThresholdSensitivityPanelProps {
  items: readonly ThresholdSensitivityItem[]
}

function ThresholdSensitivityPanel({ items }: ThresholdSensitivityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="23" meta="distance to alarm band" title="Threshold sensitivity" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatSignedValue(item.alarmMargin, item.series)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface AlarmParetoPanelProps {
  items: readonly AlarmParetoItem[]
}

function AlarmParetoPanel({ items }: AlarmParetoPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="24" meta="weighted by severity" title="Alarm Pareto" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{item.weightedCount}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface StateOccupancyPanelProps {
  states: readonly StateOccupancy[]
}

function StateOccupancyPanel({ states }: StateOccupancyPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="25" meta="samples and risk by phase" title="State occupancy" />
      <div className="phase-list">
        {states.map((state) => (
          <div className="phase-row" key={state.label}>
            <span>{state.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(state.width, state.color)} />
            </div>
            <strong>{state.risk.toFixed(0)} risk</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface MaintenancePriorityPanelProps {
  actions: readonly MaintenanceAction[]
}

function MaintenancePriorityPanel({ actions }: MaintenancePriorityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="26" meta="ranked action queue" title="Maintenance priority" />
      <div className="ranked-list">
        {actions.map((action) => (
          <div className={`ranked-row action-row status-${action.status}`} key={action.label}>
            <span>{action.driver}</span>
            <span>{action.label}</span>
            <strong>{action.priority.toFixed(0)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(action.width, '#155eef')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface UncertaintyPanelProps {
  insight: UncertaintyInsight
  series: SeriesConfig
}

function UncertaintyPanel({ insight, series }: UncertaintyPanelProps): React.JSX.Element {
  const maxValue = Math.max(
    1,
    insight.measurement,
    insight.process,
    insight.model,
    insight.combined,
  )

  return (
    <article className="workbench-panel">
      <PanelHeader index="27" meta="measurement + process + model" title="Uncertainty budget" />
      <div className="uncertainty-list">
        {[
          ['Measurement', insight.measurement, '#155eef'],
          ['Process', insight.process, '#d95319'],
          ['Model', insight.model, '#7e2f8e'],
          ['Combined', insight.combined, '#111827'],
        ].map(([label, value, color]) => (
          <div className="uncertainty-row" key={label}>
            <span>{label}</span>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle((Number(value) / maxValue) * 100, String(color))}
              />
            </div>
            <strong>{formatValue(Number(value), series)}</strong>
          </div>
        ))}
      </div>
      <div className="workbench-note">95% band +/- {formatValue(insight.coverage, series)}</div>
    </article>
  )
}

interface CapabilityPanelProps {
  insight: CapabilityInsight
  series: SeriesConfig
}

function CapabilityPanel({ insight, series }: CapabilityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="28" meta={series.label} title="Process capability" />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.cpk.toFixed(2)}</strong>
        <span>Cpk</span>
      </div>
      <dl className="workbench-metrics compact">
        <div>
          <dt>Cp</dt>
          <dd>{insight.cp.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Mean</dt>
          <dd>{formatValue(insight.mean, series)}</dd>
        </div>
        <div>
          <dt>Sigma</dt>
          <dd>{formatValue(insight.sigma, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface RunRulesPanelProps {
  items: readonly RunRuleItem[]
}

function RunRulesPanel({ items }: RunRulesPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="29" meta="Western Electric style" title="SPC run rules" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row rule-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#d92d20')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface HysteresisPanelProps {
  insight: HysteresisInsight
}

function HysteresisPanel({ insight }: HysteresisPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="30"
        meta={`${insight.xSeries.shortLabel} vs ${insight.ySeries.shortLabel}`}
        title="Hysteresis loop"
      />
      <HysteresisMiniChart insight={insight} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Loop area</dt>
          <dd>{insight.loopArea.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Closure</dt>
          <dd>{insight.closureError.toFixed(1)}%</dd>
        </div>
      </dl>
    </article>
  )
}

interface CrossSpectrumPanelProps {
  insight: CrossSpectrumInsight
}

function CrossSpectrumPanel({ insight }: CrossSpectrumPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="31" meta={`peak ${insight.peakLabel}`} title="Cross-spectrum" />
      <div className="spectrum-bars">
        {insight.bins.map((bin) => (
          <div className="spectrum-bin" key={bin.label}>
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, '#155eef')} />
            </div>
            <strong>{bin.value.toFixed(1)}</strong>
          </div>
        ))}
      </div>
      <div className="workbench-note">{insight.pairLabel}</div>
    </article>
  )
}

interface MultiresolutionPanelProps {
  bands: readonly EnergyBand[]
  series: SeriesConfig
}

function MultiresolutionPanel({ bands, series }: MultiresolutionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="32" meta={series.label} title="Multiresolution energy" />
      <div className="phase-list">
        {bands.map((band) => (
          <div className="phase-row" key={band.label}>
            <span>{band.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(band.width, band.color)} />
            </div>
            <strong>{formatValue(band.value, series)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface CycleClusterPanelProps {
  items: readonly CycleClusterItem[]
}

function CycleClusterPanel({ items }: CycleClusterPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="33" meta="cycle feature grouping" title="Cycle clustering" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row event-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>{item.cluster}</span>
            <strong>{item.distance.toFixed(1)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#7c3aed')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface TwinResidualPanelProps {
  insight: TwinResidualInsight
  series: SeriesConfig
}

function TwinResidualPanel({ insight, series }: TwinResidualPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="34"
        meta={`driver ${insight.driver.shortLabel}`}
        title="Digital twin residual"
      />
      <Sparkline
        color={series.color}
        label={`${series.label} digital twin residual`}
        symmetric
        values={insight.residuals}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{formatSignedValue(insight.currentResidual, series)}</dd>
        </div>
        <div>
          <dt>RMS</dt>
          <dd>{formatValue(insight.rms, series)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface AlarmChatterPanelProps {
  items: readonly ChatterItem[]
}

function AlarmChatterPanel({ items }: AlarmChatterPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="35" meta="status transition count" title="Alarm chatter" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              {item.transitions} / dwell {item.shortestDwell}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ScenarioForecastPanelProps {
  items: readonly ScenarioForecastItem[]
  series: SeriesConfig
}

function ScenarioForecastPanel({ items, series }: ScenarioForecastPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="36" meta="12-cycle what-if" title="Scenario forecast" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row event-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>{formatValue(item.value, series)}</span>
            <strong>{formatSignedValue(item.delta, series)}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(item.width, item.delta >= 0 ? '#d95319' : '#0072bd')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface EwmaPanelProps {
  insight: EwmaInsight
  series: SeriesConfig
}

function EwmaPanel({ insight, series }: EwmaPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="37" meta="exponentially weighted mean" title="EWMA monitor" />
      <Sparkline color={series.color} label={`${series.label} EWMA`} values={insight.values} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{formatValue(insight.current, series)}</dd>
        </div>
        <div>
          <dt>UCL</dt>
          <dd>{formatValue(insight.ucl, series)}</dd>
        </div>
        <div>
          <dt>LCL</dt>
          <dd>{formatValue(insight.lcl, series)}</dd>
        </div>
        <div>
          <dt>Violations</dt>
          <dd>{insight.violations}</dd>
        </div>
      </dl>
    </article>
  )
}

interface CusumPanelProps {
  insight: CusumInsight
  series: SeriesConfig
}

function CusumPanel({ insight, series }: CusumPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="38" meta="positive and negative drift" title="CUSUM monitor" />
      <CusumMiniChart insight={insight} series={series} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Positive</dt>
          <dd>{formatValue(insight.maxPositive, series)}</dd>
        </div>
        <div>
          <dt>Negative</dt>
          <dd>{formatSignedValue(insight.maxNegative, series)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{insight.status}</dd>
        </div>
      </dl>
    </article>
  )
}

interface KalmanPanelProps {
  insight: KalmanInsight
  series: SeriesConfig
}

function KalmanPanel({ insight, series }: KalmanPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="39" meta="filtered estimate" title="Kalman smoothing" />
      <Sparkline
        color={series.color}
        label={`${series.label} Kalman estimate`}
        values={insight.estimates}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Estimate</dt>
          <dd>{formatValue(insight.currentEstimate, series)}</dd>
        </div>
        <div>
          <dt>Residual</dt>
          <dd>{formatSignedValue(insight.currentResidual, series)}</dd>
        </div>
        <div>
          <dt>Gain</dt>
          <dd>{insight.gain.toFixed(2)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface DecompositionPanelProps {
  insight: DecompositionInsight
  series: SeriesConfig
}

function DecompositionPanel({ insight, series }: DecompositionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="40" meta="trend / seasonal / residual" title="Decomposition" />
      <Sparkline color={series.color} label={`${series.label} trend`} values={insight.trend} />
      <div className="phase-list">
        {insight.bands.map((band) => (
          <div className="phase-row" key={band.label}>
            <span>{band.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(band.width, band.color)} />
            </div>
            <strong>{formatValue(band.value, series)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface StationarityPanelProps {
  insight: StationarityInsight
}

function StationarityPanel({ insight }: StationarityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="41" meta="first half vs second half" title="Stationarity check" />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.meanShift.toFixed(2)}</strong>
        <span>mean shift sigma</span>
      </div>
      <dl className="workbench-metrics compact">
        <div>
          <dt>Variance</dt>
          <dd>{insight.varianceRatio.toFixed(2)}x</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{insight.width.toFixed(0)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface SpectralEntropyPanelProps {
  insight: SpectralEntropyInsight
}

function SpectralEntropyPanel({ insight }: SpectralEntropyPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="42" meta="0 periodic / 1 broadband" title="Spectral entropy" />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.entropy.toFixed(2)}</strong>
        <span>normalized entropy</span>
      </div>
      <div className="spectrum-bars">
        {insight.bins.slice(0, 6).map((bin) => (
          <div className="spectrum-bin" key={bin.bin}>
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, '#7e2f8e')} />
            </div>
            <strong>{bin.magnitude.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface PcaPanelProps {
  insight: PcaInsight
}

function PcaPanel({ insight }: PcaPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="43"
        meta={`${insight.variance.toFixed(0)}% proxy variance`}
        title="PCA contribution"
      />
      <div className="ranked-list">
        {insight.contributions.map((item) => (
          <div
            className={item.loading >= 0 ? 'ranked-row positive' : 'ranked-row negative'}
            key={item.series.id}
          >
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatSignedNumber(item.loading, 2)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface MahalanobisPanelProps {
  insight: MahalanobisInsight
}

function MahalanobisPanel({ insight }: MahalanobisPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="44" meta="multivariate z-distance" title="Mahalanobis distance" />
      <Sparkline color="#155eef" label="Mahalanobis distance" values={insight.distances} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{insight.current.toFixed(2)}</dd>
        </div>
        <div>
          <dt>P95</dt>
          <dd>{insight.threshold.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{insight.status}</dd>
        </div>
      </dl>
    </article>
  )
}

interface RecurrencePanelProps {
  insight: RecurrenceInsight
  series: SeriesConfig
}

function RecurrencePanel({ insight, series }: RecurrencePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="45" meta={series.label} title="Recurrence plot" />
      <RecurrenceMiniChart insight={insight} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Rate</dt>
          <dd>{insight.rate.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Determinism</dt>
          <dd>{insight.determinism.toFixed(1)}%</dd>
        </div>
      </dl>
    </article>
  )
}

interface MatrixProfilePanelProps {
  insight: MatrixProfileInsight
  series: SeriesConfig
}

function MatrixProfilePanel({ insight, series }: MatrixProfilePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="46"
        meta={`${insight.windowSize}-sample subsequences`}
        title="Matrix profile"
      />
      <Sparkline
        color={series.color}
        label={`${series.label} matrix profile`}
        values={insight.profile}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Motif</dt>
          <dd>{insight.motifStart}</dd>
        </div>
        <div>
          <dt>Discord</dt>
          <dd>{insight.discordStart}</dd>
        </div>
        <div>
          <dt>Max dist</dt>
          <dd>{insight.discordDistance.toFixed(2)}</dd>
        </div>
      </dl>
    </article>
  )
}

interface MotifFinderPanelProps {
  insight: MatrixProfileInsight
}

function MotifFinderPanel({ insight }: MotifFinderPanelProps): React.JSX.Element {
  const matchWidth = clamp(100 - insight.motifDistance * 28, 12, 100)

  return (
    <article className="workbench-panel">
      <PanelHeader index="47" meta="nearest repeated shape" title="Motif finder" />
      <div className="ranked-list">
        <div className="ranked-row event-row positive">
          <span>{insight.motifStart}</span>
          <span>start sample</span>
          <strong>{insight.motifDistance.toFixed(2)}</strong>
          <div className="bar-track">
            <span className="bar-fill" style={barStyle(matchWidth, '#027a48')} />
          </div>
        </div>
        <div className="ranked-row event-row positive">
          <span>{insight.motifMatch}</span>
          <span>matched sample</span>
          <strong>{insight.windowSize} pts</strong>
          <div className="bar-track">
            <span className="bar-fill" style={barStyle(matchWidth, '#12b76a')} />
          </div>
        </div>
      </div>
      <div className="workbench-note">
        Use motifs to compare repeatable cycles and known-good signatures.
      </div>
    </article>
  )
}

interface DiscordFinderPanelProps {
  insight: MatrixProfileInsight
}

function DiscordFinderPanel({ insight }: DiscordFinderPanelProps): React.JSX.Element {
  const ratio = insight.discordDistance / Math.max(0.001, insight.motifDistance)
  const risk = clamp(ratio * 18, 0, 100)
  const status = statusFromRisk(risk)

  return (
    <article className="workbench-panel">
      <PanelHeader index="48" meta="least repeated shape" title="Discord finder" />
      <div className={`health-score status-${status}`}>
        <strong>{insight.discordStart}</strong>
        <span>discord start sample</span>
      </div>
      <dl className="workbench-metrics compact">
        <div>
          <dt>Distance</dt>
          <dd>{insight.discordDistance.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Ratio</dt>
          <dd>{ratio.toFixed(1)}x</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>{insight.windowSize}</dd>
        </div>
      </dl>
    </article>
  )
}

interface DtwCyclePanelProps {
  items: readonly DtwCycleItem[]
}

function DtwCyclePanel({ items }: DtwCyclePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="49" meta="dynamic time warping" title="DTW cycle similarity" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row event-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>cycle band</span>
            <strong>{item.distance.toFixed(3)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#155eef')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface LagCausalityPanelProps {
  items: readonly LagCausalityItem[]
}

function LagCausalityPanel({ items }: LagCausalityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="50" meta="lagged influence proxy" title="Lag-causality proxy" />
      <div className="ranked-list">
        {items.slice(0, 4).map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.source.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.source.color }} />
            <span>{item.source.shortLabel}</span>
            <strong>
              +{item.lag} / {item.score.toFixed(2)}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.source.color)} />
            </div>
          </div>
        ))}
      </div>
      <div className="workbench-note">
        Screening proxy only; confirm with process physics or experiments.
      </div>
    </article>
  )
}

interface BayesianAlarmPanelProps {
  insight: BayesianAlarmInsight
}

function BayesianAlarmPanel({ insight }: BayesianAlarmPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="51" meta="evidence-weighted risk" title="Bayesian alarm probability" />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.probability.toFixed(0)}%</strong>
        <span>posterior alarm probability</span>
      </div>
      <div className="ranked-list">
        {insight.evidence.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{item.risk.toFixed(0)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface HazardCurvePanelProps {
  points: readonly HazardPoint[]
}

function HazardCurvePanel({ points }: HazardCurvePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="52" meta="failure probability horizon" title="Hazard curve" />
      <div className="ranked-list">
        {points.map((point) => (
          <div className={`ranked-row event-row status-${point.status}`} key={point.label}>
            <span>{point.label.replace(' cycles', 'c')}</span>
            <span>risk horizon</span>
            <strong>{point.probability.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(point.width, '#d92d20')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface FusionConsistencyPanelProps {
  insight: FusionConsistencyInsight
}

function FusionConsistencyPanel({ insight }: FusionConsistencyPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="53" meta={insight.pairLabel} title="Sensor fusion consistency" />
      <Sparkline
        color="#7e2f8e"
        label={`${insight.pairLabel} normalized residual`}
        symmetric
        values={insight.residuals}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{formatSignedNumber(insight.current, 1)}%</dd>
        </div>
        <div>
          <dt>RMS</dt>
          <dd>{insight.rms.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{insight.status}</dd>
        </div>
      </dl>
    </article>
  )
}

interface CalibrationOffsetPanelProps {
  items: readonly CalibrationOffsetItem[]
}

function CalibrationOffsetPanel({ items }: CalibrationOffsetPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="54" meta="mean vs target offset" title="Calibration offset" />
      <div className="ranked-list">
        {items.slice(0, 5).map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatSignedValue(item.offset, item.series)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface SpectrogramPanelProps {
  insight: SpectrogramInsight
  series: SeriesConfig
}

function SpectrogramPanel({ insight, series }: SpectrogramPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="55" meta={`peak ${insight.peakLabel}`} title="STFT spectrogram" />
      <MiniHeatmapChart
        cells={insight.cells}
        columns={insight.columns}
        label={`${series.label} short-time Fourier spectrogram`}
        rows={insight.rows}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Peak</dt>
          <dd>{insight.peakMagnitude.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Windows</dt>
          <dd>{insight.columns.length}</dd>
        </div>
        <div>
          <dt>Bands</dt>
          <dd>{insight.rows.length}</dd>
        </div>
      </dl>
    </article>
  )
}

interface RollingCorrelationMapPanelProps {
  insight: RollingCorrelationInsight
  series: SeriesConfig
}

function RollingCorrelationMapPanel({
  insight,
  series,
}: RollingCorrelationMapPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="56"
        meta={`${series.shortLabel} by 24-cycle windows`}
        title="Rolling correlation map"
      />
      <RollingCorrelationHeatmap insight={insight} />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Strongest</dt>
          <dd>{insight.strongestLabel}</dd>
        </div>
        <div>
          <dt>Signals</dt>
          <dd>{insight.rows.length}</dd>
        </div>
      </dl>
    </article>
  )
}

interface ResidualQqPanelProps {
  insight: ResidualQqInsight
}

function ResidualQqPanel({ insight }: ResidualQqPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="57" meta="residual Gaussian fit" title="Q-Q residual normality" />
      <ScatterMiniChart color="#155eef" label="Residual Q-Q plot" points={insight.points} />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.deviation.toFixed(2)}</strong>
        <span>tail deviation</span>
      </div>
    </article>
  )
}

interface WhitenessPanelProps {
  insight: WhitenessInsight
}

function WhitenessPanel({ insight }: WhitenessPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="58" meta="Ljung-Box residual check" title="Residual whiteness" />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.qStatistic.toFixed(1)}</strong>
        <span>Q statistic / limit {insight.threshold.toFixed(1)}</span>
      </div>
      <div className="spectrum-bars">
        {insight.lags.slice(0, 6).map((point) => (
          <div
            className={point.correlation >= 0 ? 'spectrum-bin positive' : 'spectrum-bin negative'}
            key={point.lag}
          >
            <span>lag {point.lag}</span>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(point.width, point.correlation >= 0 ? '#027a48' : '#be123c')}
              />
            </div>
            <strong>{formatSignedNumber(point.correlation, 2)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface PredictionCoveragePanelProps {
  insight: PredictionCoverageInsight
  series: SeriesConfig
}

function PredictionCoveragePanel({
  insight,
  series,
}: PredictionCoveragePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="59" meta="95% interval hit rate" title="Prediction interval coverage" />
      <Sparkline
        color={series.color}
        label={`${series.label} prediction errors`}
        symmetric
        values={insight.errors}
      />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.coverage.toFixed(0)}%</strong>
        <span>{insight.misses} misses outside band</span>
      </div>
      <div className="workbench-note">
        Mean band width {formatValue(insight.meanWidth, series)}.
      </div>
    </article>
  )
}

interface ReliabilityPanelProps {
  bands: readonly ReliabilityBand[]
}

function ReliabilityPanel({ bands }: ReliabilityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="60" meta="expected vs observed hit rate" title="Interval reliability" />
      <div className="ranked-list">
        {bands.map((band) => (
          <div className={`ranked-row event-row status-${band.status}`} key={band.label}>
            <span>{band.label}</span>
            <span>expected</span>
            <strong>{band.observed.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(band.width, '#155eef')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface TransferGainPanelProps {
  items: readonly TransferGainItem[]
  series: SeriesConfig
}

function TransferGainPanel({ items, series }: TransferGainPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="61" meta={`target ${series.shortLabel}`} title="Transfer gain" />
      <div className="ranked-list">
        {items.slice(0, 5).map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.source.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.source.color }} />
            <span>{item.source.shortLabel}</span>
            <strong>
              {formatSignedNumber(item.gain, 2)} / +{item.lag}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.source.color)} />
            </div>
          </div>
        ))}
      </div>
      <div className="workbench-note">Linear gain at best lag; validate against plant physics.</div>
    </article>
  )
}

interface StateTransitionPanelProps {
  items: readonly StateTransitionItem[]
}

function StateTransitionPanel({ items }: StateTransitionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="62"
        meta="cycle-state transition probabilities"
        title="State transition matrix"
      />
      <div className="ranked-list">
        {items.map((item) => (
          <div
            className={`ranked-row transition-row status-${item.status}`}
            key={`${item.from}-${item.to}`}
          >
            <span>{item.from}</span>
            <span>{item.to}</span>
            <strong>
              {item.probability.toFixed(0)}% / {item.count}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#475467')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface EarlyWarningLeadPanelProps {
  items: readonly EarlyWarningLeadItem[]
}

function EarlyWarningLeadPanel({ items }: EarlyWarningLeadPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="63" meta="warning before alarm" title="Early warning lead time" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatCycles(item.leadCycles)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface WaveletScalogramPanelProps {
  insight: SpectrogramInsight
  series: SeriesConfig
}

function WaveletScalogramPanel({ insight, series }: WaveletScalogramPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="64" meta={`peak ${insight.peakLabel}`} title="Wavelet scalogram" />
      <MiniHeatmapChart
        cells={insight.cells}
        columns={insight.columns}
        label={`${series.label} multiscale wavelet energy`}
        rows={insight.rows}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Energy</dt>
          <dd>{formatValue(insight.peakMagnitude, series)}</dd>
        </div>
        <div>
          <dt>Scales</dt>
          <dd>{insight.rows.length}</dd>
        </div>
      </dl>
    </article>
  )
}

interface EnvelopeSpectrumPanelProps {
  bins: readonly SpectrumBin[]
}

function EnvelopeSpectrumPanel({ bins }: EnvelopeSpectrumPanelProps): React.JSX.Element {
  const peak = bins.reduce(
    (current, candidate) => (candidate.magnitude > current.magnitude ? candidate : current),
    bins[0] ?? { bin: 0, label: '-', magnitude: 0, width: 0 },
  )

  return (
    <article className="workbench-panel">
      <PanelHeader index="65" meta={`peak ${peak.label}`} title="Envelope spectrum" />
      <div className="spectrum-bars">
        {bins.map((bin) => (
          <div
            className={bin.bin === peak.bin ? 'spectrum-bin is-peak' : 'spectrum-bin'}
            key={bin.bin}
          >
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, '#7e2f8e')} />
            </div>
            <strong>{bin.magnitude.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface OrderTrackingPanelProps {
  bins: readonly SpectrumBin[]
  series: SeriesConfig
}

function OrderTrackingPanel({ bins, series }: OrderTrackingPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="66" meta={series.label} title="Order tracking" />
      <div className="spectrum-bars">
        {bins.map((bin) => (
          <div className="spectrum-bin" key={bin.bin}>
            <span>{bin.label}</span>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, series.color)} />
            </div>
            <strong>{bin.magnitude.toFixed(1)}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}

interface RainflowDamagePanelProps {
  bins: readonly FatigueDamageBin[]
}

function RainflowDamagePanel({ bins }: RainflowDamagePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="67" meta="range-count damage proxy" title="Rainflow damage" />
      <div className="ranked-list">
        {bins.map((bin) => (
          <div className={`ranked-row wide-row status-${bin.status}`} key={bin.label}>
            <span>{bin.label}</span>
            <span>{bin.count} cycles</span>
            <strong>{bin.damage.toFixed(3)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(bin.width, statusColor(bin.status))} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface DamageAccumulationPanelProps {
  insight: DamageAccumulationInsight
  series: SeriesConfig
}

function DamageAccumulationPanel({
  insight,
  series,
}: DamageAccumulationPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="68" meta={series.label} title="Cumulative damage index" />
      <Sparkline
        color="#d92d20"
        label={`${series.label} cumulative damage`}
        values={insight.values}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Current</dt>
          <dd>{insight.current.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Projected</dt>
          <dd>{insight.projected.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{insight.status}</dd>
        </div>
      </dl>
    </article>
  )
}

interface RegimeProbabilityPanelProps {
  items: readonly RegimeProbabilityItem[]
}

function RegimeProbabilityPanel({ items }: RegimeProbabilityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="69" meta="soft operating-state classifier" title="Regime probability" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>regime</span>
            <strong>{item.probability.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface AnomalyScorePanelProps {
  insight: AnomalyScoreInsight
}

function AnomalyScorePanel({ insight }: AnomalyScorePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="70" meta="multivariate score timeline" title="Anomaly score" />
      <Sparkline color="#155eef" label="Multivariate anomaly score" values={insight.scores} />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.current.toFixed(0)}</strong>
        <span>P95 {insight.p95.toFixed(0)}</span>
      </div>
    </article>
  )
}

interface SensorVotePanelProps {
  insight: SensorVoteInsight
}

function SensorVotePanel({ insight }: SensorVotePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="71"
        meta="status agreement across sensors"
        title="Sensor vote consensus"
      />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.agreement.toFixed(0)}%</strong>
        <span>dominant vote agreement</span>
      </div>
      <div className="ranked-list">
        {insight.votes.map((vote) => (
          <div className={`ranked-row wide-row status-${vote.label}`} key={vote.label}>
            <span>{vote.label}</span>
            <span>votes</span>
            <strong>{vote.count}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(vote.width, statusColor(vote.label))} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface MaintenanceWindowPanelProps {
  items: readonly MaintenanceWindowItem[]
}

function MaintenanceWindowPanel({ items }: MaintenanceWindowPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="72"
        meta="lowest-risk service periods"
        title="Maintenance window planner"
      />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>cycle band</span>
            <strong>{item.score.toFixed(0)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#027a48')} />
            </div>
          </div>
        ))}
      </div>
      <div className="workbench-note">Higher score means fewer active warnings in that window.</div>
    </article>
  )
}

interface MatrixPanelProps {
  insight: MatrixHeatmapInsight
}

function CovarianceMatrixPanel({ insight }: MatrixPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="73" meta={`strongest ${insight.peakLabel}`} title="Covariance matrix" />
      <MatrixHeatmapChart
        colorMode="correlation"
        columns={insight.columns}
        label="Normalized sensor covariance matrix"
        rows={insight.rows}
        cells={insight.cells}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Peak r</dt>
          <dd>{formatSignedNumber(insight.peakValue, 2)}</dd>
        </div>
        <div>
          <dt>Signals</dt>
          <dd>{insight.rows.length}</dd>
        </div>
      </dl>
    </article>
  )
}

function ResidualCovariancePanel({ insight }: MatrixPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="74"
        meta={`residual link ${insight.peakLabel}`}
        title="Residual covariance"
      />
      <MatrixHeatmapChart
        colorMode="correlation"
        columns={insight.columns}
        label="Residual covariance matrix"
        rows={insight.rows}
        cells={insight.cells}
      />
      <dl className="workbench-metrics compact">
        <div>
          <dt>Peak r</dt>
          <dd>{formatSignedNumber(insight.peakValue, 2)}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>rolling</dd>
        </div>
      </dl>
    </article>
  )
}

interface FaultSignaturePanelProps {
  items: readonly FaultSignatureItem[]
}

function FaultSignaturePanel({ items }: FaultSignaturePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="75" meta="template distance match" title="Fault signature match" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>match</span>
            <strong>{item.probability.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface RootCauseWaterfallPanelProps {
  items: readonly RootCauseItem[]
}

function RootCauseWaterfallPanel({ items }: RootCauseWaterfallPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="76" meta="ranked risk contributors" title="Root-cause waterfall" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              {item.direction} {item.contribution.toFixed(0)}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface InterventionWhatIfPanelProps {
  items: readonly InterventionItem[]
}

function InterventionWhatIfPanel({ items }: InterventionWhatIfPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="77" meta="risk reduction estimate" title="Intervention what-if" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.driver}</span>
            <span>{item.label}</span>
            <strong>-{item.reduction.toFixed(0)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#027a48')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ThresholdSweepPanelProps {
  items: readonly ThresholdSweepItem[]
}

function ThresholdSweepPanel({ items }: ThresholdSweepPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="78" meta="score threshold diagnostics" title="ROC threshold sweep" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>TPR {item.truePositiveRate.toFixed(0)}%</span>
            <strong>FPR {item.falsePositiveRate.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, '#155eef')} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ConfusionMatrixPanelProps {
  insight: ConfusionMatrixInsight
}

function ConfusionMatrixPanel({ insight }: ConfusionMatrixPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="79" meta="fault classifier at score > 50" title="Confusion matrix" />
      <MatrixHeatmapChart
        colorMode="intensity"
        columns={insight.columns}
        label="Fault classifier confusion matrix"
        rows={insight.rows}
        cells={insight.cells}
      />
      <div className={`health-score status-${statusFromRisk(100 - insight.accuracy)}`}>
        <strong>{insight.accuracy.toFixed(0)}%</strong>
        <span>classification accuracy</span>
      </div>
    </article>
  )
}

interface DwellTimePanelProps {
  items: readonly DwellTimeItem[]
}

function DwellTimePanel({ items }: DwellTimePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="80" meta="state duration percentiles" title="Dwell-time distribution" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>P50 {item.p50.toFixed(0)}</span>
            <strong>P95 {item.p95.toFixed(0)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface CounterfactualSensitivityPanelProps {
  items: readonly CounterfactualSensitivityItem[]
}

function CounterfactualSensitivityPanel({
  items,
}: CounterfactualSensitivityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader
        index="81"
        meta="risk change if reset to target"
        title="Counterfactual sensitivity"
      />
      <div className="ranked-list">
        {items.map((item) => (
          <div
            className={item.deltaRisk <= 0 ? 'ranked-row positive' : 'ranked-row negative'}
            key={item.series.id}
          >
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>{formatSignedNumber(item.deltaRisk, 1)}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(item.width, item.deltaRisk <= 0 ? '#027a48' : '#be123c')}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ImputationBurdenPanelProps {
  items: readonly ImputationItem[]
}

function ImputationBurdenPanel({ items }: ImputationBurdenPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="82" meta="gaps + held-sample burden" title="Imputation burden" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              {item.imputedCount} / {item.gapCount} gaps
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface SensorSaturationPanelProps {
  items: readonly SensorSaturationItem[]
}

function SensorSaturationPanel({ items }: SensorSaturationPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="83" meta="near rail / range limits" title="Sensor saturation" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              L{item.lowCount} / H{item.highCount}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface LatencyJitterPanelProps {
  insight: LatencyInsight
}

function LatencyJitterPanel({ insight }: LatencyJitterPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="84" meta="ingest-to-render latency" title="Latency jitter" />
      <Sparkline color="#155eef" label="Latency jitter timeline" values={insight.values} />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.p95.toFixed(0)} ms</strong>
        <span>current {insight.current.toFixed(0)} ms</span>
      </div>
    </article>
  )
}

interface AlarmSuppressionPanelProps {
  items: readonly AlarmSuppressionItem[]
}

function AlarmSuppressionPanel({ items }: AlarmSuppressionPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="85" meta="debounce + cooldown simulation" title="Alarm suppression" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row status-${item.status}`} key={item.series.id}>
            <span className="mini-swatch" style={{ backgroundColor: item.series.color }} />
            <span>{item.series.shortLabel}</span>
            <strong>
              {item.suppressedCount}/{item.rawCount}
            </strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface AlarmFloodPanelProps {
  windows: readonly AlarmFloodWindow[]
}

function AlarmFloodPanel({ windows }: AlarmFloodPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="86" meta="12-cycle alert density" title="Alarm flood detector" />
      <div className="ranked-list">
        {windows.map((window) => (
          <div className={`ranked-row wide-row status-${window.status}`} key={window.label}>
            <span>{window.label}</span>
            <span>cycle band</span>
            <strong>{window.count}</strong>
            <div className="bar-track">
              <span
                className="bar-fill"
                style={barStyle(window.width, statusColor(window.status))}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface FeatureStabilityPanelProps {
  items: readonly FeatureStabilityItem[]
  series: SeriesConfig
}

function FeatureStabilityPanel({ items, series }: FeatureStabilityPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="87" meta={series.label} title="Feature stability" />
      <div className="ranked-list">
        {items.map((item) => (
          <div
            className={item.drift >= 0 ? `ranked-row status-${item.status}` : 'ranked-row negative'}
            key={item.label}
          >
            <span className="mini-swatch" style={{ backgroundColor: series.color }} />
            <span>{item.label}</span>
            <strong>{formatSignedNumber(item.drift, 2)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, series.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface ResidualByRegimePanelProps {
  items: readonly ResidualRegimeItem[]
  series: SeriesConfig
}

function ResidualByRegimePanel({ items, series }: ResidualByRegimePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="88" meta={series.label} title="Residual by regime" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>phase</span>
            <strong>{formatValue(item.rms, series)}</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, item.color)} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface SlaCompliancePanelProps {
  items: readonly SlaComplianceItem[]
}

function SlaCompliancePanel({ items }: SlaCompliancePanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="89" meta="operational analytics SLA" title="SLA compliance" />
      <div className="ranked-list">
        {items.map((item) => (
          <div className={`ranked-row wide-row status-${item.status}`} key={item.label}>
            <span>{item.label}</span>
            <span>target</span>
            <strong>{item.compliance.toFixed(0)}%</strong>
            <div className="bar-track">
              <span className="bar-fill" style={barStyle(item.width, statusColor(item.status))} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

interface DataFreshnessPanelProps {
  insight: DataFreshnessInsight
}

function DataFreshnessPanel({ insight }: DataFreshnessPanelProps): React.JSX.Element {
  return (
    <article className="workbench-panel">
      <PanelHeader index="90" meta="latest sample age proxy" title="Data freshness" />
      <Sparkline color="#0891b2" label="Data freshness timeline" values={insight.values} />
      <div className={`health-score status-${insight.status}`}>
        <strong>{insight.currentAge.toFixed(2)} s</strong>
        <span>P95 {insight.p95Age.toFixed(2)} s</span>
      </div>
    </article>
  )
}

interface MatrixHeatmapChartProps {
  cells: readonly HeatmapCell[]
  colorMode: 'correlation' | 'intensity'
  columns: readonly string[]
  label: string
  rows: readonly string[]
}

function MatrixHeatmapChart({
  cells,
  colorMode,
  columns,
  label,
  rows,
}: MatrixHeatmapChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const left = 58
  const top = 12
  const right = width - 4
  const bottom = height - 16
  const cellWidth = (right - left) / Math.max(1, columns.length)
  const cellHeight = (bottom - top) / Math.max(1, rows.length)

  return (
    <svg aria-label={label} className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {columns.map((column, index) => (
        <text
          fill="#667085"
          fontSize="5.5"
          fontWeight="700"
          key={column}
          textAnchor="middle"
          x={left + index * cellWidth + cellWidth / 2}
          y="8"
        >
          {column}
        </text>
      ))}
      {rows.map((row, index) => (
        <text
          fill="#667085"
          fontSize="5.8"
          fontWeight="700"
          key={row}
          x="5"
          y={top + index * cellHeight + cellHeight * 0.67}
        >
          {row}
        </text>
      ))}
      {cells.map((cell) => (
        <rect
          height={Math.max(1, cellHeight - 1)}
          key={`${cell.row}-${cell.column}`}
          opacity="0.95"
          style={{
            fill:
              colorMode === 'correlation' ? correlationColor(cell.value) : heatColor(cell.width),
          }}
          width={Math.max(1, cellWidth - 1)}
          x={left + cell.column * cellWidth}
          y={top + cell.row * cellHeight}
        />
      ))}
    </svg>
  )
}

interface MiniHeatmapChartProps {
  cells: readonly HeatmapCell[]
  columns: readonly string[]
  label: string
  rows: readonly string[]
}

function MiniHeatmapChart({
  cells,
  columns,
  label,
  rows,
}: MiniHeatmapChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const left = 44
  const top = 8
  const right = width - 4
  const bottom = height - 16
  const cellWidth = (right - left) / Math.max(1, columns.length)
  const cellHeight = (bottom - top) / Math.max(1, rows.length)

  return (
    <svg aria-label={label} className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {rows.map((row, index) => (
        <text
          fill="#667085"
          fontSize="5.8"
          fontWeight="700"
          key={row}
          x="5"
          y={top + index * cellHeight + cellHeight * 0.67}
        >
          {row}
        </text>
      ))}
      {columns.map((column, index) => (
        <text
          fill="#667085"
          fontSize="5.5"
          fontWeight="700"
          key={column}
          textAnchor="middle"
          x={left + index * cellWidth + cellWidth / 2}
          y={height - 5}
        >
          {index === 0 || index === columns.length - 1 ? column.split('-')[0] : ''}
        </text>
      ))}
      {cells.map((cell) => (
        <rect
          height={Math.max(1, cellHeight - 1)}
          key={`${cell.row}-${cell.column}`}
          opacity="0.95"
          style={{ fill: heatColor(cell.width) }}
          width={Math.max(1, cellWidth - 1)}
          x={left + cell.column * cellWidth}
          y={top + cell.row * cellHeight}
        />
      ))}
    </svg>
  )
}

interface RollingCorrelationHeatmapProps {
  insight: RollingCorrelationInsight
}

function RollingCorrelationHeatmap({ insight }: RollingCorrelationHeatmapProps): React.JSX.Element {
  const cells = insight.rows.flatMap((row, rowIndex) =>
    row.values.map((value, column) => ({
      row: rowIndex,
      column,
      value,
      width: Math.abs(value) * 100,
    })),
  )
  const width = 250
  const height = 72
  const left = 44
  const top = 8
  const right = width - 4
  const bottom = height - 16
  const cellWidth = (right - left) / Math.max(1, insight.columns.length)
  const cellHeight = (bottom - top) / Math.max(1, insight.rows.length)

  return (
    <svg
      aria-label="Rolling correlation heatmap"
      className="mini-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {insight.rows.map((row, index) => (
        <text
          fill={row.series.color}
          fontSize="6"
          fontWeight="760"
          key={row.series.id}
          x="5"
          y={top + index * cellHeight + cellHeight * 0.67}
        >
          {row.series.shortLabel}
        </text>
      ))}
      {insight.columns.map((column, index) => (
        <text
          fill="#667085"
          fontSize="5.5"
          fontWeight="700"
          key={column}
          textAnchor="middle"
          x={left + index * cellWidth + cellWidth / 2}
          y={height - 5}
        >
          {index === 0 || index === insight.columns.length - 1 ? column.split('-')[0] : ''}
        </text>
      ))}
      {cells.map((cell) => (
        <rect
          height={Math.max(1, cellHeight - 1)}
          key={`${cell.row}-${cell.column}`}
          opacity="0.95"
          style={{ fill: correlationColor(cell.value) }}
          width={Math.max(1, cellWidth - 1)}
          x={left + cell.column * cellWidth}
          y={top + cell.row * cellHeight}
        />
      ))}
    </svg>
  )
}

interface ScatterMiniChartProps {
  color: string
  label: string
  points: readonly HysteresisPoint[]
}

function ScatterMiniChart({ color, label, points }: ScatterMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const area: PlotArea = { left: 12, right: width - 8, top: 8, bottom: height - 10 }
  const allValues = points.flatMap((point) => [point.x, point.y])
  const domain = paddedDomain(allValues, [-3, 3])
  const xAt = (value: number) =>
    area.left + ((value - domain[0]) / Math.max(0.001, domain[1] - domain[0])) * plotWidth(area)
  const yAt = (value: number) => yForArea(value, domain, area)

  return (
    <svg aria-label={label} className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} rx="4" />
      <line
        className="mini-zero"
        x1={xAt(domain[0])}
        x2={xAt(domain[1])}
        y1={yAt(domain[0])}
        y2={yAt(domain[1])}
      />
      {points.map((point) => (
        <circle
          cx={xAt(point.x)}
          cy={yAt(point.y)}
          fill={color}
          key={`${point.x.toFixed(3)}-${point.y.toFixed(3)}`}
          opacity="0.72"
          r="2"
        />
      ))}
    </svg>
  )
}

function heatColor(width: number): string {
  const ratio = clamp(width, 0, 100) / 100
  if (ratio > 0.75) return '#be123c'
  if (ratio > 0.5) return '#ea580c'
  if (ratio > 0.25) return '#f59e0b'
  return '#dbeafe'
}

function correlationColor(value: number): string {
  const strength = Math.abs(value)
  if (strength < 0.2) return '#e4e7ec'
  if (value >= 0) return strength > 0.65 ? '#027a48' : '#86efac'
  return strength > 0.65 ? '#be123c' : '#fecdd3'
}

function statusColor(status: SignalStatus): string {
  if (status === 'alarm') return '#d92d20'
  if (status === 'anomaly') return '#be123c'
  if (status === 'warning') return '#f59e0b'
  return '#027a48'
}

function paddedDomain(
  values: readonly number[],
  fallback: readonly [number, number],
): readonly [number, number] {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return fallback

  const min = Math.min(...finiteValues)
  const max = Math.max(...finiteValues)
  if (min === max) return [min - 1, max + 1]

  const padding = (max - min) * 0.12
  return [min - padding, max + padding]
}

function sparkPath(
  values: readonly number[],
  domain: readonly [number, number],
  width: number,
  height: number,
  inset = 8,
): string {
  if (values.length === 0) return ''

  return values
    .map((value, index) => {
      const x = inset + (index / Math.max(1, values.length - 1)) * Math.max(1, width - inset * 2)
      const y = yForArea(value, domain, {
        left: inset,
        right: width - inset,
        top: inset,
        bottom: height - inset,
      })
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

interface SparklineProps {
  color: string
  label?: string
  symmetric?: boolean
  values: readonly number[]
}

function Sparkline({
  color,
  label = 'Signal sparkline',
  symmetric = false,
  values,
}: SparklineProps): React.JSX.Element {
  const width = 250
  const height = 66
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)))
  const domain: readonly [number, number] = symmetric
    ? [-maxAbs, maxAbs]
    : paddedDomain(values, [0, 1])
  const zeroY = yForArea(0, domain, {
    left: 8,
    right: width - 8,
    top: 8,
    bottom: height - 8,
  })

  return (
    <svg aria-label={label} className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {symmetric ? (
        <line className="mini-zero" x1="8" x2={width - 8} y1={zeroY} y2={zeroY} />
      ) : null}
      <path d={sparkPath(values, domain, width, height)} stroke={color} />
    </svg>
  )
}

interface ForecastMiniChartProps {
  forecast: ForecastInsight
  series: SeriesConfig
}

function ForecastMiniChart({ forecast, series }: ForecastMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const values = forecast.points.flatMap((point) => [point.low, point.expected, point.high])
  const thresholdValues = series.thresholds
    ? [series.thresholds.alarm[0], series.thresholds.alarm[1]]
    : []
  const domain = paddedDomain([...values, ...thresholdValues], series.domain)
  const area: PlotArea = { left: 8, right: width - 8, top: 8, bottom: height - 10 }
  const xAt = (index: number) =>
    area.left + (index / Math.max(1, forecast.points.length - 1)) * plotWidth(area)
  const yAt = (value: number) => yForArea(value, domain, area)
  const linePath = forecast.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point.expected).toFixed(2)}`,
    )
    .join(' ')
  const highPoints = forecast.points
    .map((point, index) => `${xAt(index).toFixed(2)} ${yAt(point.high).toFixed(2)}`)
    .join(' ')
  const lowPoints = [...forecast.points]
    .reverse()
    .map(
      (point, index) =>
        `${xAt(forecast.points.length - 1 - index).toFixed(2)} ${yAt(point.low).toFixed(2)}`,
    )
    .join(' ')

  return (
    <svg
      aria-label={`${series.label} forecast chart`}
      className="mini-chart forecast-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {series.thresholds ? (
        <>
          <line
            className="mini-limit"
            x1={area.left}
            x2={area.right}
            y1={yAt(series.thresholds.alarm[1])}
            y2={yAt(series.thresholds.alarm[1])}
          />
          <line
            className="mini-limit"
            x1={area.left}
            x2={area.right}
            y1={yAt(series.thresholds.alarm[0])}
            y2={yAt(series.thresholds.alarm[0])}
          />
        </>
      ) : null}
      <polygon className="forecast-band" points={`${highPoints} ${lowPoints}`} />
      <path d={linePath} stroke={series.color} />
    </svg>
  )
}

interface HysteresisMiniChartProps {
  insight: HysteresisInsight
}

function HysteresisMiniChart({ insight }: HysteresisMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 96
  const area: PlotArea = { left: 12, right: width - 12, top: 10, bottom: height - 14 }
  const path = insight.points
    .map((point, index) => {
      const x = area.left + (point.x / 100) * plotWidth(area)
      const y = area.bottom - (point.y / 100) * plotHeight(area)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      aria-label={`${insight.xSeries.label} and ${insight.ySeries.label} hysteresis loop`}
      className="mini-chart hysteresis-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      <line
        className="mini-zero"
        x1={area.left}
        x2={area.right}
        y1={area.bottom}
        y2={area.bottom}
      />
      <line className="mini-zero" x1={area.left} x2={area.left} y1={area.top} y2={area.bottom} />
      <path d={path} stroke={insight.xSeries.color} />
      {insight.points.slice(0, 1).map((point) => (
        <circle
          className="loop-start"
          cx={area.left + (point.x / 100) * plotWidth(area)}
          cy={area.bottom - (point.y / 100) * plotHeight(area)}
          key="loop-start"
          r="3"
        />
      ))}
    </svg>
  )
}

interface CusumMiniChartProps {
  insight: CusumInsight
  series: SeriesConfig
}

function CusumMiniChart({ insight, series }: CusumMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const values = [...insight.positive, ...insight.negative]
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)))
  const domain: readonly [number, number] = [-maxAbs, maxAbs]
  const positivePath = sparkPath(insight.positive, domain, width, height)
  const negativePath = sparkPath(insight.negative, domain, width, height)
  const zeroY = yForArea(0, domain, {
    left: 8,
    right: width - 8,
    top: 8,
    bottom: height - 8,
  })

  return (
    <svg
      aria-label={`${series.label} CUSUM chart`}
      className="mini-chart cusum-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      <line className="mini-zero" x1="8" x2={width - 8} y1={zeroY} y2={zeroY} />
      <path d={positivePath} stroke="#d95319" />
      <path d={negativePath} stroke="#0072bd" />
    </svg>
  )
}

interface RecurrenceMiniChartProps {
  insight: RecurrenceInsight
}

function RecurrenceMiniChart({ insight }: RecurrenceMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 96
  const area: PlotArea = { left: 10, right: width - 10, top: 8, bottom: height - 10 }

  return (
    <svg
      aria-label="Recurrence plot"
      className="mini-chart recurrence-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      {insight.points.map((point) => (
        <circle
          className="recurrence-dot"
          cx={area.left + (point.x / 100) * plotWidth(area)}
          cy={area.top + (point.y / 100) * plotHeight(area)}
          key={`${point.x.toFixed(2)}-${point.y.toFixed(2)}`}
          r="1.8"
        />
      ))}
    </svg>
  )
}

interface EnvelopeMiniChartProps {
  points: readonly EnvelopePoint[]
  series: SeriesConfig
}

function EnvelopeMiniChart({ points, series }: EnvelopeMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const values = points.flatMap((point) => [point.low, point.median, point.high])
  const domain = paddedDomain(values, series.domain)
  const area: PlotArea = { left: 8, right: width - 8, top: 8, bottom: height - 10 }
  const xAt = (index: number) =>
    area.left + (index / Math.max(1, points.length - 1)) * plotWidth(area)
  const yAt = (value: number) => yForArea(value, domain, area)
  const medianPath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point.median).toFixed(2)}`,
    )
    .join(' ')
  const highPoints = points
    .map((point, index) => `${xAt(index).toFixed(2)} ${yAt(point.high).toFixed(2)}`)
    .join(' ')
  const lowPoints = [...points]
    .reverse()
    .map(
      (point, index) => `${xAt(points.length - 1 - index).toFixed(2)} ${yAt(point.low).toFixed(2)}`,
    )
    .join(' ')

  return (
    <svg
      aria-label={`${series.label} operating envelope chart`}
      className="mini-chart envelope-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      <polygon className="envelope-band" points={`${highPoints} ${lowPoints}`} />
      <path d={medianPath} stroke={series.color} />
    </svg>
  )
}

interface SpcMiniChartProps {
  insight: SpcInsight
  series: SeriesConfig
}

function SpcMiniChart({ insight, series }: SpcMiniChartProps): React.JSX.Element {
  const width = 250
  const height = 72
  const domain = paddedDomain(
    [...insight.values, insight.lcl, insight.mean, insight.ucl],
    series.domain,
  )
  const area: PlotArea = { left: 8, right: width - 8, top: 8, bottom: height - 10 }
  const yAt = (value: number) => yForArea(value, domain, area)

  return (
    <svg
      aria-label={`${series.label} SPC control chart`}
      className="mini-chart spc-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="4" />
      <line
        className="mini-limit"
        x1={area.left}
        x2={area.right}
        y1={yAt(insight.ucl)}
        y2={yAt(insight.ucl)}
      />
      <line
        className="mini-mean"
        x1={area.left}
        x2={area.right}
        y1={yAt(insight.mean)}
        y2={yAt(insight.mean)}
      />
      <line
        className="mini-limit"
        x1={area.left}
        x2={area.right}
        y1={yAt(insight.lcl)}
        y2={yAt(insight.lcl)}
      />
      <path d={sparkPath(insight.values, domain, width, height)} stroke={series.color} />
    </svg>
  )
}

interface ThresholdOverlayProps {
  area: PlotArea
  normalized?: boolean
  overlays: Record<OverlayId, boolean>
  series: SeriesConfig
  showLabels?: boolean
}

function ThresholdOverlay({
  area,
  normalized = false,
  overlays,
  series,
  showLabels = true,
}: ThresholdOverlayProps): React.JSX.Element | null {
  const thresholds = series.thresholds
  if (!thresholds) return null
  const domain: readonly [number, number] = normalized ? [0, 100] : series.domain
  const project = (value: number) => (normalized ? normalizeValue(value, series.domain) : value)

  return (
    <g className="threshold-layer">
      {overlays.alarmBands ? (
        <>
          <ThresholdLine
            area={area}
            domain={domain}
            label="warn low"
            kind="warning"
            showLabel={showLabels}
            value={project(thresholds.warning[0])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="warn high"
            kind="warning"
            showLabel={showLabels}
            value={project(thresholds.warning[1])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="alarm low"
            kind="alarm"
            showLabel={showLabels}
            value={project(thresholds.alarm[0])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="alarm high"
            kind="alarm"
            showLabel={showLabels}
            value={project(thresholds.alarm[1])}
          />
          {thresholds.target !== undefined ? (
            <ThresholdLine
              area={area}
              domain={domain}
              label="target"
              kind="target"
              showLabel={showLabels}
              value={project(thresholds.target)}
            />
          ) : null}
        </>
      ) : null}
    </g>
  )
}

interface ThresholdLineProps {
  area: PlotArea
  domain: readonly [number, number]
  kind: 'warning' | 'alarm' | 'target'
  label: string
  showLabel: boolean
  value: number
}

function ThresholdLine({
  area,
  domain,
  kind,
  label,
  showLabel,
  value,
}: ThresholdLineProps): React.JSX.Element {
  const y = yForArea(value, domain, area)

  return (
    <g className={`threshold-line threshold-${kind}`}>
      <line x1={area.left} x2={area.right} y1={y} y2={y} />
      {showLabel ? (
        <text x={area.right + 10} y={y + 4}>
          {label}
        </text>
      ) : null}
    </g>
  )
}

interface AbnormalRegionLayerProps {
  area: PlotArea
  samples: readonly Sample[]
  series: SeriesConfig
}

function AbnormalRegionLayer({
  area,
  samples,
  series,
}: AbnormalRegionLayerProps): React.JSX.Element | null {
  const regions = buildAbnormalRegions(samples, series)
  if (regions.length === 0) return null

  const [firstCycle, lastCycle] = getCycleRange(samples)

  return (
    <g className="abnormal-region-layer" aria-label="Abnormal time regions">
      {regions.map((region) => {
        const startCycle = clamp(region.startCycle - 0.45, firstCycle, lastCycle)
        const endCycle = clamp(region.endCycle + 0.45, firstCycle, lastCycle)
        const x = xForArea(startCycle, samples, area)
        const endX = xForArea(endCycle, samples, area)

        return (
          <rect
            className={`abnormal-region abnormal-${region.status}`}
            key={`${series.id}-${region.startCycle}-${region.endCycle}-${region.status}`}
            x={x}
            y={area.top}
            width={Math.max(4, endX - x)}
            height={plotHeight(area)}
          />
        )
      })}
    </g>
  )
}

interface StatusMarkersProps {
  area: PlotArea
  domain?: readonly [number, number]
  normalized?: boolean
  samples: readonly Sample[]
  series: SeriesConfig
}

function StatusMarkers({
  area,
  domain,
  normalized = false,
  samples,
  series,
}: StatusMarkersProps): React.JSX.Element | null {
  if (!series.thresholds) return null
  const projectedDomain: readonly [number, number] =
    domain ?? (normalized ? [0, 100] : series.domain)

  return (
    <g className="status-point-layer">
      {samples.map((sample) => {
        const rawValue = valueFor(sample, series.id)
        const status = statusForValue(rawValue, series)
        if (status === 'normal' || status === 'warning') return null
        const projectedValue = normalized ? normalizeValue(rawValue, series.domain) : rawValue

        return (
          <circle
            className={`status-point status-${status}`}
            cx={xForArea(sample.cycle, samples, area)}
            cy={yForArea(projectedValue, projectedDomain, area)}
            key={`${series.id}-${sample.cycle}-${status}`}
            r={status === 'alarm' ? 5.4 : 4.4}
          />
        )
      })}
    </g>
  )
}

interface EventLayerProps {
  area?: PlotArea
  samples: readonly Sample[]
  y1: number
  y2: number
  showLabels?: boolean
}

function EventLayer({
  area = PLOT,
  samples,
  y1,
  y2,
  showLabels = true,
}: EventLayerProps): React.JSX.Element {
  const [firstCycle, lastCycle] = getCycleRange(samples)

  return (
    <g className="event-layer">
      {EVENTS.filter((event) => event.cycle >= firstCycle && event.cycle <= lastCycle).map(
        (event) => {
          const x = xForArea(event.cycle, samples, area)
          return (
            <g
              className={`event-marker event-${event.severity}`}
              key={`${event.cycle}-${event.label}`}
            >
              <line x1={x} x2={x} y1={y1} y2={y2} />
              {showLabels ? (
                <text x={x + 6} y={y1 - 6}>
                  {event.label}
                </text>
              ) : null}
            </g>
          )
        },
      )}
    </g>
  )
}

interface ScientificDataTipProps {
  area: PlotArea
  index: number
  normalized?: boolean
  samples: readonly Sample[]
  selected: Sample | undefined
  selectedX: number
  series: SeriesConfig
}

function ScientificDataTip({
  area,
  index,
  normalized = false,
  samples,
  selected,
  selectedX,
  series,
}: ScientificDataTipProps): React.JSX.Element | null {
  if (!selected) return null

  const rawValue = valueFor(selected, series.id)
  const projectedValue = normalized ? normalizeValue(rawValue, series.domain) : rawValue
  const domain: readonly [number, number] = normalized ? [0, 100] : series.domain
  const valueY = yForArea(projectedValue, domain, area)
  const boxWidth = 164
  const boxHeight = 66
  const boxX = clamp(selectedX + 14, area.left + 6, area.right - boxWidth - 6)
  const boxY = clamp(valueY - boxHeight - 12, area.top + 6, area.bottom - boxHeight - 6)
  const rollingAverage = rollingAverageAt(samples, series, index)
  const status = statusForValue(rawValue, series)

  return (
    <g className="data-tip">
      <line x1={selectedX} x2={boxX} y1={valueY} y2={boxY + boxHeight} />
      <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx="4" />
      <text x={boxX + 9} y={boxY + 15}>
        {series.label}
      </text>
      <text x={boxX + 9} y={boxY + 30}>
        cycle {selected.cycle} / {selected.time.toFixed(1)} s
      </text>
      <text x={boxX + 9} y={boxY + 45}>
        value {formatValue(rawValue, series)}
      </text>
      <text x={boxX + 9} y={boxY + 60}>
        avg {formatValue(rollingAverage, series)} / {status}
      </text>
    </g>
  )
}

function RowsChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const rowCount = Math.max(visibleSeries.length, 1)
  const bottomAxisY = ROW_TOP + rowCount * ROW_STEP + 26
  const activeRowIndex = visibleSeries.findIndex((series) => series.id === activeSeries.id)
  const activeRowArea = activeRowIndex >= 0 ? rowArea(activeRowIndex) : undefined
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0
  const xTicks = cycleTicks(samples)

  return (
    <svg
      aria-label="Stacked rows chart with one scale per metric"
      className="chart-svg chart-svg-rows"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${ROW_VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <CycleBand samples={samples} segments={segments} y={34} height={15} />

      {visibleSeries.length === 0 ? <EmptyState y={ROW_VIEWBOX_HEIGHT / 2} /> : null}

      {visibleSeries.map((series, index) => {
        const area = rowArea(index)
        const isActive = activeSeries.id === series.id
        const selectedValue = selected ? valueFor(selected, series.id) : 0
        const selectedY = yForArea(selectedValue, series.domain, area)

        return (
          <g className={isActive ? 'row-chart is-active' : 'row-chart'} key={series.id}>
            <rect
              className="row-bg"
              x={area.left}
              y={area.top}
              width={plotWidth(area)}
              height={plotHeight(area)}
            />

            {overlays.anomalyBands ? (
              <AbnormalRegionLayer area={area} samples={samples} series={series} />
            ) : null}

            {overlays.minorGrid ? <MinorGrid area={area} samples={samples} /> : null}

            {GRID_FRACTIONS.map((fraction) => {
              const y = area.top + plotHeight(area) * fraction
              return (
                <line
                  className="grid-line"
                  key={`${series.id}-row-grid-${fraction}`}
                  x1={area.left}
                  x2={area.right}
                  y1={y}
                  y2={y}
                />
              )
            })}

            {xTicks.map((tick) => {
              const x = xForArea(tick, samples, area)
              return (
                <line
                  className="grid-line vertical row-vertical"
                  key={`${series.id}-row-x-${tick}`}
                  x1={x}
                  x2={x}
                  y1={area.top}
                  y2={area.bottom}
                />
              )
            })}

            <ThresholdOverlay area={area} overlays={overlays} series={series} showLabels={false} />

            <text className="row-label" fill={series.color} x="48" y={area.top + 24}>
              {series.label}
            </text>
            <text className="row-unit" x="48" y={area.top + 50}>
              {series.unit}
            </text>
            <text className="row-tick" x={area.left - 14} y={area.top + 16} textAnchor="end">
              {formatTickValue(series.domain[1], series)}
            </text>
            <text className="row-tick" x={area.left - 14} y={area.bottom - 8} textAnchor="end">
              {formatTickValue(series.domain[0], series)}
            </text>

            <path
              className="series-line row-line"
              d={buildLinePathForArea(samples, series, area)}
              stroke={series.color}
              strokeDasharray={series.stepped ? '7 7' : undefined}
            />

            {overlays.rollingAverage && !series.stepped ? (
              <path
                className="rolling-average-line"
                d={buildRollingAveragePathForArea(samples, series, area)}
              />
            ) : null}

            {overlays.statusPoints ? (
              <StatusMarkers area={area} samples={samples} series={series} />
            ) : null}

            {selected ? (
              <>
                <circle
                  className="cursor-dot"
                  cx={selectedX}
                  cy={selectedY}
                  fill={series.color}
                  r={isActive ? 5.5 : 4}
                />
                <text
                  className="row-value"
                  fill={series.color}
                  x={area.right + 18}
                  y={area.top + 46}
                >
                  {formatValue(selectedValue, series)}
                </text>
              </>
            ) : null}

            <rect
              className="row-border"
              x={area.left}
              y={area.top}
              width={plotWidth(area)}
              height={plotHeight(area)}
            />
          </g>
        )
      })}

      {overlays.eventMarkers ? (
        <EventLayer
          samples={samples}
          y1={58}
          y2={Math.min(ROW_TOP + rowCount * ROW_STEP, ROW_VIEWBOX_HEIGHT - 86)}
        />
      ) : null}

      {selected ? (
        <line
          className="rows-cursor-line"
          x1={selectedX}
          x2={selectedX}
          y1="58"
          y2={Math.min(ROW_TOP + rowCount * ROW_STEP, ROW_VIEWBOX_HEIGHT - 86)}
        />
      ) : null}

      {overlays.dataTip && activeRowArea ? (
        <ScientificDataTip
          area={activeRowArea}
          index={selectedSampleIndex}
          samples={samples}
          selected={selected}
          selectedX={selectedX}
          series={activeSeries}
        />
      ) : null}

      {xTicks.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <text
            className="x-tick"
            key={`rows-x-label-${tick}`}
            x={x}
            y={bottomAxisY}
            textAnchor="middle"
          >
            {formatCycleTick(tick)}
          </text>
        )
      })}
      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={bottomAxisY + 32}>
        Cycle index / elapsed time (s)
      </text>
    </svg>
  )
}

function FocusAxisChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0

  return (
    <svg
      aria-label="Overlay chart with one active y-axis"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <PlotGrid overlays={overlays} samples={samples} />
      {overlays.anomalyBands ? (
        <AbnormalRegionLayer area={PLOT} samples={samples} series={activeSeries} />
      ) : null}
      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <SingleAxis series={activeSeries} />
      <ThresholdOverlay area={PLOT} overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {visibleSeries.length === 0 ? <EmptyState y={(PLOT.top + PLOT.bottom) / 2} /> : null}

      {visibleSeries.map((series) => {
        const isActive = activeSeries.id === series.id
        return (
          <path
            className={isActive ? 'series-line is-active' : 'series-line is-muted'}
            d={buildLinePath(samples, series)}
            key={series.id}
            stroke={series.color}
            strokeDasharray={series.stepped ? '7 7' : undefined}
          />
        )
      })}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT)}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      <CursorLayer
        selected={selected}
        selectedX={selectedX}
        visibleSeries={visibleSeries}
        activeSeries={activeSeries}
      />

      {overlays.dataTip ? (
        <ScientificDataTip
          area={PLOT}
          index={selectedSampleIndex}
          samples={samples}
          selected={selected}
          selectedX={selectedX}
          series={activeSeries}
        />
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

function SingleTagChart({
  samples,
  segments,
  selected,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0

  return (
    <svg
      aria-label={`${activeSeries.label} single-tag chart`}
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <PlotGrid overlays={overlays} samples={samples} />
      {overlays.anomalyBands ? (
        <AbnormalRegionLayer area={PLOT} samples={samples} series={activeSeries} />
      ) : null}
      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <SingleAxis series={activeSeries} />
      <ThresholdOverlay area={PLOT} overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      <path
        className="series-line is-active"
        d={buildLinePath(samples, activeSeries)}
        stroke={activeSeries.color}
        strokeDasharray={activeSeries.stepped ? '7 7' : undefined}
      />

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT)}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      <CursorLayer
        selected={selected}
        selectedX={selectedX}
        visibleSeries={[activeSeries]}
        activeSeries={activeSeries}
      />

      {overlays.dataTip ? (
        <ScientificDataTip
          area={PLOT}
          index={selectedSampleIndex}
          samples={samples}
          selected={selected}
          selectedX={selectedX}
          series={activeSeries}
        />
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

interface ResidualAxisProps {
  limit: number
  series: SeriesConfig
}

function ResidualAxis({ limit, series }: ResidualAxisProps): React.JSX.Element {
  const x = PLOT.left - 34
  const domain: readonly [number, number] = [-limit, limit]
  const ticks = [-limit, 0, limit]

  return (
    <g className="axis-group residual-axis" style={{ color: series.color }}>
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        {series.shortLabel} residual
      </text>
      {ticks.map((tick) => {
        const y = yForArea(tick, domain, PLOT)
        return (
          <g key={`residual-${series.id}-${tick}`}>
            <line className="axis-tick" x1={x} x2={x + 8} y1={y} y2={y} />
            <text className="axis-tick-label" x={x - 12} y={y + 4} textAnchor="end">
              {formatSignedValue(tick, series)}
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 18} textAnchor="middle">
        value - rolling average
      </text>
    </g>
  )
}

function ResidualChart({
  samples,
  segments,
  selected,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0
  const residual = buildResidualInsight(samples, activeSeries, selectedSampleIndex)
  const residualLimit = Math.max(
    1,
    residual.maxAbs,
    residual.rms * 3,
    (activeSeries.domain[1] - activeSeries.domain[0]) * 0.06,
  )
  const residualDomain: readonly [number, number] = [-residualLimit, residualLimit]
  const warningLimit = Math.min(residualLimit, residual.rms * 2)
  const alarmLimit = Math.min(residualLimit, residual.rms * 3)
  const xTicks = cycleTicks(samples)

  return (
    <svg
      aria-label={`${activeSeries.label} residual chart`}
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <rect
        className="plot-bg"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />

      {overlays.minorGrid ? <MinorGrid area={PLOT} samples={samples} /> : null}

      {GRID_FRACTIONS.map((fraction) => {
        const y = PLOT.top + plotHeight(PLOT) * fraction
        return (
          <line
            className="grid-line"
            key={`residual-grid-y-${fraction}`}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y}
            y2={y}
          />
        )
      })}

      {xTicks.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <g key={`residual-x-${tick}`}>
            <line className="grid-line vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
            <text className="x-tick" x={x} y={PLOT.bottom + 34} textAnchor="middle">
              {formatCycleTick(tick)}
            </text>
          </g>
        )
      })}

      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 66}>
        Cycle index / elapsed time (s)
      </text>

      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <ResidualAxis limit={residualLimit} series={activeSeries} />

      {[-alarmLimit, alarmLimit].map((limit) => (
        <g className="threshold-line threshold-alarm" key={`alarm-${limit}`}>
          <line
            x1={PLOT.left}
            x2={PLOT.right}
            y1={yForArea(limit, residualDomain, PLOT)}
            y2={yForArea(limit, residualDomain, PLOT)}
          />
        </g>
      ))}
      {[-warningLimit, warningLimit].map((limit) => (
        <g className="threshold-line threshold-warning" key={`warning-${limit}`}>
          <line
            x1={PLOT.left}
            x2={PLOT.right}
            y1={yForArea(limit, residualDomain, PLOT)}
            y2={yForArea(limit, residualDomain, PLOT)}
          />
        </g>
      ))}
      <line
        className="residual-zero-line"
        x1={PLOT.left}
        x2={PLOT.right}
        y1={yForArea(0, residualDomain, PLOT)}
        y2={yForArea(0, residualDomain, PLOT)}
      />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      <path
        className="series-line is-active"
        d={buildValuePathByIndex(samples, residual.values, PLOT, residualDomain)}
        stroke={activeSeries.color}
      />

      {overlays.statusPoints
        ? residual.values.map((value, index) => {
            const sample = samples[index]
            if (!sample) return null
            const severity =
              Math.abs(value) >= alarmLimit
                ? 'alarm'
                : Math.abs(value) >= warningLimit
                  ? 'warning'
                  : 'normal'
            if (severity === 'normal') return null
            return (
              <circle
                className={`status-point status-${severity}`}
                cx={xForArea(sample.cycle, samples, PLOT)}
                cy={yForArea(value, residualDomain, PLOT)}
                key={`residual-status-${sample.cycle}`}
                r="4.5"
              />
            )
          })
        : null}

      {selected ? (
        <g className="cursor-layer">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
          <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
          <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
            {selected.cycle}
          </text>
          <circle
            className="cursor-dot"
            cx={selectedX}
            cy={yForArea(residual.selectedResidual, residualDomain, PLOT)}
            fill={activeSeries.color}
            r="5.5"
          />
        </g>
      ) : null}

      {overlays.dataTip ? (
        <g className="data-tip">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top} y2={PLOT.bottom} />
          <rect
            x={Math.min(selectedX + 16, PLOT.right - 250)}
            y={PLOT.top + 18}
            width="234"
            height="74"
            rx="5"
          />
          <text x={Math.min(selectedX + 30, PLOT.right - 236)} y={PLOT.top + 40}>
            {activeSeries.label} residual
          </text>
          <text x={Math.min(selectedX + 30, PLOT.right - 236)} y={PLOT.top + 58}>
            cycle {selected?.cycle ?? 0} /{' '}
            {formatSignedValue(residual.selectedResidual, activeSeries)}
          </text>
          <text x={Math.min(selectedX + 30, PLOT.right - 236)} y={PLOT.top + 76}>
            rms {formatValue(residual.rms, activeSeries)}
          </text>
        </g>
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

function NormalizedChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0

  return (
    <svg
      aria-label="Normalized chart with every metric scaled from 0 to 100 percent"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <PlotGrid overlays={overlays} samples={samples} />
      {overlays.anomalyBands ? (
        <AbnormalRegionLayer area={PLOT} samples={samples} series={activeSeries} />
      ) : null}
      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <NormalizedAxis />
      <ThresholdOverlay area={PLOT} normalized overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {visibleSeries.length === 0 ? <EmptyState y={(PLOT.top + PLOT.bottom) / 2} /> : null}

      {visibleSeries.map((series) => {
        const isActive = activeSeries.id === series.id
        return (
          <path
            className={isActive ? 'series-line is-active' : 'series-line'}
            d={buildLinePathForArea(samples, series, PLOT, [0, 100], (sample) =>
              normalizeValue(valueFor(sample, series.id), series.domain),
            )}
            key={series.id}
            stroke={series.color}
            strokeDasharray={series.stepped ? '7 7' : undefined}
          />
        )
      })}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT, [0, 100], (sample) =>
            normalizeValue(valueFor(sample, activeSeries.id), activeSeries.domain),
          )}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} normalized samples={samples} series={activeSeries} />
      ) : null}

      {selected ? (
        <g className="cursor-layer">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
          <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
          <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
            {selected.cycle}
          </text>
          {visibleSeries.map((series) => {
            const normalized = normalizeValue(valueFor(selected, series.id), series.domain)
            return (
              <circle
                className="cursor-dot"
                cx={selectedX}
                cy={yFor(normalized, [0, 100])}
                fill={series.color}
                key={`normalized-dot-${series.id}`}
                r={activeSeries.id === series.id ? 5.5 : 4}
              />
            )
          })}
        </g>
      ) : null}

      {overlays.dataTip ? (
        <ScientificDataTip
          area={PLOT}
          index={selectedSampleIndex}
          normalized
          samples={samples}
          selected={selected}
          selectedX={selectedX}
          series={activeSeries}
        />
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

function MultiAxisChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: MultiAxisChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const selectedSampleIndex = selected ? nearestSampleIndex(samples, selected.cycle) : 0
  const xTicks = cycleTicks(samples)
  const [firstCycle, lastCycle] = getCycleRange(samples)

  return (
    <svg
      aria-label="Multi-axis chart with independent y-axis scales"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <rect
        className="plot-bg"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />

      {overlays.anomalyBands ? (
        <AbnormalRegionLayer area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      {overlays.minorGrid ? <MinorGrid area={PLOT} samples={samples} /> : null}

      {GRID_FRACTIONS.map((fraction) => {
        const y = PLOT.top + plotHeight(PLOT) * fraction
        return (
          <line
            className="grid-line"
            key={`grid-y-${fraction}`}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y}
            y2={y}
          />
        )
      })}

      {xTicks.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <g key={`x-${tick}`}>
            <line className="grid-line vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
            <text className="x-tick" x={x} y={PLOT.bottom + 34} textAnchor="middle">
              {formatCycleTick(tick)}
            </text>
          </g>
        )
      })}

      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 66}>
        Cycle index / elapsed time (s)
      </text>

      <g aria-label="Cycle phase band">
        {segments.map((segment) => {
          const x = xFor(segment.startCycle, samples)
          const endX = xFor(clamp(segment.endCycle + 1, firstCycle, lastCycle), samples)
          const color = STAGE_COLORS[segment.state] ?? '#6b7280'
          return (
            <rect
              fill={color}
              key={`${segment.startCycle}-${segment.endCycle}-${segment.state}`}
              opacity="0.2"
              x={x}
              y={PLOT.top - 30}
              width={Math.max(2, endX - x)}
              height="16"
            />
          )
        })}
      </g>

      <ThresholdOverlay area={PLOT} overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {SERIES.map((series) => (
        <Axis key={series.id} series={series} visible={visibleSeries.includes(series)} />
      ))}

      {visibleSeries.map((series) => (
        <path
          className="series-line"
          d={buildLinePath(samples, series)}
          key={series.id}
          stroke={series.color}
          strokeDasharray={series.stepped ? '7 7' : undefined}
        />
      ))}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT)}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      {selected ? (
        <g className="cursor-layer">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
          <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
          <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
            {selected.cycle}
          </text>
          {visibleSeries.map((series) => {
            const y = yFor(valueFor(selected, series.id), series.domain)
            return (
              <circle
                className="cursor-dot"
                cx={selectedX}
                cy={y}
                fill={series.color}
                key={`dot-${series.id}`}
                r="5"
              />
            )
          })}
        </g>
      ) : null}

      {overlays.dataTip ? (
        <ScientificDataTip
          area={PLOT}
          index={selectedSampleIndex}
          samples={samples}
          selected={selected}
          selectedX={selectedX}
          series={activeSeries}
        />
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

interface AxisProps {
  series: SeriesConfig
  visible: boolean
}

function Axis({ series, visible }: AxisProps): React.JSX.Element {
  const x = axisX(series)
  const textAnchor = series.side === 'left' ? 'end' : 'start'
  const tickStart = series.side === 'left' ? x : x - 8
  const tickEnd = series.side === 'left' ? x + 8 : x
  const labelX = series.side === 'left' ? x - 12 : x + 12

  return (
    <g className={visible ? 'axis-group' : 'axis-group muted'} style={{ color: series.color }}>
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        {series.shortLabel}
      </text>
      {series.ticks.map((tick) => {
        const y = yFor(tick, series.domain)
        return (
          <g key={`${series.id}-${tick}`}>
            <line className="axis-tick" x1={tickStart} x2={tickEnd} y1={y} y2={y} />
            <text className="axis-tick-label" x={labelX} y={y + 4} textAnchor={textAnchor}>
              {series.format ? series.format(tick) : tick.toFixed(series.decimals)}
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 18} textAnchor="middle">
        {series.unit}
      </text>
    </g>
  )
}

export { App }
