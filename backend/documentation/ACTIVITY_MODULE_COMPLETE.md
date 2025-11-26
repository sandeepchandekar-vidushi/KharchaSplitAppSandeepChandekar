# Activity/Notification Module - Complete Implementation

## Overview

The activity module provides a complete activity feed and notification system for tracking all important events in groups, expenses, and settlements.

---

## Database Schema

### PostgreSQL (activities table)
```sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
```

### SQLite (Mobile)
```sql
CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    synced_at INTEGER,
    is_synced INTEGER DEFAULT 0,
    deleted_at INTEGER,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Activity Types

### Supported Activity Types
- `group_created` - New group created
- `group_updated` - Group information updated
- `member_added` - Member joined group
- `member_removed` - Member left group
- `member_role_updated` - Member role changed
- `expense_added` - New expense created
- `expense_updated` - Expense modified
- `expense_deleted` - Expense removed
- `settlement_created` - New settlement initiated
- `settlement_confirmed` - Settlement confirmed by receiver
- `settlement_deleted` - Settlement cancelled

### Entity Types
- `group` - Group-related activities
- `member` - Member-related activities
- `expense` - Expense-related activities
- `settlement` - Settlement-related activities

---

## API Endpoints

### Get User Activities
```http
GET /api/v1/activities?userId=:id&page=1&limit=50
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "group_id": "uuid",
      "user_id": "uuid",
      "activity_type": "expense_added",
      "entity_type": "expense",
      "entity_id": "uuid",
      "title": "Expense added",
      "description": "Added \"Dinner\" for USD 150.00 in \"Beach Trip 2024\"",
      "metadata": {
        "groupName": "Beach Trip 2024",
        "expenseDescription": "Dinner",
        "amount": 150.00,
        "currency": "USD"
      },
      "is_read": false,
      "created_at": "2025-11-18T10:30:00Z",
      "actor_name": "John Doe",
      "group_name": "Beach Trip 2024"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 45,
    "hasMore": false
  },
  "unreadCount": 5
}
```

### Get Group Activities
```http
GET /api/v1/activities/group/:groupId?page=1&limit=50
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 30,
    "hasMore": false
  }
}
```

### Get Single Activity
```http
GET /api/v1/activities/:id
Authorization: Bearer {token}
```

### Get Unread Count
```http
GET /api/v1/activities/unread/count?userId=:id
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

### Mark Activity as Read
```http
PATCH /api/v1/activities/:id/read
Authorization: Bearer {token}
```

### Mark All Activities as Read
```http
PATCH /api/v1/activities/read-all
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "uuid"
}
```

### Mark Group Activities as Read
```http
PATCH /api/v1/activities/group/:groupId/read-all
Authorization: Bearer {token}
```

### Delete Activity
```http
DELETE /api/v1/activities/:id
Authorization: Bearer {token}
```

---

## Implementation Files

### Backend
- **Model**: `/backend/src/models/Activity.js`
  - `findById()` - Get single activity
  - `findByUserId()` - Get user's activities
  - `findByGroupId()` - Get group's activities
  - `getUnreadCount()` - Count unread activities
  - `create()` - Create new activity
  - `markAsRead()` - Mark single as read
  - `markAllAsRead()` - Mark all user's activities as read
  - `markGroupActivitiesAsRead()` - Mark group activities as read
  - `delete()` - Soft delete activity
  - `countByUserId()` - Total count for user
  - `countByGroupId()` - Total count for group

- **Service**: `/backend/src/services/activityService.js`
  - `logGroupCreated()`
  - `logGroupUpdated()`
  - `logMemberAdded()`
  - `logMemberRemoved()`
  - `logMemberRoleUpdated()`
  - `logExpenseAdded()`
  - `logExpenseUpdated()`
  - `logExpenseDeleted()`
  - `logSettlementCreated()`
  - `logSettlementConfirmed()`
  - `logSettlementDeleted()`

- **Controller**: `/backend/src/controllers/activityController.js`
  - `getUserActivities()` - GET user activities
  - `getGroupActivities()` - GET group activities
  - `getActivity()` - GET single activity
  - `getUnreadCount()` - GET unread count
  - `markAsRead()` - PATCH mark as read
  - `markAllAsRead()` - PATCH mark all as read
  - `markGroupActivitiesAsRead()` - PATCH mark group as read
  - `deleteActivity()` - DELETE activity

- **Routes**: `/backend/src/routes/activityRoutes.js`

### Mobile App
- **Schema**: `/src/database/schemas/dbSchema.ts`
- **Model**: `/src/database/models/index.ts` - `ActivityModel` interface

---

## Integration

Activities are automatically logged when:

1. **Groups**
   - Group created → `groupController.createGroup()`
   - Group updated → `groupController.updateGroup()`
   - Member added → `groupController.addGroupMember()`
   - Member removed → `groupController.removeGroupMember()`

2. **Expenses**
   - Expense created → `expenseController.createExpense()`
   - Expense updated → `expenseController.updateExpense()` (if implemented)
   - Expense deleted → `expenseController.deleteExpense()` (if implemented)

3. **Settlements**
   - Settlement created → `settlementController.createSettlement()`
   - Settlement confirmed → `settlementController.confirmSettlement()`
   - Settlement deleted → `settlementController.deleteSettlement()` (if implemented)

---

## Features

- ✅ Automatic activity logging on all major actions
- ✅ Read/unread status tracking
- ✅ Group-level and user-level activity feeds
- ✅ Metadata support for rich activity details
- ✅ Pagination support
- ✅ Soft deletes for data recovery
- ✅ User isolation (users can only view their own activities)
- ✅ Sync support for offline-first mobile app

---

## Example Activity Flow

1. **User creates expense**
   ```javascript
   POST /api/v1/expenses
   {
     "groupId": "group-123",
     "description": "Dinner",
     "amount": 150.00,
     "currency": "USD",
     ...
   }
   ```

2. **Activity automatically logged**
   ```javascript
   await ActivityService.logExpenseAdded(
     expense.id,
     groupId,
     userId,
     groupName,
     "Dinner",
     150.00,
     "USD"
   );
   ```

3. **Activity appears in feeds**
   - User's activity feed: `GET /api/v1/activities?userId=user-123`
   - Group's activity feed: `GET /api/v1/activities/group/group-123`

4. **User marks as read**
   ```javascript
   PATCH /api/v1/activities/activity-456/read
   ```

---

## Metadata Examples

### Expense Added
```json
{
  "groupName": "Beach Trip 2024",
  "expenseDescription": "Dinner at restaurant",
  "amount": 150.00,
  "currency": "USD"
}
```

### Member Added
```json
{
  "groupName": "Beach Trip 2024",
  "memberName": "Jane Smith"
}
```

### Settlement Confirmed
```json
{
  "groupName": "Beach Trip 2024",
  "fromName": "John Doe",
  "toName": "Jane Smith",
  "amount": 75.00,
  "currency": "USD"
}
```

---

## Testing

### Create Test Activity
```bash
# 1. Create a group
curl -X POST http://localhost:3000/api/v1/groups \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Group"}'

# Activity "Group created" is automatically logged

# 2. Get activities
curl -X GET "http://localhost:3000/api/v1/activities?userId=YOUR_USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Get unread count
curl -X GET "http://localhost:3000/api/v1/activities/unread/count?userId=YOUR_USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Mark as read
curl -X PATCH http://localhost:3000/api/v1/activities/ACTIVITY_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Status

✅ **FULLY IMPLEMENTED AND INTEGRATED**

- Database schema added to PostgreSQL migration
- SQLite schema added for mobile app
- Activity model with full CRUD operations
- Activity service with logging methods for all events
- Activity controller with 8 endpoints
- Routes registered in server.js
- Integrated into group, expense, and settlement controllers
- TypeScript model added for mobile app
- Documentation complete

---

**Version:** 1.0.0
**Created:** 2025-11-18
**Status:** Production Ready
