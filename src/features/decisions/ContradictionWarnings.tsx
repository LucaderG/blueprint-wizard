import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalysisFinding } from '@/core/blueprint'
import { FEATURE_IS_NON_GOAL, type Contradiction } from '@/core/engine'

/** Alle Regel-IDs, zu denen es einen Erklärtext gibt (siehe `decisions.contradictions.rules`). */
const RULE_IDS = [
  'offlineVsRealtime',
  'localOnlyVsAccounts',
  'freeVsPaid',
  'webOnlyVsNative',
  'noAiVsAi',
  'privacyVsTracking',
  FEATURE_IS_NON_GOAL,
] as const

type RuleId = (typeof RULE_IDS)[number]

function isRuleId(id: string): id is RuleId {
  return (RULE_IDS as readonly string[]).includes(id)
}

interface ContradictionWarningsProps {
  /** Regelbasierte Widersprüche (immer aktuell). */
  rules: readonly Contradiction[]
  /** Widersprüche aus der letzten KI-Analyse. */
  aiFindings: readonly AnalysisFinding[]
}

/** Warnbox für Widersprüche im Blueprint. Ohne Widersprüche wird nichts angezeigt. */
export function ContradictionWarnings({ rules, aiFindings }: ContradictionWarningsProps) {
  const { t } = useTranslation()
  const headingId = useId()

  if (rules.length === 0 && aiFindings.length === 0) return null

  const ruleText = (ruleId: string) =>
    isRuleId(ruleId)
      ? t(`decisions.contradictions.rules.${ruleId}`)
      : t('decisions.contradictions.rules.unknown')

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <div className="space-y-1">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-xl font-semibold text-destructive"
        >
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          {t('decisions.contradictions.title')}
        </h2>
        <p className="text-sm">{t('decisions.contradictions.intro')}</p>
      </div>

      {rules.length > 0 && (
        <ul className="space-y-4">
          {rules.map((contradiction, index) => (
            <li key={`${contradiction.ruleId}-${index}`} className="space-y-2 text-sm">
              <p className="font-medium">{ruleText(contradiction.ruleId)}</p>
              <ul className="space-y-1 border-l-2 border-destructive/40 pl-3">
                {contradiction.evidence.map((line, lineIndex) => (
                  <li key={lineIndex} className="break-words">
                    {contradiction.evidenceSectionIds[lineIndex] && (
                      <span className="mr-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {t(`sections.${contradiction.evidenceSectionIds[lineIndex]}`)}
                      </span>
                    )}
                    {t('decisions.contradictions.quote', { text: line })}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {aiFindings.length > 0 && (
        <div className="space-y-2 border-t border-destructive/20 pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('decisions.contradictions.fromAnalysis')}
          </p>
          <ul className="space-y-2 text-sm">
            {aiFindings.map((finding, index) => (
              <li key={index} className="space-y-1">
                {finding.sectionIds.length > 0 && (
                  <span className="mr-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {finding.sectionIds.map((id) => t(`sections.${id}`)).join(', ')}
                  </span>
                )}
                <span className="break-words">{finding.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
