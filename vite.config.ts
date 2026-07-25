import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = dirname(fileURLToPath(import.meta.url))

/** Serve pdf.js worker from public/ so Vite `base` (e.g. /gxp-toolkit/) resolves correctly. */
function copyPdfJsWorker() {
  const src = resolve(rootDir, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  const dest = resolve(rootDir, 'public/pdf.worker.min.mjs')
  if (!existsSync(src)) {
    throw new Error(`pdf.js worker not found at ${src}. Run npm install.`)
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
}

export default defineConfig(({ mode }) => {
  copyPdfJsWorker()

  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
