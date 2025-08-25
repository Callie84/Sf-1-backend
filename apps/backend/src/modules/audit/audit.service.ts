import { AuditLog, IAuditLog } from '../../models/AuditLog';
import { AuditAction } from '@sf1/shared';
import { logger } from '../../utils/logger';

interface CreateAuditLogParams {
  userId: string;
  tenantId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (params: CreateAuditLogParams): Promise<IAuditLog> => {
  try {
    const auditLog = new AuditLog({
      userId: params.userId,
      tenantId: params.tenantId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues ? new Map(Object.entries(params.oldValues)) : undefined,
      newValues: params.newValues ? new Map(Object.entries(params.newValues)) : undefined,
      metadata: params.metadata ? new Map(Object.entries(params.metadata)) : new Map(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp: new Date(),
    });

    await auditLog.save();
    
    // Log to console/file for immediate visibility
    logger.info('Audit log created', {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    return auditLog;
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    // Don't throw error to avoid disrupting main business logic
    throw error;
  }
};

export const getAuditLogs = async (filters: {
  userId?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) => {
  const {
    userId,
    tenantId,
    entityType,
    entityId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  const query: any = {};

  if (userId) query.userId = userId;
  if (tenantId) query.tenantId = tenantId;
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (action) query.action = action;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};