import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const keepTemp = process.argv.includes('--keep')
const tempRoot = mkdtempSync(join(tmpdir(), 'pitant-charts-shadcn-smoke-'))
const registryBuildDir = join(tempRoot, 'registry-build')
const packSourceDir = join(tempRoot, 'package-source')
const packDir = join(tempRoot, 'packs')
const consumerParent = join(tempRoot, 'consumer')
const consumerName = 'pitant-charts-shadcn-smoke'
const consumerDir = join(consumerParent, consumerName)

function run(command, args, options = {}) {
  const cwd = options.cwd ?? root
  console.log(`$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: '1',
    },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function shadcn(args) {
  run('bunx', ['shadcn@latest', ...args], { cwd: tempRoot })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function patchReactPackageForLocalPack(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json')
  const pkg = readJson(packageJsonPath)

  if (pkg.peerDependencies) {
    delete pkg.peerDependencies['@pitant/charts']
  }
  if (pkg.devDependencies) {
    delete pkg.devDependencies['@pitant/charts']
  }

  writeJson(packageJsonPath, pkg)
}

function targetToConsumerPath(target) {
  const mappings = [
    ['@components/', 'src/components/'],
    ['@ui/', 'src/components/ui/'],
    ['@lib/', 'src/lib/'],
    ['@hooks/', 'src/hooks/'],
    ['~/', 'src/'],
  ]
  const match = mappings.find(([prefix]) => target.startsWith(prefix))

  if (!match) {
    throw new Error(`Unsupported shadcn target in registry smoke test: ${target}`)
  }

  return join(consumerDir, target.replace(match[0], match[1]))
}

function importPathFromTarget(target) {
  const absolutePath = targetToConsumerPath(target)
  const relativePath = relative(join(consumerDir, 'src'), absolutePath)
  const withoutExtension = relativePath.slice(0, -extname(relativePath).length)
  return `./${withoutExtension.split(sep).join('/')}`
}

function registryItems() {
  return readdirSync(registryBuildDir)
    .filter((file) => file.endsWith('.json') && file !== 'registry.json')
    .sort()
    .map((file) => join(registryBuildDir, file))
}

function buildConsumerApp(items) {
  const imports = [
    "import '@pitant/charts/styles/tokens.css'",
    ...items.map(({ importPath }, index) => `import Block${index} from '${importPath}'`),
  ].join('\n')

  const blocks = items
    .map(
      ({ name }, index) =>
        `        <section aria-label="${name} registry smoke">\n          <Block${index} />\n        </section>`,
    )
    .join('\n')

  writeFileSync(
    join(consumerDir, 'src', 'App.tsx'),
    `${imports}\n\nexport default function App() {\n  return (\n    <main className="grid min-h-screen gap-6 bg-background p-6 text-foreground">\n${blocks}\n    </main>\n  )\n}\n`,
  )
}

try {
  console.log(`shadcn registry smoke temp: ${tempRoot}`)

  run('bun', ['run', 'build'])

  shadcn(['build', 'registry.json', '-o', registryBuildDir, '--cwd', root])

  mkdirSync(packSourceDir, { recursive: true })
  mkdirSync(packDir, { recursive: true })
  mkdirSync(consumerParent, { recursive: true })

  cpSync(join(root, 'packages', 'charts'), join(packSourceDir, 'charts'), {
    recursive: true,
  })
  cpSync(join(root, 'packages', 'charts-react'), join(packSourceDir, 'charts-react'), {
    recursive: true,
  })
  patchReactPackageForLocalPack(join(packSourceDir, 'charts-react'))

  run('npm', [
    'pack',
    '--pack-destination',
    packDir,
    join(packSourceDir, 'charts'),
    join(packSourceDir, 'charts-react'),
  ])

  const chartsVersion = readJson(join(packSourceDir, 'charts', 'package.json')).version
  const reactVersion = readJson(join(packSourceDir, 'charts-react', 'package.json')).version
  const localDependencies = [
    `@pitant/charts@file:${join(packDir, `pitant-charts-${chartsVersion}.tgz`)}`,
    `@pitant/charts-react@file:${join(packDir, `pitant-charts-react-${reactVersion}.tgz`)}`,
  ]

  shadcn([
    'init',
    '-t',
    'vite',
    '-b',
    'base',
    '--no-monorepo',
    '--preset',
    'nova',
    '-y',
    '-c',
    consumerParent,
    '--name',
    consumerName,
  ])

  const installedItems = []
  for (const itemPath of registryItems()) {
    const item = readJson(itemPath)
    const localItemPath = itemPath.replace(/\.json$/, '.local.json')
    writeJson(localItemPath, {
      ...item,
      dependencies: localDependencies,
    })

    shadcn(['add', itemPath, '-c', consumerDir, '-y', '--dry-run'])
    shadcn(['add', localItemPath, '-c', consumerDir, '-y', '--overwrite'])

    for (const file of item.files ?? []) {
      if (!file.target) {
        continue
      }

      const targetPath = targetToConsumerPath(file.target)
      if (!existsSync(targetPath)) {
        throw new Error(`${item.name}: expected installed file missing: ${targetPath}`)
      }

      installedItems.push({
        name: item.name,
        importPath: importPathFromTarget(file.target),
      })
    }
  }

  buildConsumerApp(installedItems)
  run('bun', ['run', 'typecheck'], { cwd: consumerDir })
  run('bun', ['run', 'build'], { cwd: consumerDir })

  console.log(`shadcn registry smoke passed: ${installedItems.length} installed block files`)

  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true })
  } else {
    console.log(`kept smoke temp directory: ${tempRoot}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error(`kept smoke temp directory for inspection: ${tempRoot}`)
  process.exit(1)
}
