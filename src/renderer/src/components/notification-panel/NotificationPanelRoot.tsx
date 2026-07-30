import { useCallback, useState } from 'react'
import { NotificationPanel } from './NotificationPanel'
import { useNotificationPanelEvents } from './useNotificationPanelEvents'
import type {
  NotificationPanelEntry,
  NotificationPanelSnapshot
} from '../../../../shared/notification-panel-types'

export function NotificationPanelRoot() {
  const [snapshot, setSnapshot] = useState<NotificationPanelSnapshot>({
    active: [],
    history: [],
    totalUnread: 0,
    generatedAt: 0
  })

  useNotificationPanelEvents(setSnapshot)

  const handleReveal = useCallback((entry: NotificationPanelEntry) => {
    void window.api.notificationPanel.revealNotification({
      id: entry.id,
      worktreeId: entry.worktreeId,
      paneKey: entry.paneKey,
      repoId: entry.repoId
    })
    void window.api.notificationPanel.dismiss(entry.id)
  }, [])

  const handleDismiss = useCallback((id: string) => {
    void window.api.notificationPanel.dismiss(id)
  }, [])

  const handleClearHistory = useCallback(() => {
    void window.api.notificationPanel.clearHistory()
  }, [])

  const handleClose = useCallback(() => {
    void window.api.notificationPanel.close()
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background/80">
      <NotificationPanel
        snapshot={snapshot}
        onReveal={handleReveal}
        onDismiss={handleDismiss}
        onClearHistory={handleClearHistory}
        onClose={handleClose}
      />
    </div>
  )
}
