import { useId, type ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** Abschnitt der Einstellungsseite mit Überschrift und optionaler Einleitung. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}
