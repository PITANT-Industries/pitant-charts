import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const catalog = JSON.parse(await read('src/catalog-data.json'))
const chartPreview = await read('src/charts/ChartPreview.tsx')
const parityNotes = JSON.parse(await read('src/gallery/parity-notes.json'))

test('covers 44 chart families and all 331 reference entries', () => {
  const ids = new Set()
  const urls = new Set()
  const familyIds = new Set()
  assert.equal(catalog.length, 45)
  for (const family of catalog) {
    assert(!familyIds.has(family.id), `Duplicate family ${family.id}`)
    familyIds.add(family.id)
    for (const [index, example] of family.examples.entries()) {
      assert.equal(example.family, family.id)
      assert.equal(example.position, index + 1)
      assert.equal(example.url, `https://www.shadcn.io/examples/${example.id}`)
      assert(example.title && example.label)
      assert(!ids.has(example.id), `Duplicate example ${example.id}`)
      ids.add(example.id)
      urls.add(example.url)
    }
  }
  assert.equal(catalog.find((family) => family.id === 'tooltip').examples.length, 11)
  assert.equal(ids.size, 331)
  assert.equal(urls.size, 331)
})

test('documents every catalog family exactly once with practical guidance', async () => {
  const paths = ['src/gallery/docs/cartesian.json', 'src/gallery/docs/specialized.json']
  const sources = await Promise.all(paths.map(read))
  const sections = ['summary', 'useWhen', 'data', 'reading']
  const fields = new Set([...sections, 'notes'])
  const documented = new Set()

  for (const [index, source] of sources.entries()) {
    const families = JSON.parse(source)
    assert(
      families && typeof families === 'object' && !Array.isArray(families),
      `Invalid documentation map in ${paths[index]}`,
    )

    for (const [id, guide] of Object.entries(families)) {
      assert(!documented.has(id), `Duplicate documentation for ${id}`)
      documented.add(id)
      assert(guide && typeof guide === 'object' && !Array.isArray(guide), `Invalid documentation for ${id}`)
      assert.deepEqual(new Set(Object.keys(guide)), fields, `Unexpected fields for ${id}`)
      for (const section of sections) {
        assert(
          typeof guide[section] === 'string' && guide[section].trim().length >= 24,
          `Missing substantive ${section} for ${id}`,
        )
      }
      assert(
        Array.isArray(guide.notes) && guide.notes.length >= 1 && guide.notes.length <= 2,
        `Expected one or two notes for ${id}`,
      )
      assert(
        guide.notes.every((note) => typeof note === 'string' && note.trim().length >= 16),
        `Missing substantive notes for ${id}`,
      )
    }
  }

  assert.deepEqual(documented, new Set(catalog.map((family) => family.id)))
})

test('each catalog family is routed to exactly one renderer group', () => {
  const groups = chartPreview.match(/export const rendererFamilies = \{([\s\S]+?)\} as const/)?.[1] ?? ''
  const mapped = Array.from(groups.matchAll(/'([^']+)'/g), (match) => match[1])
  assert.equal(mapped.length, 45)
  assert.deepEqual(mapped.sort(), catalog.map((family) => family.id).sort())
})

test('every catalog example has a record of checked behavior and remaining gaps', () => {
  const ids = new Set(catalog.flatMap((family) => family.examples.map((example) => example.id)))
  assert.deepEqual(new Set(Object.keys(parityNotes)), ids)
  for (const [id, note] of Object.entries(parityNotes)) {
    assert(typeof note.checked === 'string' && note.checked.trim(), `Missing verification for ${id}`)
    assert(typeof note.remaining === 'string' && note.remaining.trim(), `Missing remaining comparison for ${id}`)
  }
})
