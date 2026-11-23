import { FrameworkProvider } from 'fumadocs-core/framework'
import type { Item, Root } from 'fumadocs-core/page-tree'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { RootProvider } from 'fumadocs-ui/provider/base'
import {
  SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogHeader,
  SearchDialogIcon, SearchDialogInput, SearchDialogList, SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { families, getFamily, groups } from '../catalog'
import { docSections } from './docs-sections'
import './docs-shell.css'

type DocsNavigation = { pageId: string; onNavigate: (pageId: string) => void }
type DocsHeading = { title: string; id: string; depth?: 2 | 3 }
type DocsShellProps = DocsNavigation & {
  title: string
  description?: string
  toc: readonly DocsHeading[]
  children: ReactNode
}

const docsRoutePrefix = '/docs/'
const docsNavigation = createContext<DocsNavigation | null>(null)

function docsPath(pageId: string) {
  return `${docsRoutePrefix}${pageId}`
}

function docsHash(pageId: string) {
  return `#${new URLSearchParams({ docs: pageId })}`
}

function docsItem(id: string, name: string, description?: string): Item {
  return { type: 'page', name, url: docsPath(id), description }
}

const tree: Root = {
  $id: 'pitant-charts',
  name: 'Documentation',
  children: [
    { type: 'separator', name: 'Guides' },
    ...docSections.map(({ id, title, description }) => docsItem(id, title, description)),
    { type: 'separator', name: 'Chart families' },
    ...groups.map((group) => ({
      type: 'folder' as const,
      name: group.name,
      children: group.families.flatMap((id) => {
        const family = getFamily(id)
        return family ? [docsItem(id, family.name)] : []
      }),
    })),
  ],
}

const searchablePages = [
  ...docSections.map(({ id, title, description }) => ({ id, title, description })),
  ...families.map(({ id, name }) => ({ id, title: name, description: '' })),
]
const docsPageIds = new Set(searchablePages.map(({ id }) => id))

function pageIdForPath(path?: string) {
  if (!path?.startsWith(docsRoutePrefix)) return undefined
  const id = path.slice(docsRoutePrefix.length)
  return docsPageIds.has(id) ? id : undefined
}

function useDocsNavigation() {
  const value = use(docsNavigation)
  if (!value) throw new Error('Missing documentation navigation context.')
  return value
}

function useDocsPathname() {
  return docsPath(useDocsNavigation().pageId)
}

function useDocsParams() {
  return { slug: [useDocsNavigation().pageId] }
}

function useDocsRouter() {
  const { onNavigate } = useDocsNavigation()
  return {
    push(path: string) {
      const pageId = pageIdForPath(path)
      if (pageId) onNavigate(pageId)
    },
    refresh() {
      window.location.reload()
    },
  }
}

function DocsLink({ href, onClick, target, download, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) {
  const { onNavigate } = useDocsNavigation()
  const pageId = pageIdForPath(href)

  return <a {...props} href={pageId ? docsHash(pageId) : href} download={download} target={target} onClick={(event) => {
    onClick?.(event)
    if (!pageId || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target && target !== '_self') || download !== undefined) return
    event.preventDefault()
    onNavigate(pageId)
  }} />
}

function DocsSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { pageId } = useDocsNavigation()
  const [search, setSearch] = useState('')
  const navigated = useRef(false)
  const items = useMemo(() => {
    const terms = search.toLowerCase().trim().split(/\s+/)
    return searchablePages.filter(({ id, title, description }) => {
      const text = `${title} ${id} ${description}`.toLowerCase()
      return terms.every((term) => text.includes(term))
    }).slice(0, 12).map(({ id, title }) => ({ id, type: 'page' as const, url: docsPath(id), content: title }))
  }, [search])

  return <SearchDialog
    open={open}
    onOpenChange={(next) => {
      if (!next) setSearch('')
      onOpenChange(next)
    }}
    search={search}
    onSearchChange={setSearch}
    onSelect={(item) => { navigated.current = item.id !== pageId }}
  >
    <SearchDialogOverlay />
    <SearchDialogContent className="pitant-docs-search" onCloseAutoFocus={(event) => {
      if (navigated.current) event.preventDefault()
      navigated.current = false
    }}>
      <SearchDialogHeader>
        <SearchDialogIcon />
        <SearchDialogInput aria-label="Search documentation" />
        <SearchDialogClose />
      </SearchDialogHeader>
      <SearchDialogList items={items} />
    </SearchDialogContent>
  </SearchDialog>
}

function scrollToHeading(id: string, focus: boolean) {
  const target = document.getElementById(id)
  if (!target) return
  if (focus) {
    const heading = target.querySelector<HTMLElement>(':scope > h1, :scope > h2, :scope > h3') ?? target
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
  target.scrollIntoView({ block: 'start' })
}

export function DocsShell({ pageId, title, description, toc, onNavigate, children }: DocsShellProps) {
  const tocItems = useMemo(() => toc.map(({ id, title, depth = 2 }) => ({ title, depth, url: `#${id}` })), [toc])

  useEffect(() => {
    function followSectionLink() {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const section = params.get('section')
      if (params.get('docs') !== pageId || !section || !toc.some(({ id }) => id === section)) return
      scrollToHeading(section, false)
    }
    const frame = window.requestAnimationFrame(followSectionLink)
    window.addEventListener('hashchange', followSectionLink)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', followSectionLink)
    }
  }, [pageId, toc])

  function followHeading(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1) || !(event.target instanceof Element)) return
    const pageLink = event.target.closest('a[href^="#docs="]')
    if (pageLink && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const params = new URLSearchParams(pageLink.getAttribute('href')?.slice(1))
      const destination = params.get('docs')
      if (destination && docsPageIds.has(destination) && !params.has('variant') && !params.has('section')) {
        event.preventDefault()
        onNavigate(destination)
        return
      }
    }

    const anchor = event.target.closest('a[href="#nd-page"], #nd-toc a[href^="#"], [data-toc-popover] a[href^="#"]')
    const id = anchor?.getAttribute('href')?.slice(1)
    if (!id) return
    event.preventDefault()

    if (id === 'nd-page') {
      scrollToHeading('family-docs-title', true)
      return
    }

    const params = new URLSearchParams(window.location.hash.slice(1))
    params.set('docs', pageId)
    params.set('section', id)
    const hash = `#${params}`
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
      window.open(hash, '_blank', 'noopener')
      return
    }
    window.history.replaceState(window.history.state, '', hash)
    scrollToHeading(id, true)
  }

  return <docsNavigation.Provider value={{ pageId, onNavigate }}>
    <FrameworkProvider Link={DocsLink} useParams={useDocsParams} usePathname={useDocsPathname} useRouter={useDocsRouter}>
      <RootProvider theme={{ enabled: false }} search={{ SearchDialog: DocsSearch }}>
        <DocsLayout
          tree={tree}
          tabs={false}
          nav={{ title: 'Documentation', url: docsPath('introduction') }}
          themeSwitch={{ enabled: false }}
          sidebar={{ collapsible: false, prefetch: false, 'aria-label': 'Chart documentation' }}
          containerProps={{ className: 'pitant-docs', onClick: followHeading, onAuxClick: followHeading }}
        >
          <DocsPage toc={tocItems} tableOfContent={{ enabled: tocItems.length > 0, single: true }} aria-labelledby="family-docs-title">
            <header className="pitant-docs-heading">
              <DocsTitle id="family-docs-title" className="pitant-docs-title" tabIndex={-1}>{title}</DocsTitle>
              <DocsDescription className="pitant-docs-description">{description}</DocsDescription>
            </header>
            <DocsBody className="pitant-docs-body">{children}</DocsBody>
          </DocsPage>
        </DocsLayout>
      </RootProvider>
    </FrameworkProvider>
  </docsNavigation.Provider>
}
