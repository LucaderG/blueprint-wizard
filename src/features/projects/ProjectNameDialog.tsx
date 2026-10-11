import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PROJECT_NAME_MAX_LENGTH } from '@/core/blueprint'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/dialog'
import { projectErrorKey } from './projectErrors'
import { validateProjectName } from './projectName'

interface ProjectNameDialogProps {
  title: string
  description?: string
  submitLabel: string
  initialName?: string
  /** Bekommt den getrimmten, gültigen Namen. Wirft die Funktion, erscheint eine Fehlermeldung im Dialog. */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}

/** Dialog zum Anlegen oder Umbenennen eines Projekts. Wird bei jedem Öffnen frisch gerendert. */
export function ProjectNameDialog({
  title,
  description,
  submitLabel,
  initialName = '',
  onSubmit,
  onClose,
}: ProjectNameDialogProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const errorId = useId()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateProjectName(name)
    if (validation === 'required') return setError(t('projects.validation.required'))
    if (validation === 'tooLong') {
      return setError(t('projects.validation.tooLong', { max: PROJECT_NAME_MAX_LENGTH }))
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(name.trim())
    } catch (cause) {
      setError(t(projectErrorKey(cause)))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={title} description={description}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t('projects.nameDialog.nameLabel')}
          </label>
          <input
            id={inputId}
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive"
          />
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('projects.nameDialog.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
