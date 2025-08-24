export const Roles = {
  Admin: 'admin',
  Moderator: 'moderator',
  Premium: 'premium',
  Standard: 'standard'
} as const;

export type Role = typeof Roles[keyof typeof Roles];

export const Permissions = {
  ManageUsers: 'manage:users',
  ManageRoles: 'manage:roles',
  ViewAnalytics: 'view:analytics',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const RoleToPermissions: Record<Role, Permission[]> = {
  admin: Object.values(Permissions),
  moderator: [Permissions.ViewAnalytics],
  premium: [],
  standard: []
};
