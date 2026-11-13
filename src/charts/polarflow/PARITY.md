# Polar, flow and hierarchy examples

The library includes 116 examples from these families. They use a shared theme, React controls and demo data. Bklit UI's MIT-licensed gauge notch geometry and sunburst partition layout are included under `upstream/`.

## Differences observed in the source comparison

| Reference variant | Local behavior and remaining difference |
| --- | --- |
| `pie-center`, `pie-center-custom`, `pie-center-share`, `pie-donut-grow`, `ring-default` | Values interpolate on hover. The reference uses rolling digits. |
| `pie-center-custom`, `ring-center-custom` | The public `renderCenter` callback receives the current datum and its share. Pie share uses the aggregate. Focused ring share uses the active target, and idle ring share uses the aggregate. Custom center content follows the library’s SVG layout. |
| `pie-half-donut`, `pie-glow`, `pie-patterns` | The local slices have spacing and round stroke joins. Their corner geometry and SVG patterns differ from the reference. |
| `radial-default`, `radial-line` | The 96-bin clock accepts pointer and keyboard scrubbing. Dot status legend isolation and the line’s dashed prior day are implemented. Fixtures and styling differ. |
| `radial-patterned-dots`, `radial-activity-card` | The hourly fixtures show patterned dots and update the activity value. Status labels, interaction surfaces and presentation differ. |
| `radial-temperature`, `radial-seasonal-card` | Daily fixture data covers a year, with two range bands and a mean. Values are synthetic. |
| `radial-bar-clock`, `radial-area-clock` | The 96-bin clocks show the previous day beyond the current time. Bars highlight the active bin with a rotating scrubber. Areas sweep in and show three edge markers. Motion timing and fixture values differ. |
| `gauge-fixed` | Full previews use three 160 px dials. They sit side by side on wide panels and wrap at narrower widths. Compact gallery cards use a single scaled preview. |
| `gauge-interactive`, `gauge-dial`, `gauge-live-load` | Quarter selection, six manual readings, and the 1.8-second CPU sample loop sweep between readings. The live gauge derives current, average and peak from the same sample stream. Numeric values interpolate, and the reference’s digit transitions and gauge geometry differ. |
| `sunburst-default`, `sunburst-breadcrumb`, `sunburst-legend` | Branches morph during drill-down and back navigation. The focused chart supports arrow inspection, Enter or Space to drill and Escape to go up. Breadcrumbs jump to ancestors, and the legend activates branches and displays their share. Motion timing, fixture hierarchy and geometry differ. |
| `sunburst-segment-colors`, `sunburst-patterns` | Local segments use theme colors and SVG hatch patterns. The selected branches, styles and fixture values differ. |
| `sankey-default`, `sankey-patterns`, `sankey-pattern-lines` | Flow ribbons, gradients and patterns render. The local layer ordering and link geometry differ. |
| `treemap-default`, `treemap-drilldown`, `treemap-portfolio` | The local treemap uses ECharts layout. Drill-down and breadcrumb navigation work, and the portfolio uses weighted tiles. |
| `tree-default`, `tree-radial`, `tree-vertical`, `network-default`, `network-legend` | The local demos use ECharts for tree and network layout. Fixture nodes and labels differ. |
| `waffle-loading`, `marimekko-loading`, `treemap-loading`, `tree-loading`, `network-loading` | Muted chart geometry pulses before a user-controlled reveal. The reference uses individual entrance transitions for some marks. |
| `tooltip-standard`, `tooltip-rows`, `tooltip-content`, `tooltip-header`, `tooltip-custom-indicator` | The gallery shows the corresponding panel content and indicators. Those configurations are available through example IDs. There is no public render-prop API for arbitrary tooltip content. |

The live React reference and the library were compared in Chromium for the gauge and sunburst controls and quarter-hour clock navigation. The library was also tested with caller-provided data in the pie and ring render callbacks. The remaining comparisons cover fixture data, the full set of states and visual rendering.
