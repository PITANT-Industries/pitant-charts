import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      external: /^(react(?:-dom)?|recharts)(?:\/|$)/,
      output: { banner: '"use client";' },
    },
    outDir: 'dist-library',
    lib: {
      entry: 'src/standalone/index.ts',
      formats: ['es'],
      fileName: 'chart-library',
      cssFileName: 'chart-library',
    },
  },
})
