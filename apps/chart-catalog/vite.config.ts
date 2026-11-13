import { cpSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  build: {
    chunkSizeWarningLimit: 1400,
  },
})
