import { cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nativeSourceEntries, writeSourceArchive } from './vite.native-source'
import { writePublicRegistry } from './vite.public-registry'

const fontPackages = [
  '@fontsource-variable/geist',
  '@fontsource-variable/geist-mono',
  '@fontsource-variable/hanken-grotesk',
]
const catalogDirectory = fileURLToPath(new URL('.', import.meta.url))
const sourceFiles = [
  '.gitignore',
  'src',
  'public',
  'scripts',
  'index.html',
  'components.json',
  'package.json',
  'tsconfig.json',
  'tsconfig.library.json',
  'vite.config.ts',
  'vite.library.config.ts',
  'vite.native-source.ts',
  'vite.public-registry.ts',
  'LICENSE',
  'SOURCE.md',
  'README.md',
  'CALLER_DATA.md',
  'THIRD_PARTY_NOTICES.md',
  'licenses',
]

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'catalog-source-and-licenses',
      apply: 'build',
      writeBundle({ dir }) {
        if (!dir) return
        for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
          cpSync(resolve(catalogDirectory, file), resolve(dir, file))
        }
        cpSync(new URL('./licenses', import.meta.url), resolve(dir, 'licenses'), { recursive: true })
        writePublicRegistry(dir)
        writeSourceArchive(resolve(dir, 'chart-catalog-source.tgz'), [
          '-C', catalogDirectory, ...sourceFiles, ...nativeSourceEntries, 'registry.json', 'registry',
        ])
      },
    },
  ],
  resolve: { alias: { '@': resolve(catalogDirectory, 'src') } },
  server: {
    fs: {
      // Bun can link font packages from its global store.
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        ...fontPackages.map((name) => dirname(fileURLToPath(import.meta.resolve(name)))),
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
  },
})
