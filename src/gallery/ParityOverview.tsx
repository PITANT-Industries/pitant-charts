import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { Button } from '@ui-sdk/react/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible'
import { examples, getFamily, groups } from '../catalog'
import { Choices } from '../ui/Choices'
import parityData from './parity-notes.json'

export const parityNotes: Readonly<Record<string, { checked: string; remaining: string } | undefined>> = parityData
export const notedCount = Object.keys(parityNotes).length
export type ParityFilter = 'all' | 'documented' | 'pending'
const parityFilters: { value: ParityFilter; label: React.ReactNode }[] = [
  { value: 'all', label: <><strong>{examples.length}</strong> Catalog variants</> },
  { value: 'documented', label: <><strong>{notedCount}</strong> With notes</> },
]
const pendingFilter = { value: 'pending' as const, label: <><strong>{examples.length - notedCount}</strong> Awaiting notes</> }

export function ParityOverview({ filter, onFilter, onFamily }: {
  filter: ParityFilter
  onFilter: (filter: ParityFilter) => void
  onFamily: (group: string, family: string) => void
}) {
  return (
    <section className="parity-overview" aria-labelledby="parity-overview-title">
      <div className="parity-overview-heading">
        <ClipboardCheck size={24} aria-hidden="true" />
        <div><h1 id="parity-overview-title">Parity review</h1><p>Search checked behavior and remaining gaps. Open a variant’s Compare tab to see the live reference.</p></div>
      </div>
      <Choices className="parity-filters" label="Filter by review notes" options={examples.length !== notedCount || filter === 'pending' ? [...parityFilters, pendingFilter] : parityFilters} value={filter} onChange={onFilter} />
      <Collapsible className="parity-families">
        <CollapsibleTrigger>Review coverage by chart family</CollapsibleTrigger>
        <CollapsiblePanel><div className="parity-family-grid">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.name}>
              <h2>{group.name}</h2>
              {group.families.map((id) => {
                const family = getFamily(id)
                if (!family) return null
                const count = family.examples.filter((example) => parityNotes[example.id]).length
                return <Button key={id} onClick={() => onFamily(group.id, id)} aria-label={`${family.name}, ${count} of ${family.examples.length} variants have notes`}><span>{family.name}</span><small>{count}/{family.examples.length}</small><ArrowRight size={14} aria-hidden="true" /></Button>
              })}
            </section>
          ))}
        </div></CollapsiblePanel>
      </Collapsible>
    </section>
  )
}
