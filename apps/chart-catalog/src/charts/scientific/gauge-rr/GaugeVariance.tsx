import type { GaugeTerm, PreparedGaugeRR } from './model'

const scientific = new Intl.NumberFormat('en-US', { notation: 'scientific', maximumSignificantDigits: 5 })
const varianceNumber = (value: number) => value === 0 ? '0' : scientific.format(value)
const decimal = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

const terms: readonly GaugeTerm[] = ['part', 'repeatability', 'operator', 'interaction']
const labels: Record<GaugeTerm, string> = {
  part: 'Part-to-part', repeatability: 'Repeatability', operator: 'Operator', interaction: 'Part × operator',
}

function proportion(value: number | null) {
  return value === null ? '—' : percent.format(value)
}

type PartitionItem = { name: GaugeTerm | 'gauge'; label: string; amount: number }

function VariancePartition({ label, mode, items, total }: {
  label: string; mode: 'total' | 'gauge'; items: readonly PartitionItem[]; total: number
}) {
  let position = 0
  return <div className="gauge-partition" data-gauge-partition={mode} data-denominator={total}>
    <div className="gauge-section-head">
      <h4>{label}</h4>
      <span>{total > 0 ? '0–100%' : 'Zero estimated variance'}</span>
    </div>
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" role="img"
      aria-label={items.map(({ label, amount }) => `${label} ${proportion(total > 0 ? amount / total : null)}`).join(', ')}>
      {items.map(({ name, amount }) => {
        const width = total > 0 ? amount / total * 100 : 0
        const left = position
        position += width
        return <rect key={name} data-variance-segment={name} data-variance={amount} data-fraction={total > 0 ? amount / total : undefined}
          x={left} y={0} width={width} height={8} />
      })}
    </svg>
    <div className="gauge-partition-key">
      {items.map(({ name, label, amount }) => <span key={name}><i data-variance-chip={name} />
        {label} <strong>{proportion(total > 0 ? amount / total : null)}</strong>
      </span>)}
    </div>
  </div>
}

export function GaugeVariance({ study }: { study: PreparedGaugeRR }) {
  const { components, measurementVariance, totalVariance, measurementFraction, reproducibilityVariance } = study
  const clamped = terms.filter((term) => components[term].rawVariance < 0)
  return <section className="gauge-variance" aria-label="Estimated variance components" data-gauge-variance>
    <div className="gauge-section-head"><h3>Variance components</h3><span>Crossed ANOVA with interaction</span></div>
    <output className="gauge-variance-summary" data-gauge-variance-summary data-total-variance={totalVariance}
      data-measurement-variance={measurementVariance} data-reproducibility-variance={reproducibilityVariance}
      data-fraction={measurementFraction ?? undefined} data-gauge-sd={Math.sqrt(measurementVariance)}>
      <span>Gauge share of total variance <strong>{proportion(measurementFraction)}</strong></span>
      <span>Gauge standard deviation <strong>{decimal.format(Math.sqrt(measurementVariance))} {study.unit}</strong></span>
    </output>
    <VariancePartition label="Total variance" mode="total" total={totalVariance} items={[
      { name: 'part', label: labels.part, amount: components.part.variance },
      { name: 'gauge', label: 'Gauge R&R', amount: measurementVariance },
    ]} />
    <VariancePartition label="Within gauge variance" mode="gauge" total={measurementVariance}
      items={terms.slice(1).map((name) => ({ name, label: labels[name], amount: components[name].variance }))} />
    <div className="gauge-table-wrap"><table className="gauge-table">
      <thead><tr><th scope="col">Source</th><th scope="col">Variance ({study.unit}²)</th><th scope="col">Share of total</th></tr></thead>
      <tbody>{terms.map((term) => {
        const component = components[term]
        return <tr key={term} data-gauge-term={term} data-raw-variance={component.rawVariance}
          data-variance={component.variance} data-fraction={component.fraction ?? undefined}>
          <th scope="row">{labels[term]}</th><td>{varianceNumber(component.variance)}</td><td>{proportion(component.fraction)}</td>
        </tr>
      })}</tbody>
    </table></div>
    {clamped.length > 0 && <p className="gauge-clamped" data-gauge-clamped>
      Negative variance estimates are set to zero in the partition. {clamped.map((term) => (
        `${labels[term]}: ${varianceNumber(components[term].rawVariance)} ${study.unit}²`
      )).join(' · ')}
    </p>}
    <details className="gauge-anova">
      <summary>ANOVA table</summary>
      <div className="gauge-table-wrap"><table className="gauge-table">
        <thead><tr><th scope="col">Source</th><th scope="col">df</th><th scope="col">SS ({study.unit}²)</th><th scope="col">MS ({study.unit}²)</th></tr></thead>
        <tbody>{study.anova.map(({ term, df, ss, ms }) => <tr key={term} data-gauge-anova={term} data-df={df} data-ss={ss} data-ms={ms}>
          <th scope="row">{labels[term]}</th><td>{df}</td><td>{varianceNumber(ss)}</td><td>{varianceNumber(ms)}</td>
        </tr>)}
        <tr><th scope="row">Total</th><td>{study.totalDF}</td><td>{varianceNumber(study.totalSS)}</td><td>—</td></tr></tbody>
      </table></div>
    </details>
  </section>
}
