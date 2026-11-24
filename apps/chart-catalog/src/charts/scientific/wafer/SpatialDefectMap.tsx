import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { WaferPlot, defectColor, matchesBin } from './WaferPlot'
import { prepareDefectData, summarizeDies } from './model'
import type { DieStatus, PreparedDefectData, PreparedDie, PreparedWafer, SpatialDefectData } from './model'
import '../scientific-figure.css'
import './spatial-defect-map.css'

export interface SpatialDefectMapProps {
  data: SpatialDefectData
  label?: string
  compact?: boolean
  initialWafer?: string
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const statusLabels: Record<DieStatus, string> = { pass: 'Pass', fail: 'Fail', untested: 'Untested', missing: 'Missing record' }
const coordinate = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 })

function startDie(wafer: PreparedWafer) {
  let largest: readonly PreparedDie[] = []
  for (const cluster of wafer.clusters.values()) {
    if (cluster.length > largest.length) largest = cluster
  }
  if (!largest.length) return wafer.dies[0]
  const center = largest.reduce(([a, b], die) => [a + die.x, b + die.y], [0, 0])
  const radius = (die: PreparedDie) => Math.hypot(die.x - center[0] / largest.length, die.y - center[1] / largest.length)
  return largest.reduce((nearest, die) => radius(die) < radius(nearest) ? die : nearest)
}

function DefectMapFigure({ data, prepared, label, compact = false, source, initialWafer }:
  SpatialDefectMapProps & { prepared: PreparedDefectData; label: string }) {
  const [requestedBatch, setBatch] = useState('')
  const [requestedPattern, setPattern] = useState('')
  const [requestedWafer, setWafer] = useState(initialWafer)
  const [requestedDie, setDie] = useState<{ wafer: string; key: string }>()
  const [binChoice, setBinChoice] = useState('all')
  const batches = useMemo(() => [...new Set(prepared.wafers.map(({ source }) => source.batch))], [prepared])
  const batch = batches.includes(requestedBatch) ? requestedBatch : ''
  const byBatch = prepared.wafers.filter(({ source }) => !batch || source.batch === batch)
  const patterns = [...new Set(byBatch.flatMap(({ source }) => source.pattern ? [source.pattern] : []))]
  const pattern = patterns.includes(requestedPattern) ? requestedPattern : ''
  const choices = byBatch.filter(({ source }) => !pattern || source.pattern === pattern)
  const wafer = choices.find(({ source }) => source.id === requestedWafer) ?? choices[0]
  const active = (requestedDie?.wafer === wafer.source.id && wafer.byKey.get(requestedDie.key)) || startDie(wafer)
  const stats = useMemo(() => summarizeDies(wafer.dies), [wafer])
  const failureBins = useMemo(() => [...new Set(wafer.dies.flatMap((die) => die.status === 'fail' ? [die.bin || ''] : []))], [wafer])
  const effectiveBin = failureBins.some((id) => `bin:${id}` === binChoice) ? binChoice : 'all'
  const filter = effectiveBin === 'all' ? undefined : effectiveBin.slice(4)
  const matching = wafer.dies.filter((die) => matchesBin(die, filter)).length
  const yieldPct = stats.tested ? stats.pass / stats.tested * 100 : undefined
  const cluster = active.cluster ? wafer.clusters.get(active.cluster) : undefined
  const { geometry } = wafer.source
  const labelBin = (id: string) => prepared.binsById.get(id)?.label ?? 'Unclassified failure'

  return (
    <figure className="spatial-defect-map" data-spatial-defect-map data-compact={compact} aria-label={label}>
      {!compact && <div className="wafer-controls">
        <label>Batch
          <select value={batch} onChange={(event) => {
            setBatch(event.currentTarget.value)
            setPattern('')
          }}>
            <option value="">All batches</option>
            {batches.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        {patterns.length > 1 && <label>Wafer pattern
          <select value={pattern} onChange={(event) => setPattern(event.currentTarget.value)}>
            <option value="">All patterns</option>
            {patterns.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>}
        <label>Wafer
          <select value={wafer.source.id} onChange={(event) => setWafer(event.currentTarget.value)}>
            {choices.map(({ source }) => <option key={source.id} value={source.id}>{source.label || source.id}</option>)}
          </select>
        </label>
        {failureBins.length > 1 && <label>Failure bin
          <select value={effectiveBin} onChange={(event) => setBinChoice(event.currentTarget.value)}>
            <option value="all">All failures</option>
            {failureBins.map((id) => <option key={id} value={`bin:${id}`}>{labelBin(id)}</option>)}
          </select>
        </label>}
      </div>}
      <WaferPlot wafer={wafer} bins={data.bins} active={active} filter={filter} label={label} compact={compact}
        onSelect={(die) => setDie({ wafer: wafer.source.id, key: die.key })} />
      {!compact && <>
        <ul className="wafer-key" aria-label="Die status and failure bins">
          {stats.pass > 0 && <li data-chip="pass">Pass</li>}
          {stats.untested > 0 && <li data-chip="untested">Untested</li>}
          {stats.missing > 0 && <li data-chip="missing">Missing record</li>}
          {failureBins.map((id) => (
            <li key={id} data-chip="fail" style={{ '--wafer-chip': defectColor(data.bins.findIndex((bin) => bin.id === id)) } as CSSProperties}>
              {labelBin(id)}
            </li>
          ))}
        </ul>
        <output className="wafer-counts" data-wafer-counts data-wafer-id={wafer.source.id}
          data-wafer-batch={wafer.source.batch} data-wafer-pattern={wafer.source.pattern} data-tested={stats.tested}
          data-total={stats.total} data-pass={stats.pass} data-fail={stats.fail} data-untested={stats.untested}
          data-missing={stats.missing} data-yield={yieldPct} data-matching={matching}>
          <span><strong>{stats.tested} / {stats.total}</strong> sites tested</span>
          <span><strong>{stats.fail}</strong> failed</span>
          <span><strong>{yieldPct === undefined ? '—' : `${yieldPct.toFixed(2)}%`}</strong> tested yield</span>
          {filter !== undefined && <span><strong>{matching}</strong> matching the bin</span>}
        </output>
        <output className="wafer-readout" data-wafer-readout data-key={active.key} data-row={active.row}
          data-column={active.column} data-status={active.status} data-bin={active.bin} data-x={active.x} data-y={active.y}
          data-cluster-size={cluster?.length}>
          <span>Die <strong>Row {active.row}, column {active.column}</strong></span>
          <span>Position <strong>{coordinate.format(active.x)}, {coordinate.format(active.y)} {geometry.unit}</strong></span>
          <span>Recorded result <strong>{active.status === 'fail' ? labelBin(active.bin || '') : statusLabels[active.status]}</strong></span>
          {cluster && <span>Edge-connected failures <strong>{cluster.length}</strong></span>}
        </output>
        {source && <figcaption className="wafer-caption">
          <div>
            <a href={source.href}>{source.label}</a>
            {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
          </div>
          {source.description && <p>{source.description}</p>}
        </figcaption>}
      </>}
    </figure>
  )
}

export function SpatialDefectMap({ data, label = 'Wafer spatial defect map', ...props }: SpatialDefectMapProps) {
  const prepared = useMemo(() => prepareDefectData(data), [data])
  if (!prepared) return <p className="chart-render-message" role="status">Supply valid wafer geometry and unique die records.</p>
  return <DefectMapFigure {...props} data={data} prepared={prepared} label={label} />
}
