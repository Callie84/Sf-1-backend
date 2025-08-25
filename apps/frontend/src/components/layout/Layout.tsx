import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { notificationStore } from '@/store/notifications';
import { notificationsApi } from '@/lib/api';

interface LayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  requireAuth = true,
  allowedRoles = []
}) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, hasAnyRole } = useAuth();
  const { setUnreadCount } = notificationStore();
  
  // Initialize socket connection
  useSocket({
    autoConnect: isAuthenticated,
    onConnect: () => {
      console.log('Socket connected');
    },
    onDisconnect: () => {
      console.log('Socket disconnected');
    },
  });

  // Check authentication and authorization
  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (allowedRoles.length > 0 && user && !hasAnyRole(allowedRoles)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, requireAuth, allowedRoles, router, hasAnyRole]);

  // Load initial notification count
  useEffect(() => {
    const loadNotificationCount = async () => {
      if (isAuthenticated) {
        try {
          const response = await notificationsApi.getUnreadCount();
          if (response.success && response.data) {
            setUnreadCount(response.data.count);
          }
        } catch (error) {
          console.error('Failed to load notification count:', error);
        }
      }
    };

    loadNotificationCount();
  }, [isAuthenticated, setUnreadCount]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (requireAuth && !isAuthenticated) {
    return null; // Will redirect to login
  }

  if (allowedRoles.length > 0 && user && !hasAnyRole(allowedRoles)) {
    return null; // Will redirect to unauthorized
  }

  // Auth pages don't need the main layout
  if (router.pathname.startsWith('/auth/')) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
};