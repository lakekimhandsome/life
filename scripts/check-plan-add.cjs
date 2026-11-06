// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')

async function until(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('Timed out waiting for mock server')
}

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({ locale: 'ko-KR' })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const env = readFileSync('.env', 'utf8')
    const ref = new URL(env.match(/^VITE_SUPABASE_URL=(.*)$/m)[1].replace(/["']/g, '').trim()).hostname.split('.')[0]
    await page.addInitScript(({ user, ref }) => {
      localStorage.setItem('life-locale', 'ko')
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: 'fake-token', refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, ref })
    let rows = []
    const inserts = []
    const patches = []
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const table = url.pathname.split('/').pop()
      const method = request.method()
      if (table === 'life_user_prefs') return route.fulfill({ json: method === 'GET' ? { user_id: user.id, prefs: { locale: 'ko' } } : null })
      if (table !== 'life_objects') return route.fulfill({ json: [] })
      const id = url.searchParams.get('id')?.replace(/^eq\./, '')
      if (method === 'POST') {
        const row = request.postDataJSON()
        inserts.push({ row, finish: async (fail = false) => {
          if (fail) return route.fulfill({ status: 400, json: { message: 'test save failure' } })
          rows.push(row)
          return route.fulfill({ status: 201, body: '' })
        } })
        return
      }
      if (method === 'PATCH') {
        patches.push(id)
        assert(rows.some((row) => row.id === id), 'Update must wait for creation')
        rows = rows.map((row) => row.id === id ? { ...row, ...request.postDataJSON() } : row)
      }
      if (method === 'DELETE') rows = rows.filter((row) => row.id !== id)
      const result = id ? rows.filter((row) => row.id === id) : rows
      return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? result[0] ?? null : result })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    await page.goto(`${base}/plans`)
    const input = page.locator('.todo-composer input')
    await input.waitFor()
    await page.waitForFunction(() => !document.querySelector('.todo-composer input').disabled)
    async function add(title) {
      await input.fill(title)
      await input.press('Enter')
      await page.getByRole('button', { name: title, exact: true }).waitFor()
      assert.equal(await input.inputValue(), '')
      assert.equal(await input.isEnabled(), true)
    }
    await add('첫 계획')
    await until(() => inserts.length === 1)
    assert.equal(rows.length, 0, 'Plan must be visible before server saves it')
    await page.locator('.todo-toggle').first().click()
    assert.equal(await page.locator('.todo-toggle').first().getAttribute('aria-pressed'), 'true')
    assert.equal(patches.length, 0)
    await add('두 번째 계획')
    await until(() => inserts.length === 2)
    assert(inserts[1].row.meta.order > inserts[0].row.meta.order)
    await input.fill('계속 작성 중')
    await inserts[1].finish()
    await inserts[0].finish()
    await until(() => patches.length === 1)
    assert.equal(await input.inputValue(), '계속 작성 중', 'Success must preserve the next draft')
    assert.equal(rows.find((row) => row.title === '첫 계획').meta.done, true)
    assert.deepEqual(await page.locator('.todo-title').allTextContents(), ['첫 계획', '두 번째 계획'])

    await add('실패할 계획')
    await until(() => inserts.length === 3)
    await input.fill('새로 쓰는 내용')
    await inserts[2].finish(true)
    await page.getByRole('alert').waitFor()
    await page.getByRole('button', { name: '실패할 계획', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await input.inputValue(), '새로 쓰는 내용')
    assert.equal(await page.locator('.todo-item').count(), 2, 'Failure must remove only the failed plan')
    await add('재시도 계획')
    await until(() => inserts.length === 4)
    await inserts[3].finish(true)
    await page.getByRole('alert').waitFor()
    await page.waitForFunction(() => document.querySelector('.todo-composer input').value === '재시도 계획')
    assert.equal(await input.inputValue(), '재시도 계획', 'Failure restores an empty draft for retry')
    await page.reload()
    await page.getByRole('button', { name: '첫 계획', exact: true }).waitFor()
    assert.equal(await page.locator('.todo-item').count(), 2)
    assert.equal(await page.locator('.todo-toggle').first().getAttribute('aria-pressed'), 'true')
    assert.deepEqual(errors, [])
    console.log(`PASS ${engine.name()}: immediate add, consecutive adds, queued check, out-of-order saves, draft preservation, rollback, retry and reload`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of [chromium, webkit]) await check(engine) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
