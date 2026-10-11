import { expect, test } from '@playwright/test'

const PROBLEM = 'Problem & Vision'
const TEXT = 'Menschen verlieren den Überblick über ihre Projekte.'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
})

test('Abschnitt bearbeiten, Reifegrad setzen, nach dem Neuladen noch da und rückgängig machbar', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill('Blueprint-Test')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint-Test')

  const problem = page.getByRole('article', { name: PROBLEM })
  await problem.getByRole('button', { name: 'Bearbeiten' }).click()
  await problem.getByRole('textbox', { name: PROBLEM }).fill(TEXT)
  await problem.getByRole('button', { name: 'Fertig' }).click()
  await problem.locator('label', { hasText: 'entschieden' }).click()
  await expect(problem.getByRole('radio', { name: 'entschieden' })).toBeChecked()
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint-Test')
  const problemAfterReload = page.getByRole('article', { name: PROBLEM })
  await expect(problemAfterReload.getByText(TEXT)).toBeVisible()
  await expect(problemAfterReload.getByRole('radio', { name: 'entschieden' })).toBeChecked()
  await expect(problemAfterReload.getByTestId('maturity-badge')).toHaveText('entschieden')

  // Nach dem Neuladen ist der Verlauf leer; die nächste Änderung lässt sich zurücknehmen.
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
  await problemAfterReload.locator('label', { hasText: 'vage' }).click()
  await expect(problemAfterReload.getByRole('radio', { name: 'vage' })).toBeChecked()

  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(problemAfterReload.getByRole('radio', { name: 'entschieden' })).toBeChecked()
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible()
})
