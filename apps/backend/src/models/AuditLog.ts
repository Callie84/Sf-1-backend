import mongoose, { Document, Schema } from 'mongoose';
import { AuditLog as AuditLogType, AuditAction } from '@sf1/shared';

export interface IAuditLog extends Document, Omit<AuditLogType, '_id'> {}

const auditLogSchema = new Schema<IAuditLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  action: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'login', 'logout'],
    required: [true, 'Action is required'],
    index: true,
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    index: true,
  },
  entityId: {
    type: String,
    required: [true, 'Entity ID is required'],
    index: true,
  },
  oldValues: {
    type: Map,
    of: Schema.Types.Mixed,
  },
  newValues: {
    type: Map,
    of: Schema.Types.Mixed,
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
  ipAddress: {
    type: String,
    index: true,
  },
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false, // We use custom timestamp field
});

// Indexes for performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// TTL index to automatically delete old audit logs after 2 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);