# Caller-data coverage

The gallery fixtures and supplied `ChartData` have separate verification scopes. The 16 basic Area variants now retain their detailed renderer with caller data, including adaptive scales, row dates, missing samples, names and explicit colors. Line Markers retains event objects and legacy event strings. Their public API checks are recorded in [PARITY.md](PARITY.md).

A source audit found 135 other variants that switch implementation when data is supplied. This is a routing count, not a count of broken charts: many compatibility renderers retain their core controls and modes. The following table records concrete behavior or data-model differences. These are source findings; they do not constitute runtime qualification of every caller dataset.

| Group | Affected examples | Remaining caller-data difference |
| --- | --- | --- |
| Choropleth | `choropleth-default`, `choropleth-background`, `choropleth-click-to-zoom`, `choropleth-pointer-camera`, `choropleth-dot-grid`, `choropleth-patterns` | supplied data uses the compatibility map renderer, with older manual zoom/camera behavior or missing status/marker controls depending on the variant. [Source](src/charts/statsmaps/maps.tsx#L144). |
| Treemap | `treemap-default`, `treemap-drilldown`, `treemap-loading`, `treemap-portfolio` | the compatibility renderer lacks leaf-to-visible-ancestor drill behavior and the separate keyboard/pointer focus restoration. [Source](src/charts/polarflow/treemap-tree.tsx#L87). |
| Stream default/loading | `stream-default`, `stream-loading` | the compatibility renderer uses a centered stack instead of the measured inside-out wiggle layout. [Source](src/charts/cartesian/ReferenceStreamDiverging.tsx#L35). |
| Quantity legend pinning | `waffle-default`, `marimekko-legend` | compatibility legend selection does not retain the measured pinned selection behavior. [Source](src/charts/polarflow/ReferenceQuantity.tsx#L29). |
| Density groups | `density-groups` | the compatibility legend hides the clicked group instead of isolating it. [Source](src/charts/statsmaps/SpatialDensityDetail.tsx#L34). |
| Gantt grouped/multiple dependencies | `gantt-default`, `gantt-roadmap`, `gantt-milestones`, `gantt-loading` | the compatibility row schema supports one dependency and does not represent the measured phase headers/multiple incoming dependencies. [Source](src/charts/cartesian/GanttDetail.tsx#L12). |
| Vector stations | `vector-field-stations` | the compatibility renderer uses geographic coordinates and m/s instead of the station example's Cartesian kilometre grid and km/h. [Source](src/charts/statsmaps/maps.tsx#L561). |

Do not remove the guards without adapting inputs. Several detailed renderers still assume fixture date rows, fixed domains, preset series names or fixed hierarchy roots. The existing compatibility renderers remain available while these adapters are completed. Each affected example also records its caller-data gap in the gallery's Parity review.
