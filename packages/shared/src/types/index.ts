import { z } from 'zod';

// User Types
export const UserRoleSchema = z.enum(['admin', 'moderator', 'premium', 'standard']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  _id: z.string().optional(),
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  avatar: z.string().optional(),
  roles: z.array(UserRoleSchema).default(['standard']),
  status: UserStatusSchema.default('active'),
  tenantId: z.string().optional(),
  emailVerified: z.boolean().default(false),
  lastLogin: z.date().optional(),
  preferences: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type User = z.infer<typeof UserSchema>;

// Auth Types
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type AuthTokens = z.infer<typeof TokenSchema>;

// Message Types
export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'video', 'audio']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  _id: z.string().optional(),
  content: z.string(),
  type: MessageTypeSchema.default('text'),
  senderId: z.string(),
  channelId: z.string(),
  tenantId: z.string().optional(),
  attachments: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  edited: z.boolean().default(false),
  editedAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type Message = z.infer<typeof MessageSchema>;

// Channel Types
export const ChannelTypeSchema = z.enum(['direct', 'group', 'public', 'private']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ChannelSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  type: ChannelTypeSchema,
  members: z.array(z.string()),
  admins: z.array(z.string()),
  tenantId: z.string().optional(),
  isArchived: z.boolean().default(false),
  createdBy: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Channel = z.infer<typeof ChannelSchema>;

// Notification Types
export const NotificationTypeSchema = z.enum(['info', 'success', 'warning', 'error']);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  message: z.string(),
  type: NotificationTypeSchema,
  userId: z.string(),
  tenantId: z.string().optional(),
  read: z.boolean().default(false),
  actionUrl: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date()),
});

export type Notification = z.infer<typeof NotificationSchema>;

// File Types
export const FileSchema = z.object({
  _id: z.string().optional(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  path: z.string(),
  url: z.string().optional(),
  ownerId: z.string(),
  tenantId: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date()),
});

export type FileUpload = z.infer<typeof FileSchema>;

// Subscription Types
export const SubscriptionStatusSchema = z.enum(['active', 'canceled', 'past_due', 'incomplete']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionPlanSchema = z.enum(['free', 'premium', 'enterprise']);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const SubscriptionSchema = z.object({
  _id: z.string().optional(),
  userId: z.string(),
  tenantId: z.string().optional(),
  plan: SubscriptionPlanSchema,
  status: SubscriptionStatusSchema,
  stripeSubscriptionId: z.string().optional(),
  paypalSubscriptionId: z.string().optional(),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

// Common API Response Types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export type ApiResponse<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
};

// Pagination Types
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}>;

// Error Types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Permission Types
export const PermissionSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  resource: z.string(),
  action: z.string(),
  conditions: z.record(z.any()).default({}),
  createdAt: z.date().default(() => new Date()),
});

export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().default(false),
  tenantId: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Role = z.infer<typeof RoleSchema>;

// Tenant Types
export const TenantSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  subdomain: z.string(),
  domain: z.string().optional(),
  settings: z.record(z.any()).default({}),
  theme: z.record(z.any()).default({}),
  isActive: z.boolean().default(true),
  ownerId: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Tenant = z.infer<typeof TenantSchema>;

// Audit Log Types
export const AuditActionSchema = z.enum(['create', 'read', 'update', 'delete', 'login', 'logout']);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogSchema = z.object({
  _id: z.string().optional(),
  userId: z.string(),
  tenantId: z.string().optional(),
  action: AuditActionSchema,
  entityType: z.string(),
  entityId: z.string(),
  oldValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;