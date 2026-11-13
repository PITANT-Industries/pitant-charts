import { dirname } from 'node:path'
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
  plugins: [react()],
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
