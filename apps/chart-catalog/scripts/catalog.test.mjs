import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const catalog = JSON.parse(await read('src/catalog-data.json'))
const chartPreview = await read('src/charts/ChartPreview.tsx')
const publicCatalogUrl = 'https://opensource.pitant.de/charts/'

test('covers 74 chart and tooltip families and all 363 public examples', () => {
  const ids = new Set()
  const urls = new Set()
  const familyIds = new Set()
  assert.equal(catalog.length, 74)
  for (const family of catalog) {
    assert(!familyIds.has(family.id), `Duplicate family ${family.id}`)
    familyIds.add(family.id)
    assert.equal(family.url, `${publicCatalogUrl}#docs=${family.id}`)
    for (const [index, example] of family.examples.entries()) {
      assert.equal(example.family, family.id)
      assert.equal(example.position, index + 1)
      assert.equal(example.url, `${publicCatalogUrl}#example=${example.id}`)
      assert(example.title && example.label)
      assert(!ids.has(example.id), `Duplicate example ${example.id}`)
      ids.add(example.id)
      urls.add(example.url)
    }
  }
  assert.equal(catalog.find((family) => family.id === 'tooltip').examples.length, 11)
  assert.deepEqual(catalog.find((family) => family.id === 'campbell-diagram')?.examples.map((example) => example.id), ['campbell-diagram-ottawa'])
  assert.deepEqual(catalog.find((family) => family.id === 'mode-shapes')?.examples.map((example) => example.id), ['mode-shapes-cantilever'])
  assert.deepEqual(catalog.find((family) => family.id === 'shaft-orbit')?.examples.map((example) => example.id), ['shaft-orbit-probes'])
  assert.deepEqual(catalog.find((family) => family.id === 'frequency-response')?.examples.map((example) => example.id), ['frequency-response-servo'])
  assert.deepEqual(catalog.find((family) => family.id === 'coherence-phase')?.examples.map((example) => example.id), ['coherence-phase-bearing'])
  assert.deepEqual(catalog.find((family) => family.id === 'wavelet-scalogram')?.examples.map((example) => example.id), ['wavelet-scalogram-bearing'])
  assert.deepEqual(catalog.find((family) => family.id === 'bearing-envelope')?.examples.map((example) => example.id), ['bearing-envelope-ottawa'])
  assert.deepEqual(catalog.find((family) => family.id === 'eye-diagram')?.examples.map((example) => example.id), ['eye-diagram-nrz'])
  assert.deepEqual(catalog.find((family) => family.id === 'allan-deviation')?.examples.map((example) => example.id), ['allan-deviation-stability'])
  assert.deepEqual(catalog.find((family) => family.id === 'phase-plane')?.examples.map((example) => example.id), ['phase-plane-pendulum'])
  assert.deepEqual(catalog.find((family) => family.id === 'xrd-peak-tracker')?.examples.map((example) => example.id), ['xrd-peak-tracker-dynic2'])
  assert.deepEqual(catalog.find((family) => family.id === 'stress-strain-comparison')?.examples.map((example) => example.id), ['stress-strain-heat-treatment'])
  assert.deepEqual(catalog.find((family) => family.id === 'full-field-strain')?.examples.map((example) => example.id), ['full-field-strain-tensile'])
  assert.deepEqual(catalog.find((family) => family.id === 'fatigue-sn')?.examples.map((example) => example.id), ['fatigue-sn-measured'])
  assert.deepEqual(catalog.find((family) => family.id === 'crack-growth')?.examples.map((example) => example.id), ['crack-growth-fatigue'])
  assert.deepEqual(catalog.find((family) => family.id === 'binary-phase-diagram')?.examples.map((example) => example.id), ['binary-phase-diagram-ag-cu'])
  assert.deepEqual(catalog.find((family) => family.id === 'ternary-mixture-map')?.examples.map((example) => example.id), ['ternary-mixture-response'])
  assert.deepEqual(catalog.find((family) => family.id === 'industrial-ct')?.examples.map((example) => example.id), ['industrial-ct-porosity'])
  assert.deepEqual(catalog.find((family) => family.id === 'cad-scan-deviation')?.examples.map((example) => example.id), ['cad-scan-deviation-registered'])
  assert.deepEqual(catalog.find((family) => family.id === 'cie-chromaticity')?.examples.map((example) => example.id), ['cie-chromaticity-gamuts'])
  assert.deepEqual(catalog.find((family) => family.id === 'hyperspectral-cube')?.examples.map((example) => example.id), ['hyperspectral-cube-cuprite'])
  assert.deepEqual(catalog.find((family) => family.id === 'response-surface')?.examples.map((example) => example.id), ['response-surface-thermal'])
  assert.deepEqual(catalog.find((family) => family.id === 'mass-spectrum-mirror')?.examples.map((example) => example.id), ['mass-spectrum-mirror-caffeine'])
  assert.equal(ids.size, 363)
  assert.equal(urls.size, 363)
})

test('documents every catalog family exactly once with practical guidance', async () => {
  const paths = ['src/gallery/docs/cartesian.json', 'src/gallery/docs/specialized.json', 'src/gallery/docs/scientific.json']
  const sources = await Promise.all(paths.map(read))
  const sections = ['summary', 'useWhen', 'data', 'reading']
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
      const scientific = paths[index].endsWith('/scientific.json')
      const fields = [...sections, 'notes', ...(scientific ? ['properties', 'sources'] : [])]
      assert.deepEqual(new Set(Object.keys(guide)), new Set(fields), `Unexpected fields for ${id}`)
      if (scientific) {
        assert(guide.properties.length >= 2 && guide.properties.every(({ name, type, description }) => name && type && description))
        assert(guide.sources.length && guide.sources.every(({ label, href }) => label && new URL(href).protocol === 'https:'))
      }
      for (const section of sections) {
        assert(
          typeof guide[section] === 'string' && guide[section].trim().length >= 24,
          `Missing substantive ${section} for ${id}`,
        )
      }
      assert(
        Array.isArray(guide.notes) && guide.notes.length >= 1 && (scientific || guide.notes.length <= 2),
        `Unexpected number of notes for ${id}`,
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
  assert.equal(mapped.length, catalog.length)
  assert.deepEqual(mapped.sort(), catalog.map((family) => family.id).sort())
})

test('public pages omit internal review tools and reference links', async () => {
  const paths = ['src/gallery/Gallery.tsx', 'src/gallery/FamilyDocumentation.tsx', 'src/gallery/docs/cartesian.json', 'src/gallery/docs/specialized.json', 'src/gallery/docs/scientific.json']
  const sources = await Promise.all(paths.map(read))
  const internal = /parity[- ]?(?:review|notes|overview)|checked behavior|reference (?:gallery|preview)|https?:\/\/(?:www\.)?shadcn\.io|<iframe\b/i
  for (const [index, source] of sources.entries()) {
    assert.equal(internal.test(source), false, `Internal review material in ${paths[index]}`)
  }
})

test('CERN mass spectrum bins preserve the published event count', async () => {
  const fixture = JSON.parse(await read('src/charts/scientific/particle/cms-dimuon-bins.json'))
  assert.equal(fixture.source.doi, '10.7483/OPENDATA.CMS.CB8H.MFFA')
  assert.equal(fixture.eventCount, 100_000)
  assert.equal(fixture.counts.length, 240)
  assert(fixture.counts.every((count) => Number.isInteger(count) && count > 0))
  assert.equal(fixture.counts.reduce((total, count) => total + count, 0), fixture.eventCount)
})
