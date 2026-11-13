'use client'

import type { ReactNode } from 'react'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'

interface Choice<T extends string> {
  value: T
  label: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

export function Choices<T extends string>({ label, value, options, onChange, className, itemClassName }: {
  label: string
  value: T
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  className?: string
  itemClassName?: string
}) {
  return <ToggleGroup aria-label={label} className={className} value={[value]} deselectable={false} onValueChange={(next) => {
    const selected = options.find((option) => option.value === next[0] && !option.disabled)
    if (selected) onChange(selected.value)
  }}>
    {options.map((option) => <Toggle key={option.value} value={option.value} aria-label={option.ariaLabel} disabled={option.disabled} className={itemClassName}>{option.label}</Toggle>)}
  </ToggleGroup>
}
