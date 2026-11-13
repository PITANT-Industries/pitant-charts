import { $ } from 'bun'

const archive = Bun.argv[2]
if (!archive) throw Error('Pass the path to a packed release')
const files = new Set((await $`tar -tzf ${archive}`.text()).trim().split('\n'))
const manifest = JSON.parse(await $`tar -xOzf ${archive} package/package.json`.text())
const targets: string[] = Object.values(manifest.exports).flatMap((entry) =>
  typeof entry === 'string' ? [entry] : Object.values(entry as Record<string, string>),
)
const expected = [
  'LICENSE',
  'README.md',
  'PALETTE.md',
  'THIRD_PARTY_NOTICES.md',
  'licenses/Bklit-UI-MIT.txt',
  'licenses/Warpdrive-MIT.txt',
  'licenses/Recharts-MIT.txt',
  'licenses/React-MIT.txt',
  ...targets.map((target) => target.replace(/^\.\//, '')),
]
for (const file of expected) {
  if (!files.has(`package/${file}`)) throw Error(`Missing from tarball: ${file}`)
}
for (const file of files) {
  if (/^package\/(?:node_modules|src|\.openai|dist-catalog)\//.test(file)) {
    throw Error(`Unexpected tarball entry: ${file}`)
  }
}
if (manifest.license !== 'MIT' || Object.keys(manifest.dependencies).join() !== 'recharts') {
  throw Error('Unexpected package license or runtime dependencies')
}
console.log(`Verified ${manifest.name}@${manifest.version}: exports, notices and package contents`)
