import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['candidate', 'recruiter'],
        message: '{VALUE} is not a valid user role',
      },
    },
    tenantId: {
      type: String,
      required: [true, 'tenantId is required'],
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: unique email per tenant
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.plugin(tenantPlugin);

export const User = mongoose.model('User', userSchema);
export default User;
