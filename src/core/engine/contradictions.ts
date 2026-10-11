import type { Project } from '@/core/blueprint/schema'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'
import { normalizeText } from './cleaning'

/**
 * Regelbasierte Widerspruchserkennung (deterministisch, ohne KI).
 *
 * Eine Regel besteht aus zwei Seiten mit Mustern. Kommt irgendwo im Blueprint (Abschnittsinhalte und
 * gewählte Entscheidungsoptionen) ein Muster der Seite A und eines der Seite B vor, gibt es eine
 * Warnung. Verneinte Fundstellen („ohne Login“, „keine Werbung“) zählen nicht.
 * Die Texte zu den Regeln liegen in den i18n-Dateien unter `decisions.contradictions.rules.<id>`.
 * Ergänzend zeigt die Oberfläche die Widersprüche aus der KI-Analyse (Phase 4).
 */

export interface ContradictionRule {
  id: string
  a: readonly RegExp[]
  b: readonly RegExp[]
  /** Kommt eines dieser Muster vor, ist der scheinbare Widerspruch erklärt (z. B. „Freemium“). */
  except?: readonly RegExp[]
}

export const CONTRADICTION_RULES: readonly ContradictionRule[] = [
  {
    id: 'offlineVsRealtime',
    a: [/offline/],
    b: [
      /echtzeit/,
      /real-?time/,
      /live-?(?:kollaboration|zusammenarbeit|sync)/,
      /gleichzeitig(?:es)?\s+(?:bearbeiten|arbeiten)/,
      /multiplayer/,
    ],
  },
  {
    id: 'localOnlyVsAccounts',
    a: [
      /(?:kein(?:en)?|ohne)\s+(?:eigenen?\s+)?(?:server|backend)/,
      /nur\s+lokal/,
      /daten\s+bleiben\s+lokal/,
      /local[- ]only/,
    ],
    b: [
      /login/,
      /anmeld/,
      /\bkonto/,
      /\baccounts?\b/,
      /registrier/,
      /geräteübergreifend/,
      /synchronisier/,
      /cloud-?(?:speicher|sync)/,
    ],
  },
  {
    id: 'freeVsPaid',
    a: [/kostenlos/, /gratis/, /keine\s+kosten/],
    b: [/\babo\b/, /abonnement/, /subscription/, /bezahl/, /premium/, /in-app-käuf/, /gebühr/],
    except: [
      /freemium/,
      /kostenlos\w*\s+(?:starten|testen|test|basis|grundversion)/,
      /kostenlose\s+(?:basis|grund)/,
      /testphase|trial/,
    ],
  },
  {
    id: 'webOnlyVsNative',
    a: [/nur\s+(?:im\s+|als\s+)?(?:web|browser)/, /reine\s+web-?app/, /web-?only/],
    b: [
      /app\s*store/,
      /play\s*store/,
      /\bnative?\b/,
      /\bnativen?\s+app/,
      /\bswift\b/,
      /\bkotlin\b/,
    ],
    // Zeitliche Staffelung („App-Store-Version in Phase 2“) ist kein Widerspruch.
    except: [
      /(?:app\s*store|play\s*store|nativ)[^\n]*(?:später|phase\s*\d|version\s*2|\bv2\b)/,
      /(?:später|phase\s*\d|version\s*2|\bv2\b)[^\n]*(?:app\s*store|play\s*store|nativ)/,
    ],
  },
  {
    id: 'noAiVsAi',
    a: [/(?:ohne|keine)\s+ki\b/, /\bno\s+ai\b/],
    b: [/\bki\b/, /künstliche\s+intelligenz/, /\bllm\b/, /chatgpt/, /openai/, /\bgpt\b/],
  },
  {
    id: 'privacyVsTracking',
    a: [
      /(?:keine|ohne)\s+(?:nutzer)?daten\s+(?:zu\s+)?sammeln/,
      /datensparsam/,
      /privacy[- ]first/,
    ],
    b: [/tracking/, /analytics/, /werbung/, /\bads\b/, /nutzerprofil/],
  },
]

/** Kennung der Strukturregel „Punkt steht in Kernfunktionen und in Nicht-Zielen“. */
export const FEATURE_IS_NON_GOAL = 'featureIsNonGoal'

export interface Contradiction {
  ruleId: string
  /** Abschnitte, in denen die beiden Seiten gefunden wurden. */
  sectionIds: SectionId[]
  /** Die beiden Fundstellen (jeweils die Zeile), zur Anzeige. */
  evidence: [string, string]
  /** Abschnitt der jeweiligen Fundstelle (gleiche Reihenfolge wie `evidence`). */
  evidenceSectionIds: [SectionId, SectionId]
}

const NEGATIONS = new Set([
  'kein',
  'keine',
  'keinen',
  'keiner',
  'ohne',
  'nicht',
  'no',
  'not',
  'without',
])
const MAX_EVIDENCE_LENGTH = 120

interface TextSource {
  sectionId: SectionId
  text: string
}

interface Match {
  sectionId: SectionId
  line: string
}

function sources(project: Project): TextSource[] {
  const fromSections = SECTION_IDS.map((id) => ({
    sectionId: id,
    text: project.blueprint.sections[id].content,
  }))
  const fromDecisions = project.decisions.flatMap((d) => {
    const option = d.options.find((o) => o.id === d.chosenOptionId)
    return d.status === 'decided' && option ? [{ sectionId: d.sectionId, text: option.label }] : []
  })
  return [...fromSections, ...fromDecisions]
}

/** Verneinung nach der Fundstelle im selben Satzteil, z. B. „Login ist nicht erforderlich“. */
const NEGATED_AFTER =
  /\b(?:nicht|kein\w*)\b[^.;!?]*\b(?:nötig|notwendig|erforderlich|geplant|vorgesehen|gewünscht|gebraucht)|\bentfällt\b|\bnot\s+(?:needed|required|planned)\b/

/**
 * Prüft, ob die Fundstelle verneint ist: eines der drei Wörter davor ist eine Verneinung
 * („ohne den lästigen Login“), oder der Rest des Satzteils verneint sie („… ist nicht nötig“).
 */
function isNegated(line: string, index: number, length: number): boolean {
  const before = line
    .slice(0, index)
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .slice(-3)
  if (before.some((word) => NEGATIONS.has(word))) return true
  const rest = line.slice(index + length).split(/[.;!?]/)[0] ?? ''
  return NEGATED_AFTER.test(rest)
}

function shorten(line: string): string {
  const trimmed = line.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, '')
  return trimmed.length > MAX_EVIDENCE_LENGTH
    ? `${trimmed.slice(0, MAX_EVIDENCE_LENGTH - 1)}…`
    : trimmed
}

function findFirst(texts: readonly TextSource[], patterns: readonly RegExp[]): Match | null {
  for (const { sectionId, text } of texts) {
    for (const rawLine of text.split('\n')) {
      const line = rawLine.toLowerCase()
      for (const pattern of patterns) {
        const global = new RegExp(
          pattern.source,
          pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
        )
        for (const match of line.matchAll(global)) {
          if (!isNegated(line, match.index, match[0].length))
            return { sectionId, line: shorten(rawLine) }
        }
      }
    }
  }
  return null
}

function bulletItems(content: string): Map<string, string> {
  const items = new Map<string, string>()
  for (const line of content.split('\n')) {
    const text = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim()
    if (text) items.set(normalizeText(text), text)
  }
  return items
}

function mentionsAnywhere(texts: readonly TextSource[], patterns: readonly RegExp[]): boolean {
  return texts.some(({ text }) => patterns.some((pattern) => pattern.test(text.toLowerCase())))
}

/**
 * Findet Widersprüche im Blueprint: je Schlagwort-Regel höchstens eine Warnung, bei der Strukturregel
 * `featureIsNonGoal` eine je doppeltem Punkt.
 */
export function detectContradictions(project: Project): Contradiction[] {
  const texts = sources(project)
  const found: Contradiction[] = []

  for (const rule of CONTRADICTION_RULES) {
    if (rule.except && mentionsAnywhere(texts, rule.except)) continue
    const a = findFirst(texts, rule.a)
    if (!a) continue
    const b = findFirst(texts, rule.b)
    if (!b) continue
    found.push({
      ruleId: rule.id,
      sectionIds: [...new Set([a.sectionId, b.sectionId])],
      evidence: [a.line, b.line],
      evidenceSectionIds: [a.sectionId, b.sectionId],
    })
  }

  const features = bulletItems(project.blueprint.sections.features.content)
  const nonGoals = bulletItems(project.blueprint.sections.nonGoals.content)
  for (const [key, text] of features) {
    if (!nonGoals.has(key)) continue
    found.push({
      ruleId: FEATURE_IS_NON_GOAL,
      sectionIds: ['features', 'nonGoals'],
      evidence: [text, nonGoals.get(key) ?? text],
      evidenceSectionIds: ['features', 'nonGoals'],
    })
  }
  return found
}
