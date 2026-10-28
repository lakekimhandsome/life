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
    if (engine === chromium) {
      const input = await page.context().newCDPSession(page)
      const area = await page.locator('.gallery-image-stage').boundingBox()
      await input.send('Input.synthesizePinchGesture', {
        x: area.x + area.width / 2, y: area.y + area.height / 2,
        scaleFactor: 2, relativeSpeed: 400, gestureSourceType: 'touch',
      })
      assert(Number(await page.locator('.gallery-image-stage').getAttribute('data-zoom')) > 1.5)
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'Only the photo should zoom')
    }
    await page.getByRole('button', { name: '다음 이미지', exact: true }).tap()
    assert.equal(await page.locator('.gallery-count').textContent(), '2 / 2')
    assert((await page.locator('dialog img').boundingBox()).height > 104)
    await page.getByRole('button', { name: '이전 이미지', exact: true }).tap()

    const stage = page.locator('.gallery-image-stage')
    const area = await stage.boundingBox()
    const cx = area.x + area.width / 2
    const cy = area.y + area.height / 2
    const fingers = (spread) => [
      { identifier: 1, clientX: cx - spread, clientY: cy },
      { identifier: 2, clientX: cx + spread, clientY: cy },
    ]
    await stage.dispatchEvent('touchstart', { touches: fingers(35) })
    await stage.dispatchEvent('touchmove', { touches: fingers(70) })
    await stage.dispatchEvent('touchend', { touches: [], changedTouches: fingers(70) })
    await page.waitForFunction(() => document.querySelector('.gallery-image-stage')?.dataset.zoom === '2')
    assert.equal(await stage.getAttribute('data-zoom'), '2')
    assert.equal(await page.locator('.gallery-count').textContent(), '1 / 2', 'Pinching must not change images')
    const panStart = [{ identifier: 1, clientX: cx, clientY: cy }]
    const panEnd = [{ identifier: 1, clientX: cx - 60, clientY: cy }]
    await stage.dispatchEvent('touchstart', { touches: panStart })
    await stage.dispatchEvent('touchmove', { touches: panEnd })
    await stage.dispatchEvent('touchend', { touches: [], changedTouches: panEnd })
    assert((await page.locator('dialog img').getAttribute('style')).includes('translate(-60px'))
    assert.equal(await page.locator('.gallery-count').textContent(), '1 / 2', 'Panning must not change images')
    await stage.dispatchEvent('click', { bubbles: true })
    assert.equal(await page.locator('dialog[open]').count(), 1, 'A gesture must not dismiss the viewer')
    await stage.dispatchEvent('touchstart', { touches: fingers(70) })
    await stage.dispatchEvent('touchmove', { touches: fingers(35) })
    await stage.dispatchEvent('touchend', { touches: [], changedTouches: fingers(35) })
    assert.equal(await stage.getAttribute('data-zoom'), '1')
    const swipeStart = [{ identifier: 1, clientX: cx + 70, clientY: cy }]
    const swipeEnd = [{ identifier: 1, clientX: cx - 70, clientY: cy }]
    await stage.dispatchEvent('touchstart', { touches: swipeStart })
    await stage.dispatchEvent('touchmove', { touches: swipeEnd })
    await stage.dispatchEvent('touchend', { touches: [], changedTouches: swipeEnd })
    assert.equal(await page.locator('.gallery-count').textContent(), '2 / 2', 'Swiping still changes images at normal size')
    assert.equal(await page.locator('.gallery-image-stage').getAttribute('data-zoom'), '1')
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
    console.log(`PASS ${engine.name()}: compact thumbnails, pinch zoom/pan/swipe, gallery menu, copy/download/share, fetch errors, read-only safety, confirmed removal and native picker`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of [chromium, webkit]) await check(engine) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
