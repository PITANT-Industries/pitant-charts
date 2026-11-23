import type { JSX } from 'react'
import { BookOpen, Download, Layers3 } from 'lucide-react'
import { examples, families, getFamily, groups } from '../catalog'
import registry from '../../../../registry.json'
import { CodeBlock, guideUrl, repositoryUrl } from './ExampleCode'
import { archiveInstallCommands, PackageManagerCommands } from './PackageManagerCommands'
import './docs-sections.css'

export const docSections = [
  { id: 'introduction', title: 'Introduction', description: 'React charts for dashboards, scientific analysis, and industrial time series.' },
  { id: 'components', title: 'Components', description: 'Find a chart by the kind of data and the question you want to answer.' },
  { id: 'installation', title: 'Installation', description: 'Build the packages you need from source and install them in your React app.' },
  { id: 'theming', title: 'Theming', description: 'Use your shadcn/ui color tokens or apply the PITANT palette to a chart.' },
  { id: 'cli', title: 'CLI', description: 'Inspect and add PITANT chart blocks with the shadcn CLI.' },
  { id: 'registry', title: 'Registry', description: 'Chart blocks with source you can copy into a shadcn/ui project.' },
  { id: 'skills', title: 'Skills', description: 'Use the upstream shadcn skill to work with chart blocks in an assistant-enabled editor.' },
  { id: 'changelog', title: 'Changelog', description: 'Changes to the chart catalog, React components, and rendering engine.' },
] as const

export type DocsSectionId = (typeof docSections)[number]['id']

export function isDocsSection(section: string): section is DocsSectionId {
  return docSections.some(({ id }) => id === section)
}

const guideHeadings = {
  introduction: {
    'start-here': 'Start with a chart',
    'choose-a-package': 'Choose a package',
  },
  components: Object.fromEntries(groups.map((group) => [`component-group-${group.id}`, group.name])),
  installation: {
    'get-the-source': 'Get the source',
    'dashboard-components': 'Dashboard components',
    'catalog-examples': 'Catalog examples',
    'industrial-react-and-core': 'Industrial React and core',
    'render-a-chart': 'Render a chart',
  },
  theming: {
    'inherit-your-theme': 'Inherit your theme',
    'warpdrive-palette': 'Warpdrive Day and Night',
    'industrial-color-tokens': 'Industrial color tokens',
  },
  cli: {
    'initialize-shadcn': 'Initialize shadcn/ui',
    'preview-a-block': 'Preview changes',
    'add-a-block': 'Add a block',
  },
  registry: {
    'connect-the-registry': 'Connect the registry',
    'available-blocks': 'Available blocks',
  },
  skills: {
    'install-the-shadcn-skill': 'Install the shadcn skill',
    'work-with-pitant-blocks': 'Work with PITANT blocks',
  },
  changelog: {
    'chart-catalog': 'Chart catalog',
    'dashboard-0-7-0': 'Dashboard components 0.7.0',
    'industrial-1-0-0': 'Industrial engine and React bindings 1.0.0',
  },
} satisfies Record<DocsSectionId, Record<string, string>>

export function docsSectionToc(section: DocsSectionId) {
  return Object.entries(guideHeadings[section]).map(([id, title]) => ({ id, title }))
}

function GuideHeading<Section extends DocsSectionId>({ section, id }: {
  section: Section
  id: Extract<keyof (typeof guideHeadings)[Section], string>
}) {
  const headings: Record<string, string> = guideHeadings[section]
  return <h2 id={id}>{headings[id]}</h2>
}

const registryUrl = 'https://opensource.pitant.de/charts/r'
const dashboardPackage = 'pitant-charts-0.7.0.tgz'
const catalogPackage = 'pitant-chart-catalog-0.7.0.tgz'
const nativePackages = ['pitant-charts-1.0.0.tgz', 'pitant-charts-react-1.0.0.tgz'] as const
const timeSeriesBlock = `${registryUrl}/pitant-time-series.json`
const setup = `git clone ${repositoryUrl}.git
cd pitant-charts
bun install --frozen-lockfile`
const dashboardExample = `import { LineChart } from 'pitant-charts'
import 'pitant-charts/styles.css'

const orders = [
  { month: 'Jan', total: 28 },
  { month: 'Feb', total: 41 },
  { month: 'Mar', total: 35 },
]

export function OrdersTrend() {
  return (
    <LineChart
      label="Monthly orders"
      height={280}
      data={orders}
      category={(row) => row.month}
      series={[{ name: 'Orders', value: (row) => row.total }]}
    />
  )
}`

function shadcn(command: string) {
  return {
    npm: `npx shadcn@latest ${command}`,
    pnpm: `pnpm dlx shadcn@latest ${command}`,
    yarn: `yarn dlx shadcn@latest ${command}`,
    bun: `bunx shadcn@latest ${command}`,
  }
}

const introductionLinks = [
  { href: '#docs=components', title: 'Browse component guides', icon: BookOpen },
  { href: '#docs=installation', title: 'Install PITANT Charts', icon: Download },
  { href: '#docs=registry', title: 'Add a shadcn chart block', icon: Layers3 },
]

function Introduction() {
  return <>
    <section className="pitant-guide-start">
      <GuideHeading section="introduction" id="start-here" />
      <p>Explore {examples.length} interactive examples across {families.length} chart families. Component guides include previews, input formats, React props, and examples you can adapt to your data.</p>
      <ul className="pitant-guide-actions">
        {introductionLinks.map(({ href, title, icon: Icon }) => (
          <li key={href}>
            <a href={href}><Icon size={17} aria-hidden="true" />{title}</a>
          </li>
        ))}
      </ul>
    </section>
    <section className="pitant-guide-packages">
      <GuideHeading section="introduction" id="choose-a-package" />
      <dl>
        <div>
          <dt><code>pitant-charts</code></dt>
          <dd>Typed line, bar, donut, and sunburst components for React dashboards.</dd>
        </div>
        <div>
          <dt><code>@pitant/chart-catalog</code></dt>
          <dd>Embed a gallery example with its sample data or your own.</dd>
        </div>
        <div>
          <dt><code>@pitant/charts-react</code></dt>
          <dd>Scientific and industrial charts, including spectra, spectrograms, process-control charts, streaming trends, and synchronized panels.</dd>
        </div>
        <div>
          <dt><code>@pitant/charts</code></dt>
          <dd>TypeScript rendering and data engine for apps that manage their own canvas.</dd>
        </div>
      </dl>
    </section>
    <p>PITANT Charts is open source under MPL 2.0. See the source, license, and contribution guide on <a href={repositoryUrl}>GitHub</a>.</p>
  </>
}

function Components() {
  return <>
    <p>Open a component to find its supported data, properties, and live variations. To compare designs visually, browse the <a href="#">chart gallery</a>.</p>
    {groups.map((group) => (
      <section className="pitant-guide-component-group" key={group.id}>
        <GuideHeading section="components" id={`component-group-${group.id}`} />
        <ul>
          {group.families.map((id) => {
            const family = getFamily(id)
            return family && <li key={id}><a href={`#docs=${id}`}>{family.name}</a></li>
          })}
        </ul>
      </section>
    ))}
  </>
}

function Installation() {
  return <>
    <section>
      <GuideHeading section="installation" id="get-the-source" />
      <p>Build the workspace with Bun 1.4.4 and Node.js 22.12 or later. Dashboard and catalog components require React and React DOM 19.2 or later within React 19. The industrial React bindings support React 19.</p>
      <CodeBlock language="Terminal" source={setup} />
      <p>Run the build and pack commands in the checkout. Copy the archives printed by <code>npm pack</code> into the root of your React app, then install them with your package manager.</p>
    </section>
    <section>
      <GuideHeading section="installation" id="dashboard-components" />
      <CodeBlock language="Build and pack" source={`bun run --filter pitant-charts build
npm pack --ignore-scripts ./packages/charts-ui`} />
      <PackageManagerCommands label="Install dashboard components" commands={archiveInstallCommands([dashboardPackage])} />
    </section>
    <section>
      <GuideHeading section="installation" id="catalog-examples" />
      <CodeBlock language="Build and pack" source={`bun run --filter @pitant/chart-catalog build:library
npm pack --ignore-scripts ./apps/chart-catalog`} />
      <PackageManagerCommands label="Install the example catalog" commands={archiveInstallCommands([catalogPackage])} />
      <p>Import <code>@pitant/chart-catalog/styles.css</code> and give <code>ChartPreview</code> a parent with a set height. The <a href={guideUrl}>catalog integration guide</a> shows how to replace sample data.</p>
    </section>
    <section>
      <GuideHeading section="installation" id="industrial-react-and-core" />
      <CodeBlock language="Build and pack" source={`bun run build
npm pack --ignore-scripts ./packages/charts ./packages/charts-react`} />
      <PackageManagerCommands label="Install the core and React bindings" commands={archiveInstallCommands(nativePackages)} />
      <p>Install both archives together so that the React bindings resolve the matching engine. Use these packages for <a href="#docs=spectrum">scientific charts</a> and <a href="#docs=registry">shadcn chart blocks</a>.</p>
    </section>
    <section>
      <GuideHeading section="installation" id="render-a-chart" />
      <p>With the dashboard package installed, import its stylesheet and give the chart an accessible label.</p>
      <CodeBlock language="React" source={dashboardExample} />
    </section>
  </>
}

function Theming() {
  return <>
    <section>
      <GuideHeading section="theming" id="inherit-your-theme" />
      <p>Dashboard components read the nearest shadcn/ui color variables after you import <code>pitant-charts/styles.css</code>. Set <code>--chart-1</code> through <code>--chart-8</code> on the page or a chart container to customize the series palette.</p>
      <CodeBlock language="CSS" source={`.production-charts {
  --chart-1: oklch(0.55 0.17 250);
  --chart-2: oklch(0.51 0.12 165);
}

.dark .production-charts {
  --chart-1: oklch(0.72 0.14 250);
  --chart-2: oklch(0.75 0.13 165);
}`} />
      <p>You can set a CSS color on each series or slice. Use <code>--chart-axis-color</code>, <code>--chart-grid-color</code>, and <code>--chart-tooltip-*</code> tokens for chart surfaces and readouts.</p>
    </section>
    <section>
      <GuideHeading section="theming" id="warpdrive-palette" />
      <p>Import <code>pitant-charts/warpdrive.css</code> alongside the chart stylesheet and place <code>chart-library-theme</code> on a shared parent. Add <code>data-theme="dark"</code> to that parent for the Night palette.</p>
      <CodeBlock language="React" source={`import type { ReactNode } from 'react'
import 'pitant-charts/styles.css'
import 'pitant-charts/warpdrive.css'

export function ChartTheme({ children, dark }: { children: ReactNode; dark: boolean }) {
  return (
    <div className="chart-library-theme" data-theme={dark ? 'dark' : 'light'}>
      {children}
    </div>
  )
}`} />
    </section>
    <section>
      <GuideHeading section="theming" id="industrial-color-tokens" />
      <p>Import <code>@pitant/charts/styles/tokens.css</code> at the app entry point to use the full industrial token set. Set your own values after the import. Apply <code>.dark</code> or <code>.high-contrast</code> to an ancestor to use its supplied overrides.</p>
      <p>See <a href="https://ui.shadcn.com/docs/theming">shadcn/ui theming</a> for the base color variables.</p>
    </section>
  </>
}

function Cli() {
  return <>
    <section>
      <GuideHeading section="cli" id="initialize-shadcn" />
      <p>Run <code>init</code> in your React app if it has no <code>components.json</code>. The Yarn CLI commands on this page use Yarn 2 or newer.</p>
      <PackageManagerCommands label="Initialize shadcn in your app" commands={shadcn('init')} />
      <p>Install the two <a href="#docs=installation">industrial archives</a> before adding a PITANT block.</p>
    </section>
    <section>
      <GuideHeading section="cli" id="preview-a-block" />
      <p>Use a dry run to inspect the files the CLI will add.</p>
      <PackageManagerCommands label="Preview the TimeSeries block" commands={shadcn(`add ${timeSeriesBlock} --dry-run`)} />
    </section>
    <section>
      <GuideHeading section="cli" id="add-a-block" />
      <PackageManagerCommands label="Add the TimeSeries block" commands={shadcn(`add ${timeSeriesBlock}`)} />
      <p>Import <code>PitantTimeSeriesBlock</code> from <code>pitant/time-series.tsx</code> under the directory specified by your <code>components</code> alias. The block includes sample values you can replace with your own data.</p>
      <p>See the <a href="#docs=registry">PITANT registry</a> for the full list of blocks and the <a href="https://ui.shadcn.com/docs/cli">shadcn CLI reference</a> for command options.</p>
    </section>
  </>
}

function Registry() {
  return <>
    <section>
      <GuideHeading section="registry" id="connect-the-registry" />
      <p>Install the <a href="#docs=installation">industrial archives</a> first. Then add the registry to <code>components.json</code>. If you already have a <code>registries</code> object, add the <code>@pitant</code> entry to it.</p>
      <CodeBlock language="components.json" source={`{
  "registries": {
    "@pitant": "${registryUrl}/{name}.json"
  }
}`} />
      <PackageManagerCommands label="List the PITANT chart blocks" commands={shadcn('search @pitant')} />
      <p>The Yarn CLI examples use Yarn 2 or newer. The <a href="#docs=cli">CLI guide</a> shows how to install directly from a URL.</p>
    </section>
    <section>
      <GuideHeading section="registry" id="available-blocks" />
      <dl>
        {registry.items.map(({ name, title, description }) => (
          <div key={name}>
            <dt><a href={`${registryUrl}/${name}.json`}>{title}</a></dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <p><a href={`${registryUrl}/registry.json`}>Registry index (JSON)</a></p>
    </section>
  </>
}

function Skills() {
  return <>
    <section>
      <GuideHeading section="skills" id="install-the-shadcn-skill" />
      <p>The upstream shadcn skill reads your project's <code>components.json</code> so a supported assistant can use your aliases, theme, and configured registries. Run this from your app. The Yarn example uses Yarn 2 or newer.</p>
      <PackageManagerCommands label="Install the upstream shadcn skill" commands={{
        npm: 'npx skills add shadcn-ui/ui --skill shadcn',
        pnpm: 'pnpm dlx skills add shadcn-ui/ui --skill shadcn',
        yarn: 'yarn dlx skills add shadcn-ui/ui --skill shadcn',
        bun: 'bunx skills add shadcn-ui/ui --skill shadcn',
      }} />
      <p>Follow the installer's prompts to select the assistant you use. See <a href="https://ui.shadcn.com/docs/skills">the shadcn skills guide</a> for setup details.</p>
    </section>
    <section>
      <GuideHeading section="skills" id="work-with-pitant-blocks" />
      <p>After configuring the <a href="#docs=registry">PITANT registry</a> and installing the <a href="#docs=installation">industrial archives</a>, try these requests in your app.</p>
      <ul>
        <li>Inspect <code>@pitant/pitant-time-series</code> and add it to the dashboard. Use our timestamp and temperature fields and keep missing values as gaps.</li>
        <li>Preview <code>@pitant/pitant-synchronized-dashboard</code>. Show which files will be added and how the charts share their time range and cursor.</li>
      </ul>
    </section>
  </>
}

function Changelog() {
  return <>
    <section>
      <GuideHeading section="changelog" id="chart-catalog" />
      <ul>
        <li>Component guides cover installation, caller data, React props, and interactive examples.</li>
        <li>The <a href="#docs=mass-spectrum">CERN dimuon mass spectrum</a> shows 100,000 measured events. <a href="#docs=correlation-matrix&variant=correlation-matrix-steel">Steel surface defect correlations</a> use 1,941 records from UCI.</li>
        <li><a href="#docs=spectral-waterfall">Spectral Waterfall</a> combines a 3D spectrum history with a selected spectrum and heatmap. Its examples use frequency data from the Mauna Loa CO₂ record and temperature-resolved X-ray diffraction of DyNiC₂.</li>
        <li><a href="#docs=spectrum">Spectrum</a>, <a href="#docs=spectrogram">Spectrogram</a>, <a href="#docs=correlation-matrix">Correlation Matrix</a>, and <a href="#docs=process-control">Process Control</a> have domain data examples.</li>
      </ul>
    </section>
    <section>
      <GuideHeading section="changelog" id="dashboard-0-7-0" />
      <p>Typed React line, bar, donut, and sunburst charts use shadcn colors and offer the Warpdrive Day and Night palette. <a href={`${repositoryUrl}/tree/v0.7.0`}>Source for 0.7.0</a>.</p>
    </section>
    <section>
      <GuideHeading section="changelog" id="industrial-1-0-0" />
      <p>TimeSeries and DigitalChannel support PNG and SVG export. Eight <a href="#docs=registry">registry blocks</a> cover streaming trends, synchronized dashboards, state lanes, and other industrial chart patterns.</p>
    </section>
    <p>See <a href={`${repositoryUrl}/releases`}>releases on GitHub</a> for version history.</p>
  </>
}

const content = {
  introduction: Introduction,
  components: Components,
  installation: Installation,
  theming: Theming,
  cli: Cli,
  registry: Registry,
  skills: Skills,
  changelog: Changelog,
} satisfies Record<DocsSectionId, () => JSX.Element>

export function DocsSectionContent({ section }: { section: DocsSectionId }) {
  const Content = content[section]
  return <Content />
}
