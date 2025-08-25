import { Request } from 'express';

// Base entity interface
export interface BaseEntity {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
}

// User roles and permissions
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  PREMIUM = 'premium',
  STANDARD = 'standard'
}

export enum Permission {
  // User management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Content management
  CONTENT_CREATE = 'content:create',
  CONTENT_READ = 'content:read',
  CONTENT_UPDATE = 'content:update',
  CONTENT_DELETE = 'content:delete',
  
  // Admin operations
  ADMIN_ACCESS = 'admin:access',
  MODERATION_ACCESS = 'moderation:access',
  
  // Payment operations
  PAYMENT_READ = 'payment:read',
  SUBSCRIPTION_MANAGE = 'subscription:manage'
}

// User interface
export interface User extends BaseEntity {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  profilePicture?: string;
  preferences: UserPreferences;
  subscription?: Subscription;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  marketing: boolean;
}

// Subscription and payment interfaces
export interface Subscription extends BaseEntity {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  paypalSubscriptionId?: string;
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIAL = 'trial'
}

export interface Payment extends BaseEntity {
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  externalId: string;
  metadata: Record<string, any>;
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal'
}

// Role and permission interfaces
export interface Role extends BaseEntity {
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  level: number;
}

export interface UserPermission extends BaseEntity {
  userId: string;
  roleId: string;
  grantedBy: string;
  expiresAt?: Date;
}

// Messaging interfaces
export interface Message extends BaseEntity {
  senderId: string;
  channelId: string;
  content: string;
  type: MessageType;
  metadata?: Record<string, any>;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: string;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system'
}

export interface Channel extends BaseEntity {
  name: string;
  description?: string;
  type: ChannelType;
  members: ChannelMember[];
  settings: ChannelSettings;
}

export enum ChannelType {
  DIRECT = 'direct',
  GROUP = 'group',
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export interface ChannelMember extends BaseEntity {
  userId: string;
  channelId: string;
  role: ChannelMemberRole;
  joinedAt: Date;
  lastReadAt?: Date;
}

export enum ChannelMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member'
}

export interface ChannelSettings {
  allowInvites: boolean;
  requireApproval: boolean;
  maxMembers?: number;
  slowMode?: number;
}

// Notification interfaces
export interface Notification extends BaseEntity {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SYSTEM = 'system'
}

// File storage interfaces
export interface File extends BaseEntity {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: string;
  metadata: FileMetadata;
  isPublic: boolean;
}

export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  tags: string[];
  description?: string;
}

// AI integration interfaces
export interface AILog extends BaseEntity {
  userId: string;
  endpoint: string;
  request: any;
  response: any;
  tokensUsed: number;
  cost: number;
  duration: number;
  status: 'success' | 'error';
  error?: string;
}

// Workflow interfaces
export interface Workflow extends BaseEntity {
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  isActive: boolean;
  createdBy: string;
}

export interface WorkflowTrigger {
  type: string;
  conditions: Record<string, any>;
}

export interface WorkflowAction {
  type: string;
  parameters: Record<string, any>;
  order: number;
}

// Job scheduler interfaces
export interface Job extends BaseEntity {
  name: string;
  description: string;
  cronExpression: string;
  handler: string;
  parameters: Record<string, any>;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
  retryCount: number;
  maxRetries: number;
}

export interface JobHistory extends BaseEntity {
  jobId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  result?: any;
}

// Audit trail interfaces
export interface AuditLog extends BaseEntity {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
}

// API gateway interfaces
export interface APIKey extends BaseEntity {
  name: string;
  key: string;
  userId: string;
  permissions: Permission[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

// WebSocket interfaces
export interface WebSocketSession extends BaseEntity {
  userId: string;
  socketId: string;
  isActive: boolean;
  lastActivityAt: Date;
  metadata: Record<string, any>;
}

// External API interfaces
export interface ExternalAccount extends BaseEntity {
  userId: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

// Gamification interfaces
export interface Achievement extends BaseEntity {
  name: string;
  description: string;
  icon: string;
  points: number;
  criteria: AchievementCriteria;
  isActive: boolean;
}

export interface AchievementCriteria {
  type: string;
  value: number;
  conditions: Record<string, any>;
}

export interface UserAchievement extends BaseEntity {
  userId: string;
  achievementId: string;
  earnedAt: Date;
  metadata: Record<string, any>;
}

export interface UserPoints extends BaseEntity {
  userId: string;
  points: number;
  level: number;
  totalEarned: number;
  lastEarnedAt?: Date;
}

// Support ticket interfaces
export interface Ticket extends BaseEntity {
  userId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  assignedTo?: string;
  tags: string[];
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING = 'waiting',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface TicketMessage extends BaseEntity {
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  attachments: string[];
}

// Content moderation interfaces
export interface ModerationLog extends BaseEntity {
  contentId: string;
  contentType: string;
  flaggedBy: string;
  reason: string;
  status: ModerationStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  action: ModerationAction;
  metadata: Record<string, any>;
}

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged'
}

export enum ModerationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  FLAG = 'flag',
  DELETE = 'delete'
}

// Multi-tenant interfaces
export interface Tenant extends BaseEntity {
  name: string;
  domain: string;
  settings: TenantSettings;
  isActive: boolean;
  subscription?: Subscription;
}

export interface TenantSettings {
  theme: ThemeSettings;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  branding: BrandingSettings;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  favicon?: string;
}

export interface BrandingSettings {
  companyName: string;
  slogan?: string;
  contactEmail: string;
  website?: string;
}

// Settings interfaces
export interface Setting extends BaseEntity {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  isPublic: boolean;
  validation?: any;
}

// Feature flag interfaces
export interface FeatureFlag extends BaseEntity {
  name: string;
  description: string;
  isEnabled: boolean;
  conditions: FeatureFlagCondition[];
  rolloutPercentage: number;
  targetUsers?: string[];
  targetTenants?: string[];
}

export interface FeatureFlagCondition {
  type: string;
  value: any;
  operator: string;
}

// Chatbot interfaces
export interface ChatbotSession extends BaseEntity {
  userId: string;
  sessionId: string;
  isActive: boolean;
  context: Record<string, any>;
  lastActivityAt: Date;
}

export interface ChatbotMessage extends BaseEntity {
  sessionId: string;
  message: string;
  isUser: boolean;
  response?: string;
  metadata: Record<string, any>;
}

// Extended Express Request interface
export interface AuthenticatedRequest extends Request {
  user?: User;
  permissions?: Permission[];
  tenantId?: string;
}

// Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Search interfaces
export interface SearchQuery {
  q: string;
  filters?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  page?: number;
  limit?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  pagination: PaginationInfo;
  facets?: Record<string, any>;
}

// Rate limiting interfaces
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// Testing interfaces
export interface TestFixture {
  name: string;
  data: any;
  cleanup?: () => Promise<void>;
}

// Deployment interfaces
export interface EnvironmentConfig {
  name: string;
  variables: Record<string, string>;
  secrets: Record<string, string>;
}

// Plugin interfaces
export interface Plugin extends BaseEntity {
  name: string;
  version: string;
  description: string;
  author: string;
  isActive: boolean;
  settings: Record<string, any>;
  permissions: Permission[];
}

// Report interfaces
export interface Report extends BaseEntity {
  name: string;
  type: string;
  parameters: Record<string, any>;
  generatedBy: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  fileUrl?: string;
  metadata: Record<string, any>;
}

// Email interfaces
export interface EmailTemplate extends BaseEntity {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface EmailLog extends BaseEntity {
  templateId: string;
  to: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt?: Date;
  error?: string;
  metadata: Record<string, any>;
}

// Compliance interfaces
export interface ComplianceLog extends BaseEntity {
  action: string;
  userId: string;
  resource: string;
  resourceId: string;
  dataProcessed: Record<string, any>;
  consentGiven: boolean;
  legalBasis: string;
  retentionPeriod: number;
}

// Analytics interfaces
export interface AnalyticsEvent extends BaseEntity {
  userId?: string;
  event: string;
  category: string;
  properties: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
}

// Marketplace interfaces
export interface MarketplaceItem extends BaseEntity {
  name: string;
  description: string;
  type: 'plugin' | 'theme' | 'module';
  price: number;
  currency: string;
  author: string;
  downloads: number;
  rating: number;
  isActive: boolean;
  fileUrl: string;
  metadata: Record<string, any>;
}

export interface MarketplaceTransaction extends BaseEntity {
  itemId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentId: string;
  metadata: Record<string, any>;
}