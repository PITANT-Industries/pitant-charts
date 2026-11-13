// Adapted from the MIT-licensed EvilCharts echarts-tooltip registry entry.
// See THIRD_PARTY_NOTICES.md for the upstream source and license.
import type { DefaultLabelFormatterCallbackParams, EChartsOption } from 'echarts'

type TooltipOption = Exclude<NonNullable<EChartsOption['tooltip']>, unknown[]>

export function escapeTooltipHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Array.isArray(value)) return value.map(formatValue).join(' · ')
  return typeof value === 'string' ? value : '—'
}

function tooltipRow(item: DefaultLabelFormatterCallbackParams, showSeries: boolean) {
  const name = showSeries ? item.seriesName : item.name || item.seriesName
  const marker = typeof item.marker === 'string' ? item.marker : ''
  return `<div class="cl-tooltip-row"><span>${marker}${escapeTooltipHtml(name ?? '')}</span><strong>${escapeTooltipHtml(formatValue(item.value))}</strong></div>`
}

function tooltipShell(params: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) {
  const items = Array.isArray(params) ? params : [params]
  if (!items.length) return ''
  const label = items[0].name
  const header = label && Array.isArray(params) ? `<div class="cl-tooltip-heading">${escapeTooltipHtml(label)}</div>` : ''
  const rows = items.map((item) => tooltipRow(item, Array.isArray(params))).join('')
  return `<div class="cl-tooltip">${header}<div class="cl-tooltip-rows">${rows}</div></div>`
}

export function applyTooltipStyle(option: EChartsOption): EChartsOption {
  const tooltip = option.tooltip as TooltipOption | TooltipOption[] | undefined
  if (!tooltip || Array.isArray(tooltip) || tooltip.show === false || tooltip.formatter || tooltip.renderMode === 'richText') return option
  return {
    ...option,
    tooltip: {
      ...tooltip,
      confine: true,
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      extraCssText: 'box-shadow:none;',
      formatter: tooltipShell,
    },
  }
}
