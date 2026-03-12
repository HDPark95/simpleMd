import { test, expect } from '@playwright/test'

test('capture console errors on load', async ({ page }) => {
  const errors: string[] = []
  const logs: string[] = []

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`)
    if (msg.type() === 'error') errors.push(msg.text())
  })

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`)
  })

  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(3000)

  console.log('=== ALL CONSOLE LOGS ===')
  for (const log of logs) console.log(log)
  console.log('=== ERRORS ===')
  for (const err of errors) console.log(err)

  // Check if cm-editor exists
  const editorCount = await page.locator('.cm-editor').count()
  console.log('cm-editor count:', editorCount)

  const content = await page.locator('.cm-content').textContent()
  console.log('cm-content text length:', content?.length, 'text:', content?.substring(0, 100))

  // Check innerText too (includes rendered widgets)
  const innerText = await page.locator('.cm-content').innerText()
  console.log('cm-content innerText length:', innerText?.length, 'text:', innerText?.substring(0, 100))
})
