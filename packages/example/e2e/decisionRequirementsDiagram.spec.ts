import { test, expect } from '@playwright/test'

/** Open the menu, then pick an example model (the picker lives in the dropdown). */
async function selectExample(page: import('@playwright/test').Page, value: string) {
  await page.locator('#btn-menu').click()
  await page.getByTestId('file-picker').selectOption(value)
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
}

/** Load the chained Inner-Circle DRD and wait for the DRD view + panel. */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await selectExample(page, '/chaining/inner-circle.dmn')
  await expect(page.locator('.dmn-sim-decision-requirements-diagram-panel')).toBeVisible()
})

test('renders a DRD input panel with a field per input data', async ({ page }) => {
  await expect(page.locator('.dmn-sim-decision-requirements-diagram-panel .dmn-sim-field')).toHaveCount(2)
  await expect(page.locator('.dmn-sim-run')).toBeDisabled()
})

test('centers the DRD diagram in the viewport (not over-zoomed)', async ({ page }) => {
  const box = await page.evaluate(() => {
    const canvas = (window as { __modeler: { getActiveViewer(): { get(n: string): { viewbox(): any } } } }).__modeler
      .getActiveViewer()
      .get('canvas')
    const v = canvas.viewbox()
    return {
      scale: v.scale,
      dx: Math.abs(v.inner.x + v.inner.width / 2 - (v.x + v.width / 2)),
      dy: Math.abs(v.inner.y + v.inner.height / 2 - (v.y + v.height / 2)),
    }
  })
  expect(box.scale).toBeLessThanOrEqual(1)
  expect(box.dx).toBeLessThan(5)
  expect(box.dy).toBeLessThan(5)
})

test('simulates the graph, marks fired decisions and shows result badges', async ({ page }) => {
  const fields = page.locator('.dmn-sim-decision-requirements-diagram-panel .dmn-sim-field')
  // Age = 25 (core), Annual Spend = 1500 (>= 1000) → Segment "core", Offer "InnerCircle".
  await fields.filter({ hasText: 'Age' }).locator('input').fill('25')
  await fields.filter({ hasText: 'Annual Spend' }).locator('input').fill('1500')

  await page.locator('.dmn-sim-run').click()

  // Both decisions fire; the per-node result badges reflect the chained outcome.
  await expect(page.locator('.djs-element.dmn-sim-fired')).toHaveCount(2)
  await expect(page.locator('.dmn-sim-badge')).toContainText(['core', 'InnerCircle'])
})

test('drilling into a decision reflects the DRD run as row highlights', async ({ page }) => {
  const fields = page.locator('.dmn-sim-decision-requirements-diagram-panel .dmn-sim-field')
  await fields.filter({ hasText: 'Age' }).locator('input').fill('40')
  await fields.filter({ hasText: 'Annual Spend' }).locator('input').fill('1500')
  await page.locator('.dmn-sim-run').click()
  await expect(page.locator('.dmn-sim-badge')).toContainText(['casual', 'Newsletter'])

  // Open the Offer decision table; its casual/>=1000 rule (row 2) is reflected.
  await page.evaluate(() =>
    (window as unknown as { __openDecisionTable(id: string): void }).__openDecisionTable('Decision_Offer'),
  )
  await expect(page.locator('tr.dmn-sim-match')).toHaveCount(1)
  // The drilled-in form reflects the DRD run: inputs seeded + result bar shown.
  await expect(page.locator('.dmn-sim-result')).toContainText('Offer = Newsletter')
  await expect(page.locator('.dmn-sim-field').filter({ hasText: 'Segment' }).locator('select')).toHaveValue('casual')
})

test('reset clears the DRD markers and summary', async ({ page }) => {
  const fields = page.locator('.dmn-sim-decision-requirements-diagram-panel .dmn-sim-field')
  await fields.filter({ hasText: 'Age' }).locator('input').fill('25')
  await fields.filter({ hasText: 'Annual Spend' }).locator('input').fill('1500')
  await page.locator('.dmn-sim-run').click()
  await expect(page.locator('.djs-element.dmn-sim-fired')).not.toHaveCount(0)

  await page.locator('.dmn-sim-decision-requirements-diagram-panel .dmn-sim-reset').click()
  await expect(page.locator('.djs-element.dmn-sim-fired')).toHaveCount(0)
  await expect(page.locator('.dmn-sim-badge')).toHaveCount(0)
})

test('does not show the DRD panel for a single-decision model', async ({ page }) => {
  // Switch to a single-decision table model and open its DRD view.
  await selectExample(page, '/hit-policies/first.dmn')
  await page.evaluate(() => {
    const m = (window as any).__modeler
    const drd = m.getViews().find((v: any) => v.type === 'drd')
    if (drd) m.open(drd)
  })
  // A lone decision is covered by the table simulation → no redundant DRD panel.
  await expect(page.locator('.dmn-sim-decision-requirements-diagram-panel')).toHaveCount(0)
})

test('simulates a 3-level chain (bike leasing) end to end', async ({ page }) => {
  await selectExample(page, '/chaining/bike-leasing.dmn')
  const panel = page.locator('.dmn-sim-decision-requirements-diagram-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.dmn-sim-field')).toHaveCount(3)

  const fields = panel.locator('.dmn-sim-field')
  await fields.filter({ hasText: 'Age' }).locator('input').fill('15')
  await fields.filter({ hasText: 'Monthly Net Income' }).locator('input').fill('20000')
  await fields.filter({ hasText: 'Requested Term' }).locator('input').fill('24')
  await page.locator('.dmn-sim-run').click()

  // All three decisions fire; the final decision's badge reports "rejected".
  await expect(page.locator('.djs-element.dmn-sim-fired')).toHaveCount(3)
  await expect(page.locator('.dmn-sim-badge')).toHaveCount(3)
  await expect(page.locator('.dmn-sim-badge').filter({ hasText: 'rejected' })).toHaveCount(1)
})
