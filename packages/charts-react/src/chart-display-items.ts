export interface ChartDisplayItemsOptions<Item> {
  filter?: (item: Item, index: number) => boolean
  sort?: (left: Item, right: Item) => number
  /** Maximum item count or a half-open slice after filtering and sorting. */
  limit?: number | readonly [start: number, end: number]
}

export function selectChartDisplayItems<Item>(
  items: readonly Item[],
  { filter, sort, limit }: ChartDisplayItemsOptions<Item>,
): readonly Item[] {
  const filtered = filter ? items.filter(filter) : items
  const ordered = sort ? [...filtered].sort(sort) : filtered
  if (limit === undefined) return ordered
  if (typeof limit === 'number') return ordered.slice(0, Math.max(0, limit))
  return ordered.slice(Math.max(0, limit[0]), Math.max(0, limit[1]))
}
