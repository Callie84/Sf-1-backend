import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  HomeIcon, 
  MessageCircleIcon, 
  UsersIcon, 
  FileIcon, 
  BellIcon, 
  SettingsIcon,
  BarChart3Icon,
  ShieldIcon,
  HelpCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BotIcon,
  WorkflowIcon,
  LayoutDashboardIcon
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { notificationStore } from '@/store/notifications';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string | number;
  requiredRoles?: string[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Messages', href: '/messages', icon: MessageCircleIcon },
  { name: 'Files', href: '/files', icon: FileIcon },
  { name: 'Users', href: '/users', icon: UsersIcon, requiredRoles: ['admin', 'moderator'] },
  { name: 'Notifications', href: '/notifications', icon: BellIcon },
  { name: 'Analytics', href: '/analytics', icon: BarChart3Icon, requiredRoles: ['admin', 'moderator'] },
  { name: 'AI Assistant', href: '/ai', icon: BotIcon },
  { name: 'Workflows', href: '/workflows', icon: WorkflowIcon, requiredRoles: ['admin', 'premium'] },
  { name: 'Admin', href: '/admin', icon: LayoutDashboardIcon, requiredRoles: ['admin'] },
];

const bottomNavigation: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
  { name: 'Help', href: '/help', icon: HelpCircleIcon },
];

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const { user, hasAnyRole } = useAuth();
  const { unreadCount } = notificationStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (href: string) => {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  const filterNavItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (!item.requiredRoles) return true;
      return hasAnyRole(item.requiredRoles);
    });
  };

  const NavLink: React.FC<{ item: NavItem }> = ({ item }) => {
    const active = isActive(item.href);
    const showBadge = item.name === 'Notifications' && unreadCount > 0;

    return (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
          active
            ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <item.icon
          className={cn(
            'flex-shrink-0 h-5 w-5',
            active ? 'text-primary-700' : 'text-gray-400 group-hover:text-gray-500',
            isCollapsed ? 'mr-0' : 'mr-3'
          )}
        />
        {!isCollapsed && (
          <>
            {item.name}
            {showBadge && (
              <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <div
      className={cn(
        'bg-white shadow-sm border-r border-gray-200 flex flex-col transition-all duration-200',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SF</span>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">SF-1</h1>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* User Info */}
      {!isCollapsed && user && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.firstName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-gray-700 font-medium text-sm">
                    {user.firstName[0]}{user.lastName[0]}
                  </span>
                )}
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.email}
              </p>
              {user.roles && user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.roles.slice(0, 2).map(role => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {role}
                    </span>
                  ))}
                  {user.roles.length > 2 && (
                    <span className="text-xs text-gray-500">+{user.roles.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filterNavItems(navigation).map((item) => (
          <NavLink key={item.name} item={item} />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-200 px-3 py-4 space-y-1">
        {filterNavItems(bottomNavigation).map((item) => (
          <NavLink key={item.name} item={item} />
        ))}
      </div>

      {/* Status Indicator */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center text-xs text-gray-500">
            <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
            Online
          </div>
        </div>
      )}
    </div>
  );
};