import { Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/app/useSettings'
import { OPENROUTER_KEYS_URL, verifyOpenRouterKey, type KeyInfo } from '@/core/ai'
import { hasApiKey } from '@/core/settings'
import { formatUsd } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { aiErrorDetail } from './aiErrorDetail'
import { aiErrorKey } from './aiErrors'
import { SettingsSection } from './SettingsSection'

/** Ergebnis der letzten Verbindungsprüfung, gilt nur für den Key, mit dem sie gestartet wurde. */
type ConnectionTest =
  | { key: string; status: 'testing' }
  | { key: string; status: 'success'; info: KeyInfo }
  | { key: string; status: 'error'; error: unknown }
  | null

export function ApiKeySection() {
  const { t } = useTranslation()
  const { settings, update, clearApiKey } = useSettings()
  const inputId = useId()
  const privacyId = useId()
  const [draft, setDraft] = useState(settings.apiKey ?? '')
  const [visible, setVisible] = useState(false)
  const [test, setTest] = useState<ConnectionTest>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saved = hasApiKey(settings)
  const trimmed = draft.trim()
  const current = test?.key === trimmed ? test : null

  function handleDraftChange(value: string) {
    setDraft(value)
    setTest(null)
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmed) update({ apiKey: trimmed })
  }

  async function handleTest() {
    const key = trimmed
    setTest({ key, status: 'testing' })
    try {
      const info = await verifyOpenRouterKey(key)
      setTest({ key, status: 'success', info })
    } catch (error) {
      setTest({ key, status: 'error', error })
    }
  }

  function handleDelete() {
    clearApiKey()
    setDraft('')
    setTest(null)
    setConfirmDelete(false)
  }

  return (
    <SettingsSection title={t('settings.apiKey.title')} description={t('settings.apiKey.intro')}>
      <a
        href={OPENROUTER_KEYS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t('settings.apiKey.createLink')}
        <ExternalLink className="size-4" aria-hidden />
      </a>

      <p className="text-sm font-medium">
        {saved ? t('settings.apiKey.statusSaved') : t('settings.apiKey.statusNone')}
      </p>

      <form onSubmit={handleSave} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t('settings.apiKey.label')}
          </label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              type={visible ? 'text' : 'password'}
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder={t('settings.apiKey.placeholder')}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={privacyId}
            />
            <Button
              type="button"
              variant="outline"
              className="px-3"
              aria-label={visible ? t('settings.apiKey.hide') : t('settings.apiKey.show')}
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </Button>
          </div>
          <p id={privacyId} className="text-xs text-muted-foreground">
            {t('settings.apiKey.privacy')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!trimmed}>
            {t('settings.apiKey.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!trimmed || current?.status === 'testing'}
            onClick={handleTest}
          >
            {current?.status === 'testing'
              ? t('settings.apiKey.testing')
              : t('settings.apiKey.test')}
          </Button>
          {saved && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t('settings.apiKey.delete')}
            </Button>
          )}
        </div>
      </form>

      {current?.status === 'success' && (
        <div
          role="status"
          className="space-y-1 rounded-md border border-border bg-muted/50 p-3 text-sm"
        >
          <p className="font-medium">{t('settings.apiKey.testSuccess')}</p>
          <p>{t('settings.apiKey.usage', { usage: formatUsd(current.info.usage) })}</p>
          {current.info.limitRemaining !== null && (
            <p>
              {t('settings.apiKey.remaining', {
                remaining: formatUsd(current.info.limitRemaining),
              })}
            </p>
          )}
          {current.info.isFreeTier && <p>{t('settings.apiKey.freeTier')}</p>}
        </div>
      )}
      {current?.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t(aiErrorKey(current.error))}
          {aiErrorDetail(current.error, t) && (
            <span className="mt-1 block text-xs break-words opacity-80">
              {aiErrorDetail(current.error, t)}
            </span>
          )}
        </p>
      )}

      {confirmDelete && (
        <Dialog
          open
          onClose={() => setConfirmDelete(false)}
          title={t('settings.apiKey.deleteDialog.title')}
          description={t('settings.apiKey.deleteDialog.description')}
        >
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              data-autofocus
              onClick={() => setConfirmDelete(false)}
            >
              {t('settings.apiKey.deleteDialog.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              {t('settings.apiKey.deleteDialog.confirm')}
            </Button>
          </div>
        </Dialog>
      )}
    </SettingsSection>
  )
}
