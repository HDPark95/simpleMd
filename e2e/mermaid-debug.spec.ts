import { test } from '@playwright/test'

test('debug mermaid rendering', async ({ page }) => {
  const errors: string[] = []
  const logs: string[] = []
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.cm-editor', { timeout: 10000 })

  const cmContent = page.locator('.cm-content')
  await cmContent.click()
  await page.keyboard.press('Meta+a')
  await page.keyboard.type('```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello\n```\n\ntext here')
  await page.waitForTimeout(3000)

  console.log('=== ERRORS ===')
  for (const e of errors) console.log(e)
  console.log('=== LOGS ===')
  for (const l of logs) console.log(l)

  // Check DOM for diagram elements
  const html = await page.locator('.cm-editor').innerHTML()
  const hasDiagram = html.includes('cm-diagram') || html.includes('mermaid')
  console.log('Has diagram class in HTML:', hasDiagram)
  console.log('HTML snippet (first 2000):', html.substring(0, 2000))
})
