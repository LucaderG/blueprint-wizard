import { describe, expect, it } from 'vitest'
import de from './locales/de.json'
import en from './locales/en.json'

/** Sammelt alle String-Blätter eines JSON-Baums; Arrays werden als `pfad[i]` geführt. */
function collectLeaves(
  node: unknown,
  path: string,
  out: Map<string, unknown>,
): Map<string, unknown> {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectLeaves(item, `${path}[${index}]`, out))
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, path === '' ? key : `${path}.${key}`, out)
    }
  } else {
    out.set(path, node)
  }
  return out
}

function leavesOf(root: unknown): Map<string, unknown> {
  return collectLeaves(root, '', new Map())
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^{}\s]+?)\s*\}\}/g)].map((match) => match[1] ?? '').sort()
}

const deLeaves = leavesOf(de)
const enLeaves = leavesOf(en)

describe('Locale-Dateien', () => {
  it('haben exakt dieselben Schlüssel in en.json und de.json', () => {
    const dePaths = new Set(deLeaves.keys())
    const enPaths = new Set(enLeaves.keys())
    const missing = [...dePaths].filter((path) => !enPaths.has(path))
    const extra = [...enPaths].filter((path) => !dePaths.has(path))

    expect(
      { missing, extra },
      [
        missing.length > 0 ? `In en.json fehlen: ${missing.join(', ')}` : '',
        extra.length > 0 ? `In en.json zusätzlich: ${extra.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n') || 'Schlüssel stimmen überein',
    ).toEqual({ missing: [], extra: [] })
  })

  it('hat in en.json nur nicht-leere Strings als Werte', () => {
    const invalid = [...enLeaves.entries()]
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([path]) => path)

    expect(invalid, `Leere oder keine Strings in en.json: ${invalid.join(', ')}`).toEqual([])
  })

  it('verwendet pro Schlüssel dieselben {{…}}-Platzhalter wie de.json', () => {
    const mismatches: string[] = []

    for (const [path, deValue] of deLeaves) {
      const enValue = enLeaves.get(path)
      if (typeof deValue !== 'string' || typeof enValue !== 'string') continue

      const deVars = placeholdersOf(deValue)
      const enVars = placeholdersOf(enValue)
      if (deVars.join('|') !== enVars.join('|')) {
        mismatches.push(
          `${path}: de {{${deVars.join('}}, {{')}}} vs. en {{${enVars.join('}}, {{')}}}`,
        )
      }
    }

    expect(mismatches, mismatches.join('\n')).toEqual([])
  })
})
