import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import legacyProject from '../src/core/blueprint/__fixtures__/project-v2.json' with { type: 'json' }

const filenames = ['BLUEPRINT.md', 'CLAUDE.md', 'AGENTS.md', 'TASKS.md', 'START-PROMPT.md']

test('Abnahme Phase 7: aktueller Blueprint → Vorschau → vollständiges ZIP → Start-Prompt', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  await page.getByLabel('Projektname').fill('Koch-Leihbörse')
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
  const problem = page.getByRole('article', { name: 'Problem & Vision' })
  await problem.getByRole('button', { name: 'Bearbeiten' }).click()
  await problem.getByRole('textbox').fill('Leih dir Küchengeräte.\nRezepte inklusive.')
  await problem.getByRole('button', { name: 'Fertig', exact: true }).click()
  // Sofort wechseln: Der Export darf nicht den Stand vor dem Autosave lesen.
  await page.getByRole('link', { name: 'Blueprint fertigstellen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint fertigstellen')
  await expect(page.getByText(/Es gibt noch offene Punkte/)).toBeVisible()
  const preview = page.getByRole('textbox', { name: 'Dateivorschau' })
  expect(await preview.inputValue()).toContain('Leih dir Küchengeräte.\nRezepte inklusive.')
  const previews: Record<string, string> = {}
  for (const filename of filenames) {
    await page.getByLabel('Datei auswählen').selectOption(filename)
    previews[filename] = await preview.inputValue()
  }

  const zipPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Alles als ZIP herunterladen' }).click()
  const download = await zipPromise
  expect(download.suggestedFilename()).toBe('koch-leihboerse-blueprint.zip')
  const archive = unzipSync(await readFile((await download.path())!))
  expect(Object.keys(archive)).toEqual(filenames)
  for (const filename of filenames) expect(strFromU8(archive[filename]!)).toBe(previews[filename])

  await page.getByRole('button', { name: 'Start-Prompt kopieren' }).click()
  await expect(page.getByRole('status')).toHaveText('Start-Prompt kopiert.')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    previews['START-PROMPT.md'],
  )

  await page.getByLabel('Datei auswählen').selectOption('BLUEPRINT.md')
  const singlePromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Datei herunterladen', exact: true }).click()
  const single = await singlePromise
  expect(single.suggestedFilename()).toBe('BLUEPRINT.md')
  expect(await readFile((await single.path())!, 'utf8')).toBe(previews['BLUEPRINT.md'])

  await page.reload()
  expect(await preview.inputValue()).toBe(previews['BLUEPRINT.md'])
  await page.getByRole('link', { name: 'Zurück zum Projekt' }).click()
  await expect(problem.getByText('Leih dir Küchengeräte.\nRezepte inklusive.')).toBeVisible()
})

test('Export eines importierten Altprojekts bewahrt Entscheidungen und Antworten', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Projektdatei auswählen').setInputFiles({
    name: 'rezeptplaner.blueprint.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'blueprint-wizard/project',
        exportedAt: '2026-10-11T12:00:00.000Z',
        project: legacyProject,
      }),
    ),
  })
  await page.getByRole('link', { name: 'Rezeptplaner', exact: true }).click()
  await page.getByRole('link', { name: 'Blueprint fertigstellen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blueprint fertigstellen')
  const content = await page.getByRole('textbox', { name: 'Dateivorschau' }).inputValue()
  expect(content).toContain('Gewählt: Web-App')
  expect(content).toContain('Familien – Vor allem für mich')
  expect(content).toContain('Wo werden die Rezepte gespeichert?')
  expect(content).toContain('KI-Vorschlag – noch nicht übernommen')
})
