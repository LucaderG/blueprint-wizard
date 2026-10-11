import { expect, test } from '@playwright/test'

test('App startet und zeigt die Startseite', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Blueprint-Wizard')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Von der Idee zum Blueprint')
  await expect(
    page.getByRole('list', { name: 'Einstiegspunkte' }).getByRole('listitem'),
  ).toHaveCount(3)
})

test('Einstellungen sind erreichbar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Einstellungen' }).click()

  await expect(page).toHaveURL(/\/einstellungen$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen')
})
