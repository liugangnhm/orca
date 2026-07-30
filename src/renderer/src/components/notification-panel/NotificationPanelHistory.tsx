import { useMemo } from 'react'
import { NotificationPanelItem } from './NotificationPanelItem'
import type { NotificationPanelEntry } from '../../../../shared/notification-panel-types'

type NotificationPanelHistoryProps = {
  entries: NotificationPanelEntry[]
  onReveal: (entry: NotificationPanelEntry) => void
  onDismiss: (id: string) => void
}

function groupByDate(
  entries: NotificationPanelEntry[]
): { label: string; entries: NotificationPanelEntry[] }[] {
  const groups = new Map<string, NotificationPanelEntry[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000

  for (const entry of entries) {
    const d = new Date(entry.createdAt)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    let label: string
    if (dayStart === today) {
      label = 'Today'
    } else if (dayStart === yesterday) {
      label = 'Yesterday'
    } else {
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    const group = groups.get(label)
    if (group) {
      group.push(entry)
    } else {
      groups.set(label, [entry])
    }
  }

  return Array.from(groups.entries()).map(([label, groupEntries]) => ({
    label,
    entries: groupEntries
  }))
}

export function NotificationPanelHistory({
  entries,
  onReveal,
  onDismiss
}: NotificationPanelHistoryProps) {
  const groups = useMemo(() => groupByDate(entries), [entries])

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
        No notification history
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 scrollbar-sleek">
      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.entries.map((entry) => (
              <NotificationPanelItem
                key={entry.id}
                entry={entry}
                dimmed
                onReveal={onReveal}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
