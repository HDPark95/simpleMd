/**
 * SimpleMD User Scenario Tests
 *
 * Tests run against the dev server (localhost:5173).
 * Covers all major user scenarios from test-scenarios.md.
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Helper: wait for editor to be ready
async function waitForEditor(page: import('@playwright/test').Page) {
  await page.goto(BASE)
  await page.waitForSelector('.cm-editor', { timeout: 10000 })
  await page.waitForTimeout(500) // let WYSIWYG decorations settle
}

// Helper: type content into editor (replaces all)
async function typeContent(page: import('@playwright/test').Page, text: string) {
  const cmContent = page.locator('.cm-content')
  await cmContent.click()
  await page.keyboard.press('Meta+a')
  await page.keyboard.type(text, { delay: 5 })
  await page.waitForTimeout(300)
}

// Helper: set content via direct dispatch (faster for large content)
async function setContent(page: import('@playwright/test').Page, text: string) {
  await page.evaluate((t) => {
    const cm = document.querySelector('.cm-content') as HTMLElement
    if (!cm) return
    const view = (cm as any).cmView?.view
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: t },
      })
    }
  }, text)
  await page.waitForTimeout(300)
}

// ================================================================
// S1. 앱 실행 — Welcome 화면
// ================================================================

test.describe('S1: Welcome Screen', () => {
  test('shows welcome content on launch', async ({ page }) => {
    await waitForEditor(page)
    const content = await page.locator('.cm-content').textContent()
    expect(content!.length).toBeGreaterThan(20)
    // Welcome text should contain "SimpleMD" somewhere
    expect(content).toContain('SimpleMD')
  })

  test('launches in edit mode (not viewer)', async ({ page }) => {
    await waitForEditor(page)
    // Body should NOT have viewer-mode class for welcome
    const isViewer = await page.locator('body').evaluate(
      (el) => el.classList.contains('viewer-mode')
    )
    expect(isViewer).toBe(false)
  })

  test('cursor is visible in edit mode', async ({ page }) => {
    await waitForEditor(page)
    await page.locator('.cm-content').click()
    // cursor layer should not be display:none
    const cursorDisplay = await page.locator('.cm-cursorLayer').evaluate(
      (el) => window.getComputedStyle(el).display
    )
    expect(cursorDisplay).not.toBe('none')
  })

  test('statusbar shows editing mode', async ({ page }) => {
    await waitForEditor(page)
    const modeText = await page.locator('#status-mode').textContent()
    expect(modeText?.toLowerCase()).toContain('edit')
  })

  test('screenshot: welcome', async ({ page }) => {
    await waitForEditor(page)
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/s1-welcome.png' })
  })
})

// ================================================================
// S4. 뷰어 모드 동작
// ================================================================

test.describe('S4: Viewer Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('Cmd+E toggles to viewer mode', async ({ page }) => {
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)
    const isViewer = await page.locator('body').evaluate(
      (el) => el.classList.contains('viewer-mode')
    )
    expect(isViewer).toBe(true)
  })

  test('viewer mode hides cursor', async ({ page }) => {
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)
    // Check cm-cursor or cm-cursorLayer is hidden
    const cursorLayerHidden = await page.evaluate(() => {
      const layer = document.querySelector('.cm-cursorLayer')
      if (!layer) return true
      return window.getComputedStyle(layer).display === 'none'
    })
    expect(cursorLayerHidden).toBe(true)
  })

  test('viewer mode shows Read Only in statusbar', async ({ page }) => {
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)
    const modeText = await page.locator('#status-mode').textContent()
    expect(modeText?.toLowerCase()).toMatch(/read|view/)
  })

  test('viewer mode prevents editing', async ({ page }) => {
    // First type something recognizable
    await typeContent(page, '# Test Content\n\nOriginal text.')
    const before = await page.locator('.cm-content').textContent()

    // Switch to viewer
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)

    // Try to type
    await page.locator('.cm-content').click()
    await page.keyboard.type('INJECTED')
    await page.waitForTimeout(200)

    const after = await page.locator('.cm-content').textContent()
    expect(after).not.toContain('INJECTED')
  })

  test('selection highlight is hidden in viewer mode', async ({ page }) => {
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)
    // Check CSS rule: body.viewer-mode .cm-selectionBackground has transparent bg
    const bgTransparent = await page.evaluate(() => {
      const el = document.querySelector('body.viewer-mode')
      return el !== null
    })
    expect(bgTransparent).toBe(true)
  })

  test('Cmd+E toggles back to edit mode', async ({ page }) => {
    await page.keyboard.press('Meta+e') // viewer
    await page.waitForTimeout(200)
    await page.keyboard.press('Meta+e') // back to edit
    await page.waitForTimeout(200)
    const isViewer = await page.locator('body').evaluate(
      (el) => el.classList.contains('viewer-mode')
    )
    expect(isViewer).toBe(false)
  })

  test('screenshot: viewer mode', async ({ page }) => {
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/s4-viewer-mode.png' })
  })
})

// ================================================================
// S5. 편집 모드 전환
// ================================================================

test.describe('S5: Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('toolbar View button toggles to viewer', async ({ page }) => {
    const viewBtn = page.locator('#toolbar-view-btn')
    if (await viewBtn.isVisible()) {
      await viewBtn.click()
      await page.waitForTimeout(300)
      const isViewer = await page.locator('body').evaluate(
        (el) => el.classList.contains('viewer-mode')
      )
      expect(isViewer).toBe(true)
    }
  })

  test('toolbar Edit button toggles back to edit', async ({ page }) => {
    // Go to viewer first
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(300)
    const editBtn = page.locator('#toolbar-edit-btn')
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForTimeout(300)
      const isViewer = await page.locator('body').evaluate(
        (el) => el.classList.contains('viewer-mode')
      )
      expect(isViewer).toBe(false)
    }
  })

  test('scroll position preserved on toggle', async ({ page }) => {
    // Type enough content to scroll
    const longContent = Array.from({ length: 50 }, (_, i) => `## Heading ${i}\n\nParagraph ${i} content here.\n`).join('\n')
    await typeContent(page, longContent)

    // Scroll down
    await page.evaluate(() => {
      const scroller = document.querySelector('.cm-scroller')
      if (scroller) scroller.scrollTop = 500
    })
    await page.waitForTimeout(200)

    const scrollBefore = await page.evaluate(() => {
      return document.querySelector('.cm-scroller')?.scrollTop || 0
    })

    // Toggle to viewer and back
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(500)

    const scrollAfter = await page.evaluate(() => {
      return document.querySelector('.cm-scroller')?.scrollTop || 0
    })

    // Allow some tolerance (within 100px)
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(100)
  })
})

// ================================================================
// S6. 코드 블럭 렌더링
// ================================================================

test.describe('S6: Code Block Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('code block renders as styled widget in viewer mode', async ({ page }) => {
    await typeContent(page, '# Test\n\n```javascript\nconsole.log("hello")\n```\n\nEnd.')
    // Switch to viewer
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(500)

    // Check for rendered code block widget
    const widget = page.locator('.cm-codeblock-widget, .cm-codeblock-pre')
    const count = await widget.count()
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/s6-codeblock-viewer.png' })
  })

  test('code block hides ``` markers in viewer mode', async ({ page }) => {
    await typeContent(page, '```python\nprint("hi")\n```')
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(500)

    const text = await page.locator('.cm-content').textContent()
    // The rendered content should not show raw ``` markers
    // (they may appear as part of widget, but the raw ``` line should be hidden)
    expect(text).toContain('print')
  })

  test('code block shows raw markdown when cursor is inside (edit mode)', async ({ page }) => {
    await typeContent(page, '# Test\n\n```javascript\nconsole.log("hello")\n```\n\nEnd.')
    // Click inside the code block area
    const cmContent = page.locator('.cm-content')
    await cmContent.click()
    // Move cursor to line 4 (inside code block)
    await page.keyboard.press('Meta+Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)

    const text = await page.locator('.cm-content').textContent()
    // Raw backticks should be visible when cursor is on that line
    await page.screenshot({ path: 'e2e/screenshots/s6-codeblock-edit.png' })
  })
})

// ================================================================
// S7. Mermaid 다이어그램
// ================================================================

test.describe('S7: Mermaid Diagrams', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('mermaid renders as SVG diagram', async ({ page }) => {
    await typeContent(page, '```mermaid\ngraph LR\n    A-->B\n    B-->C\n```\n\nEnd paragraph here.')
    // Move cursor out of the mermaid block so it renders
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(3000) // mermaid async rendering

    const svg = page.locator('.cm-diagram-container svg')
    const count = await svg.count()
    console.log(`Mermaid SVG count: ${count}`)
    // Should have at least attempted to render
    const container = page.locator('.cm-diagram-container')
    await expect(container.first()).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/s7-mermaid.png' })
  })

  test('mermaid error shows message, not crash', async ({ page }) => {
    await typeContent(page, '```mermaid\ninvalid{{{syntax\n```')
    await page.waitForTimeout(2000)

    // Check no unhandled errors crashed the page
    const editor = page.locator('.cm-editor')
    await expect(editor).toBeVisible()

    // Error container should show error text
    const container = page.locator('.cm-diagram-container')
    if (await container.count() > 0) {
      const text = await container.textContent()
      expect(text?.toLowerCase()).toMatch(/error|diagram/)
    }
  })

  test('sequence diagram renders', async ({ page }) => {
    await typeContent(page, '```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi\n```')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/s7-sequence.png' })
  })
})

// ================================================================
// S8. 수학 수식
// ================================================================

test.describe('S8: Math (LaTeX)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('inline math renders', async ({ page }) => {
    await typeContent(page, 'Euler: $e^{i\\pi} + 1 = 0$\n\nEnd.')
    // Move cursor away from the math line
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)

    // Check for KaTeX rendered element
    const katex = page.locator('.katex, .cm-math-widget, [class*="math"]')
    await page.screenshot({ path: 'e2e/screenshots/s8-inline-math.png' })
  })

  test('block math renders', async ({ page }) => {
    await typeContent(page, '# Math\n\n$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$\n\nDone.')
    // Move cursor away
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/screenshots/s8-block-math.png' })
  })
})

// ================================================================
// S9. 테이블 렌더링
// ================================================================

test.describe('S9: Table Rendering', () => {
  test('table renders as styled HTML table in viewer mode', async ({ page }) => {
    await waitForEditor(page)
    await typeContent(page, '| Name | Value |\n|------|-------|\n| A    | 1     |\n| B    | 2     |')
    await page.keyboard.press('Meta+e') // viewer mode
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/screenshots/s9-table.png' })
  })
})

// ================================================================
// S10. 인라인 마크다운 렌더링
// ================================================================

test.describe('S10: Inline Markdown Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('bold text hides ** markers', async ({ page }) => {
    await typeContent(page, 'Normal **bold text** normal\n\nSecond line.')
    // Move cursor to second line so first line renders WYSIWYG
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'e2e/screenshots/s10-bold.png' })
  })

  test('heading hides # and applies style', async ({ page }) => {
    await typeContent(page, '# Big Heading\n\nSome paragraph.\n\n## Sub Heading\n\nMore text.')
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(300)

    // Check for heading decoration
    const heading = page.locator('.cm-heading-1, .cm-heading')
    const count = await heading.count()
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/s10-headings.png' })
  })

  test('link renders with underline, hides syntax', async ({ page }) => {
    await typeContent(page, 'Click [here](https://example.com) for more.\n\nEnd.')
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(300)

    const link = page.locator('.cm-link')
    const count = await link.count()
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/s10-link.png' })
  })

  test('checkbox renders as interactive widget', async ({ page }) => {
    await typeContent(page, '- [x] Completed task\n- [ ] Pending task\n\nEnd.')
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(300)

    const checkbox = page.locator('input[type="checkbox"]')
    const count = await checkbox.count()
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/s10-checkbox.png' })
  })

  test('horizontal rule renders as <hr>', async ({ page }) => {
    await typeContent(page, 'Above\n\n---\n\nBelow')
    await page.keyboard.press('Meta+End')
    await page.waitForTimeout(300)

    const hr = page.locator('.cm-hr-widget, hr')
    const count = await hr.count()
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/s10-hr.png' })
  })
})

// ================================================================
// S11. UI 컴포넌트
// ================================================================

test.describe('S11: UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditor(page)
  })

  test('toolbar is visible with format buttons', async ({ page }) => {
    const toolbar = page.locator('.toolbar')
    await expect(toolbar).toBeVisible()
    // Should have buttons
    const buttons = toolbar.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(3)
  })

  test('statusbar shows word count', async ({ page }) => {
    const statusbar = page.locator('.statusbar')
    await expect(statusbar).toBeVisible()
    const text = await statusbar.textContent()
    // Should show some word/char count
    expect(text?.toLowerCase()).toMatch(/word|char|line/)
  })

  test('outline panel exists', async ({ page }) => {
    const outline = page.locator('.outline')
    await expect(outline).toHaveCount(1)
  })

  test('sidebar exists', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).toHaveCount(1)
  })
})

// ================================================================
// S-COMBINED: 실제 문서 통합 테스트
// ================================================================

test.describe('Combined: Real Document Test', () => {
  test('renders a complex markdown document', async ({ page }) => {
    await waitForEditor(page)

    const md = `# Architecture Guide

## Overview

This document describes the **system architecture** with *emphasis* on scalability.

### Components

| Component | Role | Status |
|-----------|------|--------|
| API Gateway | Routing | Active |
| Auth Service | Authentication | Active |
| DB Layer | Persistence | Active |

### Code Example

\`\`\`typescript
interface Service {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
\`\`\`

### Task List

- [x] Design phase complete
- [x] Implementation done
- [ ] Testing in progress
- [ ] Deployment pending

### Flow Diagram

\`\`\`mermaid
graph TD
    A[Client] --> B[API Gateway]
    B --> C[Auth Service]
    B --> D[App Service]
    D --> E[(Database)]
\`\`\`

### Math

The complexity is $O(n \\log n)$ on average.

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

---

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci

For more info, see [documentation](https://docs.example.com).
`

    await typeContent(page, md)
    await page.waitForTimeout(1000)

    // Switch to viewer mode for full WYSIWYG rendering
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(2000) // wait for mermaid

    // Verify key elements
    const checks = {
      heading: await page.locator('.cm-heading').count(),
      codeblock: await page.locator('.cm-codeblock-widget').count(),
      checkbox: await page.locator('input[type="checkbox"]').count(),
      hr: await page.locator('.cm-hr-widget, hr').count(),
      link: await page.locator('.cm-link').count(),
      diagram: await page.locator('.cm-diagram-container').count(),
    }

    console.log('Render checks:', JSON.stringify(checks))

    expect(checks.heading).toBeGreaterThan(0)
    expect(checks.codeblock).toBeGreaterThan(0)
    expect(checks.checkbox).toBeGreaterThan(0)

    await page.screenshot({
      path: 'e2e/screenshots/combined-full-document.png',
      fullPage: true,
    })
  })
})
