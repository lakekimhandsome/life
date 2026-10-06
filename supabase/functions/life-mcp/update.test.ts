import assert from 'node:assert/strict'
import test from 'node:test'
import { withMergedMeta } from './update.ts'

test('shallow-merges supplied meta keys into existing meta', () => {
  assert.deepEqual(
    withMergedMeta(
      { updated_at: '2026-10-06T00:00:00.000Z' },
      { a: 1, b: 2, nested: { x: 1 } },
      { b: 3 },
    ),
    {
      updated_at: '2026-10-06T00:00:00.000Z',
      meta: { a: 1, b: 3, nested: { x: 1 } },
    },
  )
})

test('adds new meta keys', () => {
  assert.deepEqual(
    withMergedMeta({}, { a: 1 }, { b: 2 }),
    { meta: { a: 1, b: 2 } },
  )
})

test('an empty meta object preserves every existing meta key', () => {
  assert.deepEqual(
    withMergedMeta({}, { status: 'done', version: 'v1' }, {}),
    { meta: { status: 'done', version: 'v1' } },
  )
})

test('updating only the title does not include meta in the patch', () => {
  assert.deepEqual(
    withMergedMeta({ title: 'Renamed' }, { status: 'done' }, undefined),
    { title: 'Renamed' },
  )
})

test('supplied meta keys overwrite matching existing keys', () => {
  assert.deepEqual(
    withMergedMeta({}, { status: 'active', version: 'v1' }, { status: 'done' }),
    { meta: { status: 'done', version: 'v1' } },
  )
})

test('replaces nested objects instead of deep-merging them', () => {
  assert.deepEqual(
    withMergedMeta({}, { nested: { x: 1 }, untouched: true }, { nested: { y: 2 } }),
    { meta: { nested: { y: 2 }, untouched: true } },
  )
})

test('null is stored as a meta value rather than deleting the key', () => {
  assert.deepEqual(
    withMergedMeta({}, { status: 'done', version: 'v1' }, { status: null }),
    { meta: { status: null, version: 'v1' } },
  )
})
