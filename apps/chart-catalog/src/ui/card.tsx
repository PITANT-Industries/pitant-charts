// Adapted from the MIT-licensed shadcn/ui Card registry entry. See THIRD_PARTY_NOTICES.md.
import type { ComponentProps } from 'react'

export function Card(props: ComponentProps<'div'>) {
  return <div data-slot="card" {...props} />
}

export function CardHeader(props: ComponentProps<'div'>) {
  return <div data-slot="card-header" {...props} />
}

export function CardTitle(props: ComponentProps<'div'>) {
  return <div data-slot="card-title" {...props} />
}

export function CardDescription(props: ComponentProps<'div'>) {
  return <div data-slot="card-description" {...props} />
}

export function CardContent(props: ComponentProps<'div'>) {
  return <div data-slot="card-content" {...props} />
}
