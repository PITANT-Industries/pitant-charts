import { useDeferredValue, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight,
  Columns2, Code2, Copy, ExternalLink, Grid2X2, List, Menu, Moon, Search, Sun, X,
} from 'lucide-react'
import { examples, galleryOrder, getExample, getFamily, getGroupForFamily, groups } from '../catalog'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample } from '../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { BrandMark, groupIcons, HeroChart } from './Visuals'
import parityNotes from './parity-notes.json'

const pageSize = 12
const referenceUrl = 'https://www.shadcn.io/charts'
const indexUrl = 'https://chatgpt.com/space/page_158565692cf88191bb821bf62112a8d1'

function usePreference<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw) as T
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
  }, [key, value])
  return [value, setValue] as const
}

function getLinkState() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const requestedGroup = params.get('category') ?? 'all'
  const group = groups.some((entry) => entry.id === requestedGroup) ? requestedGroup : 'all'
  const family = getFamily(params.get('family') ?? '')?.id ?? 'all'
  const example = getExample(params.get('example') ?? '')?.id ?? ''
  return { group: family === 'all' ? group : getGroupForFamily(family)?.id ?? 'all', family, example }
}

function writeLink(group: string, family: string, example = '', push = false) {
  const params = new URLSearchParams()
  if (group !== 'all') params.set('category', group)
  if (family !== 'all') params.set('family', family)
  if (example) params.set('example', example)
  const target = `${window.location.pathname}${window.location.search}${params.size ? `#${params}` : ''}`
  if (push) history.pushState(null, '', target)
  else history.replaceState(null, '', target)
}

function VisibleChart({ example }: { example: ChartExample }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!host.current) return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    }, { rootMargin: '220px' })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  return <div className="card-plot" ref={host}>{visible ? <ChartPreview example={example} compact /> : <div className="card-plot-placeholder" />}</div>
}

function ExampleCard({ example, saved, onOpen, onSave }: { example: ChartExample; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const family = getFamily(example.family)
  return (
    <Card className="example-card" data-example-id={example.id}>
      <CardHeader className="example-header">
        <div className="example-heading">
          <CardTitle><button type="button" className="example-title" onClick={onOpen}>{example.title}</button></CardTitle>
          <CardDescription>{family?.name}</CardDescription>
        </div>
        <button type="button" className={`icon-button bookmark-button${saved ? ' is-saved' : ''}`} aria-label={saved ? `Unsave ${example.title}` : `Save ${example.title}`} aria-pressed={saved} onClick={onSave}><Bookmark size={17} /></button>
      </CardHeader>
      <CardContent><VisibleChart example={example} /></CardContent>
      <div className="example-footer">
        <span>{example.label}</span>
        <button type="button" aria-label={`Open ${example.title}`} onClick={onOpen}><ArrowUpRight size={16} /></button>
      </div>
    </Card>
  )
}

function Modal({ children, onClose, labelledBy, wide }: { children: ReactNode; onClose: () => void; labelledBy: string; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return (
    <dialog ref={dialog} className={`dialog${wide ? ' dialog--wide' : ''}`} aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dialog-inner">{children}</div>
    </dialog>
  )
}

function ReferenceComparison({ example, theme }: { example: ChartExample; theme: 'light' | 'dark' }) {
  const params = new URLSearchParams({ c: example.id, theme })
  const note = (parityNotes as Record<string, { checked: string; remaining?: string }>)[example.id]
  return (
    <>
      <div className="comparison">
        <section aria-labelledby="comparison-local">
          <h3 id="comparison-local">Library</h3>
          <div className="detail-plot"><ChartPreview key={example.id} example={example} /></div>
        </section>
        <section aria-labelledby="comparison-reference">
          <h3 id="comparison-reference">shadcn.io reference</h3>
          <iframe className="comparison-frame" title={`Reference preview of ${example.title}`} src={`https://www.shadcn.io/charts-preview/react/index.html?${params}`} referrerPolicy="no-referrer" />
        </section>
      </div>
      <details className="comparison-notes">
        <summary>Parity notes</summary>
        {note ? <><p>{note.checked}</p>{note.remaining && <p>{note.remaining}</p>}</> : <p>The live reference is available for comparison. A feature-by-feature check is pending.</p>}
      </details>
    </>
  )
}

function ExampleDetail({ example, theme, saved, onSave, onClose, onExample }: { example: ChartExample; theme: 'light' | 'dark'; saved: boolean; onSave: () => void; onClose: () => void; onExample: (id: string) => void }) {
  const [tab, setTab] = useState<'preview' | 'compare' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  const family = getFamily(example.family)
  const list = family?.examples ?? []
  const previous = list[example.position - 2]
  const next = list[example.position]
  const snippet = `import { ChartPreview, getExample } from 'chart-library'\nimport 'chart-library/styles.css'\n\nexport function Example() {\n  const example = getExample('${example.id}')\n  if (!example) return null\n\n  return (\n    <div style={{ height: 320 }}>\n      <ChartPreview example={example} />\n    </div>\n  )\n}`
  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  return (
    <Modal onClose={onClose} labelledBy="example-detail-title" wide={tab === 'compare'}>
      <div className="detail-header">
        <div><p>{family?.name} <span>·</span> {example.position} of {list.length}</p><h2 id="example-detail-title">{example.title}</h2></div>
        <button className="icon-button close-button" type="button" aria-label="Close preview" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="detail-toolbar">
        <div className="segmented" aria-label="Example view">
          <button type="button" aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}><Grid2X2 size={15} /> Preview</button>
          <button type="button" aria-pressed={tab === 'compare'} onClick={() => setTab('compare')}><Columns2 size={15} /> Compare</button>
          <button type="button" aria-pressed={tab === 'code'} onClick={() => setTab('code')}><Code2 size={16} /> Code</button>
        </div>
        <button type="button" className={`text-button${saved ? ' is-saved' : ''}`} aria-pressed={saved} onClick={onSave}><Bookmark size={16} />{saved ? 'Saved' : 'Save'}</button>
      </div>
      {tab === 'preview' ? <div className="detail-plot"><ChartPreview key={example.id} example={example} /></div> : tab === 'compare' ? <ReferenceComparison example={example} theme={theme} /> : (
        <div className="snippet">
          <div className="snippet-header"><span>React</span><button className="text-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true) } catch { setCopied(false) } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy code'}</button></div>
          <pre><code>{snippet}</code></pre>
        </div>
      )}
      <div className="detail-footer">
        <a href={example.url} target="_blank" rel="noreferrer">Reference preview <ExternalLink size={14} /></a>
        <div className="detail-pagination">
          <button type="button" className="icon-button" disabled={!previous} aria-label="Previous variant" onClick={() => previous && onExample(previous.id)}><ChevronLeft size={19} /></button>
          <button type="button" className="icon-button" disabled={!next} aria-label="Next variant" onClick={() => next && onExample(next.id)}><ChevronRight size={19} /></button>
        </div>
      </div>
    </Modal>
  )
}

export function Gallery() {
  const [link, setLink] = useState(getLinkState)
  const [saved, setSaved] = usePreference<string[]>('chart-library:saved', [])
  const [theme, setTheme] = usePreference<'light' | 'dark'>('chart-library:theme', 'light')
  const [layout, setLayout] = usePreference<'grid' | 'list'>('chart-library:layout', 'grid')
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim().toLowerCase())
  const [showSaved, setShowSaved] = useState(false)
  const [page, setPage] = useState(1)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const searchField = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLElement>(null)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const change = () => { setLink(getLinkState()); setPage(1) }
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      if (event.key === '/' && !event.altKey && !event.metaKey && !event.ctrlKey && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        searchField.current?.focus()
      }
    }
    window.addEventListener('hashchange', change)
    window.addEventListener('popstate', change)
    window.addEventListener('keydown', keyboard)
    return () => {
      window.removeEventListener('hashchange', change)
      window.removeEventListener('popstate', change)
      window.removeEventListener('keydown', keyboard)
    }
  }, [])

  const savedIds = new Set(Array.isArray(saved) ? saved : [])
  const selectedGroup = groups.find((group) => group.id === link.group)
  const selectedFamily = getFamily(link.family)
  const detail = getExample(link.example)
  const available = selectedFamily ? selectedFamily.examples : galleryOrder
  const filtered = available.filter((example) => {
    if (selectedGroup && !selectedGroup.families.includes(example.family)) return false
    if (showSaved && !savedIds.has(example.id)) return false
    const searchable = `${example.title} ${example.label} ${example.id} ${getFamily(example.family)?.name}`.toLowerCase()
    return query.split(/\s+/).every((word) => searchable.includes(word))
  })
  const pages = Math.ceil(filtered.length / pageSize)
  const currentPage = Math.min(page, Math.max(1, pages))
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function choose(group: string, family = 'all', onlySaved = false) {
    setLink({ group, family, example: '' })
    setPage(1)
    setShowSaved(onlySaved)
    setNavigationOpen(false)
    writeLink(group, family, '', true)
  }

  function showExample(id: string) {
    setLink((previous) => ({ ...previous, example: id }))
    writeLink(link.group, link.family, id, !link.example && Boolean(id))
  }

  function toggleSaved(id: string) {
    setSaved((previous) => {
      const list = Array.isArray(previous) ? previous : []
      return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
    })
  }

  function setResultPage(next: number) {
    setPage(next)
    results.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    results.current?.scrollIntoView({ block: 'start' })
  }

  function reset() {
    setSearch('')
    choose('all')
  }

  return (
    <div className="gallery-app">
      <header className="site-header">
        <div className="site-header-inner">
          <button type="button" className="icon-button mobile-menu" aria-label="Toggle categories" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(!navigationOpen)}><Menu size={21} /></button>
          <a href="#" className="brand" onClick={(event) => { event.preventDefault(); reset(); window.scrollTo(0, 0) }}><BrandMark /><span>Chart Library</span></a>
          <div className="header-actions">
            <a className="header-link" href={indexUrl} target="_blank" rel="noreferrer">Component index <ArrowUpRight size={14} /></a>
            <span className="header-rule" />
            <button type="button" className="icon-button" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={18} />}</button>
          </div>
        </div>
      </header>
      <div className="workspace">
        {navigationOpen && <button type="button" className="nav-backdrop" aria-label="Close categories" onClick={() => setNavigationOpen(false)} />}
        <aside className={`sidebar${navigationOpen ? ' sidebar--open' : ''}`}>
          <nav aria-label="Chart categories">
            <h2>Browse</h2>
            <button type="button" aria-current={link.group === 'all' && !showSaved ? 'page' : undefined} onClick={() => choose('all')}><Grid2X2 size={16} /> <span>All charts</span> <small>{examples.length}</small></button>
            <button type="button" aria-current={showSaved ? 'page' : undefined} onClick={() => choose('all', 'all', true)}><Bookmark size={16} /> <span>Saved</span> <small>{savedIds.size}</small></button>
            <h2>Categories</h2>
            {groups.map((group) => {
              const Icon = groupIcons[group.id as keyof typeof groupIcons]
              const active = group.id === link.group
              const count = group.families.reduce((total, id) => total + (getFamily(id)?.examples.length ?? 0), 0)
              return <button type="button" key={group.id} aria-current={active && !showSaved ? 'page' : undefined} onClick={() => choose(group.id)}><Icon size={17} /> <span>{group.name}</span> <small>{count}</small></button>
            })}
          </nav>
          <a href={referenceUrl} target="_blank" rel="noreferrer" className="sidebar-reference">Reference gallery <ExternalLink size={13} /></a>
        </aside>
        <main className="gallery-main" id="main-content">
          <section className="hero" aria-labelledby="page-title">
            <div className="hero-copy">
              <p className="hero-eyebrow"><span /> REACT COMPONENTS</p>
              <h1 id="page-title">Chart library</h1>
              <p className="hero-intro">Explore 331 variations across 44 chart families and tooltips.</p>
              <a className="primary-button" href="#catalog" onClick={(event) => { event.preventDefault(); results.current?.scrollIntoView({ block: 'start' }); searchField.current?.focus({ preventScroll: true }) }}>Browse charts <ArrowDown size={16} /></a>
            </div>
            <HeroChart />
          </section>
          <section ref={results} id="catalog" className="catalog" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <div><h2 id="catalog-title">{showSaved ? 'Saved charts' : selectedFamily?.name ?? selectedGroup?.name ?? 'All charts'}</h2><p aria-live="polite">{filtered.length} {filtered.length === 1 ? 'example' : 'examples'}</p></div>
              <form className="filter-tools" onSubmit={submitSearch}>
                <label className="search-field"><Search size={17} /><input ref={searchField} type="search" aria-label="Search charts" placeholder="Search charts…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />{search ? <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1); searchField.current?.focus() }}><X size={15} /></button> : <kbd>/</kbd>}</label>
                <div className="family-filter"><select aria-label="Chart family" value={link.family} onChange={(event) => { const id = event.target.value; choose(id === 'all' ? link.group : getGroupForFamily(id)?.id ?? 'all', id, showSaved) }}><option value="all">All families</option>{(selectedGroup ? [selectedGroup] : groups).map((group) => <optgroup key={group.id} label={group.name}>{group.families.map((id) => <option value={id} key={id}>{getFamily(id)?.name}</option>)}</optgroup>)}</select><ChevronDown size={14} /></div>
                <div className="segmented layout-toggle" aria-label="Gallery layout"><button type="button" aria-label="Grid view" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Grid2X2 size={17} /></button><button type="button" aria-label="List view" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={18} /></button></div>
              </form>
            </div>
            {visible.length ? layout === 'grid' ? (
              <div className="example-grid">{visible.map((example) => <ExampleCard key={example.id} example={example} saved={savedIds.has(example.id)} onOpen={() => showExample(example.id)} onSave={() => toggleSaved(example.id)} />)}</div>
            ) : (
              <div className="example-list">{visible.map((example) => <div className="example-list-row" key={example.id} data-example-id={example.id}><button type="button" className="list-main" onClick={() => showExample(example.id)}><span>{example.title}</span><small>{getFamily(example.family)?.name}</small><ArrowUpRight size={17} /></button><button type="button" className={`icon-button bookmark-button${savedIds.has(example.id) ? ' is-saved' : ''}`} aria-label={savedIds.has(example.id) ? `Unsave ${example.title}` : `Save ${example.title}`} aria-pressed={savedIds.has(example.id)} onClick={() => toggleSaved(example.id)}><Bookmark size={17} /></button></div>)}</div>
            ) : (
              <div className="empty-state"><span>{showSaved && !query ? <Bookmark size={23} /> : <Search size={23} />}</span><h3>{showSaved && !query && !selectedFamily ? 'No saved charts yet' : 'No matching charts'}</h3><p>{showSaved && !query && !selectedFamily ? 'Save an example to find it here later.' : 'Try another search or clear the filters.'}</p><button className="text-button" type="button" onClick={reset}>Browse all charts <ArrowDownRight size={15} /></button></div>
            )}
            {pages > 1 && <nav className="pagination" aria-label="Catalog pages"><button type="button" className="text-button" disabled={currentPage <= 1} onClick={() => setResultPage(currentPage - 1)}><ArrowLeft size={15} /> Previous</button><span>Page {currentPage} of {pages}</span><button type="button" className="text-button" disabled={currentPage >= pages} onClick={() => setResultPage(currentPage + 1)}>Next <ArrowRight size={15} /></button></nav>}
          </section>
        </main>
      </div>
      {detail && <ExampleDetail example={detail} theme={theme} saved={savedIds.has(detail.id)} onSave={() => toggleSaved(detail.id)} onClose={() => showExample('')} onExample={showExample} />}
    </div>
  )
}
