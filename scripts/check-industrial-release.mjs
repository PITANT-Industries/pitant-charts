import { readFileSync } from 'node:fs'

const core = JSON.parse(
  readFileSync(new URL('../packages/charts/package.json', import.meta.url), 'utf8'),
)
const react = JSON.parse(
  readFileSync(new URL('../packages/charts-react/package.json', import.meta.url), 'utf8'),
)

if (core.version !== react.version) {
  throw new Error(`Industrial package versions differ: ${core.version} and ${react.version}`)
}
if (core.license !== 'MPL-2.0' || react.license !== core.license) {
  throw new Error('Industrial package licenses must match the repository MPL-2.0 license.')
}

const expectedRef = `refs/tags/industrial-v${core.version}`
if (process.env.PUBLISH_DRY_RUN !== 'true' && process.env.GITHUB_REF !== expectedRef) {
  throw new Error(`Publishing requires ${expectedRef}, got ${process.env.GITHUB_REF ?? 'no ref'}.`)
}

console.log(`Industrial package versions match at ${core.version}.`)
