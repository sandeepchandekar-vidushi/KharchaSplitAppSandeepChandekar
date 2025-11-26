# KharchaSplit API Endpoints

**Base URL:** `https://api.kharchasplit.com/api/v1`
**Development URL:** `http://localhost:3000/api/v1`

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Groups](#groups)
- [Expenses](#expenses)
- [Settlements](#settlements)
- [Personal Expenses](#personal-expenses)
- [Activities](#activities)
- [Sync](#sync)
- [Health Check](#health-check)

---

## 🔐 Authentication

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer {access_token}
```

### Register User
```http
POST /auth/register
```

**Body:**
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "email": "john@example.com"  // optional
}
```

**Response:** 201
```json
{
  "success": true,
  "message": "User registered successfully. OTP sent.",
  "data": {
    "userId": "uuid"
  }
}
```

---

### Send OTP
```http
POST /auth/send-otp
```

**Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

---

### Verify OTP & Login
```http
POST /auth/verify-otp
```

**Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response:** 200
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

---

### Refresh Access Token
```http
POST /auth/refresh
```

**Body:**
```json
{
  "refreshToken": "your_refresh_token"
}
```

**Response:** 200
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token"
  }
}
```

---

### Logout
```http
POST /auth/logout
```

**Body:**
```json
{
  "refreshToken": "your_refresh_token"
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Simple Login (No OTP)
```http
POST /auth/simple-login
```

**Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "email": "john@example.com",
      "profileImageBase64": "...",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

**Response:** 404 (User not found)
```json
{
  "success": false,
  "error": "User not found. Please complete registration first."
}
```

---

## 👤 Users

### Get User Profile
```http
GET /users/:id
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "profileImageBase64": "...",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### Update User Profile
```http
PUT /users/:id
Authorization: Bearer {token}
```

**Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { /* updated user */ }
}
```

---

### Delete User Account
```http
DELETE /users/:id
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 👥 Groups

### Get User's Groups
```http
GET /groups?userId=:userId&page=1&limit=20
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Beach Trip 2024",
      "description": "Vacation expenses",
      "coverImageBase64": "...",
      "createdBy": "uuid",
      "memberCount": 5,
      "expenseCount": 12,
      "totalExpenses": 1500.00,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "hasMore": false
  }
}
```

---

### Get Group Details
```http
GET /groups/:id
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "uuid",
      "name": "Beach Trip 2024",
      "description": "Vacation expenses",
      "createdBy": "uuid"
    },
    "members": [
      {
        "userId": "uuid",
        "name": "John Doe",
        "role": "creator"
      }
    ],
    "balances": [
      {
        "userId": "uuid",
        "name": "John Doe",
        "balance": 50.00
      }
    ]
  }
}
```

---

### Create Group
```http
POST /groups
Authorization: Bearer {token}
```

**Body:**
```json
{
  "name": "Beach Trip 2024",
  "description": "Vacation expenses",
  "coverImageBase64": "...",
  "members": [
    {
      "userId": "uuid",
      "name": "Jane Smith",
      "phoneNumber": "+9876543210",
      "email": "jane@example.com"
    }
  ]
}
```

**Response:** 201
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": { /* group object */ }
}
```

---

### Update Group
```http
PUT /groups/:id
Authorization: Bearer {token}
```

**Body:**
```json
{
  "name": "Updated Group Name",
  "description": "Updated description"
}
```

---

### Delete Group
```http
DELETE /groups/:id
Authorization: Bearer {token}
```

---

### Get Group Members
```http
GET /groups/:id/members
Authorization: Bearer {token}
```

---

### Add Group Member
```http
POST /groups/:id/members
Authorization: Bearer {token}
```

**Body:**
```json
{
  "userId": "uuid",
  "name": "New Member",
  "phoneNumber": "+1234567890",
  "email": "member@example.com"
}
```

---

### Remove Group Member
```http
DELETE /groups/:id/members/:userId
Authorization: Bearer {token}
```

---

### Update Member Role
```http
PUT /groups/:id/members/:userId
Authorization: Bearer {token}
```

**Body:**
```json
{
  "role": "admin"  // or "member"
}
```

---

## 💰 Expenses

### Get Group Expenses
```http
GET /expenses?groupId=:groupId&page=1&limit=50
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "description": "Dinner at restaurant",
      "amount": 150.00,
      "currency": "USD",
      "category": "Food",
      "paidById": "uuid",
      "paidByName": "John Doe",
      "splitType": "equal",
      "expenseDate": "2025-01-15T18:30:00Z",
      "participants": [
        {
          "userId": "uuid",
          "name": "John Doe",
          "amount": 75.00
        },
        {
          "userId": "uuid",
          "name": "Jane Smith",
          "amount": 75.00
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "hasMore": false
  }
}
```

---

### Get Single Expense
```http
GET /expenses/:id
Authorization: Bearer {token}
```

---

### Create Expense
```http
POST /expenses
Authorization: Bearer {token}
```

**Body:**
```json
{
  "groupId": "uuid",
  "description": "Dinner at restaurant",
  "amount": 150.00,
  "currency": "USD",
  "category": "Food",
  "paidById": "uuid",
  "paidByName": "John Doe",
  "splitType": "equal",
  "receiptBase64": "...",
  "notes": "Great dinner!",
  "expenseDate": "2025-01-15T18:30:00Z",
  "participants": [
    {
      "userId": "uuid",
      "name": "John Doe",
      "amount": 75.00
    },
    {
      "userId": "uuid",
      "name": "Jane Smith",
      "amount": 75.00
    }
  ]
}
```

**Response:** 201
```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": { /* expense object */ }
}
```

---

### Update Expense
```http
PUT /expenses/:id
Authorization: Bearer {token}
```

---

### Delete Expense
```http
DELETE /expenses/:id
Authorization: Bearer {token}
```

---

## 💸 Settlements

### Get Group Settlements
```http
GET /settlements?groupId=:groupId
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "fromUserId": "uuid",
      "toUserId": "uuid",
      "amount": 50.00,
      "currency": "USD",
      "status": "pending",
      "notes": "Settling up",
      "createdAt": "2025-01-20T10:00:00Z",
      "confirmedAt": null
    }
  ]
}
```

---

### Create Settlement
```http
POST /settlements
Authorization: Bearer {token}
```

**Body:**
```json
{
  "groupId": "uuid",
  "fromUserId": "uuid",
  "toUserId": "uuid",
  "amount": 50.00,
  "currency": "USD",
  "notes": "Settling up"
}
```

**Response:** 201

---

### Confirm Settlement
```http
PATCH /settlements/:id/confirm
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Settlement confirmed successfully",
  "data": { /* settlement object with status: "confirmed" */ }
}
```

---

### Delete Settlement
```http
DELETE /settlements/:id
Authorization: Bearer {token}
```

---

## 📊 Personal Expenses

### Get Personal Expenses
```http
GET /personal-expenses?userId=:userId&page=1&limit=50
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "description": "Grocery shopping",
      "amount": 85.50,
      "currency": "USD",
      "category": "Groceries",
      "receiptBase64": "...",
      "notes": "Weekly groceries",
      "expenseDate": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "hasMore": false
  }
}
```

---

### Get Single Personal Expense
```http
GET /personal-expenses/:id
Authorization: Bearer {token}
```

---

### Create Personal Expense
```http
POST /personal-expenses
Authorization: Bearer {token}
```

**Body:**
```json
{
  "description": "Grocery shopping",
  "amount": 85.50,
  "currency": "USD",
  "category": "Groceries",
  "receiptBase64": "...",
  "notes": "Weekly groceries",
  "expenseDate": "2025-01-15T10:00:00Z"
}
```

---

### Update Personal Expense
```http
PUT /personal-expenses/:id
Authorization: Bearer {token}
```

---

### Delete Personal Expense
```http
DELETE /personal-expenses/:id
Authorization: Bearer {token}
```

---

## 🔔 Activities

### Get User Activities
```http
GET /activities?userId=:userId&page=1&limit=50
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "userId": "uuid",
      "activityType": "expense_added",
      "entityType": "expense",
      "entityId": "uuid",
      "title": "Expense added",
      "description": "Added \"Dinner\" for USD 150.00 in \"Beach Trip 2024\"",
      "metadata": {
        "groupName": "Beach Trip 2024",
        "expenseDescription": "Dinner",
        "amount": 150.00,
        "currency": "USD"
      },
      "isRead": false,
      "createdAt": "2025-01-15T18:30:00Z",
      "actorName": "John Doe",
      "groupName": "Beach Trip 2024"
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

---

### Get Group Activities
```http
GET /activities/group/:groupId?page=1&limit=50
Authorization: Bearer {token}
```

---

### Get Single Activity
```http
GET /activities/:id
Authorization: Bearer {token}
```

---

### Get Unread Count
```http
GET /activities/unread/count?userId=:userId
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

### Mark Activity as Read
```http
PATCH /activities/:id/read
Authorization: Bearer {token}
```

---

### Mark All Activities as Read
```http
PATCH /activities/read-all
Authorization: Bearer {token}
```

**Body:**
```json
{
  "userId": "uuid"
}
```

---

### Mark Group Activities as Read
```http
PATCH /activities/group/:groupId/read-all
Authorization: Bearer {token}
```

---

### Delete Activity
```http
DELETE /activities/:id
Authorization: Bearer {token}
```

---

## 🔄 Sync

### Bulk Sync Operation
```http
POST /sync
Authorization: Bearer {token}
```

**Body:**
```json
{
  "operations": [
    {
      "type": "CREATE",
      "table": "expenses",
      "recordId": "local-id-123",
      "data": {
        "groupId": "uuid",
        "description": "Lunch",
        "amount": 25.00
      }
    },
    {
      "type": "UPDATE",
      "table": "groups",
      "recordId": "uuid",
      "data": {
        "name": "Updated Group Name"
      }
    },
    {
      "type": "DELETE",
      "table": "expenses",
      "recordId": "uuid",
      "data": {}
    }
  ]
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Sync completed",
  "data": {
    "processed": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      {
        "recordId": "local-id-123",
        "success": true,
        "id": "uuid"
      }
    ],
    "errors": [
      {
        "recordId": "uuid",
        "error": "Record not found"
      }
    ]
  }
}
```

---

### Get Last Sync Time
```http
GET /sync/last?userId=:userId
Authorization: Bearer {token}
```

**Response:** 200
```json
{
  "success": true,
  "data": [
    {
      "tableName": "all",
      "lastSyncedAt": "2025-01-20T12:00:00Z"
    }
  ]
}
```

---

## ❤️ Health Check

### Health Check
```http
GET /health
```

**Response:** 200
```json
{
  "success": true,
  "message": "KharchaSplit API is running",
  "version": "v1",
  "timestamp": "2025-01-20T12:00:00Z"
}
```

---

## 📊 Summary

**Total Endpoints:** 42

### Breakdown:
- **Authentication:** 5 endpoints
- **Users:** 3 endpoints
- **Groups:** 9 endpoints
- **Expenses:** 5 endpoints
- **Settlements:** 4 endpoints
- **Personal Expenses:** 5 endpoints
- **Activities:** 8 endpoints
- **Sync:** 2 endpoints
- **Health:** 1 endpoint

---

## 🔒 Security

- All endpoints (except auth & health) require JWT authentication
- Rate limiting: 100 requests per 15 minutes
- CORS enabled
- Helmet security headers
- Input validation on all endpoints
- SQL injection protection via parameterized queries

---

## 📝 Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

**Version:** 1.0.0
**Last Updated:** 2025-11-18
