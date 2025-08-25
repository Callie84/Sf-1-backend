import { Router } from 'express';
import { UserController } from './user.controller';
import { protect, restrictTo, checkTenantAccess } from '../../middleware/auth';
import { validate, validateQuery } from '../../utils/validation';
import { userValidation, paginationValidation } from '../../utils/validation';
import { apiLimiter } from '../../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();
const userController = new UserController();

// Apply authentication to all routes
router.use(protect);
router.use(apiLimiter);

// Validation schemas
const assignRolesSchema = Joi.object({
  roles: Joi.array().items(
    Joi.string().valid('admin', 'moderator', 'premium', 'standard')
  ).required(),
});

const userFiltersSchema = paginationValidation.keys({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'pending'),
  roles: Joi.string(), // comma-separated roles
  search: Joi.string().min(1),
});

// Public user routes (within tenant)
router.get('/me', userController.getCurrentUser);

router.patch('/me',
  validate(userValidation.updateProfile),
  userController.updateProfile
);

// Routes that require tenant context
router.use(checkTenantAccess);

router.get('/',
  validateQuery(userFiltersSchema),
  userController.getUsers
);

router.get('/stats',
  restrictTo('admin', 'moderator'),
  userController.getUserStats
);

router.get('/:id',
  userController.getUserById
);

router.get('/:id/activity',
  userController.getUserActivity
);

router.patch('/:id',
  restrictTo('admin'),
  validate(userValidation.updateProfile),
  userController.updateUser
);

router.delete('/:id',
  restrictTo('admin'),
  userController.deleteUser
);

router.patch('/:id/roles',
  restrictTo('admin'),
  validate(assignRolesSchema),
  userController.assignRoles
);

export default router;