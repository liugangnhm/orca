import { useEffect } from 'react'
import type {
  NotificationPanelEntry,
  NotificationPanelSnapshot
} from '../../../../shared/notification-panel-types'
import { useAppStore } from '@/store'

type SnapshotListener = (snapshot: NotificationPanelSnapshot) => void

export function useNotificationPanelEvents(onSnapshot: SnapshotListener): void {
  const setNotificationHistory = useAppStore((s) => s.setNotificationHistory)

  useEffect(() => {
    void window.api.notificationPanel.getHistory().then((snapshot) => {
      if (snapshot) {
        setNotificationHistory(snapshot)
        onSnapshot(snapshot)
      }
    })

    const offNew = window.api.notificationPanel.onNew((entry: NotificationPanelEntry) => {
      const current = useAppStore.getState().notificationHistory
      if (current.active.some((e) => e.id === entry.id)) {
        return
      }
      const updated: NotificationPanelSnapshot = {
        active: [entry, ...current.active],
        history: current.history,
        totalUnread: current.totalUnread + 1,
        generatedAt: Date.now()
      }
      setNotificationHistory(updated)
      onSnapshot(updated)
    })

    const offSnapshot = window.api.notificationPanel.onSnapshot?.(
      (snapshot: NotificationPanelSnapshot) => {
        setNotificationHistory(snapshot)
        onSnapshot(snapshot)
      }
    )

    const offUnreadChanged = window.api.notificationPanel.onUnreadChanged((count: number) => {
      const current = useAppStore.getState().notificationHistory
      if (current.totalUnread !== count) {
        const updated: NotificationPanelSnapshot = { ...current, totalUnread: count }
        setNotificationHistory(updated)
        onSnapshot(updated)
      }
    })

    return () => {
      offNew()
      offSnapshot?.()
      offUnreadChanged()
    }
  }, [onSnapshot, setNotificationHistory])
}
