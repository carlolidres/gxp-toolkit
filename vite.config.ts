/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function resolveBase(env: Record<string, string>): string {
  const explicit = env.VITE_BASE_PATH?.trim()
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`
  }
  if (env.VITE_GITHUB_PAGES === 'true') {
    return '/gxp-toolkit/'
  }
  return './'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const base = resolveBase(env)

  return {
    plugins: [react()],
    base,
    test: {
      environment: 'node',
      globals: true,
    },
  }
})
