import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const catalogRoot = new URL('../apps/chart-catalog/', import.meta.url)
const documentUrl = new URL('REMAINING_WORK.md', catalogRoot)
const begin = '<!-- BEGIN GENERATED REMAINING MATRIX -->'
const end = '<!-- END GENERATED REMAINING MATRIX -->'
const check = process.argv.includes('--check')
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('Usage: node scripts/export-remaining-work.mjs [--check]')
}

const [families, notes, document] = await Promise.all([
  readFile(new URL('src/catalog-data.json', catalogRoot), 'utf8').then(JSON.parse),
  readFile(new URL('src/gallery/parity-notes.json', catalogRoot), 'utf8').then(JSON.parse),
  readFile(documentUrl, 'utf8'),
])
const examples = families.flatMap((family) => family.examples)
const ids = new Set(examples.map((example) => example.id))
const noteIds = Object.keys(notes)
if (examples.length !== 331 || ids.size !== 331) {
  throw new Error(
    `Expected 331 unique catalogue IDs; found ${examples.length} entries / ${ids.size} IDs`,
  )
}
const missing = [...ids].filter((id) => !Object.hasOwn(notes, id))
const extra = noteIds.filter((id) => !ids.has(id))
if (missing.length || extra.length || noteIds.length !== 331) {
  throw new Error(
    `Remaining-note ID mismatch: ${JSON.stringify({ missing, extra, count: noteIds.length })}`,
  )
}
for (const family of families) {
  for (const example of family.examples) {
    if (example.family !== family.id) throw new Error(`Wrong family for ${example.id}`)
    if (typeof notes[example.id].remaining !== 'string' || !notes[example.id].remaining.trim()) {
      throw new Error(`Missing remaining text for ${example.id}`)
    }
    if (typeof example.url !== 'string' || new URL(example.url).protocol !== 'https:') {
      throw new Error(`Missing HTTPS reference URL for ${example.id}`)
    }
  }
}
if (document.split(begin).length !== 2 || document.split(end).length !== 2) {
  throw new Error('Expected exactly one generated-matrix marker pair')
}
const start = document.indexOf(begin) + begin.length
const finish = document.indexOf(end)
if (finish < start) throw new Error('Generated-matrix markers are reversed')

// Escape only Markdown table delimiters; notes remain verbatim after rendering.
const cell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', '<br>')
const sections = families.map((family) =>
  [
    `### ${family.id} — ${family.examples.length} examples`,
    '',
    '| Exact ID | Reference URL | Original remaining note |',
    '| --- | --- | --- |',
    ...family.examples.map(
      (example) =>
        `| \`${example.id}\` | [Reference](${example.url}) | ${cell(notes[example.id].remaining)} |`,
    ),
  ].join('\n'),
)
const matrix = `\n\n331 unique IDs; 331 reference URLs; 331 nonempty remaining notes. Catalogue order is preserved.\n\n${sections.join('\n\n')}\n\n`
const output = document.slice(0, start) + matrix + document.slice(finish)
if (check && output !== document) {
  throw new Error('Generated matrix is stale; run node scripts/export-remaining-work.mjs')
}
if (!check && output !== document) await writeFile(documentUrl, output)
console.log(
  JSON.stringify({
    mode: check ? 'check' : 'write',
    document: fileURLToPath(documentUrl).split('/apps/chart-catalog/').at(-1),
    families: families.length,
    examples: examples.length,
    uniqueIds: ids.size,
    notes: noteIds.length,
    missing,
    extra,
    exactSourceNotes: true,
    matrixCurrent: true,
  }),
)
