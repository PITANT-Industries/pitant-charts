import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspaceDirectory = fileURLToPath(new URL('../../', import.meta.url))
const packageFiles = ['src', 'package.json', 'tsconfig.json', 'tsup.config.ts', 'LICENSE', 'LICENSE-MIT', 'SOURCE.md']

export const nativeSourceEntries = [
  '-C', workspaceDirectory,
  ...['charts', 'charts-react'].flatMap((name) => packageFiles.map((file) => `packages/${name}/${file}`)),
  'packages/charts/styles',
]

export function writeSourceArchive(output: string, entries: string[]) {
  execFileSync(
    'tar',
    ['-czf', output, '--exclude=.DS_Store', '--exclude=._*', '--exclude=__pycache__', '--exclude=*.local', ...entries],
    { env: { ...process.env, COPYFILE_DISABLE: '1' } },
  )
}
