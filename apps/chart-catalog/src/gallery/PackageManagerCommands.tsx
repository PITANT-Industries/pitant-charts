import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from './ExampleCode'

const managers = ['npm', 'pnpm', 'yarn', 'bun'] as const
type PackageManager = typeof managers[number]

export type PackageManagerCommandSet = Record<PackageManager, string>

export function archiveInstallCommands(filenames: readonly string[]): PackageManagerCommandSet {
  const paths = filenames.map((filename) => `"./${filename}"`).join(' ')
  const yarnPaths = filenames.map((filename) => `"file:./${filename}"`).join(' ')
  return {
    npm: `npm install ${paths}`,
    pnpm: `pnpm add ${paths}`,
    yarn: `yarn add ${yarnPaths}`,
    bun: `bun add ${paths}`,
  }
}

export function PackageManagerCommands({ commands, label = 'Install in your app' }: {
  commands: PackageManagerCommandSet
  label?: string
}) {
  return (
    <Tabs defaultValue="npm" className="docs-package-managers">
      <TabsList aria-label={`${label} package manager`}>
        {managers.map((manager) => <TabsTrigger key={manager} value={manager}>{manager}</TabsTrigger>)}
      </TabsList>
      {managers.map((manager) => <TabsContent key={manager} value={manager}>
        <CodeBlock language={label} source={commands[manager]} />
      </TabsContent>)}
    </Tabs>
  )
}
