import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import registry from '../../registry.json'

const homepage = 'https://opensource.pitant.de/charts/'
const registrySource = new URL('../../', import.meta.url)
const itemSchema = 'https://ui.shadcn.com/schema/registry-item.json'
const installDocs = `Install @pitant/charts and @pitant/charts-react from source before using this block. See ${homepage}#docs=installation.`

export function writePublicRegistry(outputDir: string) {
  const registryDir = join(outputDir, 'r')
  mkdirSync(registryDir, { recursive: true })

  const items = registry.items.map(({ name, type, title, description, categories, files }) => {
    const item = { name, type, title, description, categories, docs: installDocs, files }
    const payload = {
      $schema: itemSchema,
      ...item,
      files: files.map((file) => ({
        ...file,
        content: readFileSync(new URL(file.path, registrySource), 'utf8'),
      })),
    }
    writeFileSync(join(registryDir, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`)
    return item
  })

  const index = { $schema: registry.$schema, name: registry.name, homepage, items }
  writeFileSync(join(registryDir, 'registry.json'), `${JSON.stringify(index, null, 2)}\n`)
}
