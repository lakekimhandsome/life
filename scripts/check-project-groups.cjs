// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const now = new Date().toISOString()
    const statuses = ['active', 'idea', 'paused', 'done']
    const objects = [...statuses.map((status) => ({ type: 'project', title: status, meta: { status } })),
      ...['note', 'journal', 'goal'].map((type) => ({ type, title: type, meta: {} }))]
      .map((object, index) => ({ id: `test-${index}`, user_id: user.id, body: 'Preview', occurred_at: now,
        created_at: now, updated_at: now, visibility: 'private', share_token: null, ...object }))
    await page.addInitScript((user) => {
      localStorage.setItem('life-locale', 'en')
      const payload = btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
      localStorage.setItem('sb-pbmzjxjtctwhgxxbcgxl-auth-token', JSON.stringify({
        access_token: `e30.${payload}.fake`, refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600, token_type: 'bearer', user,
      }))
    }, user)
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', (route) => {
      const table = new URL(route.request().url()).pathname.split('/').pop()
      return route.fulfill({ json: table === 'life_objects' ? objects
        : table === 'life_user_prefs' ? { user_id: user.id, prefs: { locale: 'en' } } : [] })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    await page.goto(`${base}/projects`)
    await page.locator('.object-group').first().waitFor()
    assert.equal(await page.locator('.object-group[open]').count(), 4)
    for (let index = 0; index < statuses.length; index++) {
      const group = page.locator('.object-group').nth(index)
      const summary = group.locator('summary')
      assert.equal(await group.locator('strong').textContent(), '1')
      await summary.click()
      assert.equal(await group.locator('.object-row').isVisible(), false)
      assert.equal(await page.locator('.object-group[open]').count(), 3)
      await summary.focus()
      await page.keyboard.press('Enter')
      assert.equal(await group.locator('.object-row').isVisible(), true)
      await page.keyboard.press('Space')
      assert.equal(await group.locator('.object-row').isVisible(), false)
      await summary.click()
      assert.equal(await page.locator('.object-group[open]').count(), 4)
    }
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.locator('.object-group summary').nth(0).click()
    await page.locator('.object-group summary').nth(2).click()
    await page.waitForFunction(() => localStorage.getItem('life-project-group-active') === 'closed'
      && localStorage.getItem('life-project-group-paused') === 'closed')
    await page.locator('.sidebar-nav a[href="/notes"]').click()
    await page.locator('.object-row').first().waitFor()
    await page.locator('.sidebar-nav a[href="/projects"]').click()
    await page.locator('.object-group').first().waitFor()
    assert.deepEqual(await page.locator('.object-group').evaluateAll((groups) => groups.map((group) => group.open)), [false, true, false, true])
    await page.reload()
    await page.locator('.object-group').first().waitFor()
    assert.deepEqual(await page.locator('.object-group').evaluateAll((groups) => groups.map((group) => group.open)), [false, true, false, true])
    await page.locator('.object-group summary').first().click()
    await page.waitForFunction(() => localStorage.getItem('life-project-group-active') === 'open')
    await page.reload()
    await page.locator('.object-group').first().waitFor()
    assert.deepEqual(await page.locator('.object-group').evaluateAll((groups) => groups.map((group) => group.open)), [true, true, false, true])
    for (const path of ['notes', 'journal', 'goals']) {
      await page.goto(`${base}/${path}`)
      await page.locator('.object-row').first().waitFor()
      assert.equal(await page.locator('.object-group').count(), 0)
    }
    console.log(`${engine.name()}: toggling, navigation/reload persistence and other lists passed`)
  } finally { await browser.close() }
}
;(async () => { await check(chromium); await check(webkit) })().catch((error) => { console.error(error); process.exitCode = 1 })
