// Проверка темы в настоящем Chromium: node docs-site/test/theme.browser.mjs
// (нужна собранная dist-site и запущенный сервер: SERVE=http://localhost:4173/docs/).
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const url = process.env.SERVE ?? 'http://localhost:4173/docs/'
const browser = await chromium.launch()
async function probe({ stored, scheme }) {
    const ctx = await browser.newContext({ colorScheme: scheme })
    if (stored !== undefined) await ctx.addInitScript((v) => localStorage.setItem('starlight-theme', v), stored)
    const page = await ctx.newPage()
    await page.goto(url)
    const r = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.body).backgroundColor,
    }))
    await ctx.close()
    return r
}
const dark = 'rgb(13, 15, 19)'
let r = await probe({ scheme: 'light' })
console.log('fresh, OS light', r); assert.equal(r.theme, 'dark'); assert.equal(r.bg, dark)
r = await probe({ stored: 'light', scheme: 'dark' })
console.log('stored light', r); assert.equal(r.theme, 'light'); assert.notEqual(r.bg, dark)
r = await probe({ stored: '', scheme: 'light' })
console.log('auto (stored empty), OS light', r); assert.equal(r.theme, 'light'); assert.notEqual(r.bg, dark)
r = await probe({ stored: '', scheme: 'dark' })
console.log('auto (stored empty), OS dark', r); assert.equal(r.theme, 'dark'); assert.equal(r.bg, dark)
await browser.close()
console.log('OK')
