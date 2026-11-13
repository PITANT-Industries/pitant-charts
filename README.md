# Chart Library

React chart components and a searchable gallery indexed against the [shadcn.io React chart catalog](https://www.shadcn.io/charts). The catalog includes 44 chart families with 320 examples plus 11 tooltip examples.

## Run the gallery

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Search or filter by family, switch to list view, and save examples for later. The browser stores saved charts and theme preferences. A variant’s URL opens it directly, and its Code tab shows how to use it in React.

[Component index and progress](https://chatgpt.com/space/page_158565692cf88191bb821bf62112a8d1)

## Use the React library

`npm run build:library` creates the ESM module, CSS and TypeScript declarations in `dist-library`. Use `npm pack` to create an installable local archive.

```tsx
import { ChartPreview, getExample } from 'chart-library'
import 'chart-library/styles.css'

export function OrdersChart() {
  const example = getExample('line-default')
  if (!example) return null

  return (
    <div style={{ height: 280 }}>
      <ChartPreview example={example} data={{
        categories: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        series: [{ name: 'Orders', values: [28, 34, 31, 43, 40] }],
      }} />
    </div>
  )
}
```

`examples`, `families`, `groups`, `getExample`, and `getFamily` expose the catalog. `ChartData` accepts categories and numeric series for common charts and records for family-specific data such as geographic points and hierarchies. Omitting `data` uses demo fixtures. Use a sized container and override the shadcn-style CSS variables after importing the stylesheet.

## Verify changes

```sh
npm test
npm run build
```

See [Parity status](PARITY.md) for verification and known differences, and [Third-party notices](THIRD_PARTY_NOTICES.md) for upstream code and licenses.
