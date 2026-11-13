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
