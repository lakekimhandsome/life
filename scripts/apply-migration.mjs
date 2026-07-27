#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql via Supabase Management API.
 *
 * Requires: SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 * Optional: SUPABASE_PROJECT_REF (defaults to VITE_SUPABASE_URL project ref)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  try {
    const text = readFileSync(join(root, '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match) continue
      if (!(match[1] in process.env)) process.env[match[1]] = match[2]
    }
  } catch {
    // ignore
  }
}

loadEnv()

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN.\n' +
      'Create one at https://supabase.com/dashboard/account/tokens\n' +
      'Then: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migration.mjs',
  )
  process.exit(1)
}

const ref =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.VITE_SUPABASE_URL ?? '')
    .replace(/^https:\/\//, '')
    .replace(/\.supabase\.co.*$/, '')

if (!ref) {
  console.error('Could not resolve SUPABASE_PROJECT_REF')
  process.exit(1)
}

const migrationsDir = join(root, 'supabase', 'migrations')
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const file of files) {
  const query = readFileSync(join(migrationsDir, file), 'utf8')
  console.log(`Applying ${file}...`)
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const body = await response.text()
  if (!response.ok) {
    console.error(`Failed (${response.status}): ${body}`)
    process.exit(1)
  }
  console.log(`OK ${file}`)
}

console.log('All migrations applied.')
