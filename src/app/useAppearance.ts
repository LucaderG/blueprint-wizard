import { useEffect } from 'react'
import { resolveTheme, type Settings } from '@/core/settings'
import i18n from '@/shared/i18n'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Setzt Sprache (`lang`, i18next) und Farbschema (Klasse `dark`) am Dokument. */
export function useAppearance({ uiLanguage, theme }: Pick<Settings, 'uiLanguage' | 'theme'>) {
  useEffect(() => {
    document.documentElement.lang = uiLanguage
    if (i18n.language !== uiLanguage) void i18n.changeLanguage(uiLanguage)
  }, [uiLanguage])

  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
    const apply = () => {
      const dark = resolveTheme(theme, media?.matches ?? false) === 'dark'
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system' || !media) return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
