// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine, touch = false) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', hasTouch: touch })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const userId = '00000000-0000-4000-8000-000000000001'
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const now = new Date().toISOString()
    let objects = [{ id: 'note-test', user_id: userId, type: 'note', title: '원래 노트', body: '본문', meta: {},
      folder_id: null, occurred_at: now, created_at: now, updated_at: now, visibility: 'private', share_token: null }]
    const folders = []
    let failMove = false
    let failDelete = false
    await page.addInitScript(({ user, ref }) => {
      localStorage.setItem('life-locale', 'ko')
      const payload = btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.fake`, refresh_token: 'fake',
        expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }))
    }, { user, ref: 'pbmzjxjtctwhgxxbcgxl' })
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const table = url.pathname.split('/').pop()
      const method = request.method()
      if (table === 'delete_life_note_folder') {
        if (failDelete) return route.fulfill({ status: 500, json: { message: 'test failure' } })
        const id = request.postDataJSON().target_id
        const folder = folders.find((item) => item.id === id)
        if (!folder) return route.fulfill({ status: 404, json: { message: 'Folder not found' } })
        const parentId = folder.parent_id
        folders.forEach((item) => { if (item.parent_id === id) item.parent_id = parentId })
        objects.forEach((item) => { if (item.folder_id === id) item.folder_id = parentId })
        folders.splice(folders.indexOf(folder), 1)
        return route.fulfill({ json: parentId })
      }
      if (table === 'life_note_folders') {
        if (method === 'POST') { folders.push(request.postDataJSON()); return route.fulfill({ status: 201, body: '' }) }
        return route.fulfill({ json: folders })
      }
      if (table === 'life_objects') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '')
        if (method === 'POST') { objects.push(request.postDataJSON()); return route.fulfill({ status: 201, body: '' }) }
        if (method === 'PATCH') {
          if (failMove) return route.fulfill({ status: 500, json: { message: 'test failure' } })
          objects = objects.map((object) => object.id === id ? { ...object, ...request.postDataJSON() } : object)
        }
        const rows = id ? objects.filter((object) => object.id === id) : objects
        return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows })
      }
      if (table === 'life_user_prefs') return route.fulfill({ json: method === 'GET' ? { user_id: userId, prefs: { locale: 'ko' } } : null })
      return route.fulfill({ json: [] })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    await page.goto(`${base}/notes`)
    await page.getByText('원래 노트', { exact: true }).waitFor()
    async function createFolder(name) {
      await page.getByRole('button', { name: '폴더 만들기', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('textbox', { name: '폴더 이름' }).fill(name)
      await dialog.getByRole('button', { name: '추가', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
    }
    await createFolder('상위 폴더')
    await page.getByRole('link', { name: '상위 폴더', exact: true }).click()
    await createFolder('하위 폴더')
    await page.getByRole('link', { name: '하위 폴더', exact: true }).click()
    await page.getByRole('heading', { name: '노트 / 상위 폴더 / 하위 폴더', exact: true }).waitFor()
    assert.equal(await page.locator('h1.notes-path').textContent(), '노트 / 상위 폴더 / 하위 폴더')
    const colors = await page.locator('h1.notes-path').evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.querySelector(':scope > span')).color])
    assert.notEqual(colors[0], colors[1])
    assert.equal(folders[1].parent_id, folders[0].id)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/note-folders-${engine.name()}.png` })
    await page.reload()
    await page.getByRole('heading', { name: '노트 / 상위 폴더 / 하위 폴더', exact: true }).waitFor()
    await page.locator('.module-header-actions a').click()
    await page.locator('.inline-title-input').fill('폴더 안 새 노트')
    await page.locator('.inline-title-input').blur()
    await page.waitForURL('**/object/**')
    assert.equal(objects.find((object) => object.title === '폴더 안 새 노트').folder_id, folders[1].id)
    await page.goto(`${base}/object/note-test`)
    await page.getByRole('button', { name: '폴더로 이동', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '상위 폴더', exact: true }).click()
    await dialog.getByRole('button', { name: '하위 폴더', exact: true }).click()
    failMove = true
    await dialog.getByRole('button', { name: '여기로 이동', exact: true }).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(objects[0].folder_id, null)
    failMove = false
    await dialog.getByRole('button', { name: '여기로 이동', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(objects[0].folder_id, folders[1].id)
    await page.locator('.inline-title-input').fill('이동 후 편집')
    const edited = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('life_objects'))
    await page.locator('.inline-title-input').blur()
    await page.waitForFunction(() => document.querySelector('.inline-title-input')?.value === '이동 후 편집')
    await edited
    assert.equal(objects[0].folder_id, folders[1].id)
    await page.getByRole('button', { name: '폴더로 이동', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '노트', exact: true }).click()
    await dialog.getByRole('button', { name: '여기로 이동', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(objects[0].folder_id, null)
    await page.goto(`${base}/notes`)
    await page.getByText('이동 후 편집', { exact: true }).waitFor()
    assert.equal(await page.getByText('폴더 안 새 노트', { exact: true }).count(), 0)
    await page.getByRole('button', { name: '폴더 만들기', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    // Deleting a nested folder promotes its contents, and a failure allows retry.
    await page.getByRole('link', { name: '상위 폴더', exact: true }).click()
    await page.getByRole('button', { name: '폴더 삭제: 하위 폴더', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '취소', exact: true }).click()
    assert.equal(folders.length, 2)
    await page.getByRole('button', { name: '폴더 삭제: 하위 폴더', exact: true }).click()
    failDelete = true
    await dialog.getByRole('button', { name: '삭제', exact: true }).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(folders.length, 2)
    failDelete = false
    await dialog.getByRole('button', { name: '삭제', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByText('폴더 안 새 노트', { exact: true }).waitFor()
    assert.equal(objects.find((object) => object.title === '폴더 안 새 노트').folder_id, folders[0].id)
    await createFolder('보존할 폴더')
    await page.goto(`${base}/notes`)
    await page.getByRole('button', { name: '폴더 삭제: 상위 폴더', exact: true }).click()
    await dialog.getByRole('button', { name: '삭제', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('link', { name: '보존할 폴더', exact: true }).waitFor()
    await page.getByText('폴더 안 새 노트', { exact: true }).waitFor()
    assert.equal(folders[0].parent_id, null)
    assert.equal(objects.find((object) => object.title === '폴더 안 새 노트').folder_id, null)
    await page.reload()
    await page.getByRole('link', { name: '보존할 폴더', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const deleteButton = page.getByRole('button', { name: '폴더 삭제: 보존할 폴더', exact: true })
    if (touch) {
      assert.equal(await deleteButton.evaluate((el) => getComputedStyle(el).opacity), '1')
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/folder-delete-${engine.name()}.png` })
    } else {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.mouse.move(0, 0)
      assert.equal(await deleteButton.evaluate((el) => getComputedStyle(el).opacity), '0')
      await deleteButton.focus()
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.note-folder-delete')).opacity === '1')
      await page.locator('.note-folder-item').hover()
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.note-folder-delete')).opacity === '1')
    }
    await page.goto(`${base}/notes?folder=00000000-0000-4000-8000-999999999999`)
    await page.getByText('폴더를 찾을 수 없습니다', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log(`${engine.name()} (${touch ? 'touch' : 'mouse'}): folders, move, delete cancel/failure/retry, nested/root promotion, reload, button visibility and missing folder passed`)
  } finally { await browser.close() }
}
;(async () => {
  if (!process.env.TEST_TOUCH_ONLY) { await check(chromium); await check(webkit) }
  await check(chromium, true); await check(webkit, true)
})().catch((error) => { console.error(error); process.exitCode = 1 })
