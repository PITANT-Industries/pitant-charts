import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { getGroupForFamily } from '../catalog'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample, ChartFamily } from '../types'
import { CodeBlock, ExampleCode, guideUrl, repositoryUrl } from './ExampleCode'
import { parityNotes } from './ParityOverview'
import cartesianDocs from './docs/cartesian.json'
import specializedDocs from './docs/specialized.json'
import './documentation.css'

type FamilyNotes = {
  summary: string
  useWhen: string
  data: string
  reading: string
  notes: string[]
}

const documentation: Record<string, FamilyNotes> = { ...cartesianDocs, ...specializedDocs }
const sourceBuild = `git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
bun run --filter @pitant/chart-catalog build:library
cd apps/chart-catalog
npm pack --ignore-scripts`
const properties = [
  { name: 'example', type: 'ChartExample', description: 'Required. Select a registered chart with getExample(id).' },
  { name: 'data', type: 'ChartData', description: 'Optional categories, numeric series, and family-specific rows. Omit it to use the example data. Check caller-data coverage for the variant you select.' },
  { name: 'compact', type: 'boolean', description: 'Uses the compact presentation shown in gallery cards.' },
]
const extraProperties: Record<string, (typeof properties)[number]> = {
  'live-line': { name: 'liveStream', type: 'LiveLineStream', description: 'Supplies chronological batches of timestamped samples and an unsubscribe function.' },
  pie: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content for donut variants using the current value, total, and share.' },
  ring: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content from the current ring values and progress target when available.' },
  tooltip: { name: 'renderTooltip', type: '(context: ChartTooltipContext) => ReactNode', description: 'Supplies custom tooltip content using the active category, pin state, and series values.' },
}
const sections = [
  { id: 'docs-preview', name: 'Preview' },
  { id: 'docs-usage', name: 'Installation' },
  { id: 'docs-data', name: 'Data and usage' },
  { id: 'docs-props', name: 'Props' },
  { id: 'docs-examples', name: 'Examples' },
]

export function ExampleNotes({ example }: { example: ChartExample }) {
  const notes = parityNotes[example.id]
  return (
    <div className="variant-notes">
      <p>{example.description}</p>
      {notes && <dl>
        <dt>Checked behavior</dt>
        <dd>{notes.checked}</dd>
        <dt>Known differences</dt>
        <dd>{notes.remaining}</dd>
      </dl>}
    </div>
  )
}

export function FamilyDocumentation({ family, onBrowseFamily, onOpenExample }: {
  family: ChartFamily
  onBrowseFamily: (id: string) => void
  onOpenExample: (example: string, tab: 'preview' | 'code' | 'notes') => void
}) {
  const doc = documentation[family.id]
  const featured = family.examples[0]
  const extra = extraProperties[family.id]
  const group = getGroupForFamily(family.id)
  const article = useRef<HTMLElement>(null)
  const [activeSection, setActiveSection] = useState<string>(sections[0].id)

  useEffect(() => {
    const content = article.current
    if (!content) return
    const targets = Array.from(content.querySelectorAll<HTMLElement>(':scope > section[id]'))
    const header = document.querySelector('.site-header')
    let frame = 0

    function updateActiveSection() {
      frame = 0
      const cutoff = (header?.getBoundingClientRect().bottom ?? 0) + 28
      let active = targets[0]?.id ?? sections[0].id
      for (const target of targets) {
        if (target.getBoundingClientRect().top > cutoff) break
        active = target.id
      }
      if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1) {
        const focusedTarget = targets.find((target) => target.querySelector('h2') === document.activeElement)
        const focusedTop = focusedTarget?.getBoundingClientRect().top ?? -1
        active = focusedTarget && focusedTop >= cutoff - 28 && focusedTop < window.innerHeight
          ? focusedTarget.id
          : targets.at(-1)?.id ?? active
      }
      setActiveSection(active)
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection)
    }

    const resize = new ResizeObserver(scheduleUpdate)
    resize.observe(content)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.cancelAnimationFrame(frame)
    }
  }, [family.id])

  if (!doc || !featured) return null

  return (
    <div className="family-docs-layout docs-showcase">
      <header className="docs-header">
        <div className="docs-header-links">
          <nav aria-label="Breadcrumb" className="docs-breadcrumb">
            <a href={`#category=${group?.id ?? 'all'}&family=${family.id}`} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
              event.preventDefault()
              onBrowseFamily(family.id)
            }}>Charts</a>
            {group && <><ChevronRight size={13} aria-hidden="true" /><span>{group.name}</span></>}
          </nav>
          <a className="docs-source-link" href={`${repositoryUrl}/tree/main/apps/chart-catalog`} aria-label="Catalog source">Source <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
        <h1 id="family-docs-title" tabIndex={-1}>{family.name}</h1>
        <p>{doc.summary}</p>
      </header>
      <nav className="docs-jump" aria-label="On this page">
        <p>On this page</p>
        {sections.map(({ id, name }) => (
          <button aria-current={activeSection === id ? 'location' : undefined} type="button" key={id} onClick={() => {
            const section = document.getElementById(id)
            section?.querySelector('h2')?.focus({ preventScroll: true })
            section?.scrollIntoView({ block: 'start' })
            setActiveSection(id)
          }}>{name}</button>
        ))}
      </nav>
      <article className="family-docs" aria-labelledby="family-docs-title" ref={article}>
        <section id="docs-preview" aria-labelledby="docs-preview-title">
          <h2 id="docs-preview-title" className="docs-preview-heading" tabIndex={-1}>Preview</h2>
          <Tabs defaultValue="preview" activation="manual" className="docs-preview">
            <div className="docs-preview-toolbar">
              <TabsList className="docs-preview-tabs" aria-label="Documentation example view">
                <TabsTab value="preview">Preview</TabsTab>
                <TabsTab value="code">Code</TabsTab>
              </TabsList>
              {featured.title.toLowerCase() !== family.name.toLowerCase() && <span className="docs-preview-label">{featured.title}</span>}
            </div>
            <div className="docs-preview-panel">
              <TabsPanel value="preview">
                <div className="docs-example-plot"><ChartPreview example={featured} /></div>
              </TabsPanel>
              <TabsPanel value="code"><ExampleCode example={featured} /></TabsPanel>
            </div>
          </Tabs>
        </section>

        <section id="docs-usage" aria-labelledby="docs-usage-title">
          <h2 id="docs-usage-title" tabIndex={-1}>Installation</h2>
          <p>Build the catalog from source with Bun. Your app needs React and React DOM 19.2 or a later 19.x version.</p>
          <div className="docs-install-blocks">
            <CodeBlock language="Build and pack" source={sourceBuild} />
            <CodeBlock language="Install in your app" source={'npm install "/path/to/pitant-chart-catalog-VERSION.tgz"'}
              note={<>Use the path to the archive printed by <code>npm pack</code>.</>} />
          </div>
          <p>See the <a href={guideUrl}>integration guide</a> for importing the stylesheet and using a sized chart container.</p>
        </section>

        <section id="docs-data" aria-labelledby="docs-data-title">
          <h2 id="docs-data-title" tabIndex={-1}>Data and usage</h2>
          <dl className="docs-data">
            <dt>When to use it</dt><dd>{doc.useWhen}</dd>
            <dt>Input data</dt><dd>{doc.data}</dd>
            <dt>Reading the chart</dt><dd>{doc.reading}</dd>
          </dl>
          <ul>{doc.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <p><a href={`${repositoryUrl}/blob/main/apps/chart-catalog/CALLER_DATA.md`}>Caller-data support by variant</a></p>
        </section>

        <section id="docs-props" aria-labelledby="docs-props-title">
          <h2 id="docs-props-title" tabIndex={-1}>Props</h2>
          <div className="docs-props">
            <table>
              <thead><tr><th scope="col">Prop</th><th scope="col">Type</th><th scope="col">Usage</th></tr></thead>
              <tbody>{[...properties, ...(extra ? [extra] : [])].map(({ name, type, description }) => <tr key={name}>
                <th scope="row"><code>{name}</code></th><td><code>{type}</code></td><td>{description}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section id="docs-examples" aria-labelledby="docs-examples-title">
          <h2 id="docs-examples-title" tabIndex={-1}>Examples</h2>
          <ul className="docs-variants">
            {family.examples.map((example) => (
              <li key={example.id}>
                <div><h3>{example.title}</h3><p>{example.label}</p></div>
                <div className="docs-variant-actions">
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'preview')} aria-label={`Preview ${example.title}`}>Preview</Button>
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'code')} aria-label={`View code for ${example.title}`}>Code</Button>
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'notes')} aria-label={`Notes for ${example.title}`}>Notes</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  )
}
