import { Plus, Search, Upload } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { normalizeText } from '@/core/engine'
import type { ProjectSummary } from '@/core/storage'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { ProjectListItem } from './ProjectListItem'
import { ProjectNameDialog } from './ProjectNameDialog'
import { projectErrorKey } from './projectErrors'
import { TrashList } from './TrashList'
import { useProjects } from './useProjects'

type View = 'library' | 'trash'

type DialogState =
  | { type: 'create' }
  | { type: 'rename'; project: ProjectSummary }
  | { type: 'deleteForever'; project: ProjectSummary }
  | { type: 'emptyTrash' }
  | null

type Notice =
  { tone: 'success'; message: string; undoId?: string } | { tone: 'error'; message: string } | null

/**
 * Bibliothek auf der Startseite (ADR 0012): gespeicherte Einträge mit Suche, dazu der Papierkorb.
 * Löschen verschiebt ohne Rückfrage in den Papierkorb und bietet „Rückgängig“ an; endgültig löscht
 * nur der Papierkorb, mit Rückfrage.
 */
export function ProjectsSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    status,
    projects,
    trashed,
    retentionDays,
    create,
    rename,
    duplicate,
    trash,
    restore,
    deleteForever,
    emptyTrash,
    importFile,
    exportProject,
  } = useProjects()
  const [view, setView] = useState<View>('library')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  const closeDialog = () => setDialog(null)

  /** Führt eine Aktion aus und meldet Erfolg oder Fehler im Hinweisbereich. */
  async function run(action: () => Promise<Notice>) {
    setNotice(null)
    try {
      setNotice(await action())
    } catch (error) {
      setNotice({ tone: 'error', message: t(projectErrorKey(error)) })
    }
  }

  const success = (message: string, undoId?: string): Notice => ({
    tone: 'success',
    message,
    undoId,
  })

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    await run(async () => {
      try {
        const project = await importFile(file)
        setView('library')
        return success(t('projects.notice.imported', { name: project.name }))
      } finally {
        // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
        input.value = ''
      }
    })
  }

  const search = normalizeText(query)
  const visible = search
    ? projects.filter((project) => normalizeText(project.name).includes(search))
    : projects

  const viewButton = (target: View, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={view === target ? 'default' : 'outline'}
      aria-pressed={view === target}
      onClick={() => {
        setView(target)
        setNotice(null)
      }}
    >
      {label}
    </Button>
  )

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

      <div role="group" aria-label={t('projects.viewLabel')} className="flex flex-wrap gap-2">
        {viewButton('library', t('projects.views.library'))}
        {viewButton('trash', t('projects.views.trash', { count: trashed.length }))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground empty:hidden">
        <div role="status" className="empty:hidden">
          {notice?.tone === 'success' && notice.message}
        </div>
        {notice?.tone === 'success' && notice.undoId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const id = notice.undoId
              if (!id) return
              void run(async () => {
                const restored = await restore(id)
                return success(t('projects.notice.restored', { name: restored.name }))
              })
            }}
          >
            {t('projects.undo')}
          </Button>
        )}
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

      {status !== 'error' && view === 'library' && (
        <>
          {status === 'ready' && projects.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              {t('projects.empty')}
            </p>
          )}
          {projects.length > 0 && (
            <div className="relative max-w-sm">
              <label htmlFor={searchId} className="sr-only">
                {t('projects.searchLabel')}
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder={t('projects.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {projects.length > 0 && visible.length === 0 && (
            <p className="text-muted-foreground">{t('projects.noMatches', { query })}</p>
          )}
          {visible.length > 0 && (
            <ul className="space-y-3" aria-label={t('projects.listLabel')}>
              {visible.map((project) => (
                <ProjectListItem
                  key={project.id}
                  project={project}
                  onRename={() => setDialog({ type: 'rename', project })}
                  onDuplicate={() =>
                    run(async () => {
                      const copy = await duplicate(project.id)
                      return success(t('projects.notice.duplicated', { name: copy.name }))
                    })
                  }
                  onExport={() =>
                    run(async () => {
                      await exportProject(project)
                      return null
                    })
                  }
                  onDelete={() =>
                    run(async () => {
                      await trash(project.id)
                      return success(
                        t('projects.notice.deleted', { name: project.name }),
                        project.id,
                      )
                    })
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      {status === 'ready' && view === 'trash' && (
        <TrashList
          entries={trashed}
          retentionDays={retentionDays}
          now={new Date()}
          onRestore={(entry) =>
            run(async () => {
              await restore(entry.id)
              return success(t('projects.notice.restored', { name: entry.name }))
            })
          }
          onDeleteForever={(project) => setDialog({ type: 'deleteForever', project })}
          onEmpty={() => setDialog({ type: 'emptyTrash' })}
        />
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
            setNotice(success(t('projects.notice.renamed', { name: renamed.name })))
          }}
        />
      )}
      {dialog?.type === 'deleteForever' && (
        <DeleteProjectDialog
          title={t('projects.deleteDialog.title')}
          description={t('projects.deleteDialog.description', { name: dialog.project.name })}
          onClose={closeDialog}
          onConfirm={async () => {
            closeDialog()
            await run(async () => {
              await deleteForever(dialog.project.id)
              return success(t('projects.notice.deletedForever', { name: dialog.project.name }))
            })
          }}
        />
      )}
      {dialog?.type === 'emptyTrash' && (
        <DeleteProjectDialog
          title={t('projects.emptyTrashDialog.title')}
          description={t('projects.emptyTrashDialog.description', { count: trashed.length })}
          onClose={closeDialog}
          onConfirm={async () => {
            closeDialog()
            await run(async () => {
              await emptyTrash()
              return success(t('projects.notice.trashEmptied'))
            })
          }}
        />
      )}
    </section>
  )
}
