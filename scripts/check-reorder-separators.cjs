// Start npm run dev first. Run with Playwright and pngjs available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')
const { PNG } = require('pngjs')
const { readFileSync } = require('node:fs')

async function check(engine, scale) {
  const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  try {
    const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 900, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const ref = new URL(process.env.VITE_SUPABASE_URL || readFileSync('.env', 'utf8').match(/^VITE_SUPABASE_URL=(.*)$/m)[1].replace(/["']/g, '').trim()).hostname.split('.')[0]
    const now = new Date().toISOString()
    let objects = Array.from({ length: 5 }, (_, index) => ({ id: `plan-${index}`, user_id: user.id, type: 'plan', title: `계획 ${index + 1}`, body: '', meta: { order: index }, occurred_at: now, created_at: now, updated_at: now, visibility: 'private', share_token: null }))
    objects.push(...Array.from({ length: 5 }, (_, index) => ({ id: `asset-${index}`, user_id: user.id, type: 'asset', title: `현금 ${index + 1}`, body: '', meta: { kind: 'cash', symbol: 'KRW', quantity: (index + 1) * 10000, order: index }, occurred_at: now, created_at: now, updated_at: now, visibility: 'private', share_token: null })))
    objects.push({ ...objects[5], id: 'other-asset', title: '부동산', meta: { kind: 'real_estate', symbol: 'KRW', quantity: 1000000, order: 0 } })
    const patches = []
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
      if (request.method() === 'PATCH') { patches.push(id); objects = objects.map((object) => object.id === id ? { ...object, ...request.postDataJSON() } : object) }
      const typeFilter = url.searchParams.get('type')
      const type = typeFilter?.startsWith('eq.') ? typeFilter.slice(3) : null
      const rows = objects.filter((object) => (!id || object.id === id) && (!type || object.type === type))
      return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] : rows })
    })
    for (const [path, selector, attribute] of [['/plans', '.todo-list', 'data-todo-id'], ['/settings/cards', '.card-edit-list', 'data-card-id'], ['/assets', '.assets-list', 'data-asset-id']]) {
      await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'}${path}`)
      const list = page.locator(selector).first()
      const rows = list.locator(`:scope > [${attribute}]`)
      await rows.nth(4).waitFor()
      await list.scrollIntoViewIfNeeded()
      await page.evaluate(() => document.fonts.ready)
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
        const handle = rows.nth(1).locator(path === '/assets' ? '.assets-handle' : '.todo-handle')
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
            return { lines: list.style.getPropertyValue('--reorder-lines') === 'none' ? [] : list.style.getPropertyValue('--reorder-line-positions').split(',').map((position) => parseFloat(position.trim().split(' ')[1]) + rect.top),
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
        await page.waitForTimeout(200)
        const geometry = await list.evaluate((list) => ({
          top: list.getBoundingClientRect().top,
          x: list.getBoundingClientRect().right - 20,
          positions: list.style.getPropertyValue('--reorder-line-positions'),
          paper: getComputedStyle(list).backgroundColor.match(/\d+/g).slice(0, 3).map(Number),
        }))
        const screenshot = PNG.sync.read(await page.screenshot())
        for (const position of geometry.positions.split(',')) {
          const y = (geometry.top + parseFloat(position.trim().split(' ')[1])) * scale
          let thickness = 0
          for (let pixelY = Math.floor(y) - 2 * scale; pixelY <= Math.ceil(y) + 2 * scale; pixelY++) {
            const offset = (pixelY * screenshot.width + Math.round(geometry.x * scale)) * 4
            if (geometry.paper.some((channel, index) => Math.abs(channel - screenshot.data[offset + index]) > 12)) thickness++
          }
          assert.equal(thickness, scale, `${path}: every separator is 1 CSS pixel thick at ${scale}x`)
        }
        await page.mouse.move(x, initial[0].top + 2, { steps: 8 })
        await checkLines(0)
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${path.slice(1).replaceAll('/', '-')}-${theme}-${engine.name()}.png` })
        const patchCount = patches.length
        await page.mouse.up()
        await page.waitForFunction((selector) => !document.querySelector(selector).classList.contains('is-reordering'), selector)
        assert.equal(await rows.first().getAttribute(attribute), ids[1], 'Drop still changes the order')
        assert.equal(await list.evaluate((list) => list.style.getPropertyValue('--reorder-lines')), '')
        assert(await rows.first().evaluate((row) => getComputedStyle(row).boxShadow !== 'none'), 'Normal separators return after drop')
        assert(await rows.evaluateAll((rows) => rows.every((row) => !row.style.transform)), 'Transforms are cleaned up')
        if (path === '/assets') {
          await page.waitForFunction(() => !document.querySelector('.assets-list .is-dragging'))
          for (let attempt = 0; attempt < 100 && patches.length < patchCount + 5; attempt++) await page.waitForTimeout(20)
          assert.equal(patches.length, patchCount + 5, 'Only the reordered asset group is saved')
          assert(!patches.slice(patchCount).includes('other-asset'), 'Other asset groups stay unchanged')
          await page.reload()
          await rows.nth(4).waitFor()
          assert.equal(await rows.first().getAttribute(attribute), ids[1], 'Saved order survives reload')
          await list.scrollIntoViewIfNeeded()
          const cancelIds = await rows.evaluateAll((rows) => rows.map((row) => row.dataset.assetId))
          const cancelBox = await rows.first().locator('.assets-handle').boundingBox()
          await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2)
          await page.mouse.down()
          await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height * 3)
          await rows.first().locator('.assets-handle').dispatchEvent('pointercancel', { pointerId: 1 })
          await page.mouse.up()
          await page.waitForFunction(() => !document.querySelector('.assets-list.is-reordering'))
          assert.deepEqual(await rows.evaluateAll((rows) => rows.map((row) => row.dataset.assetId)), cancelIds, 'Cancellation restores original order')
          assert.equal(patches.length, patchCount + 5, 'Cancellation does not save')
        }
      }
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${engine.name()} ${scale}x: plans/cards/assets, light/dark, stationary separators, clear item/gap edges, reorder and cleanup`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of (process.env.CHROMIUM_PATH ? [chromium] : [chromium, webkit])) for (const scale of [1, 2]) await check(engine, scale) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
