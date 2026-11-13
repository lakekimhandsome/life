// Start npm run dev first. Set CHROMIUM_PATH when using a system browser.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  try {
    const page = await browser.newPage({ locale: 'ko-KR' })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const now = new Date().toISOString()
    let object = { id: 'history-note', user_id: user.id, type: 'note', title: '편집 기록', body: '원래 본문', meta: {}, folder_id: null, occurred_at: now, created_at: now, updated_at: now, visibility: 'private', share_token: null }
    const savedBodies = []
    await page.addInitScript((user) => {
      localStorage.setItem('life-locale', 'ko')
      const payload = btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
      localStorage.setItem('sb-pbmzjxjtctwhgxxbcgxl-auth-token', JSON.stringify({ access_token: `e30.${payload}.fake`, refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }))
    }, user)
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname.endsWith('life_objects')) {
        if (request.method() === 'PATCH') {
          assert.equal(url.searchParams.get('updated_at'), `eq.${object.updated_at}`)
          object = { ...object, ...request.postDataJSON(), updated_at: new Date().toISOString() }
          savedBodies.push(object.body)
        }
        return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? object : [object] })
      }
      if (url.pathname.endsWith('life_user_prefs')) return route.fulfill({ json: { user_id: user.id, prefs: { locale: 'ko' } } })
      return route.fulfill({ json: [] })
    })
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'}/object/history-note`)
    const editor = page.locator('.inline-markdown-content[contenteditable="true"]')
    const undo = page.getByRole('radio', { name: /실행 취소/ })
    const redo = page.getByRole('radio', { name: /다시 실행/ })
    await editor.waitFor()
    assert.equal(await undo.isDisabled(), true)
    assert.equal(await redo.isDisabled(), true)
    assert.equal(await page.locator('.editor-toolbar-target').innerText(), '')
    assert.equal(await page.locator('.detail-meta .editor-history-actions').count(), 1)
    assert.equal(await page.locator('.detail-body .body-image-insert').count(), 0)
    const insertImage = page.locator('.detail-meta').getByRole('button', { name: '사진 삽입', exact: true })
    const chooserEvent = page.waitForEvent('filechooser')
    await insertImage.click()
    assert.equal((await chooserEvent).isMultiple(), true)
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.insertText(' edited')
    await page.waitForTimeout(650)
    assert.equal(object.body, '원래 본문 edited')
    await undo.click()
    await page.waitForTimeout(650)
    assert.equal((await editor.innerText()).trim(), '원래 본문')
    assert.equal(object.body, '원래 본문')
    assert.equal(await redo.isEnabled(), true)
    await redo.click()
    await page.waitForTimeout(650)
    assert.equal(object.body, '원래 본문 edited')
    await editor.click()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(650)
    assert.equal(object.body, '원래 본문')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.insertText(' replacement')
    await page.waitForTimeout(650)
    assert.equal(await redo.isDisabled(), true)
    assert.equal(object.body, '원래 본문 replacement')
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        const box = await undo.boundingBox()
        assert(box.width >= 28 && box.height >= 28)
        const saveBox = await page.locator('.detail-editor-tools .clipboard-save').boundingBox()
        const imageBox = await insertImage.boundingBox()
        assert(Math.abs((saveBox.y + saveBox.height / 2) - (imageBox.y + imageBox.height / 2)) < 2)
        assert.equal(await undo.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
        assert.equal(await insertImage.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/editor-history-${width}-${theme}.png` })
      }
    }
    await page.reload()
    await editor.waitFor()
    assert.equal((await editor.innerText()).trim(), '원래 본문 replacement')
    assert.equal(await undo.isDisabled(), true)
    assert.equal(await redo.isDisabled(), true)
    assert.deepEqual(errors, [])
    assert(savedBodies.length >= 5)
    console.log('PASS: header placement beside save status, background-free icons, image picker, undo/redo and keyboard history, redo invalidation, autosave with version checks, reload, mobile/desktop and both themes')
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
