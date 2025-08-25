import { create } from 'zustand';
import { Notification } from '@sf1/shared';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationIds: string[]) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (isLoading: boolean) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

export const notificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) => {
    const currentNotifications = get().notifications;
    set({ 
      notifications: [notification, ...currentNotifications],
      unreadCount: get().unreadCount + (notification.read ? 0 : 1)
    });
  },

  markAsRead: (notificationIds) => {
    const notifications = get().notifications.map(notification => 
      notificationIds.includes(notification._id!)
        ? { ...notification, read: true, readAt: new Date() }
        : notification
    );
    
    const readCount = notificationIds.length;
    set({ 
      notifications,
      unreadCount: Math.max(0, get().unreadCount - readCount)
    });
  },

  markAllAsRead: () => {
    const notifications = get().notifications.map(notification => ({
      ...notification,
      read: true,
      readAt: new Date()
    }));
    
    set({ 
      notifications,
      unreadCount: 0
    });
  },

  removeNotification: (id) => {
    const notifications = get().notifications.filter(n => n._id !== id);
    const removedNotification = get().notifications.find(n => n._id === id);
    const unreadCount = removedNotification && !removedNotification.read 
      ? Math.max(0, get().unreadCount - 1)
      : get().unreadCount;
    
    set({ notifications, unreadCount });
  },

  setUnreadCount: (count) => set({ unreadCount: count }),

  setLoading: (isLoading) => set({ isLoading }),

  updateNotification: (id, updates) => {
    const notifications = get().notifications.map(notification =>
      notification._id === id ? { ...notification, ...updates } : notification
    );
    set({ notifications });
  },
}));