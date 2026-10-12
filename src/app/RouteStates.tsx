import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/shared/ui/button'

/** Anzeige, solange der Code einer Seite beim ersten Aufruf noch lädt. */
export function RouteLoading() {
  const { t } = useTranslation()
  return (
    <p role="status" className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {t('routeError.loading')}
    </p>
  )
}

/**
 * Fehlerseite für Fehler beim Laden oder Anzeigen einer Seite, z. B. wenn nach einem Update der Code
 * einer Seite ohne Netz nicht geladen werden kann.
 */
export function RouteError() {
  const { t } = useTranslation()
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('routeError.title')}</h1>
      <p className="text-muted-foreground">{t('routeError.text')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t('routeError.reload')}</Button>
        <Button variant="outline" asChild>
          <Link to="/" reloadDocument>
            {t('notFound.back')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
