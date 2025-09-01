import { User, IUser } from '../../models/User';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

export class UserService {
  async getUsers(filters: {
    tenantId?: string;
    status?: string;
    roles?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      tenantId,
      status,
      roles,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const query: any = {};

    if (tenantId) query.tenantId = tenantId;
    if (status) query.status = status;
    if (roles && roles.length > 0) query.roles = { $in: roles };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-password -refreshTokens')
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await User.findById(id).select('-password -refreshTokens');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async updateUser(
    id: string,
    updates: Partial<IUser>,
    updatedBy: string
  ): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const oldValues = user.toObject();
    
    // Update user
    Object.assign(user, updates);
    await user.save();

    // Create audit log
    await createAuditLog({
      userId: updatedBy,
      action: 'update',
      entityType: 'User',
      entityId: id,
      oldValues: {
        firstName: oldValues.firstName,
        lastName: oldValues.lastName,
        roles: oldValues.roles,
        status: oldValues.status,
      },
      newValues: {
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status,
      },
    });

    return user;
  }

  async updateProfile(
    id: string,
    updates: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
      preferences?: Record<string, any>;
    }
  ): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const oldValues = user.toObject();

    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.avatar) user.avatar = updates.avatar;
    if (updates.preferences) {
      user.preferences = new Map(Object.entries(updates.preferences));
    }

    await user.save();

    // Create audit log
    await createAuditLog({
      userId: id,
      action: 'update',
      entityType: 'User',
      entityId: id,
      oldValues: {
        firstName: oldValues.firstName,
        lastName: oldValues.lastName,
        avatar: oldValues.avatar,
      },
      newValues: {
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      },
    });

    return user;
  }

  async deleteUser(id: string, deletedBy: string): Promise<void> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Soft delete by setting status to inactive
    user.status = 'inactive';
    await user.save();

    // Create audit log
    await createAuditLog({
      userId: deletedBy,
      action: 'delete',
      entityType: 'User',
      entityId: id,
      oldValues: { status: 'active' },
      newValues: { status: 'inactive' },
    });
  }

  async assignRoles(
    id: string,
    roles: string[],
    assignedBy: string
  ): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const oldRoles = [...user.roles];
    user.roles = roles;
    await user.save();

    // Create audit log
    await createAuditLog({
      userId: assignedBy,
      action: 'update',
      entityType: 'User',
      entityId: id,
      oldValues: { roles: oldRoles },
      newValues: { roles: roles },
      metadata: { action: 'role_assignment' },
    });

    return user;
  }

  async getUserStats(tenantId?: string) {
    const matchStage: any = {};
    if (tenantId) matchStage.tenantId = tenantId;

    const stats = await User.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          suspended: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] },
          },
          admins: {
            $sum: { $cond: [{ $in: ['admin', '$roles'] }, 1, 0] },
          },
          premium: {
            $sum: { $cond: [{ $in: ['premium', '$roles'] }, 1, 0] },
          },
        },
      },
    ]);

    return stats[0] || {
      total: 0,
      active: 0,
      pending: 0,
      suspended: 0,
      admins: 0,
      premium: 0,
    };
  }

  async getUserActivity(id: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This would typically involve aggregating data from various collections
    // For now, return mock data structure
    return {
      loginCount: 0,
      messagesCount: 0,
      filesUploaded: 0,
      lastActivity: null,
      activityByDay: [],
    };
  }
}