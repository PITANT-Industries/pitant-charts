import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getGroupForFamily } from '../catalog'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample, ChartFamily } from '../types'
import { CodeBlock, ExampleCode, guideUrl, repositoryUrl, scientificGuideUrl } from './ExampleCode'
import { DocsShell } from './DocsShell'
import { useNearViewport } from './DeferredChart'
import { archiveInstallCommands, PackageManagerCommands } from './PackageManagerCommands'
import cartesianDocs from './docs/cartesian.json'
import specializedDocs from './docs/specialized.json'
import scientificDocs from './docs/scientific.json'
import './documentation.css'

type PropGuide = { name: string; type: string; description: string }

type FamilyGuide = {
  summary: string
  useWhen: string
  data: string
  reading: string
  notes: string[]
  properties?: PropGuide[]
  sources?: { label: string; href: string }[]
}

const documentation: Record<string, FamilyGuide> = { ...cartesianDocs, ...specializedDocs, ...scientificDocs }
const sourceBuild = `git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
bun run --filter @pitant/chart-catalog build:library
cd apps/chart-catalog
npm pack --ignore-scripts`
const nativeSourceBuild = `git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
bun run build
npm pack ./packages/charts ./packages/charts-react`
const catalogInstall = archiveInstallCommands(['pitant-chart-catalog-0.7.0.tgz'])
const nativeInstall = archiveInstallCommands(['pitant-charts-1.0.0.tgz', 'pitant-charts-react-1.0.0.tgz'])
const properties: PropGuide[] = [
  { name: 'example', type: 'ChartExample', description: 'Required. Select a registered chart with getExample(id).' },
  { name: 'data', type: 'ChartData', description: 'Optional categories, numeric series, and family-specific rows. Omit it to use the included sample data. See Data and usage for accepted fields.' },
  { name: 'compact', type: 'boolean', description: 'Uses the compact presentation shown in gallery cards.' },
]
const extraProperties: Record<string, (typeof properties)[number]> = {
  'live-line': { name: 'liveStream', type: 'LiveLineStream', description: 'Supplies chronological batches of timestamped samples and an unsubscribe function.' },
  pie: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content for donut variants using the current value, total, and share.' },
  ring: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content from the current ring values and progress target when available.' },
  tooltip: { name: 'renderTooltip', type: '(context: ChartTooltipContext) => ReactNode', description: 'Supplies custom tooltip content using the active category, pin state, and series values.' },
}
const familyToc = [
  { id: 'docs-preview-title', title: 'Preview' },
  { id: 'docs-usage-title', title: 'Installation' },
  { id: 'docs-data-title', title: 'Data and usage' },
  { id: 'docs-props-title', title: 'Props' },
]

function ExamplePlot({ example, deferred }: { example: ChartExample; deferred: boolean }) {
  const [host, visible] = useNearViewport<HTMLDivElement>()
  const scientific = getGroupForFamily(example.family)?.id === 'scientific'
  return (
    <div className={`docs-example-plot not-prose${scientific ? ' docs-example-plot--scientific' : ''}`} data-example-id={example.id} ref={deferred ? host : undefined}>
      {(!deferred || visible) && <ChartPreview example={example} />}
    </div>
  )
}

function ExamplePreview({ example, featured = false }: { example: ChartExample; featured?: boolean }) {
  const Title = featured ? 'h2' : 'h3'
  const titleId = featured ? 'docs-preview-title' : `example-${example.id}`

  return (
    <Tabs defaultValue="preview" activationMode="manual" className="docs-preview">
      <div className="docs-preview-toolbar not-prose">
        <Title id={titleId} tabIndex={-1}>{example.title}</Title>
        <TabsList variant="line" aria-label={`${example.title} example view`}>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="preview" className="docs-preview-panel">
        <ExamplePlot example={example} deferred={!featured} />
      </TabsContent>
      <TabsContent value="code" className="docs-preview-panel">
        <ExampleCode example={example} />
      </TabsContent>
    </Tabs>
  )
}

export function FamilyDocumentation({ family, variantId, onNavigate }: {
  family: ChartFamily
  variantId?: string
  onNavigate: (pageId: string) => void
}) {
  const doc = documentation[family.id]
  const featured = family.examples.find((example) => example.id === variantId) ?? family.examples[0]
  if (!doc || !featured) return null

  const otherExamples = family.examples.filter((example) => example.id !== featured.id)
  const toc = otherExamples.length ? [...familyToc, { id: 'docs-examples-title', title: 'Examples' }] : familyToc
  const scientific = getGroupForFamily(family.id)?.id === 'scientific' && !['spectral-waterfall', 'mass-spectrum', 'mass-spectrum-mirror', 'chromatogram-peak-integration', 'gauge-rr', 'kaplan-meier', 'weibull-probability', 'hotelling-process-monitor', 'classifier-threshold-explorer', 'fault-event-replay', 'startup-overlay', 'cumulative-flow', 'takt-balance', 'energy-operating-map', 'lcms-feature-map', 'pca-biplot', 'pareto-frontier', 'batch-genealogy', 'spatial-defect-map', 'campbell-diagram', 'mode-shapes', 'shaft-orbit', 'frequency-response', 'coherence-phase', 'wavelet-scalogram', 'bearing-envelope', 'eye-diagram', 'allan-deviation', 'phase-plane', 'xrd-peak-tracker', 'stress-strain-comparison', 'full-field-strain', 'fatigue-sn', 'crack-growth', 'binary-phase-diagram', 'ternary-mixture-map', 'industrial-ct', 'cad-scan-deviation', 'cie-chromaticity', 'hyperspectral-cube', 'response-surface'].includes(family.id)
  const extra = extraProperties[family.id]
  const documentedProps = doc.properties ?? [...properties, ...(extra ? [extra] : [])]

  return (
    <DocsShell pageId={family.id} title={family.name} description={doc.summary} toc={toc} onNavigate={onNavigate}>
      <div className="family-docs">
        <section id="docs-preview" aria-labelledby="docs-preview-title">
          <ExamplePreview key={featured.id} example={featured} featured />
        </section>

        <section id="docs-usage" aria-labelledby="docs-usage-title">
          <h2 id="docs-usage-title" tabIndex={-1}>Installation</h2>
          <p>{scientific
            ? 'Build the industrial chart packages with Bun. Your app needs React and React DOM 19.'
            : 'Build the catalog from source with Bun. Your app needs React and React DOM 19.2 or a later 19.x version.'}</p>
          <div className="docs-install-blocks">
            <CodeBlock language="Build and pack" source={scientific ? nativeSourceBuild : sourceBuild} />
            <p>Copy the archives printed by <code>npm pack</code> into your app directory. Then run the command for your package manager.</p>
            <PackageManagerCommands commands={scientific ? nativeInstall : catalogInstall} />
          </div>
          <p>See the <a href={scientific ? scientificGuideUrl : guideUrl}>integration guide</a> for importing the stylesheet and using a sized chart container.</p>
        </section>

        <section id="docs-data" aria-labelledby="docs-data-title">
          <h2 id="docs-data-title" tabIndex={-1}>Data and usage</h2>
          <dl className="docs-data">
            <dt>When to use it</dt><dd>{doc.useWhen}</dd>
            <dt>Input data</dt><dd>{doc.data}</dd>
            <dt>Reading the chart</dt><dd>{doc.reading}</dd>
          </dl>
          <ul>{doc.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          {doc.sources?.length ? (
            <ul aria-label="Data sources">{doc.sources.map(({ href, label }) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
          ) : <p><a href={`${repositoryUrl}/blob/main/apps/chart-catalog/CALLER_DATA.md`}>Input data by example</a></p>}
        </section>

        <section id="docs-props" aria-labelledby="docs-props-title">
          <h2 id="docs-props-title" tabIndex={-1}>Props</h2>
          <div className="docs-props">
            <table>
              <thead><tr><th scope="col">Prop</th><th scope="col">Type</th><th scope="col">Usage</th></tr></thead>
              <tbody>{documentedProps.map(({ name, type, description }) => <tr key={name}>
                <th scope="row"><code>{name}</code></th><td><code>{type}</code></td><td>{description}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        {otherExamples.length > 0 && (
          <section id="docs-examples" aria-labelledby="docs-examples-title">
            <h2 id="docs-examples-title" tabIndex={-1}>Examples</h2>
            <div className="docs-variants">
              {otherExamples.map((example) => (
                <section key={example.id} aria-labelledby={`example-${example.id}`}>
                  <ExamplePreview example={example} />
                </section>
              ))}
            </div>
          </section>
        )}
      </div>
    </DocsShell>
  )
}
