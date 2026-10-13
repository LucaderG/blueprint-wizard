import { expect, test, type Page } from '@playwright/test'

const projectList = (page: Page) => page.getByRole('list', { name: 'Projektliste' })

async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill(name)
  await dialog.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await page.getByRole('link', { name: 'Alle Projekte' }).click()
  await expect(projectList(page).getByRole('link', { name, exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
})

test('Abnahme Phase 1: angelegtes Projekt ist nach dem Neuladen noch da', async ({ page }) => {
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' })
  await dialog.getByLabel('Projektname').fill('Mein erstes Projekt')
  await dialog.getByRole('button', { name: 'Anlegen' }).click()

  await expect(page).toHaveURL(/\/projekte\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mein erstes Projekt')
  await expect(page.getByRole('list', { name: 'Abschnitte' }).getByRole('listitem')).toHaveCount(10)

  // Auch die Projektseite selbst übersteht ein Neuladen.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mein erstes Projekt')

  await page.goto('/')
  await page.reload()
  await expect(
    projectList(page).getByRole('link', { name: 'Mein erstes Projekt', exact: true }),
  ).toBeVisible()
  await expect(
    projectList(page).getByRole('progressbar', { name: 'Vollständigkeit von Mein erstes Projekt' }),
  ).toHaveAttribute('aria-valuenow', '0')
})

test('Projekt umbenennen', async ({ page }) => {
  await createProject(page, 'Alpha')

  await projectList(page).getByRole('button', { name: 'Alpha umbenennen' }).click()
  const dialog = page.getByRole('dialog', { name: 'Projekt umbenennen' })
  await dialog.getByLabel('Projektname').fill('Beta')
  await dialog.getByRole('button', { name: 'Speichern' }).click()

  await expect(projectList(page).getByRole('link', { name: 'Beta', exact: true })).toBeVisible()
  await page.reload()
  await expect(projectList(page).getByRole('link', { name: 'Beta', exact: true })).toBeVisible()
  await expect(projectList(page).getByRole('link', { name: 'Alpha', exact: true })).toHaveCount(0)
})

test('Projekt duplizieren', async ({ page }) => {
  await createProject(page, 'Alpha')

  await projectList(page).getByRole('button', { name: 'Alpha duplizieren' }).click()

  await expect(projectList(page).getByRole('listitem')).toHaveCount(2)
  await page.reload()
  await expect(
    projectList(page).getByRole('link', { name: 'Alpha (Kopie)', exact: true }),
  ).toBeVisible()
  await expect(projectList(page).getByRole('link', { name: 'Alpha', exact: true })).toBeVisible()
})

test('Löschen legt in den Papierkorb, Rückgängig und Speichern holen zurück', async ({ page }) => {
  await createProject(page, 'Alpha')

  // Löschen in der Bibliothek braucht keine Bestätigung und bietet „Rückgängig“.
  await projectList(page).getByRole('button', { name: 'Alpha löschen' }).click()
  await expect(page.getByRole('status')).toHaveText('„Alpha“ liegt jetzt im Papierkorb.')
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(projectList(page).getByRole('link', { name: 'Alpha', exact: true })).toBeVisible()

  // Erneut löschen; der Eintrag überlebt im Papierkorb ein Neuladen.
  await projectList(page).getByRole('button', { name: 'Alpha löschen' }).click()
  await expect(page.getByRole('button', { name: 'Papierkorb (1)' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Papierkorb (1)' }).click()
  const trash = page.getByRole('list', { name: 'Papierkorb' })
  await expect(trash.getByText('noch 24 Std.')).toBeVisible()
  await trash.getByRole('button', { name: 'Alpha speichern' }).click()

  await page.getByRole('button', { name: 'Bibliothek', exact: true }).click()
  await expect(projectList(page).getByRole('link', { name: 'Alpha', exact: true })).toBeVisible()
})

test('Endgültig löschen mit Bestätigung', async ({ page }) => {
  await createProject(page, 'Alpha')
  await projectList(page).getByRole('button', { name: 'Alpha löschen' }).click()
  await page.getByRole('button', { name: 'Papierkorb (1)' }).click()
  const trash = page.getByRole('list', { name: 'Papierkorb' })

  await trash.getByRole('button', { name: 'Alpha endgültig löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  await expect(trash.getByRole('link', { name: 'Alpha', exact: true })).toBeVisible()

  await trash.getByRole('button', { name: 'Alpha endgültig löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Endgültig löschen' }).click()

  await expect(page.getByRole('button', { name: 'Papierkorb (0)' })).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Papierkorb (0)' })).toBeVisible()
})

test('Nach Ablauf der Frist entfernt der Start den Eintrag endgültig', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T10:00:00Z') })
  await page.reload()
  await createProject(page, 'Alpha')
  await projectList(page).getByRole('button', { name: 'Alpha löschen' }).click()
  await expect(page.getByRole('button', { name: 'Papierkorb (1)' })).toBeVisible()

  // Standardfrist: ein Tag.
  await page.clock.setSystemTime(new Date('2026-10-02T11:00:00Z'))
  await page.reload()

  await expect(page.getByRole('button', { name: 'Papierkorb (0)' })).toBeVisible()
})

test('Export und Import ergeben wieder dasselbe Projekt', async ({ page }) => {
  await createProject(page, 'Rundreise Ü')

  const downloadPromise = page.waitForEvent('download')
  await projectList(page).getByRole('button', { name: 'Rundreise Ü exportieren' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('rundreise-ue.blueprint.json')
  const path = await download.path()

  // Original löschen, dann die exportierte Datei wieder importieren.
  await projectList(page).getByRole('button', { name: 'Rundreise Ü löschen' }).click()
  await expect(page.getByText(/Du hast noch keine Projekte/)).toBeVisible()

  await page.getByLabel('Projektdatei auswählen').setInputFiles(path)

  await expect(page.getByRole('status')).toHaveText('„Rundreise Ü“ wurde importiert.')
  await page.reload()
  await projectList(page).getByRole('link', { name: 'Rundreise Ü', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rundreise Ü')
})

test('Import einer ungültigen Datei zeigt eine Fehlermeldung', async ({ page }) => {
  await page.getByLabel('Projektdatei auswählen').setInputFiles({
    name: 'kaputt.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"nicht": "unser Format"}'),
  })

  await expect(page.getByRole('alert')).toHaveText(
    'Die Datei ist keine gültige Projektdatei des Blueprint-Wizards.',
  )
})
