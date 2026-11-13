import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const workspace = new URL('../', import.meta.url)
const catalog = JSON.parse(await readFile(new URL('package.json', workspace), 'utf8'))
const dashboard = JSON.parse(
  await readFile(new URL('../../packages/charts-ui/package.json', workspace), 'utf8'),
)

assert.equal(catalog.name, '@pitant/chart-catalog')
assert.equal(catalog.private, true, 'The chart catalog workspace must be private')
assert.equal(catalog.version, dashboard.version, 'Match the PITANT dashboard chart version')

if (process.argv.includes('--pack')) {
  const output = execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: workspace,
    encoding: 'utf8',
  })
  const [archive] = JSON.parse(output)
  const files = new Set(archive.files.map(({ path }) => path))
  const exports = [
    catalog.exports['.'].types,
    catalog.exports['.'].import,
    catalog.exports['./styles.css'],
  ]
  for (const path of [...exports, 'THIRD_PARTY_NOTICES.md']) {
    assert(files.has(path.replace(/^\.\//, '')), `Missing from catalog package: ${path}`)
  }
  assert([...files].some((path) => path.startsWith('licenses/')), 'Missing catalog licenses')
  assert(
    [...files].every((path) => !/^(dist|src|\.openai)\//.test(path)),
    'Unexpected app source or site build in the catalog package',
  )
}

console.log(`Verified ${catalog.name}@${catalog.version}`)
