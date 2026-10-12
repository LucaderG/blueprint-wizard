import { Settings, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { cn } from '@/shared/lib/utils'
import { UsageIndicator } from './UsageIndicator'
import { VersionFooter } from './VersionFooter'

export function Layout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-5 text-primary" aria-hidden />
            {t('app.name')}
          </Link>
          <nav aria-label={t('nav.label')} className="flex items-center gap-1">
            <UsageIndicator />
            <NavLink
              to="/einstellungen"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              <Settings className="size-4" aria-hidden />
              {t('nav.settings')}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <VersionFooter />
    </div>
  )
}
