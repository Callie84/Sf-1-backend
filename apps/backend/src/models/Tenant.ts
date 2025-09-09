import mongoose, { Document, Schema } from 'mongoose';
import { Tenant as TenantType } from '@sf1/shared';

export interface ITenant extends Document, Omit<TenantType, '_id'> {}

const tenantSchema = new Schema<ITenant>({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    maxlength: 100,
  },
  subdomain: {
    type: String,
    required: [true, 'Subdomain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Invalid subdomain format'],
    index: true,
  },
  domain: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Invalid domain format'],
  },
  settings: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
  theme: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true,
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'incomplete'],
      default: 'active',
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    stripeCustomerId: String,
  },
  limits: {
    users: {
      type: Number,
      default: 10,
    },
    storage: {
      type: Number,
      default: 1024, // MB
    },
    apiCalls: {
      type: Number,
      default: 1000,
    },
  },
  usage: {
    users: {
      type: Number,
      default: 0,
    },
    storage: {
      type: Number,
      default: 0,
    },
    apiCalls: {
      type: Number,
      default: 0,
    },
  },
  features: {
    customDomain: {
      type: Boolean,
      default: false,
    },
    sso: {
      type: Boolean,
      default: false,
    },
    advancedAnalytics: {
      type: Boolean,
      default: false,
    },
    customBranding: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
tenantSchema.index({ subdomain: 1, isActive: 1 });
tenantSchema.index({ ownerId: 1 });
tenantSchema.index({ 'subscription.status': 1 });

// Virtual for full domain
tenantSchema.virtual('fullDomain').get(function() {
  return this.domain || `${this.subdomain}.sf1.app`;
});

// Pre-save middleware to update limits based on subscription
tenantSchema.pre('save', function(next) {
  if (this.isModified('subscription.plan')) {
    switch (this.subscription.plan) {
      case 'free':
        this.limits = {
          users: 10,
          storage: 1024, // 1GB
          apiCalls: 1000,
        };
        this.features = {
          customDomain: false,
          sso: false,
          advancedAnalytics: false,
          customBranding: false,
        };
        break;
      case 'premium':
        this.limits = {
          users: 100,
          storage: 10240, // 10GB
          apiCalls: 10000,
        };
        this.features = {
          customDomain: true,
          sso: false,
          advancedAnalytics: true,
          customBranding: true,
        };
        break;
      case 'enterprise':
        this.limits = {
          users: -1, // Unlimited
          storage: -1, // Unlimited
          apiCalls: -1, // Unlimited
        };
        this.features = {
          customDomain: true,
          sso: true,
          advancedAnalytics: true,
          customBranding: true,
        };
        break;
    }
  }
  next();
});

// Method to check if tenant has reached limit
tenantSchema.methods.hasReachedLimit = function(resource: string): boolean {
  const limit = this.limits[resource];
  const usage = this.usage[resource];
  
  if (limit === -1) return false; // Unlimited
  return usage >= limit;
};

// Method to increment usage
tenantSchema.methods.incrementUsage = function(resource: string, amount: number = 1) {
  this.usage[resource] = (this.usage[resource] || 0) + amount;
  return this.save();
};

export const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);