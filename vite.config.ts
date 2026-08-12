import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

// Short commit SHA, so the footer stamp changes on every merge automatically.
// Vercel exposes the SHA as an env var; locally we read it from git.
function commitSha(): string {
  try {
    const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA
    if (fromEnv) return fromEnv.slice(0, 7)
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(commitSha()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
