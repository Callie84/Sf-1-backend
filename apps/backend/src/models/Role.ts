import mongoose, { Document, Schema } from 'mongoose';
import { Role as RoleType, Permission as PermissionType } from '@sf1/shared';

export interface IPermission extends Document, Omit<PermissionType, '_id'> {}
export interface IRole extends Document, Omit<RoleType, '_id'> {}

const permissionSchema = new Schema<IPermission>({
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Permission description is required'],
    trim: true,
  },
  resource: {
    type: String,
    required: [true, 'Resource is required'],
    trim: true,
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
  },
  conditions: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
}, {
  timestamps: true,
});

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Role description is required'],
    trim: true,
  },
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission',
  }],
  isSystem: {
    type: Boolean,
    default: false,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes
permissionSchema.index({ resource: 1, action: 1 });
roleSchema.index({ tenantId: 1, name: 1 });

// Pre-populate permissions when finding roles
roleSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'permissions',
    select: 'name description resource action conditions',
  });
  next();
});

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
export const Role = mongoose.model<IRole>('Role', roleSchema);