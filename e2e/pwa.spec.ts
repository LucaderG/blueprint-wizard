import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('PWA: Manifest, Service Worker und Öffnen ohne Netz', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Das Manifest ist verlinkt und beschreibt eine installierbare App.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await page.request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Blueprint-Wizard', display: 'standalone' })
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )

  // Der Service Worker übernimmt die Seite und hat die App vorab gespeichert.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  // Ohne Netz öffnet die App weiterhin, auch auf einer Unterseite.
  await context.setOffline(true)
  await page.goto('/einstellungen')
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await context.setOffline(false)
})
