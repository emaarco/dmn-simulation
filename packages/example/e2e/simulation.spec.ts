import { test, expect } from '@playwright/test'

/** Open the menu, then pick an example model (the picker lives in the dropdown). */
async function selectExample(page: import('@playwright/test').Page, value: string) {
  await page.locator('#btn-menu').click()
  await page.getByTestId('file-picker').selectOption(value)
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
}

/** Models open in the DRD view by default; drill into a decision's table. */
async function openTable(page: import('@playwright/test').Page, decisionId: string) {
  await page.evaluate(
    id => (window as unknown as { __openDecisionTable(id: string): void }).__openDecisionTable(id),
    decisionId,
  )
  await expect(page.locator('.dmn-sim')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
  // Default model (Recommend Bike) lands in the DRD view — open its table.
  await openTable(page, 'Decision_RecommendBike')
})

test('renders the simulation form above the decision table', async ({ page }) => {
  await expect(page.locator('.dmn-sim')).toBeVisible()
  // Recommend Bike has two inputs: Terrain (dropdown) + Budget (number).
  await expect(page.locator('.dmn-sim-field')).toHaveCount(2)
  await expect(page.locator('.dmn-sim-run')).toBeDisabled()
})

test('simulates a FIRST decision and highlights the matched rule', async ({ page }) => {
  // Terrain = Gravel, Budget = 2500 (>= 2000) → Gravel Pro (rule 1).
  await page.locator('.dmn-sim-field').nth(0).locator('select').selectOption('Gravel')
  await page.locator('.dmn-sim-field').nth(1).locator('input').fill('2500')

  const run = page.locator('.dmn-sim-run')
  await expect(run).toBeEnabled()
  await run.click()

  await expect(page.locator('.dmn-sim-result')).toContainText('Gravel Pro')
  await expect(page.locator('.dmn-sim-result')).toContainText('Rule 1')
  // Exactly one reported rule row is highlighted.
  await expect(page.locator('tr.dmn-sim-match')).toHaveCount(1)
})

test('shows a miss result and no highlight when nothing matches', async ({ page }) => {
  // City needs a budget >= 800; 500 matches no rule.
  await page.locator('.dmn-sim-field').nth(0).locator('select').selectOption('City')
  await page.locator('.dmn-sim-field').nth(1).locator('input').fill('500')
  await page.locator('.dmn-sim-run').click()

  await expect(page.locator('.dmn-sim-result--miss')).toBeVisible()
  await expect(page.locator('tr.dmn-sim-match')).toHaveCount(0)
})

test('COLLECT + SUM aggregates and highlights every matching rule', async ({ page }) => {
  await selectExample(page, '/hit-policies/collect-sum.dmn')
  await openTable(page, 'Decision_Points')

  const fields = page.locator('.dmn-sim-field')
  const count = await fields.count()
  for (let i = 0; i < count; i++) {
    const control = fields.nth(i).locator('input, select')
    const tag = await control.evaluate(el => el.tagName)
    if (tag === 'SELECT') {
      const opts = control.locator('option')
      await control.selectOption({ index: (await opts.count()) - 1 })
    } else {
      await control.fill('1000')
    }
  }
  await page.locator('.dmn-sim-run').click()
  // Aggregation renders as SUM(...) = <n>; at least one rule highlighted.
  await expect(page.locator('.dmn-sim-output')).toContainText('SUM')
  await expect(page.locator('tr.dmn-sim-match')).not.toHaveCount(0)
})

test('reset clears inputs, result and highlight', async ({ page }) => {
  await page.locator('.dmn-sim-field').nth(0).locator('select').selectOption('Gravel')
  await page.locator('.dmn-sim-field').nth(1).locator('input').fill('2500')
  await page.locator('.dmn-sim-run').click()
  await expect(page.locator('.dmn-sim-result')).toBeVisible()

  await page.locator('.dmn-sim-reset').click()
  await expect(page.locator('.dmn-sim-result')).toHaveCount(0)
  await expect(page.locator('tr.dmn-sim-match')).toHaveCount(0)
  await expect(page.locator('.dmn-sim-run')).toBeDisabled()
})

test('shares the current model via a URL hash that reopens it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // Default model = Recommend Bike (two inputs). Share it, then follow the link.
  await page.locator('#btn-menu').click()
  await page.locator('#btn-share').click()
  await page.waitForFunction(() => location.hash.startsWith('#dmn='))
  const hash = await page.evaluate(() => location.hash)

  await page.goto('/' + hash)
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
  await openTable(page, 'Decision_RecommendBike')
  await expect(page.locator('.dmn-sim-field')).toHaveCount(2)
})

test('restores the edited model after a reload (URL hash)', async ({ page }) => {
  const before = await page.evaluate(() => location.hash)
  await page.evaluate(async () => {
    interface Viewer {
      get(name: string): unknown
    }
    interface View {
      type: string
    }
    const modeler = (
      window as unknown as {
        __modeler: { getViews(): View[]; open(view: View): Promise<void>; getActiveViewer(): Viewer }
      }
    ).__modeler
    // beforeEach drills into the decision table; rename the decision in the DRD.
    const drd = modeler.getViews().find(v => v.type === 'drd')!
    await modeler.open(drd)
    const viewer = modeler.getActiveViewer()
    const modeling = viewer.get('modeling') as { updateProperties(el: unknown, props: Record<string, string>): void }
    const registry = viewer.get('elementRegistry') as { get(id: string): unknown }
    modeling.updateProperties(registry.get('Decision_RecommendBike'), { name: 'Reload Survivor' })
  })

  // The edit is mirrored into the hash (debounced) — wait until it reflects it.
  await page.waitForFunction(prev => location.hash.startsWith('#dmn=') && location.hash !== prev, before)
  await page.reload()
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')

  const xml = await page.evaluate(
    async () =>
      (
        await (
          window as unknown as { __modeler: { saveXML(o: { format: boolean }): Promise<{ xml: string }> } }
        ).__modeler.saveXML({ format: true })
      ).xml,
  )
  expect(xml).toContain('Reload Survivor')
})

test('round-trips a very large model through the URL hash on reload', async ({ page }) => {
  await selectExample(page, '/large/credit-score-banding.dmn')

  // Loading mirrors the model into the hash; wait until the large one lands, then reload.
  await page.waitForFunction(() => location.hash.length > 10_000)
  const hashLength = await page.evaluate(() => location.hash.length)
  expect(hashLength).toBeGreaterThan(10_000) // ~13k chars — well within browser URL limits

  await page.reload()
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')

  // The full 400-rule table survived the hash round-trip intact.
  const ruleCount = await page.evaluate(async () => {
    const { xml } = await (
      window as unknown as { __modeler: { saveXML(o: { format: boolean }): Promise<{ xml: string }> } }
    ).__modeler.saveXML({ format: true })
    return (xml.match(/<rule\b/g) ?? []).length
  })
  expect(ruleCount).toBe(400)
})

test('imports a local .dmn file via the file dialog', async ({ page }) => {
  // The hidden input backs the "Datei öffnen…" menu item.
  await page.locator('#file-input').setInputFiles('public/miravelo/check-credit-rating.dmn')
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')

  // Check Credit Rating has two inputs (Age + Monthly Net Income).
  await openTable(page, 'checkCreditRating')
  await expect(page.locator('.dmn-sim-field')).toHaveCount(2)
})
