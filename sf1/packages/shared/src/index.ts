export const appName = 'SF-1';
export type Role = 'admin' | 'moderator' | 'premium' | 'standard';
export const roles: Role[] = ['admin', 'moderator', 'premium', 'standard'];

export interface ApiResponse<T> { data: T; error?: string }
