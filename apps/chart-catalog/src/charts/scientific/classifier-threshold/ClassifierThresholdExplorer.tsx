import { useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { classifierPointIndex, prepareClassifierThreshold } from './model'
import type { ClassifierOperatingPoint, ClassifierThresholdData, PreparedClassifierThreshold } from './model'
import './classifier-threshold.css'

export interface ClassifierThresholdExplorerProps {
  data: ClassifierThresholdData
  title?: string
  initialThreshold?: number
  caption?: ReactNode
  compact?: boolean
}

const count = new Intl.NumberFormat('en-US')
const rate = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const area = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const ticks = [0, 0.25, 0.5, 0.75, 1]

function cutoffLabel(threshold: number | null) {
  return threshold === null ? 'Above highest score' : String(threshold)
}

function ClassifierCurve({ kind, analysis, index, compact, select }: {
  kind: 'roc' | 'pr'
  analysis: PreparedClassifierThreshold
  index: number
  compact: boolean
  select?: (index: number) => void
}) {
  const roc = kind === 'roc'
  const title = roc ? 'ROC curve' : 'Precision–recall curve'
  const baseline = analysis.positives / (analysis.positives + analysis.negatives)
  const left = compact ? 8 : 52
  const right = compact ? 228 : 342
  const top = 11
  const bottom = compact ? 228 : 181
  const x = (value: number) => left + (right - left) * value
  const y = (value: number) => bottom - (bottom - top) * value
  const coordinates = useMemo(() => analysis.points.map((point) => ({
    x: roc ? point.fpr : point.tpr,
    y: roc ? point.tpr : point.precision ?? 1,
  })), [analysis, roc])
  const curvePath = coordinates.map((point, i) => {
    if (i === 0) return roc ? `M${x(point.x)},${y(point.y)}` : ''
    if (!roc && i === 1) return `M${left},${y(point.y)}H${x(point.x)}`
    return roc ? `L${x(point.x)},${y(point.y)}` : `V${y(point.y)}H${x(point.x)}`
  }).join(' ').trimStart()
  const active = coordinates[index]
  const hasMarker = roc || analysis.points[index].precision !== null

  function selectNearest(event: MouseEvent<SVGSVGElement>) {
    const transform = event.currentTarget.getScreenCTM()
    if (!select || !transform) return
    const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
    if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) return
    let nearest = index
    let distance = Infinity
    coordinates.forEach((point, i) => {
      if (!roc && i === 0) return
      const candidate = (pointer.x - x(point.x)) ** 2 + (pointer.y - y(point.y)) ** 2
      if (candidate < distance || (candidate === distance && Math.abs(i - index) < Math.abs(nearest - index))) {
        nearest = i
        distance = candidate
      }
    })
    select(nearest)
  }

  return <section className="classifier-curve" aria-label={title}>
    {!compact && <div className="classifier-heading">
      <h3>{title}</h3>
      <span>{roc ? 'AUC' : 'AP'} <strong>{area.format(roc ? analysis.rocAuc : analysis.averagePrecision)}</strong></span>
    </div>}
    <svg viewBox={compact ? "0 0 240 240" : "0 0 354 225"} role="img" aria-label={title} data-classifier-curve={kind}
      data-baseline={roc ? 'diagonal' : baseline} data-selected-index={index}
      onClick={compact ? undefined : selectNearest}>
      {!compact && ticks.map((tick) => <g key={tick} className="classifier-tick">
        <path d={`M${x(tick)},${top}V${bottom}M${left},${y(tick)}H${right}`} />
        <text x={x(tick)} y={bottom + 18} textAnchor={tick === 1 ? 'end' : 'middle'}>{rate.format(tick)}</text>
        <text x={left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{rate.format(tick)}</text>
      </g>)}
      <path className="classifier-baseline" d={roc
        ? `M${left},${bottom}L${right},${top}`
        : `M${left},${y(baseline)}H${right}`} />
      <path className="classifier-axis" d={`M${left},${top}V${bottom}H${right}`} />
      {!compact && <>
        <text className="classifier-axis-label" x={(left + right) / 2} y={219} textAnchor="middle">{roc ? 'False positive rate' : 'Recall'}</text>
        <text className="classifier-axis-label" textAnchor="middle" transform={`translate(11 ${(top + bottom) / 2}) rotate(-90)`}>
          {roc ? 'True positive rate' : 'Precision'}
        </text>
      </>}
      <path className="classifier-trace" data-classifier-trace d={curvePath} />
      {hasMarker && <g data-classifier-marker data-x={active.x} data-y={active.y}>
        {!compact && <path className="classifier-crosshair" d={`M${left},${y(active.y)}H${x(active.x)}V${bottom}`} />}
        <circle cx={x(active.x)} cy={y(active.y)} r={compact ? 5.8 : 4.8} />
      </g>}
    </svg>
    {!compact && <p className="classifier-baseline-key">{roc ? 'Chance' : `Positive prevalence ${rate.format(baseline)}`}</p>}
  </section>
}

function ConfusionMatrix({ point, data, compact }: {
  point: ClassifierOperatingPoint
  data: ClassifierThresholdData
  compact: boolean
}) {
  const rows = [
    { label: data.positiveLabel, cells: [{ key: 'tp', value: point.tp }, { key: 'fn', value: point.fn }] },
    { label: data.negativeLabel, cells: [{ key: 'fp', value: point.fp }, { key: 'tn', value: point.tn }] },
  ]
  if (compact) return <svg className="classifier-compact-matrix" viewBox="0 0 100 100" role="img" aria-label="Confusion matrix">
    {rows.flatMap(({ cells }, row) => cells.map(({ key, value }, column) =>
      <rect key={key} x={6 + column * 45} y={6 + row * 45}
        width="41" height="41" rx="1" data-error={row !== column}
        style={{ '--cell-rate': value / (cells[0].value + cells[1].value) } as CSSProperties} />))}
  </svg>

  return <table className="classifier-matrix" aria-label="Confusion matrix" data-classifier-matrix>
    <thead><tr><th scope="col">Actual outcome</th><th scope="col">Predicted {data.positiveLabel}</th>
      <th scope="col">Predicted {data.negativeLabel}</th></tr></thead>
    <tbody>{rows.map(({ label, cells }, row) => <tr key={row}>
      <th scope="row">{label}</th>
      {cells.map(({ key, value }, column) => {
        const fraction = value / (cells[0].value + cells[1].value)
        return <td key={key} data-classifier-cell={key} data-count={value} data-error={row !== column}
          style={{ '--cell-rate': fraction } as CSSProperties}>
          <strong>{count.format(value)}</strong><span>{rate.format(fraction)}</span>
        </td>
      })}
    </tr>)}</tbody>
  </table>
}

function ThresholdFigure({ data, title, initialThreshold, caption, compact = false, analysis }:
  ClassifierThresholdExplorerProps & { analysis: PreparedClassifierThreshold }) {
  const [selectedCutoff, setCutoff] = useState<number>()
  const index = classifierPointIndex(analysis.points, selectedCutoff ?? initialThreshold ?? (analysis.points[1].threshold ?? Infinity))
  const point = analysis.points[index]
  const label = cutoffLabel(point.threshold)
  const choose = (next: number) => setCutoff(analysis.points[next].threshold ?? Infinity)

  return <figure className="classifier-threshold" data-classifier-threshold data-compact={compact}
    data-positives={analysis.positives} data-negatives={analysis.negatives} data-point-count={analysis.points.length}
    data-roc-auc={analysis.rocAuc} data-average-precision={analysis.averagePrecision} aria-label={title}>
    {!compact && <section className="classifier-cutoff" aria-label="Select an operating threshold">
      <div className="classifier-heading">
        <h3>Decision threshold</h3>
        <span>{count.format(analysis.positives)} {data.positiveLabel} · {count.format(analysis.negatives)} {data.negativeLabel}</span>
      </div>
      <label className="classifier-slider-label">
        <span>{point.threshold === null ? 'Above highest score · no positive predictions' : <>Predict “{data.positiveLabel}” when score ≥ <strong>{label}</strong></>}</span>
        <input type="range" min="0" max={analysis.points.length - 1} step="1" value={index}
          aria-label="Decision threshold" aria-valuetext={label} data-classifier-cutoff
          onChange={(event) => choose(Number(event.currentTarget.value))} />
      </label>
      <div className="classifier-slider-scale" aria-hidden="true"><span>Higher cutoff</span><span>Lower cutoff</span></div>
    </section>}
    <div className="classifier-curves">
      <ClassifierCurve kind="roc" analysis={analysis} index={index} compact={compact} select={choose} />
      <ClassifierCurve kind="pr" analysis={analysis} index={index} compact={compact} select={choose} />
    </div>
    {compact ? <ConfusionMatrix point={point} data={data} compact /> :
      <section className="classifier-outcomes" aria-label="Operating point outcomes">
        <div className="classifier-heading"><h3>Confusion matrix</h3><span>Counts and percentages of each actual class</span></div>
        <ConfusionMatrix point={point} data={data} compact={false} />
        <output className="classifier-readout" data-classifier-readout={index} data-threshold={point.threshold ?? 'none'}
          data-recall={point.tpr} data-false-positive-rate={point.fpr} data-precision={point.precision ?? 'undefined'} aria-live="off">
          <span>Recall <strong>{rate.format(point.tpr)}</strong></span>
          <span>False positive rate <strong>{rate.format(point.fpr)}</strong></span>
          <span>Precision <strong>{point.precision === null ? 'Undefined' : rate.format(point.precision)}</strong></span>
        </output>
      </section>}
    {!compact && caption && <figcaption>{caption}</figcaption>}
  </figure>
}

export function ClassifierThresholdExplorer({ title = 'Classifier threshold explorer', ...props }: ClassifierThresholdExplorerProps) {
  const analysis = useMemo(() => prepareClassifierThreshold(props.data), [props.data])
  if (!analysis) return <p role="status">Provide finite scores and unique IDs for observations from both actual classes.</p>
  return <ThresholdFigure {...props} title={title} analysis={analysis} />
}
