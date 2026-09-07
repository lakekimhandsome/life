import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const commitHash = (process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }))
  .trim()
  .slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: { __COMMIT_HASH__: JSON.stringify(commitHash) },
})
