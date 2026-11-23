import { useDeferredValue, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@ui-sdk/react/drawer'
import { createInputController, Input } from '@ui-sdk/react/input'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs'
import { Toggle } from '@ui-sdk/react/toggle'
import {
  ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, ChevronLeft, ChevronRight,
  Code2, Grid2X2, List, Menu, Moon, Search, Star, Sun, X,
} from 'lucide-react'
import { examples, galleryOrder, getExample, getFamily, getGroupForFamily, groups } from '../catalog'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample } from '../types'
import { Choices } from '../ui/Choices'
import { ExampleCode, repositoryUrl } from './ExampleCode'
import { FamilyDocumentation } from './FamilyDocumentation'
import { groupIcons } from './Visuals'
import { FamilySelect } from './FamilySelect'
import pitantMark from './brand/pitant-icon.svg'
import pitantWordmark from './brand/pitant-wordmark.svg'
import pitantWordmarkWhite from './brand/pitant-wordmark-white.svg'

const pageSize = 12
const catalogTitle = document.title
const popularFamilies = [
  { id: 'all', label: 'All charts' },
  { id: 'area', label: 'Area' },
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' },
  { id: 'radar', label: 'Radar' },
  { id: 'radial', label: 'Radial' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'tooltip', label: 'Tooltips' },
]
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

type ExampleTab = 'preview' | 'code'
type GalleryLink = { group: string; family: string; example: string; tab: ExampleTab; docs?: string; variant?: string }

function getLinkState(): GalleryLink {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const requestedGroup = params.get('category') ?? 'all'
  const group = groups.some((entry) => entry.id === requestedGroup) ? requestedGroup : 'all'
  const family = getFamily(params.get('family') ?? '')?.id ?? 'all'
  const docs = getFamily(params.get('docs') ?? '')?.id
  const requestedVariant = getExample(params.get('variant') ?? '')
  const variant = requestedVariant && requestedVariant.family === docs ? requestedVariant.id : undefined
  const selectedExample = getExample(params.get('example') ?? '')
  const example = selectedExample && (!docs || docs === selectedExample.family) ? selectedExample.id : ''
  const tab = example && params.get('view') === 'code' ? 'code' : 'preview'
  return { group: family === 'all' ? group : getGroupForFamily(family)?.id ?? 'all', family, example, docs, variant, tab }
}

function writeLink({ group, family, example, tab, docs, variant }: GalleryLink, push = false) {
  const params = new URLSearchParams()
  if (docs) params.set('docs', docs)
  if (variant) params.set('variant', variant)
  if (group !== 'all') params.set('category', group)
  if (family !== 'all') params.set('family', family)
  if (example) {
    params.set('example', example)
    if (tab !== 'preview') params.set('view', tab)
  }
  const target = `${window.location.pathname}${window.location.search}${params.size ? `#${params}` : ''}`
  if (push) history.pushState(null, '', target)
  else history.replaceState(null, '', target)
}

function followLink(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  action()
}

function exampleDocsHref(example: ChartExample) {
  return `#${new URLSearchParams({ docs: example.family, variant: example.id })}`
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
  return <div className="card-plot" ref={host} aria-hidden="true" inert>{visible && <ChartPreview example={example} compact />}</div>
}

function ExampleCard({ example, featured, onDocumentation }: {
  example: ChartExample
  featured: boolean
  onDocumentation: () => void
}) {
  return (
    <div className={featured ? 'example-card example-card--featured' : 'example-card'} data-example-id={example.id}>
      <VisibleChart example={example} />
      <a className="example-card-link" href={exampleDocsHref(example)} aria-label={`Documentation for ${example.title}`} onClick={(event) => followLink(event, onDocumentation)} />
    </div>
  )
}

function Modal({ children, onClose, labelledBy, variant }: { children: ReactNode; onClose: () => void; labelledBy: string; variant: ExampleTab }) {
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
    <dialog ref={dialog} className={`dialog dialog--${variant}`} closedby="any" aria-labelledby={labelledBy} onClose={(event) => { if (!event.currentTarget.open) onClose() }} onClick={(event) => {
      const element = event.currentTarget
      if ('closedBy' in HTMLDialogElement.prototype || event.target !== element) return
      const bounds = element.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) element.close()
    }}>
      <div className="dialog-inner">{children}</div>
    </dialog>
  )
}

function ExampleDetail({ example, tab, onTab, saved, onSave, onClose, onExample, onDocumentation }: {
  example: ChartExample; tab: ExampleTab; onTab: (tab: ExampleTab) => void;
  saved: boolean; onSave: () => void; onClose: () => void; onExample: (id: string) => void; onDocumentation: () => void;
}) {
  const family = getFamily(example.family)
  const list = family?.examples ?? []
  const previous = list[example.position - 2]
  const next = list[example.position]
  return (
    <Modal onClose={onClose} labelledBy="example-detail-title" variant={tab}>
      <div className="detail-header">
        <div><p>{family?.name} <span>·</span> {example.position} of {list.length}</p><h2 id="example-detail-title">{example.title}</h2></div>
        <Button className="icon-button close-button" aria-label="Close preview" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
      </div>
      <Tabs value={tab} activation="manual" onValueChange={(next) => { if (next) onTab(next) }}>
        <div className="detail-toolbar">
          <TabsList className="segmented" aria-label="Example view">
            <TabsTab value="preview"><Grid2X2 size={15} aria-hidden="true" /> Preview</TabsTab>
            <TabsTab value="code"><Code2 size={16} aria-hidden="true" /> Code</TabsTab>
          </TabsList>
          <Toggle className="text-button" aria-label="Save example" pressed={saved} onPressedChange={onSave}><Bookmark size={16} aria-hidden="true" /><span aria-hidden="true">{saved ? 'Saved' : 'Save'}</span></Toggle>
        </div>
        <TabsPanel value="preview"><div className="detail-plot"><ChartPreview key={example.id} example={example} /></div></TabsPanel>
        <TabsPanel value="code"><ExampleCode example={example} /></TabsPanel>
      </Tabs>
      <div className="detail-footer">
        <div className="detail-links">
          <a href={exampleDocsHref(example)} onClick={(event) => followLink(event, onDocumentation)}>Chart documentation <BookOpen size={14} aria-hidden="true" /></a>
        </div>
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
  const openSourceHref = window.location.pathname.endsWith('/charts/') ? '../' : 'https://opensource.pitant.de/'

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
    function normalizeLegacyLink(next: GalleryLink) {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const view = hash.get('view')
      if (hash.has('review') || view === 'compare' || view === 'notes') writeLink(next)
    }
    const change = () => {
      const next = getLinkState()
      normalizeLegacyLink(next)
      setLink(next)
      setShowSaved(false)
      setPage(1)
    }
    normalizeLegacyLink(getLinkState())
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
  const documentedFamily = getFamily(link.docs ?? '')
  useEffect(() => {
    document.title = documentedFamily ? `${documentedFamily.name} | PITANT Charts` : catalogTitle
  }, [documentedFamily])
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
  const showFeature = currentPage === 1 && !query && !showSaved &&
    (!selectedGroup || ['area', 'bar', 'line'].includes(link.family))
  const landingFeature = showFeature && !selectedGroup && layout === 'grid' ? visible[0] : undefined
  const gridExamples = landingFeature ? visible.slice(1) : visible

  function choose(group: string, family = 'all', onlySaved = false) {
    const next: GalleryLink = { group, family, example: '', tab: 'preview' }
    setLink(next)
    setPage(1)
    setShowSaved(onlySaved)
    setNavigationOpen(false)
    writeLink(next, true)
  }

  function showExample(id: string, tab?: ExampleTab) {
    const currentTab = link.example && id ? link.tab : 'preview'
    const next: GalleryLink = { ...link, example: id, tab: tab ?? currentTab }
    setLink(next)
    writeLink(next, !link.example && Boolean(id))
  }

  function browseFamily(id: string) {
    choose(getGroupForFamily(id)?.id ?? 'all', id)
  }

  function browseDocumentedFamily(id: string) {
    searchController.setValue('')
    browseFamily(id)
    requestAnimationFrame(() => {
      results.current?.scrollIntoView({ block: 'start' })
      document.getElementById('catalog-title')?.focus({ preventScroll: true })
    })
  }

  function showDocumentation(family: string, variant?: string) {
    if (link.docs === family && link.variant === variant && !link.example) return
    const next: GalleryLink = { docs: family, variant, group: 'all', family: 'all', example: '', tab: 'preview' }
    setLink(next)
    setShowSaved(false)
    setPage(1)
    setNavigationOpen(false)
    writeLink(next, true)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => document.getElementById('family-docs-title')?.focus({ preventScroll: true }))
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

  function browseCatalog() {
    reset()
    window.scrollTo(0, 0)
  }

  function categoryNavigation() {
    if (documentedFamily) return (
      <nav className="documentation-nav" aria-label="Chart documentation">
        <a className="documentation-entry" href="#" onClick={(event) => followLink(event, browseCatalog)}><ArrowLeft size={15} aria-hidden="true" /> Browse charts</a>
        {groups.map((group) => (
          <div key={group.id}>
            <h2>{group.name}</h2>
            {group.families.map((id) => (
              <a key={id} href={`#docs=${id}`} aria-current={id === link.docs ? 'page' : undefined} onClick={(event) => followLink(event, () => showDocumentation(id))}>
                {getFamily(id)?.name}
              </a>
            ))}
          </div>
        ))}
      </nav>
    )
    return <>
      <nav aria-label="Chart categories">
        <h2>Browse</h2>
        <Button aria-current={link.group === 'all' && !showSaved ? 'page' : undefined} onClick={() => choose('all')}><Grid2X2 size={16} aria-hidden="true" /> <span>All charts</span> <small>{examples.length}</small></Button>
        <a className="documentation-entry" href="#docs=area" onClick={(event) => followLink(event, () => showDocumentation('area'))}><BookOpen size={16} aria-hidden="true" /> <span>Documentation</span></a>
        <Button aria-current={showSaved ? 'page' : undefined} onClick={() => choose('all', 'all', true)}><Bookmark size={16} aria-hidden="true" /> <span>Saved</span> <small>{savedIds.size}</small></Button>
        <h2>Categories</h2>
        {groups.map((group) => {
          const Icon = groupIcons[group.id as keyof typeof groupIcons]
          const active = group.id === link.group
          const count = group.families.reduce((total, id) => total + (getFamily(id)?.examples.length ?? 0), 0)
          return <Button key={group.id} aria-current={active && !showSaved ? 'page' : undefined} onClick={() => choose(group.id)}><Icon size={17} aria-hidden="true" /> <span>{group.name}</span> <small>{count}</small></Button>
        })}
      </nav>
    </>
  }

  return (
    <div className="gallery-app">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>{documentedFamily ? 'Skip to documentation' : 'Skip to chart catalog'}</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Drawer side="start" open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DrawerTrigger className={`icon-button mobile-menu${documentedFamily ? '' : ' catalog-menu'}`} aria-label={documentedFamily ? 'Open chart documentation' : 'Open chart categories'}><Menu size={19} aria-hidden="true" /></DrawerTrigger>
            <DrawerBackdrop className="nav-backdrop" />
            <DrawerContent className="nav-drawer" initialFocus="content">
              <div className="nav-drawer-header"><DrawerTitle>{documentedFamily ? 'Chart documentation' : 'Chart categories'}</DrawerTitle><DrawerClose className="icon-button" aria-label={documentedFamily ? 'Close chart documentation' : 'Close chart categories'}><X size={18} aria-hidden="true" /></DrawerClose></div>
              <div data-drawer-no-drag="">{categoryNavigation()}</div>
            </DrawerContent>
          </Drawer>
          <a href="#" className="brand" aria-label="PITANT Charts home" onClick={(event) => followLink(event, browseCatalog)}>
            <img className="brand-mark" src={pitantMark} alt="" width="23" height="17" />
            <img className="brand-wordmark brand-wordmark-light" src={pitantWordmark} alt="" width="77" height="29" />
            <img className="brand-wordmark brand-wordmark-dark" src={pitantWordmarkWhite} alt="" width="77" height="29" />
            <span className="brand-product">Charts</span>
          </a>
          <nav className="header-nav" aria-label="PITANT Charts sections">
            <a className="header-link" href="#" aria-current={!documentedFamily ? 'page' : undefined} onClick={(event) => followLink(event, browseCatalog)}>Charts</a>
            <a className="header-link" href="#docs=area" aria-current={documentedFamily ? 'page' : undefined} onClick={(event) => followLink(event, () => showDocumentation('area'))}>Documentation</a>
          </nav>
          <nav className="header-actions" aria-label="Project links">
            <a className="header-link" href={openSourceHref} aria-label="PITANT Open Source">
              <ArrowLeft size={15} aria-hidden="true" /> <span className="header-link-text">Open source</span>
            </a>
            <a className="header-link star-link" href={repositoryUrl} aria-label="Star PITANT Charts on GitHub" title="Star PITANT Charts on GitHub">
              <Star size={15} aria-hidden="true" /> <span className="header-link-text">Star on GitHub</span><span className="star-short" aria-hidden="true">Star</span>
            </a>
            <span className="header-rule" />
            <Toggle className="icon-button" aria-label="Dark theme" pressed={theme === 'dark'} onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</Toggle>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {!documentedFamily && !showSaved && <section className={landingFeature ? 'hero hero--featured' : 'hero'} aria-labelledby="page-title">
          <div className="hero-copy">
            <h1 id="page-title">PITANT Charts</h1>
            <p className="hero-intro">Explore {examples.length} interactive React examples for dashboards, time series, maps, and more.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#catalog" onClick={(event) => { event.preventDefault(); results.current?.scrollIntoView({ block: 'start' }); searchField.current?.focus({ preventScroll: true }) }}>Browse charts <ArrowDown size={16} aria-hidden="true" /></a>
              <a className="secondary-button" href="#docs=area" onClick={(event) => followLink(event, () => showDocumentation('area'))}>Documentation <BookOpen size={16} aria-hidden="true" /></a>
            </div>
          </div>
          {landingFeature && <ExampleCard
            example={landingFeature}
            featured
            onDocumentation={() => showDocumentation(landingFeature.family, landingFeature.id)}
          />}
        </section>}
        <div className={documentedFamily ? 'workspace' : 'workspace workspace--catalog'}>
          {documentedFamily && <aside className="sidebar">{categoryNavigation()}</aside>}
          <div className="gallery-main">
            {documentedFamily ? <FamilyDocumentation key={documentedFamily.id} family={documentedFamily} variantId={link.variant} onOpenExample={showExample} onBrowseFamily={browseDocumentedFamily} /> : <>
            {!showSaved && <nav className="family-rail" aria-label="Popular chart families">
              {popularFamilies.map(({ id, label }) => (
                <Button key={id} aria-pressed={id === 'all' ? link.group === 'all' : link.family === id} onClick={() => browseFamily(id)}>
                  {label}
                </Button>
              ))}
            </nav>}
            <section ref={results} id="catalog" className="catalog" aria-labelledby="catalog-title">
              <div className="catalog-heading">
                <div><h2 id="catalog-title" tabIndex={-1}>{showSaved ? 'Saved charts' : selectedFamily?.name ?? selectedGroup?.name ?? 'All charts'}</h2><p aria-live="polite">{filtered.length} {filtered.length === 1 ? 'example' : 'examples'}</p></div>
                <form className="filter-tools" onSubmit={submitSearch}>
                  <div className="search-field"><Search size={17} aria-hidden="true" /><Input controller={searchController} ref={searchField} type="search" aria-label="Search charts" placeholder="Search charts…" value={search} onValueChange={(value) => { setSearch(value); setPage(1) }} />{search ? <Button aria-label="Clear search" onClick={() => { searchController.setValue(''); searchField.current?.focus() }}><X size={15} aria-hidden="true" /></Button> : <kbd aria-hidden="true">/</kbd>}</div>
                  <FamilySelect value={link.family} groups={selectedGroup ? [selectedGroup] : groups} onChange={(id) => choose(id === 'all' ? link.group : getGroupForFamily(id)?.id ?? 'all', id, showSaved)} />
                  <Choices className="segmented layout-toggle" label="Gallery layout" options={layoutChoices} value={layout} onChange={setLayout} />
                </form>
              </div>
              {visible.length ? layout === 'grid' ? (
                <div className="example-grid">
                  {gridExamples.map((example, index) => (
                    <ExampleCard
                      key={example.id}
                      example={example}
                      featured={showFeature && !landingFeature && index === 0}
                      onDocumentation={() => showDocumentation(example.family, example.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="example-list">
                  {visible.map((example) => (
                    <a className="example-list-row" key={example.id} data-example-id={example.id} href={exampleDocsHref(example)} onClick={(event) => followLink(event, () => showDocumentation(example.family, example.id))}>
                      <span>{example.title}</span><small>{getFamily(example.family)?.name}</small><ArrowUpRight size={17} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><span>{showSaved && !query ? <Bookmark size={23} /> : <Search size={23} />}</span><h3>{showSaved && !query && !selectedFamily ? 'No saved charts yet' : 'No matching charts'}</h3><p>{showSaved && !query && !selectedFamily ? 'Save an example to find it here later.' : 'Try another search or clear the filters.'}</p><Button className="text-button" onClick={reset}>Browse all charts <ArrowDownRight size={15} aria-hidden="true" /></Button></div>
              )}
              {pages > 1 && <nav className="pagination" aria-label="Catalog pages"><Button className="text-button" disabled={currentPage <= 1} onClick={() => setResultPage(currentPage - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</Button><span>Page {currentPage} of {pages}</span><Button className="text-button" disabled={currentPage >= pages} onClick={() => setResultPage(currentPage + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></Button></nav>}
            </section>
            </>}
          </div>
        </div>
      </main>
      {detail && <ExampleDetail example={detail} tab={link.tab} onTab={showTab} saved={savedIds.has(detail.id)} onSave={() => toggleSaved(detail.id)} onClose={() => showExample('')} onExample={showExample} onDocumentation={() => showDocumentation(detail.family, detail.id)} />}
    </div>
  )
}
