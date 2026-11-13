import { useDeferredValue, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible'
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@ui-sdk/react/drawer'
import { createInputController, Input } from '@ui-sdk/react/input'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs'
import { Toggle } from '@ui-sdk/react/toggle'
import {
  ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight,
  ClipboardCheck, Columns2, Code2, Copy, ExternalLink, Grid2X2, List, Menu, Moon, Palette, Search, Sun, X,
} from 'lucide-react'
import { examples, galleryOrder, getExample, getFamily, getGroupForFamily, groups } from '../catalog'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample } from '../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Choices } from '../ui/Choices'
import { BrandMark, groupIcons, HeroChart } from './Visuals'
import { FamilySelect } from './FamilySelect'
import { notedCount, ParityOverview, parityNotes } from './ParityOverview'
import type { ParityFilter } from './ParityOverview'
import { comparisonPlot } from './comparison-plot'

const pageSize = 12
const referenceUrl = 'https://www.shadcn.io/charts'
const layoutChoices = [
  { value: 'grid', label: <Grid2X2 size={17} aria-hidden="true" />, ariaLabel: 'Grid view' },
  { value: 'list', label: <List size={18} aria-hidden="true" />, ariaLabel: 'List view' },
] as const

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

type ExampleTab = 'preview' | 'compare' | 'code'
type GalleryLink = { group: string; family: string; example: string; review: ParityFilter | null; tab: ExampleTab }

function getLinkState(): GalleryLink {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const requestedGroup = params.get('category') ?? 'all'
  const group = groups.some((entry) => entry.id === requestedGroup) ? requestedGroup : 'all'
  const family = getFamily(params.get('family') ?? '')?.id ?? 'all'
  const example = getExample(params.get('example') ?? '')?.id ?? ''
  const review = params.get('review')
  const tab = params.get('view')
  return { group: family === 'all' ? group : getGroupForFamily(family)?.id ?? 'all', family, example,
    review: review === 'all' || review === 'documented' || review === 'measured' || review === 'pending' ? review : null,
    tab: example && (tab === 'compare' || tab === 'code') ? tab : 'preview' }
}

function writeLink({ group, family, example, review, tab }: GalleryLink, push = false) {
  const params = new URLSearchParams()
  if (group !== 'all') params.set('category', group)
  if (family !== 'all') params.set('family', family)
  if (example) {
    params.set('example', example)
    if (tab !== 'preview') params.set('view', tab)
  }
  if (review) params.set('review', review)
  const target = `${window.location.pathname}${window.location.search}${params.size ? `#${params}` : ''}`
  if (push) history.pushState(null, '', target)
  else history.replaceState(null, '', target)
}

function VisibleChart({ example }: { example: ChartExample }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!host.current) return
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    }, { rootMargin: '220px' })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  return <div className="card-plot" ref={host}>{visible && <ChartPreview example={example} compact />}</div>
}

function ExampleCard({ example, saved, review, onOpen, onSave }: { example: ChartExample; saved: boolean; review: boolean; onOpen: () => void; onSave: () => void }) {
  const family = getFamily(example.family)
  return (
    <Card className="example-card" data-example-id={example.id}>
      <CardHeader className="example-header">
        <div className="example-heading">
          <CardTitle><Button className="example-title" aria-label={`Open ${example.title}`} onClick={onOpen}>{example.title}</Button></CardTitle>
          <CardDescription>{family?.name}</CardDescription>
        </div>
        <Toggle className="icon-button bookmark-button" aria-label={`Save ${example.title}`} pressed={saved} onPressedChange={onSave}><Bookmark size={17} aria-hidden="true" /></Toggle>
      </CardHeader>
      <CardContent><VisibleChart example={example} /></CardContent>
      <div className="example-footer">
        <span>{example.label}</span>
        {review && <small className="example-review-state">{parityNotes[example.id] ? 'Notes available' : 'Awaiting notes'}</small>}
      </div>
    </Card>
  )
}

function Modal({ children, onClose, labelledBy, wide }: { children: ReactNode; onClose: () => void; labelledBy: string; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!element.open) element.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (element.open) element.close()
      document.body.style.overflow = previous
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog ref={dialog} className={`dialog${wide ? ' dialog--wide' : ''}`} closedby="any" aria-labelledby={labelledBy} onClose={(event) => { if (!event.currentTarget.open) onClose() }} onClick={(event) => {
      const element = event.currentTarget
      if ('closedBy' in HTMLDialogElement.prototype || event.target !== element) return
      const bounds = element.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) element.close()
    }}>
      <div className="dialog-inner">{children}</div>
    </dialog>
  )
}

function ReferenceComparison({ example, theme }: { example: ChartExample; theme: 'light' | 'dark' }) {
  const [matchReference, setMatchReference] = usePreference('chart-library:compare-reference-colors', true)
  const params = new URLSearchParams({ c: example.id, theme })
  const note = parityNotes[example.id]
  const plotLayout = comparisonPlot(example)
  return (
    <>
      <div className="comparison-options">
        <Toggle className="text-button comparison-palette-toggle" pressed={matchReference} onPressedChange={setMatchReference}>
          <Palette size={15} aria-hidden="true" /> Match reference styling
        </Toggle>
      </div>
      <div className="comparison">
        <section aria-labelledby="comparison-local">
          <h3 id="comparison-local">Library</h3>
          <div className={matchReference ? 'detail-plot comparison-reference-colors' : 'detail-plot'} data-theme={matchReference ? theme : undefined}>
            {plotLayout ? <div className="comparison-measured" data-plot-layout={plotLayout} data-plot-id={example.id}>
              <ChartPreview key={example.id} example={example} />
            </div> : <ChartPreview key={example.id} example={example} />}
          </div>
        </section>
        <section aria-labelledby="comparison-reference">
          <h3 id="comparison-reference">shadcn.io reference</h3>
          <iframe className="comparison-frame" title={`Reference preview of ${example.title}`} src={`https://www.shadcn.io/charts-preview/react/index.html?${params}`} referrerPolicy="no-referrer" />
        </section>
      </div>
      <Collapsible className="comparison-notes">
        <CollapsibleTrigger>Parity notes</CollapsibleTrigger>
        <CollapsiblePanel>{note ? <><p>{note.checked}</p><p>{note.remaining}</p></> : <p>The live reference is available for comparison. A feature-by-feature check is pending.</p>}</CollapsiblePanel>
      </Collapsible>
    </>
  )
}

function ExampleDetail({ example, theme, tab, onTab, saved, onSave, onClose, onExample }: { example: ChartExample; theme: 'light' | 'dark'; tab: ExampleTab; onTab: (tab: ExampleTab) => void; saved: boolean; onSave: () => void; onClose: () => void; onExample: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const family = getFamily(example.family)
  const list = family?.examples ?? []
  const previous = list[example.position - 2]
  const next = list[example.position]
  const snippet = `import { ChartPreview, getExample } from '@pitant/chart-catalog'\nimport '@pitant/chart-catalog/styles.css'\n\nexport function Example() {\n  const example = getExample('${example.id}')\n  if (!example) return null\n\n  return (\n    <div style={{ height: 320 }}>\n      <ChartPreview example={example} />\n    </div>\n  )\n}`
  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  return (
    <Modal onClose={onClose} labelledBy="example-detail-title" wide={tab === 'compare'}>
      <div className="detail-header">
        <div><p>{family?.name} <span>·</span> {example.position} of {list.length}</p><h2 id="example-detail-title">{example.title}</h2></div>
        <Button className="icon-button close-button" aria-label="Close preview" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
      </div>
      <Tabs value={tab} activation="manual" onValueChange={(next) => { if (next) onTab(next) }}>
        <div className="detail-toolbar">
          <TabsList className="segmented" aria-label="Example view">
            <TabsTab value="preview"><Grid2X2 size={15} aria-hidden="true" /> Preview</TabsTab>
            <TabsTab value="compare"><Columns2 size={15} aria-hidden="true" /> Compare</TabsTab>
            <TabsTab value="code"><Code2 size={16} aria-hidden="true" /> Code</TabsTab>
          </TabsList>
          <Toggle className="text-button" aria-label="Save example" pressed={saved} onPressedChange={onSave}><Bookmark size={16} aria-hidden="true" /><span aria-hidden="true">{saved ? 'Saved' : 'Save'}</span></Toggle>
        </div>
        <TabsPanel value="preview"><div className="detail-plot"><ChartPreview key={example.id} example={example} /></div></TabsPanel>
        <TabsPanel value="compare"><ReferenceComparison example={example} theme={theme} /></TabsPanel>
        <TabsPanel value="code"><div className="snippet">
          <div className="snippet-header"><span>React</span><Button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true) } catch { setCopied(false) } }}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? 'Copied' : 'Copy code'}</Button></div>
          <pre><code>{snippet}</code></pre>
        </div></TabsPanel>
      </Tabs>
      <div className="detail-footer">
        <a href={example.url} target="_blank" rel="noreferrer">Reference preview <ExternalLink size={14} /></a>
        <div className="detail-pagination">
          <Button className="icon-button" disabled={!previous} aria-label="Previous variant" onClick={() => previous && onExample(previous.id)}><ChevronLeft size={19} aria-hidden="true" /></Button>
          <Button className="icon-button" disabled={!next} aria-label="Next variant" onClick={() => next && onExample(next.id)}><ChevronRight size={19} aria-hidden="true" /></Button>
        </div>
      </div>
    </Modal>
  )
}

export function Gallery() {
  const [link, setLink] = useState<GalleryLink>(getLinkState)
  const [saved, setSaved] = usePreference<string[]>('chart-library:saved', [])
  const [theme, setTheme] = usePreference<'light' | 'dark'>('chart-library:theme', 'light')
  const [layout, setLayout] = usePreference<'grid' | 'list'>('chart-library:layout', 'grid')
  const [search, setSearch] = useState('')
  const [searchController] = useState(createInputController)
  const query = useDeferredValue(search.trim().toLowerCase())
  const [showSaved, setShowSaved] = useState(false)
  const [page, setPage] = useState(1)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const searchField = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff')
  }, [theme])
  useEffect(() => {
    const desktop = matchMedia('(min-width: 851px)')
    const close = () => { if (desktop.matches) setNavigationOpen(false) }
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [])
  useEffect(() => {
    const change = () => { setLink(getLinkState()); setShowSaved(false); setPage(1) }
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      if (event.key === '/' && !event.altKey && !event.metaKey && !event.ctrlKey && !document.querySelector('dialog[open], [data-slot="drawer-content"][data-open]')) {
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
    if (link.review === 'documented' && !parityNotes[example.id]) return false
    if (link.review === 'measured' && !comparisonPlot(example)) return false
    if (link.review === 'pending' && parityNotes[example.id]) return false
    const note = link.review ? parityNotes[example.id] : undefined
    const searchable = `${example.title} ${example.label} ${example.id} ${getFamily(example.family)?.name} ${note?.checked ?? ''} ${note?.remaining ?? ''}`.toLowerCase()
    return query.split(/\s+/).every((word) => searchable.includes(word))
  })
  const pages = Math.ceil(filtered.length / pageSize)
  const currentPage = Math.min(page, Math.max(1, pages))
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function choose(group: string, family = 'all', onlySaved = false, review: ParityFilter | null = null) {
    const next: GalleryLink = { group, family, example: '', review, tab: 'preview' }
    setLink(next)
    setPage(1)
    setShowSaved(onlySaved)
    setNavigationOpen(false)
    writeLink(next, true)
  }

  function showExample(id: string) {
    const next: GalleryLink = { ...link, example: id, tab: link.example && id ? link.tab : 'preview' }
    setLink(next)
    writeLink(next, !link.example && Boolean(id))
  }

  function showTab(tab: ExampleTab) {
    const next = { ...link, tab }
    setLink(next)
    writeLink(next)
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
    searchController.setValue('')
    choose('all')
  }

  function categoryNavigation() {
    return <>
      <nav aria-label="Chart categories">
        <h2>Browse</h2>
        <Button aria-current={link.group === 'all' && !showSaved && !link.review ? 'page' : undefined} onClick={() => choose('all')}><Grid2X2 size={16} aria-hidden="true" /> <span>All charts</span> <small>{examples.length}</small></Button>
        <Button aria-current={showSaved ? 'page' : undefined} onClick={() => choose('all', 'all', true)}><Bookmark size={16} aria-hidden="true" /> <span>Saved</span> <small>{savedIds.size}</small></Button>
        <Button aria-current={link.review ? 'page' : undefined} onClick={() => choose('all', 'all', false, 'all')}><ClipboardCheck size={16} aria-hidden="true" /> <span>Parity review</span> <small>{notedCount}</small></Button>
        <h2>Categories</h2>
        {groups.map((group) => {
          const Icon = groupIcons[group.id as keyof typeof groupIcons]
          const active = group.id === link.group
          const count = group.families.reduce((total, id) => total + (getFamily(id)?.examples.length ?? 0), 0)
          return <Button key={group.id} aria-current={active && !showSaved && !link.review ? 'page' : undefined} onClick={() => choose(group.id)}><Icon size={17} aria-hidden="true" /> <span>{group.name}</span> <small>{count}</small></Button>
        })}
      </nav>
      <a href={referenceUrl} target="_blank" rel="noreferrer" className="sidebar-reference">Reference gallery <ExternalLink size={13} aria-hidden="true" /></a>
    </>
  }

  return (
    <div className="gallery-app">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to chart catalog</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Drawer side="start" open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DrawerTrigger className="icon-button mobile-menu" aria-label="Open chart categories"><Menu size={21} aria-hidden="true" /></DrawerTrigger>
            <DrawerBackdrop className="nav-backdrop" />
            <DrawerContent className="nav-drawer" initialFocus="content">
              <div className="nav-drawer-header"><DrawerTitle>Chart categories</DrawerTitle><DrawerClose className="icon-button" aria-label="Close chart categories"><X size={18} aria-hidden="true" /></DrawerClose></div>
              <div data-drawer-no-drag="">{categoryNavigation()}</div>
            </DrawerContent>
          </Drawer>
          <a href="#" className="brand" onClick={(event) => { event.preventDefault(); reset(); window.scrollTo(0, 0) }}><BrandMark /><span>Chart Library</span></a>
          <div className="header-actions">
            <a className="header-link" href="#review=all" onClick={(event) => { event.preventDefault(); choose('all', 'all', false, 'all'); window.scrollTo(0, 0) }}>Component index <ArrowRight size={14} /></a>
            <span className="header-rule" />
            <Toggle className="icon-button" aria-label="Dark theme" pressed={theme === 'dark'} onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</Toggle>
          </div>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">{categoryNavigation()}</aside>
        <main className="gallery-main" id="main-content" tabIndex={-1}>
          {link.review ? <ParityOverview filter={link.review} onFilter={(filter) => choose(link.group, link.family, false, filter)} onFamily={(group, family) => { choose(group, family, false, link.review); results.current?.scrollIntoView({ block: 'start' }) }} /> : <section className="hero" aria-labelledby="page-title">
            <div className="hero-copy">
              <p className="hero-eyebrow"><span /> REACT COMPONENTS</p>
              <h1 id="page-title">Chart library</h1>
              <p className="hero-intro">Explore 331 variations across 44 chart families and tooltips.</p>
              <a className="primary-button" href="#catalog" onClick={(event) => { event.preventDefault(); results.current?.scrollIntoView({ block: 'start' }); searchField.current?.focus({ preventScroll: true }) }}>Browse charts <ArrowDown size={16} /></a>
            </div>
            <HeroChart />
          </section>}
          <section ref={results} id="catalog" className="catalog" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <div><h2 id="catalog-title">{showSaved ? 'Saved charts' : selectedFamily?.name ?? selectedGroup?.name ?? (link.review === 'documented' ? 'Variants with notes' : link.review === 'measured' ? 'Variants with measured plot sizing' : link.review === 'pending' ? 'Variants awaiting notes' : 'All charts')}</h2><p aria-live="polite">{filtered.length} {filtered.length === 1 ? 'example' : 'examples'}</p></div>
              <form className="filter-tools" onSubmit={submitSearch}>
                <div className="search-field"><Search size={17} aria-hidden="true" /><Input controller={searchController} ref={searchField} type="search" aria-label="Search charts" placeholder={link.review ? 'Search charts and notes…' : 'Search charts…'} value={search} onValueChange={(value) => { setSearch(value); setPage(1) }} />{search ? <Button aria-label="Clear search" onClick={() => { searchController.setValue(''); searchField.current?.focus() }}><X size={15} aria-hidden="true" /></Button> : <kbd aria-hidden="true">/</kbd>}</div>
                <FamilySelect value={link.family} groups={selectedGroup && !link.review ? [selectedGroup] : groups} onChange={(id) => choose(id === 'all' ? link.review ? 'all' : link.group : getGroupForFamily(id)?.id ?? 'all', id, showSaved, link.review)} />
                <Choices className="segmented layout-toggle" label="Gallery layout" options={layoutChoices} value={layout} onChange={setLayout} />
              </form>
            </div>
            {visible.length ? layout === 'grid' ? (
              <div className="example-grid">{visible.map((example) => <ExampleCard key={example.id} example={example} saved={savedIds.has(example.id)} review={Boolean(link.review)} onOpen={() => showExample(example.id)} onSave={() => toggleSaved(example.id)} />)}</div>
            ) : (
              <div className="example-list">{visible.map((example) => <div className="example-list-row" key={example.id} data-example-id={example.id}><Button className="list-main" aria-label={`Open ${example.title}`} onClick={() => showExample(example.id)}><span>{example.title}</span><small>{getFamily(example.family)?.name}</small><ArrowUpRight size={17} aria-hidden="true" /></Button><Toggle className="icon-button bookmark-button" aria-label={`Save ${example.title}`} pressed={savedIds.has(example.id)} onPressedChange={() => toggleSaved(example.id)}><Bookmark size={17} aria-hidden="true" /></Toggle></div>)}</div>
            ) : (
              <div className="empty-state"><span>{showSaved && !query ? <Bookmark size={23} /> : <Search size={23} />}</span><h3>{showSaved && !query && !selectedFamily ? 'No saved charts yet' : 'No matching charts'}</h3><p>{showSaved && !query && !selectedFamily ? 'Save an example to find it here later.' : 'Try another search or clear the filters.'}</p><Button className="text-button" onClick={reset}>Browse all charts <ArrowDownRight size={15} aria-hidden="true" /></Button></div>
            )}
            {pages > 1 && <nav className="pagination" aria-label="Catalog pages"><Button className="text-button" disabled={currentPage <= 1} onClick={() => setResultPage(currentPage - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</Button><span>Page {currentPage} of {pages}</span><Button className="text-button" disabled={currentPage >= pages} onClick={() => setResultPage(currentPage + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></Button></nav>}
          </section>
        </main>
      </div>
      {detail && <ExampleDetail example={detail} theme={theme} tab={link.tab} onTab={showTab} saved={savedIds.has(detail.id)} onSave={() => toggleSaved(detail.id)} onClose={() => showExample('')} onExample={showExample} />}
    </div>
  )
}
