import { Check, ChevronDown } from 'lucide-react'
import {
  Select, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { getFamily } from '../catalog'
import type { ChartGroup } from '../types'

export function FamilySelect({ value, groups, onChange }: { value: string; groups: readonly ChartGroup[]; onChange: (id: string) => void }) {
  const sections = groups.map((group) => ({
    id: group.id,
    type: 'group' as const,
    label: group.name,
    items: group.families.map((id) => ({ value: id, label: getFamily(id)?.name ?? id })),
  }))
  return <Select value={value} onValueChange={(next) => { if (next !== null) onChange(next) }} items={[{ value: 'all', label: 'All families' }, ...sections]}>
    <SelectTrigger className="family-filter" aria-label="Chart family"><SelectValue /><ChevronDown size={14} aria-hidden="true" /></SelectTrigger>
    <SelectContent className="family-menu">
      <SelectItem className="family-menu-item" value="all">All families<SelectItemIndicator><Check size={14} aria-hidden="true" /></SelectItemIndicator></SelectItem>
      {sections.map((group) => <SelectGroup key={group.id}><SelectGroupLabel className="family-menu-group">{group.label}</SelectGroupLabel>
        {group.items.map((item) => <SelectItem className="family-menu-item" key={item.value} value={item.value}>{item.label}<SelectItemIndicator><Check size={14} aria-hidden="true" /></SelectItemIndicator></SelectItem>)}
      </SelectGroup>)}
    </SelectContent>
  </Select>
}
