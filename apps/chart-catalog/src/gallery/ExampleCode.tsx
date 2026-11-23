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

export function CodeBlock({ language, source, note }: { language: string; source: string; note?: ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'selected'>('idle')
  const code = useRef<HTMLElement>(null)

  useEffect(() => {
    if (status === 'idle') return
    const timeout = window.setTimeout(() => setStatus('idle'), status === 'copied' ? 1800 : 6000)
    return () => window.clearTimeout(timeout)
  }, [status])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(source)
      setStatus('copied')
    } catch {
      const selection = window.getSelection()
      if (!selection || !code.current) return
      const range = document.createRange()
      range.selectNodeContents(code.current)
      selection.removeAllRanges()
      selection.addRange(range)
      setStatus('selected')
    }
  }

  return (
    <div className="snippet">
      <div className="snippet-header">
        <span>{language}</span>
        <Button className="text-button" onClick={() => void copyCode()}>
          {status === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {status === 'copied' ? 'Copied' : 'Copy code'}
        </Button>
      </div>
      {note && <p className="code-context">{note}</p>}
      <pre><code ref={code}>{source}</code></pre>
      {status === 'selected' && <p className="code-context" role="status">Code selected. Use your keyboard shortcut to copy it.</p>}
    </div>
  )
}

export function ExampleCode({ example }: { example: ChartExample }) {
  return <CodeBlock key={example.id} language="React" source={exampleSnippet(example)}
    note={<>Build the catalog package from source to use this example. <a href={guideUrl}>Integration guide</a></>} />
}
