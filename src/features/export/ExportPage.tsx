import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ClipboardCopy, Download, FileCheck2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import type { Project } from '@/core/blueprint'
import { createExportZip } from '@/core/export/archive'
import {
  describeReadiness,
  generateExportFiles,
  type ExportFilename,
} from '@/core/export/generators'
import { checkReadiness } from '@/core/export/readiness'
import { CompletenessBar } from '@/features/projects/CompletenessBar'
import { useProjectEditor } from '@/features/projects/useProjectEditor'
import { Button } from '@/shared/ui/button'
import { downloadBlobFile, downloadTextFile } from '@/shared/lib/download'
import { slugify } from '@/shared/lib/slugify'

/** Export liest über den vorhandenen Editor; ausstehende Speicherungen anderer Seiten werden abgewartet. */
export function ExportPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams()
  const state = useProjectEditor(projectId)

  if (state.status === 'loading') return <p role="status">{t('projects.page.loading')}</p>
  if (state.status === 'error')
    return (
      <p role="alert" className="text-destructive">
        {t('projects.page.loadError')}
      </p>
    )
  if (state.status === 'notFound')
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{t('projects.page.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('projects.page.notFoundText')}</p>
        <Button asChild>
          <Link to="/">{t('projects.page.home')}</Link>
        </Button>
      </div>
    )

  return <ExportView key={state.project.id} project={state.project} />
}

type Notice = 'copied' | 'copyError' | 'downloadError' | 'downloaded'

function ExportView({ project }: { project: Project }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<ExportFilename>('BLUEPRINT.md')
  const [notice, setNotice] = useState<Notice | null>(null)
  const preview = useRef<HTMLTextAreaElement>(null)
  // Zähler statt sofortigem select(): markiert wird erst, wenn der Start-Prompt gerendert ist.
  const [selectRequest, setSelectRequest] = useState(0)
  useEffect(() => {
    if (selectRequest === 0) return
    preview.current?.focus()
    preview.current?.select()
  }, [selectRequest])
  const labels = {
    ...t('export.document', { returnObjects: true }),
    sectionTitles: t('sections', { returnObjects: true }),
    modelKinds: t('monetization.kinds', { returnObjects: true }),
    pricingStrategies: t('monetization.strategies', { returnObjects: true }),
    maturity: t('maturity', { returnObjects: true }),
  }
  const readiness = checkReadiness(project)
  const warnings = describeReadiness(readiness, labels)
  const files = generateExportFiles(project, labels)
  const file = files.find((candidate) => candidate.name === selected)!

  const copy = async () => {
    setSelected('START-PROMPT.md')
    setNotice(null)
    try {
      // Fehlt die Clipboard-API, wirft der Aufruf synchron; auch das landet im catch.
      await navigator.clipboard.writeText(
        files.find((candidate) => candidate.name === 'START-PROMPT.md')!.content,
      )
      setNotice('copied')
    } catch {
      setNotice('copyError')
      setSelectRequest((n) => n + 1)
    }
  }

  const download = (zip: boolean) => {
    setNotice(null)
    try {
      if (zip) {
        const bytes = createExportZip(files)
        downloadBlobFile(
          `${slugify(project.name) || 'projekt'}-blueprint.zip`,
          new Blob([bytes], { type: 'application/zip' }),
        )
      } else downloadTextFile(file.name, file.content, 'text/markdown;charset=utf-8')
      setNotice('downloaded')
    } catch {
      setNotice('downloadError')
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/projekte/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('export.back')}
      </Link>
      <header className="space-y-3">
        <p className="text-sm font-medium break-words text-muted-foreground">{project.name}</p>
        <h1 className="text-3xl font-bold tracking-tight">{t('export.title')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('export.lead')}</p>
      </header>

      <section
        aria-labelledby="readiness-heading"
        className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <h2 id="readiness-heading" className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck2 className="size-5" aria-hidden />
          {t('export.checkTitle')}
        </h2>
        <CompletenessBar value={readiness.completeness} label={t('export.percentage')} />
        <p>{t(readiness.ready ? 'export.ready' : 'export.warning')}</p>
        {warnings.length > 0 && (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {warnings.map((warning, index) => (
              <li key={index} className="break-words">
                {warning}
              </li>
            ))}
          </ul>
        )}
        {(readiness.questions.length > 0 || readiness.decisions.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {readiness.questions.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/projekte/${project.id}/fragen`}>
                  {t('blueprint.toolbar.askQuestions')}
                </Link>
              </Button>
            )}
            {readiness.decisions.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/projekte/${project.id}/entscheidungen`}>
                  {t('blueprint.toolbar.decisions')}
                </Link>
              </Button>
            )}
          </div>
        )}
      </section>

      <section
        aria-labelledby="preview-heading"
        className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-heading" className="text-lg font-semibold">
            {t('export.preview')}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="export-file" className="sr-only">
              {t('export.files')}
            </label>
            <select
              id="export-file"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value as ExportFilename)
                setNotice(null)
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {files.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => download(false)}>
              <Download className="size-4" aria-hidden />
              {t('export.downloadFile')}
            </Button>
          </div>
        </div>
        <textarea
          ref={preview}
          aria-label={t('export.preview')}
          readOnly
          spellCheck={false}
          value={file.content}
          className="h-[28rem] w-full resize-y rounded-md border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed focus-visible:ring-2 focus-visible:ring-ring"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => download(true)}>
          <Download className="size-4" aria-hidden />
          {t('export.downloadZip')}
        </Button>
        <Button variant="outline" onClick={() => void copy()}>
          <ClipboardCopy className="size-4" aria-hidden />
          {t('export.copy')}
        </Button>
      </div>
      {notice && (
        <p
          role={notice === 'copyError' || notice === 'downloadError' ? 'alert' : 'status'}
          className={
            notice === 'copyError' || notice === 'downloadError'
              ? 'text-sm text-destructive'
              : 'text-sm text-muted-foreground'
          }
        >
          {t(`export.${notice}`)}
        </p>
      )}
      <section
        aria-labelledby="start-heading"
        className="space-y-2 rounded-xl bg-muted/50 p-4 sm:p-5"
      >
        <h2 id="start-heading" className="font-semibold">
          {t('export.howToTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('export.howTo')}</p>
        <p className="text-sm text-muted-foreground">{t('export.localHint')}</p>
      </section>
    </div>
  )
}
