// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const ref = new URL(readFileSync('.env', 'utf8').match(/^VITE_SUPABASE_URL=(.*)$/m)[1].replace(/["']/g, '').trim()).hostname.split('.')[0]
    const now = new Date().toISOString()
    let objects = Array.from({ length: 5 }, (_, index) => ({ id: `plan-${index}`, user_id: user.id, type: 'plan', title: `계획 ${index + 1}`, body: '', meta: { order: index }, occurred_at: now, created_at: now, updated_at: now, visibility: 'private', share_token: null }))
    let prefs = { locale: 'ko' }
    await page.addInitScript(({ user, ref }) => {
      localStorage.setItem('life-locale', 'ko')
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: 'fake-token', refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, ref })
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const table = url.pathname.split('/').pop()
      if (table === 'life_user_prefs') {
        if (request.method() !== 'GET') prefs = request.postDataJSON().prefs
        return route.fulfill({ json: { user_id: user.id, prefs } })
      }
      if (table !== 'life_objects') return route.fulfill({ json: [] })
      const id = url.searchParams.get('id')?.replace(/^eq\./, '')
      if (request.method() === 'PATCH') objects = objects.map((object) => object.id === id ? { ...object, ...request.postDataJSON() } : object)
      const rows = id ? objects.filter((object) => object.id === id) : objects
      return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] : rows })
    })
    for (const [path, selector, attribute] of [['/plans', '.todo-list', 'data-todo-id'], ['/settings/cards', '.card-edit-list', 'data-card-id']]) {
      await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'}${path}`)
      const list = page.locator(selector).first()
      const rows = list.locator(`:scope > [${attribute}]`)
      await rows.nth(4).waitFor()
      await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))))
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        await page.evaluate(async () => {
          await new Promise(requestAnimationFrame)
          await new Promise(requestAnimationFrame)
          await Promise.all(document.getAnimations().filter((animation) => animation.effect.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})))
        })
        const ids = await rows.evaluateAll((rows, attribute) => rows.map((row) => row.getAttribute(attribute)), attribute)
        const initial = await rows.evaluateAll((rows) => rows.map((row) => { const r = row.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height } }))
        const handle = rows.nth(1).locator('.todo-handle')
        const box = await handle.boundingBox()
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.waitForFunction((selector) => document.querySelector(selector).classList.contains('is-reordering'), selector)
        async function checkLines(gapIndex) {
          const result = await list.evaluate((list) => {
            const rect = list.getBoundingClientRect()
            const dragged = list.querySelector('.is-dragging').getBoundingClientRect()
            return { lines: list.style.backgroundImage === 'none' ? [] : list.style.backgroundPosition.split(',').map((position) => parseFloat(position.trim().split(' ')[1]) + rect.top),
              shadows: [...list.children].map((row) => getComputedStyle(row).boxShadow), top: dragged.top, bottom: dragged.bottom }
          })
          assert(result.shadows.every((shadow) => shadow === 'none'), 'No row carries a separator during drag')
          for (const line of result.lines) {
            assert(initial.some((rect) => Math.abs(rect.bottom - line) < 1), 'Separators stay at their original coordinates')
            assert(line < result.top - 0.5 || line > result.bottom + 0.5, 'No separator crosses the moving item')
            assert(Math.abs(line - initial[gapIndex].bottom) > 1, 'No separator below the empty slot')
            if (gapIndex > 0) assert(Math.abs(line - initial[gapIndex - 1].bottom) > 1, 'No separator above the empty slot')
          }
          assert(result.lines.length > 0, 'Unrelated separators remain visible')
        }
        await checkLines(1)
        await page.mouse.move(x, y + initial[1].height * 1.5, { steps: 8 })
        await checkLines(2)
        await page.mouse.move(x, initial[0].top + 2, { steps: 8 })
        await checkLines(0)
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${path.includes('cards') ? 'cards' : 'plans'}-${theme}-${engine.name()}.png` })
        await page.mouse.up()
        await page.waitForFunction((selector) => !document.querySelector(selector).classList.contains('is-reordering'), selector)
        assert.equal(await rows.first().getAttribute(attribute), ids[1], 'Drop still changes the order')
        assert.equal(await list.evaluate((list) => list.style.backgroundImage), '')
        assert(await rows.first().evaluate((row) => getComputedStyle(row).boxShadow !== 'none'), 'Normal separators return after drop')
        assert(await rows.evaluateAll((rows) => rows.every((row) => !row.style.transform)), 'Transforms are cleaned up')
      }
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${engine.name()}: plans/cards, light/dark, stationary separators, clear item/gap edges, reorder and cleanup`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of [chromium, webkit]) await check(engine) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
