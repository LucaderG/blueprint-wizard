import { Minus, Plus, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Decision } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type LeverageLevel = 'foundation' | 'important' | 'detail'

/** Hebel 4–5 gilt als Grundsatz, 3 als wichtig, 1–2 als Detail. */
function leverageLevel(leverage: number): LeverageLevel {
  if (leverage >= 4) return 'foundation'
  if (leverage === 3) return 'important'
  return 'detail'
}

const LEVERAGE_CLASS: Record<LeverageLevel, string> = {
  foundation: 'bg-primary/10 text-primary',
  important: 'bg-muted text-foreground',
  detail: 'bg-muted text-muted-foreground',
}

interface DecisionCardProps {
  decision: Decision
  onDecide: (optionId: string, rationale: string) => void
  onDismiss: () => void
}

/** Eine offene Entscheidung: Optionen mit Vor- und Nachteilen, Begründung und Entscheiden. */
export function DecisionCard({ decision, onDecide, onDismiss }: DecisionCardProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const groupName = useId()
  const rationaleId = useId()
  // Eine Empfehlung wird bewusst nicht vorausgewählt: die Wahl trifft die Person selbst.
  const [selected, setSelected] = useState<string | null>(null)
  // Eine Begründung aus einer früheren Entscheidung bleibt beim Wieder-Öffnen als Entwurf erhalten.
  const [rationale, setRationale] = useState(decision.rationale)

  const level = leverageLevel(decision.leverage)

  return (
    <article aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t(`sections.${decision.sectionId}`)}
          </span>
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVERAGE_CLASS[level])}
          >
            {t(`decisions.leverage.${level}`)}
          </span>
        </div>
        <h3 id={headingId} className="text-lg font-semibold break-words">
          {decision.title}
        </h3>
        {decision.context && (
          <p className="text-sm break-words text-muted-foreground">{decision.context}</p>
        )}
      </header>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('decisions.card.optionsLegend')}</legend>
        {decision.options.map((option) => (
          <div
            key={option.id}
            className="space-y-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <label className="flex cursor-pointer flex-wrap items-start gap-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="leading-relaxed font-medium break-words">{option.label}</span>
              {option.id === decision.recommendedOptionId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t('decisions.card.recommended')}
                </span>
              )}
            </label>

            <div className="grid gap-3 pl-7 sm:grid-cols-2">
              <ProsCons icon={Plus} title={t('decisions.card.pros')} items={option.pros} />
              <ProsCons icon={Minus} title={t('decisions.card.cons')} items={option.cons} />
            </div>

            {option.consequence && (
              <p className="pl-7 break-words text-muted-foreground">
                {t('decisions.card.consequence', { text: option.consequence })}
              </p>
            )}
          </div>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={rationaleId} className="text-sm font-medium">
          {t('decisions.card.rationaleLabel')}
        </label>
        <textarea
          id={rationaleId}
          rows={2}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          className="w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
          {t('decisions.card.dismiss')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) onDecide(selected, rationale)
          }}
        >
          {t('decisions.card.decide')}
        </Button>
      </div>
    </article>
  )
}

interface ProsConsProps {
  icon: LucideIcon
  title: string
  items: readonly string[]
}

/** Kurze Liste mit Überschrift (Vorteile oder Nachteile). Ohne Einträge wird nichts angezeigt. */
function ProsCons({ icon: Icon, title, items }: ProsConsProps) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {title}
      </p>
      <ul className="list-disc space-y-0.5 pl-5 break-words">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
