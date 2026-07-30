import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

export function NotificationPanelToolbarButton() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    void window.api.notificationPanel.getPanelOpen().then(setIsOpen)
    const offOpen = window.api.notificationPanel.onPanelOpenChanged(setIsOpen)
    const offUnread = window.api.notificationPanel.onUnreadChanged(setUnreadCount)
    return () => {
      offOpen()
      offUnread()
    }
  }, [])

  return (
    <button
      className={cn(
        'relative flex size-7 items-center justify-center rounded-md transition-colors',
        'hover:bg-worktree-sidebar-accent/70 hover:text-worktree-sidebar-foreground',
        isOpen ? 'text-worktree-sidebar-foreground' : 'text-worktree-sidebar-foreground/60'
      )}
      onClick={() => void window.api.notificationPanel.toggle()}
      title={translate('notificationPanel.toggle.title', 'Notifications')}
      aria-label={translate('notificationPanel.toggle.ariaLabel', 'Toggle notification panel')}
    >
      <Bell className="size-4 shrink-0" strokeWidth={isOpen ? 2.25 : 1.75} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 py-px text-[9px] font-semibold text-primary-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
