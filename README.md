# PITANT Charts

PITANT Charts provides React components for dashboards, a browsable chart catalog, and a WebGPU chart engine for industrial and scientific data. The packages use CSS variables that can share a shadcn palette across applications.

[Open the private gallery](https://chart-library-catalog.stony-boar-2041.chatgpt.site) · [Browse parity notes](https://chart-library-catalog.stony-boar-2041.chatgpt.site/#review=all) · [View GitHub Actions](https://github.com/PITANT-Industries/pitant-charts/actions)

## Choose a package

| Package | Use it for | Data |
| --- | --- | --- |
| [`pitant-charts`](packages/charts-ui/README.md) | React dashboard line, grouped bar, donut, and sunburst charts | Rows with accessors, slices, or a hierarchy |
| [`@pitant/chart-catalog`](apps/chart-catalog/README.md) | Browsing and embedding specific React chart examples, including gauges, heatmaps, and maps | Categories and numeric series or records for the chart family |
| [`@pitant/charts-react`](packages/charts-react/README.md) | Historian trends, digital states, synchronized views, and scientific plots in React | Typed arrays or inputs specific to the chart |
| [`@pitant/charts`](packages/charts/README.md) | Industrial renderers, data engine, and chart APIs for apps that own the canvas | Typed arrays and renderer commands |

`pitant-charts` and the private `@pitant/chart-catalog` workspace share the same version. The two industrial packages have their own version. Use local package archives for installation from source. [Installation and examples](docs/getting-started.md)

## Run the chart catalog

Use Bun 1.4.4 and a current Node.js 22 release (at least 22.12).

```sh
git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
bun run catalog:dev
```

The catalog has 320 chart examples in 44 families plus 11 tooltip examples. Open a chart’s **Code** tab for its React import and **Compare** to see the reference beside the local chart. **Parity review** shows checks and remaining differences for each example. [Catalog documentation](apps/chart-catalog/README.md) · [Parity status](apps/chart-catalog/PARITY.md)

## Add a dashboard chart

After installing the dashboard package, import its stylesheet and pass your rows to a component. [Dashboard setup](packages/charts-ui/README.md)

```tsx
import { LineChart } from 'pitant-charts'
import 'pitant-charts/styles.css'

const orders = [{ month: 'Jan', count: 28 }, { month: 'Feb', count: 41 }]

export function OrdersChart() {
  return (
    <LineChart
      label="Monthly orders"
      data={orders}
      category={(row) => row.month}
      series={[{ name: 'Orders', value: (row) => row.count }]}
    />
  )
}
```

## Develop and release

| Task | Command |
| --- | --- |
| Build the industrial packages | `bun run build` |
| Run the industrial documentation app | `bun run build` then `bun run docs:dev` |
| Build the gallery and its React package | `bun run catalog:build` |
| Build the static gallery for Sites | `bun run catalog:site` |
| Check formatting and industrial types | `bun run lint` and `bun run typecheck` |

GitHub Actions checks the industrial packages, dashboard package, and catalog. The catalog workflow packages the gallery build from `main`. The private Sites deployment and the industrial npm release each have a separate release procedure. [Contributing](CONTRIBUTING.md) · [CI and delivery](docs/ci-cd.md) · [Release checklist](docs/release-checklist.md)

## Reference docs

- [Industrial quick start](docs/quick-start.md) and [composed examples](docs/examples/README.md)
- [shadcn registry blocks](registry/README.md)
- [Architecture](ARCHITECTURE.md), [industrial roadmap](docs/ROADMAP.md), and [planning index](docs/architecture/README.md)

## License

PITANT-owned source code is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, you can obtain one from [Mozilla](https://mozilla.org/MPL/2.0/).

The chart packages include source, and third-party code and assets carry their upstream notices. [License](LICENSE) · [Licensing and source access](docs/licensing.md) · [Catalog notices](apps/chart-catalog/THIRD_PARTY_NOTICES.md) · [Dashboard notices](packages/charts-ui/THIRD_PARTY_NOTICES.md)
