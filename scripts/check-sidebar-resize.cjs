// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
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
      const json = table === 'life_user_prefs' ? { user_id: user.id, prefs: { locale: 'en' } } : []
      return route.fulfill({ json })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    await page.goto(`${base}/notes`)
    const handle = page.getByRole('separator', { name: 'Resize sidebar' })
    await handle.waitFor()
    async function expectWidth(width) {
      await page.waitForFunction((width) => document.querySelector('.app-sidebar').getBoundingClientRect().width === width, width)
      assert.equal(await handle.getAttribute('aria-valuenow'), String(width))
      assert.equal(await page.locator('.app-frame').evaluate((el) => el.getBoundingClientRect().x), width)
    }
    async function dragBy(delta) {
      const box = await handle.boundingBox()
      await page.mouse.move(box.x + box.width / 2, 100)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + delta, 100, { steps: 8 })
      await page.mouse.up()
      await page.waitForFunction(() => !document.querySelector('.app-shell').classList.contains('is-resizing-sidebar'))
    }
    await expectWidth(248)
    await dragBy(72)
    await expectWidth(320)
    await page.reload()
    await handle.waitFor()
    await expectWidth(320)
    await dragBy(500)
    await expectWidth(400)
    await dragBy(-600)
    await expectWidth(200)
    await handle.focus()
    await page.keyboard.press('ArrowRight')
    await expectWidth(210)
    await page.keyboard.press('ArrowLeft')
    await expectWidth(200)
    await page.keyboard.press('End')
    await expectWidth(400)
    await page.keyboard.press('ArrowRight')
    await expectWidth(400)
    await page.keyboard.press('Home')
    await expectWidth(200)
    await page.keyboard.press('ArrowLeft')
    await expectWidth(200)
    await handle.dblclick({ position: { x: 4, y: 100 } })
    await expectWidth(248)
    await page.getByRole('link', { name: 'Projects', exact: true }).click()
    await expectWidth(248)
    for (const width of [390, 799]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await handle.isVisible(), false)
      assert.equal(await page.locator('.app-sidebar').isVisible(), false)
      assert.equal(await page.locator('.app-frame').evaluate((el) => el.getBoundingClientRect().width), width)
    }
    await page.setViewportSize({ width: 800, height: 900 })
    await expectWidth(248)
    for (const [stored, expected] of [['NaN', 248], ['9999', 400], ['-10', 200]]) {
      await page.evaluate((stored) => localStorage.setItem('life-sidebar-width', stored), stored)
      await page.reload()
      await handle.waitFor()
      await expectWidth(expected)
    }
    assert.deepEqual(errors, [])
    console.log(`${engine.name()}: drag, bounds, keyboard, reset, persistence, navigation, mobile and invalid storage passed`)
  } finally { await browser.close() }
}
;(async () => { await check(chromium); await check(webkit) })().catch((error) => { console.error(error); process.exitCode = 1 })
