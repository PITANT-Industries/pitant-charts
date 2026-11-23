import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Check, Copy } from 'lucide-react'
import type { ChartExample } from '../types'

export const repositoryUrl = 'https://github.com/PITANT-Industries/pitant-charts'
export const guideUrl = `${repositoryUrl}/blob/main/apps/chart-catalog/README.md#use-the-react-library`

function exampleSnippet(example: ChartExample) {
  return `import { ChartPreview, getExample } from '@pitant/chart-catalog'
import '@pitant/chart-catalog/styles.css'

export function Example() {
  const example = getExample('${example.id}')
  if (!example) return null

  return (
    <div style={{ height: 320 }}>
      <ChartPreview example={example} />
    </div>
  )
}`
}

async function copyText(source: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(source)
      return true
    } catch { /* Clipboard permissions can vary by browser. */ }
  }

  // The catalog can be served over HTTP, where the Clipboard API is unavailable.
  const field = document.createElement('textarea')
  field.className = 'clipboard-field'
  field.value = source
  field.readOnly = true
  field.tabIndex = -1
  field.setAttribute('aria-hidden', 'true')
  const previousFocus = document.activeElement
  const selection = document.getSelection()
  const previousRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined
  const host = document.querySelector('dialog[open]') ?? document.body
  host.append(field)
  try {
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    if (selection && previousRange) {
      selection.removeAllRanges()
      selection.addRange(previousRange)
    }
  }
}

function CopyButton({ source, label, compact, onUnavailable }: {
  source: string
  label?: string
  compact?: boolean
  onUnavailable: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  return <>
    <Button className={compact ? 'card-code card-copy' : 'text-button'} aria-label={label} title={compact ? 'Copy code' : undefined} onClick={async () => {
      if (await copyText(source)) setCopied(true)
      else onUnavailable()
    }}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {!compact && (copied ? 'Copied' : 'Copy code')}
    </Button>
    <span className="clipboard-status" role="status">{copied ? 'Code copied' : ''}</span>
  </>
}

export function CopyExample({ example, onShowCode }: { example: ChartExample; onShowCode: () => void }) {
  return <CopyButton source={exampleSnippet(example)} label={`Copy code for ${example.title}`} compact onUnavailable={onShowCode} />
}

export function CodeBlock({ language, source, note }: { language: string; source: string; note?: ReactNode }) {
  const [selected, setSelected] = useState(false)
  const code = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!selected) return
    const timeout = window.setTimeout(() => setSelected(false), 6000)
    return () => window.clearTimeout(timeout)
  }, [selected])

  function selectCode() {
    const selection = window.getSelection()
    if (!selection || !code.current) return
    const range = document.createRange()
    range.selectNodeContents(code.current)
    selection.removeAllRanges()
    selection.addRange(range)
    setSelected(true)
  }

  return (
    <div className="snippet">
      <div className="snippet-header">
        <span>{language}</span>
        <CopyButton source={source} onUnavailable={selectCode} />
      </div>
      {note && <p className="code-context">{note}</p>}
      <pre><code ref={code}>{source}</code></pre>
      {selected && <p className="code-context" role="status">Code selected. Use your keyboard shortcut to copy it.</p>}
    </div>
  )
}

export function ExampleCode({ example }: { example: ChartExample }) {
  return <CodeBlock key={example.id} language="React" source={exampleSnippet(example)}
    note={<>Build the catalog package from source to use this example. <a href={guideUrl}>Integration guide</a></>} />
}
