# Database Setup Guide

## Overview

KharchaSplit uses a **hybrid database architecture** combining:
- **Local Storage**: SQLite for offline-first capability
- **Remote Storage**: PostgreSQL via REST API
- **Sync Layer**: Automatic bidirectional synchronization

This architecture provides:
- ✅ Offline-first functionality
- ✅ Fast local operations
- ✅ Automatic cloud backup
- ✅ Multi-device synchronization
- ✅ Conflict resolution

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Mobile App                        │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ Repositories │    │  Components  │              │
│  │  (Data Layer)│◄───┤  (UI Layer)  │              │
│  └──────┬───────┘    └──────────────┘              │
│         │                                            │
│  ┌──────▼──────────────────────────────────┐       │
│  │        Database Manager                  │       │
│  ├──────────────┬──────────────┬───────────┤       │
│  │  SQLite      │  API Service │Sync Service│      │
│  │  Service     │              │            │       │
│  └──────┬───────┴──────┬───────┴─────┬─────┘       │
│         │              │             │              │
└─────────┼──────────────┼─────────────┼─────────────┘
          │              │             │
          ▼              ▼             ▼
   ┌──────────┐   ┌──────────┐  ┌─────────┐
   │  SQLite  │   │   HTTP   │  │ Network │
   │   DB     │   │   API    │  │ Monitor │
   └──────────┘   └────┬─────┘  └─────────┘
                       │
                       ▼
              ┌────────────────┐
              │   PostgreSQL   │
              │   (Backend)    │
              └────────────────┘
```

---

## Installation

### 1. Dependencies

The following packages are already installed:
```bash
npm install react-native-sqlite-storage
npm install axios
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo
npm install react-native-uuid
```

### 2. iOS Setup

```bash
cd ios
pod install
cd ..
```

### 3. Android Setup

No additional setup required. SQLite is built-in.

---

## Quick Start

### Initialize the Database

In your [`App.tsx`](../App.tsx):

```typescript
import { useEffect } from 'react';
import { databaseManager } from './src/database';

function App() {
  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      await databaseManager.initialize({
        apiBaseUrl: 'https://api.yourdomain.com', // Your PostgreSQL backend URL
        autoSync: true, // Enable automatic sync
      });
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
    }
  };

  return (
    // Your app components
  );
}
```

---

## Usage Examples

### 1. Using Repositories (Recommended)

```typescript
import { groupRepository } from './src/database';

// Create a group
const result = await groupRepository.createGroup({
  name: 'Trip to Goa',
  description: 'Beach vacation expenses',
  created_by: userId,
  members: [
    { user_id: 'user1', name: 'John Doe', phone_number: '+1234567890' },
    { user_id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
  ],
});

// Get user's groups
const groups = await groupRepository.getUserGroups(userId);

// Update group
await groupRepository.updateGroup(groupId, {
  name: 'Updated Group Name',
});

// Get group members
const members = await groupRepository.getGroupMembers(groupId);

// Add member
await groupRepository.addGroupMember({
  group_id: groupId,
  user_id: newUserId,
  name: 'New Member',
  added_by: currentUserId,
});
```

### 2. Direct SQLite Operations

```typescript
import { sqliteService } from './src/database';

// Insert
await sqliteService.insert('users', {
  id: 'user123',
  name: 'John Doe',
  phone_number: '+1234567890',
  created_at: Date.now(),
  updated_at: Date.now(),
  is_synced: 0,
});

// Select
const users = await sqliteService.select('users', {
  where: { phone_number: '+1234567890' },
  limit: 10,
});

// Update
await sqliteService.update(
  'users',
  { name: 'John Updated' },
  { id: 'user123' }
);

// Delete (soft)
await sqliteService.softDelete('users', { id: 'user123' });

// Custom query
const results = await sqliteService.query(
  'SELECT * FROM users WHERE created_at > ?',
  [Date.now() - 86400000] // Last 24 hours
);
```

### 3. API Service

```typescript
import { apiService } from './src/database';

// Configure API
await apiService.setBaseUrl('https://api.yourdomain.com');
await apiService.setAuthToken('your-auth-token');

// Make API calls
const response = await apiService.get('/users/123');
if (response.success) {
  console.log('User data:', response.data);
}

// Create group via API
const createResponse = await apiService.createGroup({
  name: 'New Group',
  created_by: userId,
});
```

### 4. Manual Sync

```typescript
import { syncService, databaseManager } from './src/database';

// Manual sync
await databaseManager.sync('both'); // 'push', 'pull', or 'both'

// Get sync status
const status = await syncService.getSyncStatus();
console.log('Sync status:', status);

// Enable/disable auto-sync
await databaseManager.setAutoSync(true);

// Get last sync time
const lastSync = await syncService.getLastSyncTime();
```

---

## Database Schema

### Tables

#### users
- `id` (TEXT, PRIMARY KEY)
- `phone_number` (TEXT, UNIQUE)
- `name` (TEXT)
- `email` (TEXT)
- `profile_image_base64` (TEXT)
- `created_at`, `updated_at`, `synced_at` (INTEGER timestamps)
- `is_synced` (INTEGER: 0 or 1)
- `deleted_at` (INTEGER)

#### groups
- `id` (TEXT, PRIMARY KEY)
- `name` (TEXT)
- `description` (TEXT)
- `cover_image_base64` (TEXT)
- `created_by` (TEXT, FOREIGN KEY → users)
- Timestamps and sync fields

#### group_members
- `id` (TEXT, PRIMARY KEY)
- `group_id` (TEXT, FOREIGN KEY → groups)
- `user_id` (TEXT, FOREIGN KEY → users)
- `name`, `phone_number`, `email` (TEXT)
- `role` (TEXT: 'creator', 'admin', 'member')
- `added_by` (TEXT, FOREIGN KEY → users)
- `joined_at` (INTEGER)
- Timestamps and sync fields

#### expenses
- `id` (TEXT, PRIMARY KEY)
- `group_id` (TEXT, FOREIGN KEY → groups)
- `description`, `amount`, `currency`, `category` (TEXT/REAL)
- `paid_by_id`, `paid_by_name` (TEXT)
- `split_type` (TEXT: 'equal', 'unequal', 'percentage', 'shares')
- `receipt_base64`, `notes` (TEXT)
- `expense_date` (INTEGER)
- Timestamps and sync fields

#### expense_participants
- `id` (TEXT, PRIMARY KEY)
- `expense_id` (TEXT, FOREIGN KEY → expenses)
- `user_id` (TEXT, FOREIGN KEY → users)
- `name` (TEXT)
- `amount`, `percentage`, `shares` (REAL/INTEGER)
- Timestamps and sync fields

#### settlements
- `id` (TEXT, PRIMARY KEY)
- `group_id` (TEXT, FOREIGN KEY → groups)
- `from_user_id`, `to_user_id` (TEXT, FOREIGN KEY → users)
- `amount`, `currency` (REAL/TEXT)
- `status` (TEXT: 'pending', 'confirmed', 'paid')
- `notes` (TEXT)
- `confirmed_at` (INTEGER)
- Timestamps and sync fields

#### personal_expenses
- Similar to expenses but for personal tracking
- `user_id` instead of `group_id`

#### sync_queue
- Tracks operations pending sync to server
- `operation_type` (TEXT: 'CREATE', 'UPDATE', 'DELETE')
- `table_name`, `record_id`, `data` (TEXT/JSON)
- `priority`, `retry_count` (INTEGER)
- `created_at`, `last_attempt_at` (INTEGER)
- `error_message` (TEXT)

---

## Backend API Requirements

Your PostgreSQL backend should implement these endpoints:

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/verify-otp` - OTP verification
- `POST /auth/refresh` - Refresh token

### Users
- `GET /users/:id` - Get user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Groups
- `GET /groups?userId=:id` - Get user's groups (paginated)
- `GET /groups/:id` - Get single group
- `POST /groups` - Create group
- `PUT /groups/:id` - Update group
- `DELETE /groups/:id` - Delete group

### Group Members
- `POST /groups/:id/members` - Add member
- `DELETE /groups/:id/members/:userId` - Remove member
- `PUT /groups/:id/members/:userId` - Update member

### Expenses
- `GET /expenses?groupId=:id` - Get group expenses (paginated)
- `GET /expenses/:id` - Get single expense
- `POST /expenses` - Create expense
- `PUT /expenses/:id` - Update expense
- `DELETE /expenses/:id` - Delete expense

### Settlements
- `GET /settlements?groupId=:id` - Get settlements
- `POST /settlements` - Create settlement
- `PATCH /settlements/:id/confirm` - Confirm settlement

### Sync
- `POST /sync` - Bulk sync operation
- `GET /sync/last?userId=:id` - Get last sync timestamp

---

## Configuration

### Setting API Base URL

You can set the API base URL in three ways:

1. **During initialization:**
```typescript
await databaseManager.initialize({
  apiBaseUrl: 'https://api.yourdomain.com',
});
```

2. **After initialization:**
```typescript
await databaseManager.configureApi('https://api.yourdomain.com');
```

3. **Using API service directly:**
```typescript
await apiService.setBaseUrl('https://api.yourdomain.com');
```

### Setting Auth Token

```typescript
await apiService.setAuthToken('your-jwt-token');
```

The token will be automatically included in all API requests.

---

## Sync Strategy

### Offline-First Approach

1. **All operations are local-first**
   - Changes are immediately saved to SQLite
   - UI updates instantly
   - Operations are queued for sync

2. **Automatic Background Sync**
   - Syncs every 5 minutes (configurable)
   - Triggers on network reconnection
   - Retries failed operations

3. **Conflict Resolution**
   - Server wins by default (can be customized)
   - Timestamps used for conflict detection
   - Manual resolution available for critical data

### Sync Queue Priority

Operations are prioritized:
- High priority (1): CREATE operations
- Normal priority (0): UPDATE, DELETE operations

---

## Monitoring & Debugging

### Get Database Statistics

```typescript
const stats = await databaseManager.getStatistics();
console.log('SQLite stats:', stats.sqlite);
console.log('Sync status:', stats.sync);
```

### Health Check

```typescript
const health = await databaseManager.healthCheck();
console.log('SQLite:', health.sqlite ? 'OK' : 'Error');
console.log('API:', health.api ? 'OK' : 'Error');
console.log('Online:', health.online ? 'Yes' : 'No');
```

### Enable Debug Logging

SQLite debugging is automatically enabled in `__DEV__` mode.

---

## Best Practices

1. **Always use repositories** for complex operations
2. **Handle errors gracefully** - offline mode is expected
3. **Show sync status** to users
4. **Implement pull-to-refresh** to trigger manual sync
5. **Cache user preferences** locally
6. **Test offline scenarios** thoroughly
7. **Monitor sync queue size** - alert if growing too large

---

## Troubleshooting

### Database won't initialize
- Check SQLite permissions (should be automatic)
- Verify pod install on iOS
- Check Android build logs

### Sync not working
- Verify network connection
- Check API base URL is set correctly
- Verify auth token is valid
- Check sync queue: `SELECT * FROM sync_queue`

### Data conflicts
- Check `synced_at` timestamps
- Review sync queue errors: `SELECT * FROM sync_queue WHERE error_message IS NOT NULL`

### Reset database (development only)
```typescript
await databaseManager.resetLocalDatabase();
```

⚠️ **WARNING**: This deletes all local data!

---

## Next Steps

1. **Set up your PostgreSQL backend** with the required API endpoints
2. **Configure the API base URL** in your app
3. **Implement authentication** and set auth tokens
4. **Test offline scenarios** thoroughly
5. **Monitor sync performance** and optimize as needed

---

## Support

For questions or issues:
- Check the [main documentation](./CLAUDE.md)
- Review the [codebase structure](../src/database/README.md)
- Open an issue on GitHub

---

**Built with ❤️ for KharchaSplit**
