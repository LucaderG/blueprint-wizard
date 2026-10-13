import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAiProvider } from '@/app/useSettings'
import { PROJECT_NAME_MAX_LENGTH, type EntryPoint } from '@/core/blueprint'
import { DEFAULT_VARIANT_COUNT, MAX_VARIANTS, MIN_VARIANTS } from '@/core/ai'
import { MAX_IDEA_TEXT_LENGTH } from '@/core/engine'
import { useVariantGeneration } from '@/features/variants/useVariantGeneration'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { Input } from '@/shared/ui/input'
import { useIdeaClassification } from './useIdeaClassification'
import { formatNumber } from '@/shared/lib/format'

const TEXT_FILE_PATTERN = /\.(txt|md)$/i
const VARIANT_COUNTS = Array.from(
  { length: MAX_VARIANTS - MIN_VARIANTS + 1 },
  (_, index) => MIN_VARIANTS + index,
)

interface IdeaFormProps {
  entryPoint: EntryPoint
}

/** Eingabe für Projektname und Freitext samt KI-Einordnung oder Start ohne KI. */
export function IdeaForm({ entryPoint }: IdeaFormProps) {
  const { t } = useTranslation()
  const aiProvider = useAiProvider()
  const navigate = useNavigate()
  const { state, classify, startWithoutAi, cancel } = useIdeaClassification()
  const variants = useVariantGeneration()
  const [variantCount, setVariantCount] = useState(DEFAULT_VARIANT_COUNT)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const textId = useId()
  const counterId = useId()
  const tooLongId = useId()
  const variantCountId = useId()

  const variantsRunning = variants.state.status === 'running'
  const busy = state.status === 'running' || variantsRunning
  const aiRunning = state.status === 'running' && state.mode === 'ai'
  const tooLong = text.length > MAX_IDEA_TEXT_LENGTH
  const canClassify = aiProvider !== null && text.trim() !== '' && !tooLong && !busy
  const canUpload = entryPoint === 'almostDone'
  // Varianten gibt es nur im Einstieg „halbe Idee“ (Entscheidung zu ADR 0012).
  const offersVariants = entryPoint === 'partialIdea'
  const submission = { text, name, entryPoint }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canClassify) void classify(submission)
  }

  function handleVariants() {
    if (!canClassify) return
    variants.reset()
    void variants.generate(text, variantCount, () => navigate('/varianten'))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!TEXT_FILE_PATTERN.test(file.name)) {
      setFileError(t('wizard.form.uploadWrongType'))
      return
    }
    try {
      setText(await file.text())
      setFileError(null)
    } catch {
      setFileError(t('wizard.form.uploadError'))
    }
  }

  const describedBy = tooLong ? `${counterId} ${tooLongId}` : counterId

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-sm font-medium">
          {t('wizard.form.nameLabel')}
        </label>
        <Input
          id={nameId}
          value={name}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        {aiProvider && (
          <p className="text-xs text-muted-foreground">{t('wizard.form.nameHintAi')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={textId} className="text-sm font-medium">
            {t(`wizard.form.textLabel.${entryPoint}`)}
          </label>
          {canUpload && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('wizard.form.uploadButton')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                aria-label={t('wizard.form.uploadInputLabel')}
                tabIndex={-1}
                className="sr-only"
                onChange={handleFileChange}
              />
            </>
          )}
        </div>

        <textarea
          id={textId}
          rows={12}
          value={text}
          disabled={busy}
          aria-invalid={tooLong}
          aria-describedby={describedBy}
          onChange={(event) => setText(event.target.value)}
          className="min-h-64 w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:border-destructive"
        />

        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <p id={tooLongId} className="text-destructive">
            {tooLong && t('wizard.form.tooLong', { max: formatNumber(MAX_IDEA_TEXT_LENGTH) })}
          </p>
          <p id={counterId} className={tooLong ? 'text-destructive' : 'text-muted-foreground'}>
            {t('wizard.form.counter', {
              current: formatNumber(text.length),
              max: formatNumber(MAX_IDEA_TEXT_LENGTH),
            })}
          </p>
        </div>
      </div>

      {fileError && (
        <p role="alert" className="text-sm text-destructive">
          {fileError}
        </p>
      )}

      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(state.errorKey)}
          {state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">{state.detail}</span>
          )}
        </p>
      )}

      {variants.state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(variants.state.errorKey)}
          {variants.state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">
              {variants.state.detail}
            </span>
          )}
        </p>
      )}

      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {t(
            variantsRunning
              ? 'variants.running'
              : aiRunning
                ? 'wizard.form.runningAi'
                : 'wizard.form.runningManual',
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {aiRunning ? (
          <Button type="button" variant="outline" onClick={cancel}>
            {t('wizard.form.cancel')}
          </Button>
        ) : (
          <Button type="submit" disabled={!canClassify}>
            {t('wizard.form.submitAi')}
          </Button>
        )}
        {offersVariants && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={variantCountId} className="text-sm font-medium">
              {t('variants.countLabel')}
            </label>
            <Select
              id={variantCountId}
              value={variantCount}
              disabled={busy}
              onChange={(event) => setVariantCount(Number(event.target.value))}
              className="w-auto disabled:opacity-50"
            >
              {VARIANT_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {formatNumber(count)}
                </option>
              ))}
            </Select>
            {variantsRunning ? (
              <Button type="button" variant="outline" onClick={variants.cancel}>
                {t('wizard.form.cancel')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={!canClassify}
                onClick={handleVariants}
              >
                {t('variants.generate')}
              </Button>
            )}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void startWithoutAi(submission)}
        >
          {t('wizard.form.submitManual')}
        </Button>
      </div>
    </form>
  )
}
