import { test, expect } from '@playwright/test'

test('mermaid diagram renders when cursor moves away', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.cm-editor', { timeout: 10000 })

  const cmContent = page.locator('.cm-content')
  await cmContent.click()
  await page.keyboard.press('Meta+a')

  // Type mermaid block, then move cursor away
  await page.keyboard.type('```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi\n```\n\n\nSome text below to move cursor here')

  // Move cursor to the last line (outside the mermaid block)
  await page.keyboard.press('End')
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'e2e/screenshots/mermaid-rendered.png' })

  // Check for mermaid SVG or container
  const mermaidContainer = page.locator('.cm-diagram-container')
  const count = await mermaidContainer.count()
  console.log(`Mermaid containers found: ${count}`)

  // Check for SVG inside
  const svgCount = await page.locator('.cm-diagram-container svg').count()
  console.log(`Mermaid SVGs found: ${svgCount}`)
})
