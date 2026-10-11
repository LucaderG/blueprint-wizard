import { Plus, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { ProjectSummary } from '@/core/storage'
import { Button } from '@/shared/ui/button'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { ProjectListItem } from './ProjectListItem'
import { ProjectNameDialog } from './ProjectNameDialog'
import { projectErrorKey } from './projectErrors'
import { useProjects } from './useProjects'

type DialogState =
  | { type: 'create' }
  | { type: 'rename'; project: ProjectSummary }
  | { type: 'delete'; project: ProjectSummary }
  | null

type Notice = { tone: 'success' | 'error'; message: string } | null

/** Projektliste auf der Startseite: anlegen, importieren, umbenennen, duplizieren, exportieren, löschen. */
export function ProjectsSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { status, projects, create, rename, duplicate, remove, importFile, exportProject } =
    useProjects()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeDialog = () => setDialog(null)

  /** Führt eine Listenaktion aus und meldet Erfolg oder Fehler im Hinweisbereich. */
  async function run(action: () => Promise<string | null>) {
    setNotice(null)
    try {
      const message = await action()
      setNotice(message ? { tone: 'success', message } : null)
    } catch (error) {
      setNotice({ tone: 'error', message: t(projectErrorKey(error)) })
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    await run(async () => {
      try {
        const project = await importFile(file)
        return t('projects.notice.imported', { name: project.name })
      } finally {
        // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
        input.value = ''
      }
    })
  }

  return (
    <section aria-labelledby="projects-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="projects-heading" className="text-xl font-semibold">
          {t('projects.title')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {t('projects.import')}
          </Button>
          <Button type="button" onClick={() => setDialog({ type: 'create' })}>
            <Plus className="size-4" aria-hidden />
            {t('projects.new')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label={t('projects.importInputLabel')}
            tabIndex={-1}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      <div role="status" className="text-sm text-muted-foreground empty:hidden">
        {notice?.tone === 'success' && notice.message}
      </div>
      {notice?.tone === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {notice.message}
        </p>
      )}

      {status === 'loading' && <p className="text-muted-foreground">{t('projects.loading')}</p>}
      {status === 'error' && (
        <p role="alert" className="text-destructive">
          {t('projects.loadError')}
        </p>
      )}
      {status === 'ready' && projects.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          {t('projects.empty')}
        </p>
      )}
      {projects.length > 0 && (
        <ul className="space-y-3" aria-label={t('projects.listLabel')}>
          {projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              onRename={() => setDialog({ type: 'rename', project })}
              onDuplicate={() =>
                run(async () => {
                  const copy = await duplicate(project.id)
                  return t('projects.notice.duplicated', { name: copy.name })
                })
              }
              onExport={() =>
                run(async () => {
                  await exportProject(project)
                  return null
                })
              }
              onDelete={() => setDialog({ type: 'delete', project })}
            />
          ))}
        </ul>
      )}

      {dialog?.type === 'create' && (
        <ProjectNameDialog
          title={t('projects.nameDialog.createTitle')}
          description={t('projects.nameDialog.createDescription')}
          submitLabel={t('projects.nameDialog.createSubmit')}
          onClose={closeDialog}
          onSubmit={async (name) => {
            const project = await create(name)
            await navigate(`/projekte/${project.id}`)
          }}
        />
      )}
      {dialog?.type === 'rename' && (
        <ProjectNameDialog
          title={t('projects.nameDialog.renameTitle')}
          submitLabel={t('projects.nameDialog.renameSubmit')}
          initialName={dialog.project.name}
          onClose={closeDialog}
          onSubmit={async (name) => {
            const renamed = await rename(dialog.project.id, name)
            closeDialog()
            setNotice({
              tone: 'success',
              message: t('projects.notice.renamed', { name: renamed.name }),
            })
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <DeleteProjectDialog
          name={dialog.project.name}
          onClose={closeDialog}
          onConfirm={async () => {
            closeDialog()
            await run(async () => {
              await remove(dialog.project.id)
              return t('projects.notice.deleted', { name: dialog.project.name })
            })
          }}
        />
      )}
    </section>
  )
}
