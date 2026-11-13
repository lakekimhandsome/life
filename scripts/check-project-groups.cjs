// Start the app first. Run with Playwright available in NODE_PATH.
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
    let rejectPin = false
    let folderRefresh
    let pinSave
    const folders = []
    await page.route('**/rest/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const table = url.pathname.split('/').pop()
      const id = url.searchParams.get('id')?.slice(3)
      if (table === 'life_objects' && id) {
        const row = objects.find((object) => object.id === id)
        if (request.method() === 'PATCH') {
          await pinSave
          if (rejectPin || url.searchParams.get('updated_at') !== `eq.${row.updated_at}`) {
            return route.fulfill({ json: [] })
          }
          Object.assign(row, request.postDataJSON(), { updated_at: new Date().toISOString() })
        }
        return route.fulfill({ json: row ? [row] : [] })
      }
      if (table === 'life_note_folders') await folderRefresh
      return route.fulfill({ json: table === 'life_objects' ? objects
        : table === 'life_user_prefs' ? { user_id: user.id, prefs: { locale: 'en' } }
        : table === 'life_note_folders' ? folders : [] })
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
    for (const path of ['notes', 'journal']) {
      await page.goto(`${base}/${path}`)
      await page.locator('.object-row').first().waitFor()
      assert.equal(await page.locator('.object-group').count(), 0)
    }
    const goalStatuses = ['active', 'achieved', 'paused']
    objects.push(...goalStatuses.map((status) => ({ ...objects[6], id: `goal-${status}`,
      title: `Goal ${status}`, meta: { status, targetDate: '2027-01-01' } })),
      { ...objects[6], id: 'goal-unknown', title: 'Unknown status goal', meta: { status: 'unknown' } })
    await page.goto(`${base}/goals`)
    await page.locator('.object-group').first().waitFor()
    assert.deepEqual(await page.locator('.object-group h2').allTextContents(), ['In progress', 'Achieved', 'Paused'])
    assert.deepEqual(await page.locator('.object-group strong').allTextContents(), ['3', '1', '1'])
    assert.equal(await page.locator('.object-row-tags span').count(), 0)
    assert.equal(await page.locator('.object-row time').count(), 3)
    await page.locator('.object-group summary').first().click()
    await page.waitForFunction(() => localStorage.getItem('life-goal-group-active') === 'closed')
    await page.reload()
    await page.locator('.object-group').first().waitFor()
    assert.deepEqual(await page.locator('.object-group').evaluateAll((groups) => groups.map((group) => group.open)), [false, true, true])
    await page.locator('.sidebar-nav a[href="/projects"]').click()
    await page.waitForURL(`${base}/projects`)
    await page.waitForFunction(() => document.querySelectorAll('.object-group').length === 4)
    assert.deepEqual(await page.locator('.object-group').evaluateAll((groups) => groups.map((group) => group.open)), [true, true, false, true])
    objects.push({ ...objects[0], id: 'project-to-pin', title: 'Older project' })
    objects.push({ ...objects[4], id: 'note-to-pin', title: 'Older note', occurred_at: '2020-01-01T00:00:00Z' })
    folders.push({ id: 'child', parent_id: null, user_id: user.id, name: 'Child folder' })

    await page.goto(`${base}/projects`)
    const projectPin = page.getByRole('button', { name: 'Pin to top: Older project' })
    await projectPin.press('Space')
    await page.locator('button[aria-label="Pin to top: Older project"][aria-pressed="true"]:enabled').waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Pin to top: Older project', pressed: true }).waitFor()
    assert.deepEqual(await page.locator('.object-group').first().locator('h3').allTextContents(), ['Older project', 'active'])
    assert.equal(objects.at(-2).meta.status, 'active')
    await page.getByRole('button', { name: 'Pin to top: active' }).click()
    await page.locator('button[aria-label="Pin to top: active"][aria-pressed="true"]:enabled').waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Pin to top: active', pressed: true }).waitFor()
    assert.deepEqual(await page.locator('.object-group').first().locator('h3').allTextContents(), ['Older project', 'active'])

    await page.goto(`${base}/notes`)
    const notePin = page.getByRole('button', { name: 'Pin to top: Older note' })
    await notePin.click()
    await page.locator('button[aria-label="Pin to top: Older note"][aria-pressed="true"]:enabled').waitFor()
    const list = await page.locator('.object-stream').elementHandle()
    const refreshRequested = page.waitForRequest('**/rest/v1/life_note_folders?**')
    const refreshCompleted = page.waitForResponse('**/rest/v1/life_note_folders?**')
    const refresh = Promise.withResolvers()
    folderRefresh = refresh.promise
    try {
      // Focus and Realtime broadcasts both run LifeProvider's sync callback.
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await refreshRequested
      assert.equal(await list.isVisible(), true)
    } finally {
      refresh.resolve()
      folderRefresh = undefined
    }
    await refreshCompleted
    assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'Older note', 'note'])
    await page.getByRole('button', { name: 'Pin to top: note', exact: true }).click()
    await page.locator('button[aria-label="Pin to top: note"][aria-pressed="true"]:enabled').waitFor()
    assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'Older note', 'note'])
    rejectPin = true
    await notePin.click()
    await page.getByRole('alert').filter({ hasText: 'Could not save the pin' }).waitFor()
    assert.equal(await notePin.getAttribute('aria-pressed'), 'true')
    rejectPin = false
    await notePin.click()
    await page.locator('button[aria-label="Pin to top: Older note"][aria-pressed="false"]:enabled').waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Pin to top: Older note', pressed: false }).waitFor()
    assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'note', 'Older note'])
    await notePin.click()
    await page.locator('button[aria-label="Pin to top: Older note"][aria-pressed="true"]:enabled').waitFor()
    assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'note', 'Older note'])

    const save = Promise.withResolvers()
    pinSave = save.promise
    try {
      await notePin.click()
      await page.locator('button[aria-label="Pin to top: Older note"][aria-pressed="false"]:disabled').waitFor()
      objects.push({ ...objects[4], id: 'oldest-note', title: 'Oldest note', occurred_at: '2010-01-01T00:00:00Z', meta: {} })
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await page.getByRole('heading', { name: 'Oldest note' }).waitFor()
      assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'note', 'Older note', 'Oldest note'])
    } finally {
      save.resolve()
    }
    await page.locator('button[aria-label="Pin to top: Older note"][aria-pressed="false"]:enabled').waitFor()
    assert.deepEqual(await page.locator('.object-stream h3').allTextContents(), ['Folder: Child folder', 'note', 'Older note', 'Oldest note'])
    console.log(`${engine.name()}: project groups, pin order, reload, rollback, and unpin during sync passed`)
  } finally { await browser.close() }
}
;(async () => { await check(chromium); await check(webkit) })().catch((error) => { console.error(error); process.exitCode = 1 })
