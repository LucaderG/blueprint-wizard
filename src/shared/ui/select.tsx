import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Natives Auswahlfeld im Stil der Oberfläche. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
