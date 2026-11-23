import type {
  CorrelationMatrixConfig,
  CorrelationMatrixData,
  DistributionColumnData,
  DistributionConfig,
  SpectrogramConfig,
  SpectrogramMatrixData,
  SpectrumColumnData,
  SpectrumConfig,
  TimeSeriesColumnData,
  TimeSeriesConfig,
} from '@pitant/charts-react'
import measurements from './measurements.json'

interface Fixture<Data, Config> {
  data: Data
  config: Config
  sourceLabel: string
  sourceUrl: string
  description: string
}

// The numeric snapshots in measurements.json retain source order and precision.
// NOAA GML publication, version 2026-08-11 (CC0-1.0), DOI 10.15138/yaf1-bk21.
// 480 contiguous Mauna Loa monthly dry-air mole fractions, Jan 1980–Dec 2019.
// The source is the observatory in-situ monthly text file, using the value
// column for rows with the unflagged quality code "...".
const noaa = {
  sourceLabel: 'NOAA Global Monitoring Laboratory',
  sourceUrl: 'https://gml.noaa.gov/data/dataset.php?item=mlo-co2-observatory-monthly',
}
const samplesPerYear = 12
const firstYear = 1980
const lastFrequency = 4

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

// Least-squares linear detrend, followed by a periodic Hann window. The
// displayed bins are positive and below Nyquist. Double those magnitudes and
// divide by the window sum to express the one-sided peak amplitude in ppm.
function amplitudeSpectrum(samples: readonly number[], firstBin: number, lastBin: number) {
  const sampleCount = samples.length
  const middle = (sampleCount - 1) / 2
  const center = mean(samples)
  let covariance = 0
  let variance = 0
  for (const [index, value] of samples.entries()) {
    const x = index - middle
    covariance += x * (value - center)
    variance += x * x
  }
  const slope = covariance / variance

  let windowSum = 0
  const windowed = samples.map((value, index) => {
    const weight = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / sampleCount)
    windowSum += weight
    return (value - center - slope * (index - middle)) * weight
  })
  return Float64Array.from({ length: lastBin - firstBin + 1 }, (_, offset) => {
    const radians = (2 * Math.PI * (offset + firstBin)) / sampleCount
    let real = 0
    let imaginary = 0
    for (const [index, value] of windowed.entries()) {
      real += value * Math.cos(radians * index)
      imaginary -= value * Math.sin(radians * index)
    }
    return (2 * Math.hypot(real, imaginary)) / windowSum
  })
}

const monthlyCo2 = measurements.maunaLoaMonthlyPpm
const spectrumSpacing = samplesPerYear / monthlyCo2.length
const spectrumAmplitudes = amplitudeSpectrum(
  monthlyCo2,
  1,
  (lastFrequency * monthlyCo2.length) / samplesPerYear,
)
const spectrumFrequencies = Float64Array.from(
  spectrumAmplitudes,
  (_, index) => (index + 1) * spectrumSpacing,
)
const annualAmplitude = spectrumAmplitudes[monthlyCo2.length / samplesPerYear - 1]
const formatFrequency = new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format
const formatAmplitude = new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format

export const spectrumFixture: Fixture<SpectrumColumnData, SpectrumConfig> = {
  ...noaa,
  description: 'One-sided amplitude of 480 monthly Mauna Loa CO₂ averages from 1980–2019 after linear detrending and Hann windowing.',
  data: {
    frequencies: spectrumFrequencies,
    columns: { amplitude: spectrumAmplitudes },
  },
  config: {
    series: [{ key: 'co2-amplitude', field: 'amplitude', label: 'CO₂ amplitude' }],
    peakMarkers: [{ key: 'annual-cycle', frequency: 1, magnitude: annualAmplitude, label: 'Annual cycle' }],
    xAxis: { label: 'Frequency (cycles/year)', range: [0, lastFrequency], formatValue: formatFrequency },
    yAxis: { label: 'Amplitude (ppm)', baseline: 0, formatValue: formatAmplitude },
  },
}

const windowLength = 96
const windowStep = samplesPerYear
const frequencySpacing = samplesPerYear / windowLength
const windows = Array.from(
  { length: 1 + Math.floor((monthlyCo2.length - windowLength) / windowStep) },
  (_, index) => {
    const start = index * windowStep
    return amplitudeSpectrum(monthlyCo2.slice(start, start + windowLength), 2, lastFrequency / frequencySpacing)
  },
)
const spectrogramValues = new Float64Array(windows.length * windows[0].length)
for (const [index, amplitudes] of windows.entries()) {
  spectrogramValues.set(amplitudes, index * amplitudes.length)
}

export const spectrogramFixture: Fixture<SpectrogramMatrixData, SpectrogramConfig> = {
  ...noaa,
  description: 'Mauna Loa CO₂ amplitude in 96-month windows stepped one year at a time. Tiles show each window’s center year.',
  data: {
    timeBins: Float64Array.from(windows, (_, index) => firstYear + (index * windowStep + windowLength / 2) / samplesPerYear),
    frequencyBins: Float64Array.from(windows[0], (_, index) => (index + 2) * frequencySpacing),
    timeBinWidth: windowStep / samplesPerYear,
    frequencyBinWidth: frequencySpacing,
    values: spectrogramValues,
    valueLayout: 'time-major',
  },
  config: {
    xAxis: { label: 'Window center year', formatValue: (value) => value.toFixed(0) },
    yAxis: { label: 'Frequency (cycles/year)', formatValue: formatFrequency },
    zAxis: { label: 'Amplitude (ppm)', range: [0, Math.ceil(Math.max(...spectrogramValues))], formatValue: formatAmplitude },
  },
}

// Palmer Station LTER and Kristen Gorman, through Horst, Hill, and Gorman's
// palmerpenguins 0.1.0 (CC0-1.0, DOI 10.5281/zenodo.3960218). Numeric columns
// from inst/extdata/penguins.csv at e5bfd5f2c7da95b0823e9501b9013eb2ef124fa7.
const penguinVariables = [
  { key: 'bill-length', label: 'Bill length', unit: 'mm' },
  { key: 'bill-depth', label: 'Bill depth', unit: 'mm' },
  { key: 'flipper-length', label: 'Flipper length', unit: 'mm' },
  { key: 'body-mass', label: 'Body mass', unit: 'g' },
]
const penguins = measurements.penguinMeasurements
const completePenguins = penguins.filter(
  (row): row is number[] => row.every((value) => value !== null),
)
const centeredMeasurements = penguinVariables.map((_, column) => {
  const observations = completePenguins.map((row) => row[column])
  const center = mean(observations)
  return observations.map((value) => value - center)
})

function pearson(left: readonly number[], right: readonly number[]) {
  let covariance = 0
  let leftVariance = 0
  let rightVariance = 0
  for (const [index, x] of left.entries()) {
    const y = right[index]
    covariance += x * y
    leftVariance += x * x
    rightVariance += y * y
  }
  return covariance / Math.sqrt(leftVariance * rightVariance)
}

const correlationValues = Float64Array.from(centeredMeasurements.flatMap(
  (left, row) => centeredMeasurements.map((right, column) => row === column ? 1 : pearson(left, right)),
))
export const correlationFixture: Fixture<CorrelationMatrixData, CorrelationMatrixConfig> = {
  sourceLabel: 'Palmer Station LTER via palmerpenguins',
  sourceUrl: 'https://allisonhorst.github.io/palmerpenguins/',
  description: 'Pearson correlations across four measurements for 342 complete records from three penguin species. Two incomplete records were excluded.',
  data: {
    variables: penguinVariables,
    values: correlationValues,
    sampleCounts: new Uint16Array(correlationValues.length).fill(completePenguins.length),
    missingCounts: new Uint16Array(correlationValues.length).fill(penguins.length - completePenguins.length),
    valueLayout: 'row-major',
  },
  config: { includeDiagonal: true, labels: { visible: true }, valueRange: [-1, 1] },
}

// Bob Zarr, NIST, ZARR13 heat-flow meter calibration, January 1990. All 195
// calibration factors in acquisition order. NIST's source does not give units.
const nist = {
  sourceLabel: 'NIST Heat Flow Meter case study',
  sourceUrl: 'https://itl.nist.gov/div898/handbook/eda/section4/eda4281.htm',
}
const calibrationFactors = measurements.calibrationFactors
const baselineSize = 100
const calibrationBaseline = calibrationFactors.slice(0, baselineSize)
const centerLine = mean(calibrationBaseline)
const meanMovingRange = mean(calibrationBaseline.slice(1).map(
  (value, index) => Math.abs(value - calibrationBaseline[index]),
))
// NIST/SEMATECH Individuals chart, using d₂ = 1.128 for moving ranges of two.
// https://itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm
const controlDistance = (3 * meanMovingRange) / 1.128
const lowerControlLimit = centerLine - controlDistance
const upperControlLimit = centerLine + controlDistance
const postBaselineViolations = calibrationFactors.flatMap((value, index) => {
  const sample = index + 1
  if (sample <= baselineSize || (value >= lowerControlLimit && value <= upperControlLimit)) return []
  return [{
    key: `sample-${sample}`,
    x: sample,
    label: `Sample ${sample}`,
    rule: value < lowerControlLimit ? 'Below lower control limit' : 'Above upper control limit',
    severity: 'violation' as const,
  }]
})
const formatFactor = new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format
const formatCount = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format

export const processControlFixture: Fixture<TimeSeriesColumnData, TimeSeriesConfig> = {
  ...nist,
  description: 'An individuals chart of 195 calibration factors, with fixed 3σ limits estimated on the first 100 samples. Markers flag later samples outside the limits.',
  data: {
    timestamps: Float64Array.from(calibrationFactors, (_, index) => index + 1),
    columns: { factor: Float64Array.from(calibrationFactors) },
  },
  config: {
    series: [{ key: 'calibration-factor', field: 'factor', label: 'Calibration factor' }],
    spcTracks: [{
      key: 'calibration-control-limits',
      chartKind: 'individual',
      centerLine,
      lowerControlLimit,
      upperControlLimit,
      markers: postBaselineViolations,
    }],
    xAxis: { label: 'Sample number', formatValue: formatCount },
    yAxis: { label: 'Calibration factor', formatValue: formatFactor },
  },
}

// Keep the interval boundaries in integer hundredths to avoid cumulative
// rounding. The left endpoint is included and the right endpoint is excluded.
const firstCalibrationBin = 919
const binCount = 14
const calibrationBinStarts = Float64Array.from({ length: binCount }, (_, index) => (firstCalibrationBin + index) / 100)
const calibrationBinEnds = Float64Array.from({ length: binCount }, (_, index) => (firstCalibrationBin + index + 1) / 100)
const calibrationCounts = Float64Array.from(
  calibrationBinStarts,
  (start, index) => calibrationFactors.filter(
    (value) => value >= start && value < calibrationBinEnds[index],
  ).length,
)

export const capabilityFixture: Fixture<DistributionColumnData, DistributionConfig> = {
  ...nist,
  description: 'The same 195 calibration factors in 0.01-wide bins. The target and specification markers are illustrative values for this example.',
  data: {
    binStarts: calibrationBinStarts,
    binEnds: calibrationBinEnds,
    columns: { count: calibrationCounts },
  },
  config: {
    series: [{ key: 'calibration-count', field: 'count', label: 'Readings per bin' }],
    markers: [
      { key: 'example-lower-spec', kind: 'lower-spec', value: 9.20, label: 'Example LSL' },
      { key: 'example-target', kind: 'target', value: 9.26, label: 'Example target' },
      { key: 'example-upper-spec', kind: 'upper-spec', value: 9.32, label: 'Example USL' },
    ],
    xAxis: { label: 'Calibration factor', formatValue: formatFactor },
    yAxis: { label: 'Readings', baseline: 0, formatValue: formatCount },
  },
}
