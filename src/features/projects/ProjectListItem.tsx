import { Copy, Download, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ProjectSummary } from '@/core/storage'
import { formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { CompletenessBar } from './CompletenessBar'

interface ProjectListItemProps {
  project: ProjectSummary
  onRename: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

export function ProjectListItem({
  project,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: ProjectListItemProps) {
  const { t } = useTranslation()
  const { name } = project

  const actions = [
    { key: 'rename', icon: Pencil, onClick: onRename },
    { key: 'duplicate', icon: Copy, onClick: onDuplicate },
    { key: 'export', icon: Download, onClick: onExport },
    { key: 'delete', icon: Trash2, onClick: onDelete },
  ] as const

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <Link
          to={`/projekte/${project.id}`}
          className="block font-semibold break-words hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {name}
        </Link>
        {project.hasProfile && project.completeness === 0 ? (
          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {t('projects.profileBadge')}
          </span>
        ) : (
          <CompletenessBar
            value={project.completeness}
            label={t('projects.completenessLabel', { name })}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {t('projects.lastChanged', { date: formatDateTime(project.updatedAt) })}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {actions.map(({ key, icon: Icon, onClick }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t(`projects.actions.${key}Label`, { name })}
            onClick={onClick}
            className={key === 'delete' ? 'text-destructive' : undefined}
          >
            <Icon className="size-4" aria-hidden />
            {t(`projects.actions.${key}`)}
          </Button>
        ))}
      </div>
    </li>
  )
}
