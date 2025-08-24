import mongoose, { Schema, Document, Model } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  roles: string[];
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: ['standard'], index: true },
    isEmailVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
