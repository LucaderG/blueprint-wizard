import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/dialog'

interface DeleteProjectDialogProps {
  title: string
  description: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

/** Sicherheitsabfrage vor dem endgültigen Löschen. Der Fokus startet auf „Abbrechen“. */
export function DeleteProjectDialog({
  title,
  description,
  onConfirm,
  onClose,
}: DeleteProjectDialogProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" data-autofocus onClick={onClose}>
          {t('projects.deleteDialog.cancel')}
        </Button>
        <Button type="button" variant="destructive" disabled={submitting} onClick={handleConfirm}>
          {t('projects.deleteDialog.confirm')}
        </Button>
      </div>
    </Dialog>
  )
}
