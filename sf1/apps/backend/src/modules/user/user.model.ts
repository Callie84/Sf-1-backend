import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRole, UserPreferences, NotificationSettings } from '@/types';

export interface UserDocument extends User, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): any;
}

const notificationSettingsSchema = new Schema<NotificationSettings>({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  marketing: { type: Boolean, default: false }
}, { _id: false });

const userPreferencesSchema = new Schema<UserPreferences>({
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
  language: { type: String, default: 'en' },
  timezone: { type: String, default: 'UTC' },
  notifications: { type: notificationSettingsSchema, default: () => ({}) }
}, { _id: false });

const userSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.STANDARD,
    index: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: {
    type: Date
  },
  profilePicture: {
    type: String
  },
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  },
  tenantId: {
    type: String,
    index: true
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  twoFactorSecret: {
    type: String
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, transform: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for display name
userSchema.virtual('displayName').get(function() {
  return this.username || this.fullName;
});

// Indexes for performance
userSchema.index({ email: 1, tenantId: 1 });
userSchema.index({ username: 1, tenantId: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to update lastPasswordChange
userSchema.pre('save', function(next) {
  if (this.isModified('password')) {
    this.lastPasswordChange = new Date();
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Method to check if account is locked
userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    await this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
    return;
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) };
  }

  await this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  await this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function(): string {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.emailVerificationToken = token;
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function(): string {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.passwordResetToken = token;
  this.passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
  return token;
};

// Method to verify email verification token
userSchema.methods.verifyEmailVerificationToken = function(token: string): boolean {
  return this.emailVerificationToken === token && 
         this.emailVerificationExpires > new Date();
};

// Method to verify password reset token
userSchema.methods.verifyPasswordResetToken = function(token: string): boolean {
  return this.passwordResetToken === token && 
         this.passwordResetExpires > new Date();
};

// Method to clear email verification token
userSchema.methods.clearEmailVerificationToken = function(): void {
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
};

// Method to clear password reset token
userSchema.methods.clearPasswordResetToken = function(): void {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email: string, tenantId?: string) {
  const query: any = { email: email.toLowerCase() };
  if (tenantId) query.tenantId = tenantId;
  return this.findOne(query);
};

// Static method to find by username
userSchema.statics.findByUsername = function(username: string, tenantId?: string) {
  const query: any = { username: username.toLowerCase() };
  if (tenantId) query.tenantId = tenantId;
  return this.findOne(query);
};

// Static method to find active users
userSchema.statics.findActive = function(tenantId?: string) {
  const query: any = { isActive: true };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query);
};

// Static method to find by role
userSchema.statics.findByRole = function(role: UserRole, tenantId?: string) {
  const query: any = { role, isActive: true };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query);
};

// Static method to count users by role
userSchema.statics.countByRole = function(role: UserRole, tenantId?: string) {
  const query: any = { role, isActive: true };
  if (tenantId) query.tenantId = tenantId;
  return this.countDocuments(query);
};

// Static method to find users created in date range
userSchema.statics.findByDateRange = function(startDate: Date, endDate: Date, tenantId?: string) {
  const query: any = { 
    createdAt: { 
      $gte: startDate, 
      $lte: endDate 
    } 
  };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query);
};

// Static method to find users by last login
userSchema.statics.findByLastLogin = function(days: number, tenantId?: string) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const query: any = { lastLoginAt: { $gte: date } };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query);
};

// Export the model
export const UserModel = mongoose.model<UserDocument>('User', userSchema);