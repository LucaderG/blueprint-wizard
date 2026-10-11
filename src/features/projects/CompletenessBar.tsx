import { formatPercent } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

interface CompletenessBarProps {
  /** Vollständigkeit in Prozent (0–100). */
  value: number
  /** Zugänglicher Name des Fortschrittsbalkens. */
  label: string
  className?: string
}

export function CompletenessBar({ value, label, className }: CompletenessBarProps) {
  const percent = formatPercent(value)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={percent}
        className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground tabular-nums" aria-hidden>
        {percent}
      </span>
    </div>
  )
}
