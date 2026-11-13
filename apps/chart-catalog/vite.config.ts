import { cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

const fontPackages = [
  '@fontsource-variable/geist',
  '@fontsource-variable/geist-mono',
  '@fontsource-variable/hanken-grotesk',
]

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'catalog-third-party-notices',
      apply: 'build',
      writeBundle({ dir }) {
        if (!dir) return
        cpSync(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), resolve(dir, 'THIRD_PARTY_NOTICES.md'))
        cpSync(new URL('./licenses', import.meta.url), resolve(dir, 'licenses'), { recursive: true })
      },
    },
  ],
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
