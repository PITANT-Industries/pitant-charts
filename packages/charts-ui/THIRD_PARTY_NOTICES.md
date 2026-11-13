# Third-party notices

The root MIT license covers the original PITANT Charts code. The following works retain their upstream notices and terms.

| Work | Use in this release | License |
| --- | --- | --- |
| [Bklit UI](https://github.com/bklit/bklit-ui) | Sunburst hierarchy and arc layout adapted from the [sunburst registry source](https://bklit.com/r/sunburst-chart.json). Only the layout and data type are used. | [MIT, uixmat](licenses/Bklit-UI-MIT.txt) |
| Warpdrive | Day and Night surface, text, accent and semantic theme values adapted from Warpdrive's CSS at revision `9dc666ab`. | [MIT, Nikita Sawinyh](licenses/Warpdrive-MIT.txt) |
| [Recharts](https://github.com/recharts/recharts) | External runtime dependency. Draws axes, lines, bars and radial sectors. | [MIT](licenses/Recharts-MIT.txt) |
| [React and React DOM](https://github.com/facebook/react) | External peer dependencies supplied by the consuming app. | [MIT](licenses/React-MIT.txt) |

The standalone tarball contains compiled library code, styles, TypeScript declarations and notices. React, React DOM and Recharts are resolved by the consumer's package manager and keep their own notices. The full chart gallery, its reference examples, and its fonts and chart engines live outside this release. The optional stylesheet uses shadcn-compatible CSS custom property names. It contains no shadcn registry source.
