import { ArrowLeft, Info, Redo2, RotateCcw, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { needsPricing } from '@/core/engine'
import { SaveStatus } from '@/features/blueprint/SaveStatus'
import { useHistoryShortcuts } from '@/features/blueprint/useHistoryShortcuts'
import { useProjectEditor, type ProjectEditorState } from '@/features/projects/useProjectEditor'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { Button } from '@/shared/ui/button'
import { FinishStep } from './FinishStep'
import { ModelsStep } from './ModelsStep'
import { PricingStep } from './PricingStep'
import { useMonetization, type MonetizationController } from './useMonetization'

type ReadyState = Extract<ProjectEditorState, { status: 'ready' }>

/** Seite „Monetarisierung“ eines Projekts: Modelle vergleichen, wählen, Preisstrategie festlegen. */
export function MonetizationPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams()
  const state = useProjectEditor(projectId)

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-muted-foreground">
        {t('projects.page.loading')}
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-destructive">
        {t('projects.page.loadError')}
      </p>
    )
  }

  if (state.status === 'notFound') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{t('projects.page.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('projects.page.notFoundText')}</p>
        <Button asChild>
          <Link to="/">{t('projects.page.home')}</Link>
        </Button>
      </div>
    )
  }

  return <MonetizationView {...state} />
}

function MonetizationView(editor: ReadyState) {
  const { t } = useTranslation()
  const { project, saveState, canUndo, canRedo, undo, redo, flush } = editor
  const controller = useMonetization(editor)
  // Wer trotz unfertigem Blueprint starten will, darf das; begonnene Sektionen bleiben offen.
  const [forced, setForced] = useState(false)
  const started = controller.monetization !== null
  const showSteps = controller.availability.available || started || forced

  useHistoryShortcuts({ canUndo, canRedo, undo, redo })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/projekte/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('monetization.page.back')}
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.name}</h1>
        <p className="text-muted-foreground">{t('monetization.page.lead')}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!canUndo} onClick={undo}>
              <Undo2 className="size-4" aria-hidden />
              {t('blueprint.toolbar.undo')}
            </Button>
            <Button variant="outline" size="sm" disabled={!canRedo} onClick={redo}>
              <Redo2 className="size-4" aria-hidden />
              {t('blueprint.toolbar.redo')}
            </Button>
            {started && (
              <Button variant="outline" size="sm" onClick={controller.reset}>
                <RotateCcw className="size-4" aria-hidden />
                {t('monetization.page.reset')}
              </Button>
            )}
          </div>
          <SaveStatus saveState={saveState} onRetry={() => void flush()} />
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('monetization.page.disclaimer')}
      </p>

      <ApiKeyNotice />

      {showSteps ? (
        <Steps controller={controller} editor={editor} />
      ) : (
        <Availability controller={controller} onStart={() => setForced(true)} />
      )}
    </div>
  )
}

/** Hinweis, solange der Blueprint für fundierte Vorschläge noch zu dünn ist. */
function Availability({
  controller,
  onStart,
}: {
  controller: MonetizationController
  onStart: () => void
}) {
  const { t } = useTranslation()
  const { completeness, belowThreshold, missingSections } = controller.availability
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-xl font-semibold">{t('monetization.availability.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('monetization.availability.text')}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {belowThreshold && (
          <li>{t('monetization.availability.completeness', { value: completeness })}</li>
        )}
        {missingSections.length > 0 && (
          <li>
            {t('monetization.availability.missing', {
              sections: missingSections.map((id) => t(`sections.${id}`)).join(', '),
            })}
          </li>
        )}
      </ul>
      <Button variant="outline" size="sm" onClick={onStart}>
        {t('monetization.availability.start')}
      </Button>
    </section>
  )
}

function Steps({ controller, editor }: { controller: MonetizationController; editor: ReadyState }) {
  const { monetization } = controller
  return (
    <>
      <ModelsStep
        monetization={monetization}
        state={controller.modelsState}
        hasAi={controller.hasAi}
        onSuggest={() => void controller.suggestModels()}
        onCancel={controller.cancelModels}
        onAdd={controller.addModel}
        onChoose={controller.chooseModels}
      />
      {monetization && needsPricing(monetization) && (
        <PricingStep
          monetization={monetization}
          state={controller.pricingState}
          hasAi={controller.hasAi}
          onSuggest={() => void controller.suggestPricing()}
          onCancel={controller.cancelPricing}
          onAdd={controller.addPricing}
          onChoose={controller.choosePricing}
        />
      )}
      {monetization && monetization.chosenModelIds.length > 0 && (
        <FinishStep
          project={editor.project}
          monetization={monetization}
          impacts={controller.impacts}
          onFinalize={controller.finalize}
          onReopen={controller.reopen}
          onApplyImpact={controller.applyImpact}
        />
      )}
    </>
  )
}
