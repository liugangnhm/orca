import { memo } from 'react'
import { AgentIcon } from '@/lib/agent-catalog'
import { AgentStateDot } from '@/components/AgentStateDot'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import type { NotificationPanelEntry } from '../../../../shared/notification-panel-types'
import { cn } from '@/lib/utils'

type NotificationPanelItemProps = {
  entry: NotificationPanelEntry
  dimmed?: boolean
  onReveal: (entry: NotificationPanelEntry) => void
  onDismiss: (id: string) => void
}

function formatRelativeTime(createdAt: number): string {
  const diff = Date.now() - createdAt
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) {
    return `${seconds}s ago`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const NotificationPanelItem = memo(function NotificationPanelItem({
  entry,
  dimmed = false,
  onReveal,
  onDismiss
}: NotificationPanelItemProps) {
  return (
    <div
      className={cn(
        'group relative flex cursor-pointer gap-2.5 rounded-lg border border-transparent p-2.5 transition-colors',
        'hover:bg-accent/50',
        dimmed && 'opacity-50'
      )}
      onClick={() => onReveal(entry)}
    >
      <div className="flex shrink-0 items-start pt-0.5">
        {entry.agentType ? (
          <AgentIcon agent={agentTypeToIconAgent(entry.agentType)} size={16} />
        ) : (
          <div className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px]">
            !
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium leading-tight">{entry.title}</span>
          <div className="flex shrink-0 items-center gap-1">
            {entry.agentState && <AgentStateDot state={entry.agentState} size="sm" />}
            {!dimmed && (
              <button
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss(entry.id)
                }}
                aria-label="Dismiss"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        {entry.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.body}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {entry.repoLabel && <span>{entry.repoLabel}</span>}
          {entry.worktreeLabel && (
            <>
              <span>·</span>
              <span>{entry.worktreeLabel}</span>
            </>
          )}
          <span>·</span>
          <span>{formatRelativeTime(entry.createdAt)}</span>
        </div>
      </div>
    </div>
  )
})
