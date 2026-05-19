import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const registryPath = join(root, 'registry.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf8'))

const allowedItemTypes = new Set([
  'registry:base',
  'registry:block',
  'registry:component',
  'registry:font',
  'registry:hook',
  'registry:item',
  'registry:lib',
  'registry:page',
  'registry:style',
  'registry:theme',
  'registry:ui',
  'registry:file',
])

const allowedFileTypes = new Set([
  'registry:block',
  'registry:component',
  'registry:file',
  'registry:hook',
  'registry:lib',
  'registry:page',
  'registry:ui',
])

const targetPrefixes = ['@components/', '@ui/', '@lib/', '@hooks/', '~/']
const errors = []

if (registry.$schema !== 'https://ui.shadcn.com/schema/registry.json') {
  errors.push('registry.json must use the shadcn registry schema URL.')
}
if (registry.name !== 'pitant-charts') {
  errors.push('registry.name must be pitant-charts.')
}
if (!Array.isArray(registry.items) || registry.items.length === 0) {
  errors.push('registry.items must be a non-empty array.')
}

const names = new Set()
for (const item of registry.items ?? []) {
  if (!item.name || typeof item.name !== 'string') {
    errors.push('every item must have a string name.')
    continue
  }
  if (names.has(item.name)) {
    errors.push(`duplicate registry item name: ${item.name}`)
  }
  names.add(item.name)
  if (!allowedItemTypes.has(item.type)) {
    errors.push(`${item.name}: unsupported item type ${item.type}`)
  }
  if (!Array.isArray(item.dependencies) || !item.dependencies.includes('@pitant/charts-react')) {
    errors.push(`${item.name}: must declare @pitant/charts-react dependency.`)
  }
  if (!Array.isArray(item.files) || item.files.length === 0) {
    errors.push(`${item.name}: files must be a non-empty array.`)
    continue
  }
  for (const file of item.files) {
    if (!file.path || typeof file.path !== 'string') {
      errors.push(`${item.name}: every file must have a string path.`)
      continue
    }
    if (isAbsolute(file.path) || file.path.includes('..')) {
      errors.push(`${item.name}: file path must be repo-relative: ${file.path}`)
    }
    if (!allowedFileTypes.has(file.type)) {
      errors.push(`${item.name}: unsupported file type ${file.type}`)
    }
    if (!existsSync(join(root, file.path))) {
      errors.push(`${item.name}: missing file ${file.path}`)
    }
    if (file.target !== undefined) {
      const validTarget = targetPrefixes.some((prefix) => file.target.startsWith(prefix))
      if (!validTarget) {
        errors.push(`${item.name}: target must use a supported shadcn placeholder: ${file.target}`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('registry validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`registry validation passed: ${registry.items.length} items`)
