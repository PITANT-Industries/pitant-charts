# Polar, flow and hierarchy examples

The library includes 116 examples from these families. They use a shared theme, React controls and demo data. Bklit UI's MIT-licensed gauge notch geometry and sunburst partition layout are included under `upstream/`.

## Differences observed in the source comparison

| Reference variant | Local behavior and remaining difference |
| --- | --- |
| `pie-center`, `pie-center-custom`, `pie-center-share`, `pie-donut-grow`, `ring-default` | Values interpolate on hover. The reference uses rolling digits. |
| `pie-center-custom`, `ring-center-custom` | The previews show custom center content, and the ring shows percentage of target. The public `ChartPreview` API has no custom center render callback. |
| `pie-half-donut`, `pie-glow`, `pie-patterns` | The local slices have spacing and round stroke joins. Their corner geometry and SVG patterns differ from the reference. |
| `radial-default`, `radial-patterned-dots`, `radial-line`, `radial-activity-card` | Fixtures use hourly values. The reference shows finer sampling in some of these charts. |
| `radial-temperature`, `radial-seasonal-card` | Daily fixture data covers a year, with two range bands and a mean. Values are synthetic. |
| `radial-bar-clock`, `radial-area-clock` | Hover highlights the bin or the edge points. The scrubber and sweep animation are simplified. |
| `gauge-fixed` | Dials have fixed radii in the SVG coordinate system and scale with the containing panel. The reference uses explicit pixel-sized gauges. |
| `gauge-interactive`, `gauge-dial`, `gauge-live-load` | Values and dial geometry update interactively. Numeric labels change directly, and notches transition by color. |
| `sunburst-default`, `sunburst-breadcrumb` | Branch hover and drill navigation work. The local SVG updates the partition on drill; the reference uses an animated branch morph. |
| `sunburst-segment-colors`, `sunburst-patterns` | Local segments use theme colors and SVG hatch patterns. The selected branches, styles and fixture values differ. |
| `sankey-default`, `sankey-patterns`, `sankey-pattern-lines` | Flow ribbons, gradients and patterns render. The local layer ordering and link geometry differ. |
| `treemap-default`, `treemap-drilldown`, `treemap-portfolio` | The local treemap uses ECharts layout. Drill-down and breadcrumb navigation work, and the portfolio uses weighted tiles. |
| `tree-default`, `tree-radial`, `tree-vertical`, `network-default`, `network-legend` | The local demos use ECharts for tree and network layout. Fixture nodes and labels differ. |
| `waffle-loading`, `marimekko-loading`, `treemap-loading`, `tree-loading`, `network-loading` | Muted chart geometry pulses before a user-controlled reveal. The reference uses individual entrance transitions for some marks. |
| `tooltip-standard`, `tooltip-rows`, `tooltip-content`, `tooltip-header`, `tooltip-custom-indicator` | The gallery shows the corresponding panel content and indicators. Those configurations are available through example IDs. There is no public render-prop API for arbitrary tooltip content. |

Representative interactions were checked in Chromium. The list documents known differences and does not establish visual or behavioral equivalence for every example.
