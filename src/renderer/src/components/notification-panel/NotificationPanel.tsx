import { useState } from 'react'
import { NotificationPanelItem } from './NotificationPanelItem'
import { NotificationPanelHistory } from './NotificationPanelHistory'
import type {
  NotificationPanelEntry,
  NotificationPanelSnapshot
} from '../../../../shared/notification-panel-types'

type NotificationPanelProps = {
  snapshot: NotificationPanelSnapshot
  onReveal: (entry: NotificationPanelEntry) => void
  onDismiss: (id: string) => void
  onClearHistory: () => void
  onClose: () => void
}

type View = 'active' | 'history'

export function NotificationPanel({
  snapshot,
  onReveal,
  onDismiss,
  onClearHistory,
  onClose
}: NotificationPanelProps) {
  const [view, setView] = useState<View>('active')

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/50 bg-popover/95 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              view === 'active'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setView('active')}
          >
            Active
            {snapshot.totalUnread > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] text-primary-foreground">
                {snapshot.totalUnread}
              </span>
            )}
          </button>
          <button
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              view === 'history'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setView('history')}
          >
            History
          </button>
        </div>
        <div className="flex items-center gap-1">
          {view === 'history' && snapshot.history.length > 0 && (
            <button
              className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClearHistory}
            >
              Clear
            </button>
          )}
          <button
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {view === 'active' ? (
        snapshot.active.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 scrollbar-sleek">
            <div className="space-y-1">
              {snapshot.active.map((entry) => (
                <NotificationPanelItem
                  key={entry.id}
                  entry={entry}
                  onReveal={onReveal}
                  onDismiss={onDismiss}
                />
              ))}
            </div>
          </div>
        )
      ) : (
        <NotificationPanelHistory
          entries={snapshot.history}
          onReveal={onReveal}
          onDismiss={onDismiss}
        />
      )}
    </div>
  )
}
