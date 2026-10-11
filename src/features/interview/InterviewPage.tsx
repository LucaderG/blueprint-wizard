import { ArrowLeft, Redo2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { SaveStatus } from '@/features/blueprint/SaveStatus'
import { useHistoryShortcuts } from '@/features/blueprint/useHistoryShortcuts'
import { useProjectEditor, type ProjectEditorState } from '@/features/projects/useProjectEditor'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { Button } from '@/shared/ui/button'
import { AnalysisPanel } from './AnalysisPanel'
import { InterviewHistory } from './InterviewHistory'
import { IntegrationReview } from './IntegrationReview'
import { QuestionRound } from './QuestionRound'
import { useInterview } from './useInterview'

type ReadyState = Extract<ProjectEditorState, { status: 'ready' }>

/** Fragenseite eines Projekts: Analyse, Fragerunde, Vorschläge zum Übernehmen und Verlauf. */
export function InterviewPage() {
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

  return <InterviewView {...state} />
}

/** Der eigentliche Fragenmotor-Bildschirm für ein geladenes Projekt. */
function InterviewView(editor: ReadyState) {
  const { t } = useTranslation()
  const { project, saveState, canUndo, canRedo, undo, redo, flush } = editor
  const controller = useInterview(editor)

  useHistoryShortcuts({ canUndo, canRedo, undo, redo })

  const integrationRunning = controller.integration.status === 'running'
  const analysisRunning = controller.analysis.status === 'running'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/projekte/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('interview.page.back')}
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.name}</h1>
        <p className="text-muted-foreground">{t('interview.page.lead')}</p>
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
          </div>
          <SaveStatus saveState={saveState} onRetry={() => void flush()} />
        </div>
      </header>

      <ApiKeyNotice />

      <AnalysisPanel
        analysis={project.interview.analysis}
        state={controller.analysis}
        hasAi={controller.hasAi}
        integrationRunning={integrationRunning}
        onAnalyze={() => void controller.analyze()}
        onCancel={controller.cancel}
      />

      {controller.integration.status === 'idle' ? (
        <QuestionRound
          round={controller.round}
          blockedCount={controller.prioritization.blocked.length}
          analysisRunning={analysisRunning}
          onSubmit={controller.submitRound}
        />
      ) : (
        <IntegrationReview
          integration={controller.integration}
          acceptProposal={controller.acceptProposal}
          rejectProposal={controller.rejectProposal}
          acceptAllProposals={controller.acceptAllProposals}
          appendWithoutAi={controller.appendWithoutAi}
          dismissIntegration={controller.dismissIntegration}
          cancel={controller.cancel}
        />
      )}

      <InterviewHistory log={project.interview.log} />
    </div>
  )
}
