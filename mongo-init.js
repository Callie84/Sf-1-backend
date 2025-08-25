// MongoDB initialization script
db = db.getSiblingDB('sf1');

// Create admin user
db.createUser({
  user: 'sf1_admin',
  pwd: 'sf1_admin_password',
  roles: [
    {
      role: 'readWrite',
      db: 'sf1'
    }
  ]
});

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1 });
db.users.createIndex({ roles: 1 });

db.messages.createIndex({ channelId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1 });
db.messages.createIndex({ tenantId: 1 });

db.notifications.createIndex({ userId: 1, read: 1 });
db.notifications.createIndex({ tenantId: 1 });

db.audit_logs.createIndex({ entityType: 1, entityId: 1 });
db.audit_logs.createIndex({ userId: 1, timestamp: -1 });
db.audit_logs.createIndex({ tenantId: 1 });

db.files.createIndex({ ownerId: 1 });
db.files.createIndex({ tenantId: 1 });

print('SF-1 database initialized successfully');