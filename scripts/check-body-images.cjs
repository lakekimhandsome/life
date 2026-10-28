// Start npm run dev first. Requires Playwright with Chromium and WebKit installed.
// Run: NODE_PATH=/path/to/node_modules node scripts/check-body-images.cjs
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true, locale: 'ko-KR',
    })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    // Capture actions without changing the system clipboard or opening a native share sheet.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        write: async (items) => {
          const image = await items[0].getType('image/png')
          window.imageCopy = { type: image.type, size: image.size }
        },
      } })
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
      Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
        window.imageShare = { name: files[0].name, type: files[0].type, size: files[0].size }
      } })
    })
    let failFetch = false
    await page.route('https://example.test/**', (route) => {
      if (failFetch) return route.fulfill({ status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
      const portrait = route.request().url().includes('portrait')
      return route.fulfill({
        contentType: portrait ? 'image/png' : 'image/jpeg',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: readFileSync(join(__dirname, 'fixtures', `body-image-${portrait ? 'portrait.png' : 'landscape.jpg'}`)),
      })
    })
    await page.goto('http://127.0.0.1:5173/body-image-check.html')
    const images = page.locator('.inline-markdown-content img[src]')
    await images.nth(1).waitFor()
    const dimensions = await images.evaluateAll((items) => items.map((image) => {
      const rect = image.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
    assert.deepEqual(dimensions, [{ width: 104, height: 104 }, { width: 104, height: 104 }])
    assert.equal(await page.locator('img[data-lexical-managed-linebreak][role="button"]').count(), 0)
    if (engine === webkit) {
      assert(await page.locator('img[data-lexical-managed-linebreak]').count() > 0)
      const sizes = await page.locator('img[data-lexical-managed-linebreak]').evaluateAll((items) => items.map((image) => image.getBoundingClientRect().width))
      assert(sizes.every((width) => width === 0), 'Safari layout images must remain zero-width')
    }
    assert.equal(await page.evaluate(() => innerWidth), 390)
    assert.equal(await page.locator('.body-image-delete').count(), 0, 'No thumbnail delete button')
    const menu = () => page.getByRole('button', { name: '이미지 메뉴', exact: true }).tap()
    await images.first().tap()
    await page.locator('dialog[open]').waitFor()
    assert.equal(await page.locator('.gallery-count').textContent(), '1 / 2')
    const hitArea = await page.locator('.gallery-menu-toggle').boundingBox()
    assert.equal(hitArea.width, 44)
    assert.equal(hitArea.height, 44)
    await page.getByRole('button', { name: '다음 이미지', exact: true }).tap()
    assert.equal(await page.locator('.gallery-count').textContent(), '2 / 2')
    assert((await page.locator('dialog img').boundingBox()).height > 104)
    await page.getByRole('button', { name: '이전 이미지', exact: true }).tap()

    await menu()
    await page.getByRole('button', { name: '이미지 복사', exact: true }).tap()
    await page.waitForFunction(() => window.imageCopy?.size > 0)
    assert.equal(await page.evaluate(() => window.imageCopy.type), 'image/png')
    await page.getByRole('status').filter({ hasText: '복사됨' }).waitFor()
    await menu()
    const pendingDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '이미지 저장', exact: true }).tap()
    assert.equal((await pendingDownload).suggestedFilename(), 'LIFE-image.jpg')
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }))
    await menu()
    await page.getByRole('button', { name: '이미지 저장', exact: true }).tap()
    await page.waitForFunction(() => window.imageShare?.size > 0)
    assert.equal(await page.evaluate(() => window.imageShare.type), 'image/jpeg')
    failFetch = true
    await menu()
    await page.getByRole('button', { name: '이미지 저장', exact: true }).tap()
    await page.getByRole('status').filter({ hasText: '이미지를 받지 못했습니다.' }).waitFor()
    failFetch = false
    await page.getByRole('button', { name: '닫기', exact: true }).tap()

    await page.locator('#preview img[src]').first().tap()
    await menu()
    assert.equal(await page.getByRole('button', { name: '이미지 삭제', exact: true }).count(), 0, 'Read-only images cannot be deleted')
    assert.equal(await page.getByRole('button', { name: '이미지 저장', exact: true }).count(), 1)
    await page.getByRole('button', { name: '닫기', exact: true }).tap()
    await images.first().tap()
    await menu()
    let pendingDialog = page.waitForEvent('dialog')
    let pendingTap = page.getByRole('button', { name: '이미지 삭제', exact: true }).tap()
    let confirmation = await pendingDialog
    assert.equal(confirmation.message(), '이 이미지를 본문에서 삭제할까요?')
    await confirmation.dismiss()
    await pendingTap
    assert.equal(await images.count(), 2, 'Cancel must keep the image')
    pendingDialog = page.waitForEvent('dialog')
    pendingTap = page.getByRole('button', { name: '이미지 삭제', exact: true }).tap()
    confirmation = await pendingDialog
    await confirmation.accept()
    await pendingTap
    await page.waitForFunction(() => !document.querySelector('#markdown').textContent.includes('landscape'))
    assert.equal(await images.count(), 1)
    assert.equal(await page.locator('.gallery-count').textContent(), '1 / 1')
    assert.equal(await page.locator('dialog img').getAttribute('alt'), 'portrait')
    await menu()
    pendingDialog = page.waitForEvent('dialog')
    pendingTap = page.getByRole('button', { name: '이미지 삭제', exact: true }).tap()
    confirmation = await pendingDialog
    await confirmation.accept()
    await pendingTap
    await page.locator('dialog').waitFor({ state: 'detached' })
    const pendingChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '이미지 넣기', exact: true }).tap()
    await (await pendingChooser).setFiles([])
    assert.deepEqual(errors, [])
    console.log(`PASS ${engine.name()}: compact thumbnails, gallery menu, copy/download/share, fetch errors, read-only safety, confirmed removal and native picker`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of [chromium, webkit]) await check(engine) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
