import { useMemo, useState } from 'react'
import { GenealogyPlot } from './GenealogyPlot'
import { lineagePath, prepareGenealogy, traceGenealogy } from './model'
import type { BatchGenealogyData, GenealogyNode, GenealogyPort, PreparedGenealogy } from './model'
import '../scientific-figure.css'
import './batch-genealogy.css'

export interface BatchGenealogyProps {
  data: BatchGenealogyData
  label?: string
  compact?: boolean
  initialLot?: string
  source?: { label: string; href: string; description?: string }
}

const instantFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: 'UTC', timeZoneName: 'short', hourCycle: 'h23',
})
const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

function shortRecord(node: GenealogyNode, data: BatchGenealogyData) {
  return node.kind === 'lot' ? data.lots[node.index].id : data.steps[node.index].label
}

function fullRecord(node: GenealogyNode, data: BatchGenealogyData) {
  if (node.kind === 'step') {
    const step = data.steps[node.index]
    return `${step.label} (${step.id})`
  }
  const lot = data.lots[node.index]
  return `${lot.id} · ${lot.label}`
}

function PortList({ name, ports, onInspect }: {
  name: string
  ports: readonly GenealogyPort[]
  onInspect: (key: string) => void
}) {
  return (
    <div className="genealogy-port-list">
      <strong>{name}</strong>
      <ul aria-label={name}>
        {ports.map(({ lotId, quantity, unit }) => (
          <li key={lotId} data-genealogy-port={lotId} data-quantity={quantity} data-unit={unit}>
            <button type="button" onClick={() => onInspect(`lot:${lotId}`)}>{lotId}</button>
            {quantity !== undefined && <span>{amountFormat.format(quantity)}{unit && ` ${unit}`}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function GenealogyFigure({ data, prepared, label, compact = false, initialLot, source }:
  BatchGenealogyProps & { prepared: PreparedGenealogy; label: string }) {
  const [requestedLot, setLot] = useState(initialLot)
  const [requestedRecord, setRecord] = useState<string>()
  const selected = data.lots.find(({ id }) => id === requestedLot) ?? data.lots.find(({ status }) => status === 'held') ?? data.lots[0]
  const trace = useMemo(() => traceGenealogy(prepared, selected.id)!, [prepared, selected.id])
  const record = (requestedRecord && prepared.byKey.get(requestedRecord)) || prepared.byKey.get(trace.root)!
  const witness = lineagePath(trace, record.key)
  const upstream = prepared.nodes.filter((node) => trace.upstream.has(node.key))
  const downstream = prepared.nodes.filter((node) => trace.downstream.has(node.key))
  const context = prepared.nodes.filter((node) => node.key !== trace.root && !trace.upstream.has(node.key) && !trace.downstream.has(node.key))
  const upstreamLots = upstream.filter(({ kind }) => kind === 'lot').length
  const downstreamLots = downstream.filter(({ kind }) => kind === 'lot').length
  const related = [
    { group: 'Trace start', nodes: [prepared.byKey.get(trace.root)!] },
    { group: 'Upstream trace', nodes: upstream },
    { group: 'Downstream trace', nodes: downstream },
    { group: 'Other recorded context', nodes: context },
  ]
  const lot = record.kind === 'lot' ? data.lots[record.index] : undefined
  const step = record.kind === 'step' ? data.steps[record.index] : undefined

  function pick(id: string) {
    setLot(id)
    setRecord(undefined)
  }

  return (
    <figure className="batch-genealogy" data-batch-genealogy data-compact={compact} aria-label={label}>
      {!compact && <div className="genealogy-controls">
        <label>Trace from lot
          <select value={selected.id} onChange={(event) => pick(event.currentTarget.value)}>
            {data.lots.map(({ id, label, status }) => <option key={id} value={id}>
              {id} · {label}{status === 'held' ? ' (hold)' : ''}
            </option>)}
          </select>
        </label>
        <label>Inspect record
          <select value={record.key} onChange={(event) => setRecord(event.currentTarget.value)}>
            {related.map(({ group, nodes }) => nodes.length > 0 && (
              <optgroup label={group} key={group}>
                {nodes.map((node) => <option key={node.key} value={node.key}>{fullRecord(node, data)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>}
      <GenealogyPlot data={data} prepared={prepared} trace={trace} inspected={record.key} witness={witness}
        label={label} compact={compact} onInspect={setRecord} />
      {!compact && <>
        <ul className="genealogy-key" aria-label="Figure key">
          <li className="genealogy-key-lot">Lot</li>
          <li className="genealogy-key-step">Process event</li>
          <li className="genealogy-key-upstream">Upstream</li>
          <li className="genealogy-key-downstream">Downstream</li>
          <li className="genealogy-key-context">Other context</li>
        </ul>
        <output className="genealogy-counts" data-genealogy-counts data-root={trace.root}
          data-upstream-lots={upstreamLots} data-downstream-lots={downstreamLots}
          data-upstream-steps={upstream.length - upstreamLots} data-downstream-steps={downstream.length - downstreamLots}>
          <span><strong>{upstreamLots}</strong> upstream lots in {upstream.length - upstreamLots} process events</span>
          <span><strong>{downstreamLots}</strong> downstream lots in {downstream.length - downstreamLots} process events</span>
        </output>
        <section className="genealogy-evidence" data-genealogy-evidence={record.key}
          data-relation={record.key === trace.root ? 'selected' : trace.upstream.has(record.key) ? 'upstream'
            : trace.downstream.has(record.key) ? 'downstream' : 'context'}
          aria-label="Selected record evidence">
          <div className="genealogy-evidence-title">
            <strong>{fullRecord(record, data)}</strong>
            {lot?.status && <span className="genealogy-lot-status" data-status={lot.status}>{lot.status === 'held' ? 'Quality hold' : 'Released'}</span>}
            {lot && lot.id !== selected.id && <button type="button" onClick={() => pick(lot.id)}>Trace this lot</button>}
          </div>
          {lot?.detail && <p>{lot.detail}</p>}
          {step && <>
            <p><time dateTime={step.timestamp}>{instantFormat.format(new Date(step.timestamp))}</time>{step.location && ` · ${step.location}`}</p>
            <div className="genealogy-ports">
              <PortList name="Recorded inputs" ports={step.inputs} onInspect={setRecord} />
              <PortList name="Recorded outputs" ports={step.outputs} onInspect={setRecord} />
            </div>
          </>}
          {witness.length > 1 ? <div className="genealogy-witness">
            <strong>Recorded path</strong>
            <ul aria-label="Recorded material path" data-genealogy-path>
              {witness.map((key) => <li key={key} data-node-key={key}>{shortRecord(prepared.byKey.get(key)!, data)}</li>)}
            </ul>
          </div> : witness.length === 0 && <p data-genealogy-context role="status">This record is outside the selected lot’s upstream and downstream paths.</p>}
        </section>
        {source && <figcaption className="genealogy-caption">
          <a href={source.href}>{source.label}</a>
          {source.description && <p>{source.description}</p>}
        </figcaption>}
      </>}
    </figure>
  )
}

export function BatchGenealogy({ data, label = 'Batch genealogy', ...props }: BatchGenealogyProps) {
  const prepared = useMemo(() => prepareGenealogy(data), [data])
  if (!prepared) return <p className="chart-render-message" role="status">Supply lot versions and timestamped events with valid input and output references.</p>
  return <GenealogyFigure {...props} data={data} prepared={prepared} label={label} />
}
