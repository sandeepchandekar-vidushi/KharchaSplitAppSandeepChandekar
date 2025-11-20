# 🎉 KharchaSplit Backend - Setup Complete!

## ✅ What's Been Created

### Project Structure
```
backend/
├── src/
│   ├── config/
│   │   └── database.js           ✅ PostgreSQL connection pool
│   ├── controllers/
│   │   └── authController.js     ✅ Authentication logic
│   ├── middleware/
│   │   ├── auth.js               ✅ JWT authentication
│   │   ├── validation.js         ✅ Request validation
│   │   └── errorHandler.js       ✅ Error handling
│   ├── routes/
│   │   └── authRoutes.js         ✅ Auth endpoints
│   ├── utils/
│   │   ├── jwt.js                ✅ JWT helpers
│   │   └── otp.js                ✅ OTP generation
│   └── server.js                 ✅ Express server
├── migrations/
│   ├── 001_initial_schema.sql    ✅ Database schema
│   └── migrate.js                ✅ Migration runner
├── package.json                  ✅ Dependencies
├── .env.example                  ✅ Config template
└── .gitignore                    ✅ Git ignore rules
```

### ✅ Implemented Features

**Authentication System:**
- ✅ User registration with OTP
- ✅ OTP-based login
- ✅ JWT access & refresh tokens
- ✅ Token refresh endpoint
- ✅ Logout functionality

**Database:**
- ✅ Complete PostgreSQL schema
- ✅ 10 tables with indexes
- ✅ Foreign key constraints
- ✅ Soft deletes
- ✅ Auto-update triggers
- ✅ Views for common queries

**Middleware:**
- ✅ JWT authentication
- ✅ Request validation
- ✅ Error handling
- ✅ Rate limiting
- ✅ CORS
- ✅ Helmet security
- ✅ Compression

**Utilities:**
- ✅ JWT token generation/verification
- ✅ OTP generation & expiry
- ✅ Database helpers

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kharchasplit
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
```

### 3. Set Up PostgreSQL Database

**Option A: Using psql**
```bash
# Create database
psql -U postgres
CREATE DATABASE kharchasplit;
\q
```

**Option B: Using Docker**
```bash
docker run --name kharchasplit-postgres \
  -e POSTGRES_DB=kharchasplit \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Run Migrations

```bash
npm run migrate
```

You should see:
```
✅ Migration completed successfully!
📊 Database schema created:
   - users
   - groups
   - group_members
   ...
```

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║   🚀 KharchaSplit API Server          ║
╚════════════════════════════════════════╝

✅ Server running on port 3000
✅ Environment: development
✅ API Version: v1

📡 Health check: http://localhost:3000/health
📚 API Base URL: http://localhost:3000/api/v1
```

### 6. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "name": "Test User",
    "email": "test@example.com"
  }'
```

---

## 📋 Remaining Controllers to Create

I've created the foundation. You need to create these additional controllers:

### 1. User Controller
**File:** `src/controllers/userController.js`

```javascript
const { query } = require('../config/database');

// GET /api/v1/users/:id
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, phone_number, name, email, profile_image_base64, created_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, profile_image_base64 } = req.body;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           profile_image_base64 = COALESCE($3, profile_image_base64)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, phone_number, name, email, profile_image_base64`,
      [name, email, profile_image_base64, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/:id
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUser, updateUser, deleteUser };
```

### 2. Group Controller
**File:** `src/controllers/groupController.js`

Create endpoints for:
- `GET /api/v1/groups?userId=:id` - Get user's groups
- `GET /api/v1/groups/:id` - Get single group
- `POST /api/v1/groups` - Create group
- `PUT /api/v1/groups/:id` - Update group
- `DELETE /api/v1/groups/:id` - Delete group
- `POST /api/v1/groups/:id/members` - Add member
- `DELETE /api/v1/groups/:id/members/:userId` - Remove member

### 3. Expense Controller
**File:** `src/controllers/expenseController.js`

Create endpoints for:
- `GET /api/v1/expenses?groupId=:id` - Get group expenses
- `GET /api/v1/expenses/:id` - Get single expense
- `POST /api/v1/expenses` - Create expense
- `PUT /api/v1/expenses/:id` - Update expense
- `DELETE /api/v1/expenses/:id` - Delete expense

### 4. Settlement Controller
**File:** `src/controllers/settlementController.js`

Create endpoints for:
- `GET /api/v1/settlements?groupId=:id` - Get settlements
- `POST /api/v1/settlements` - Create settlement
- `PATCH /api/v1/settlements/:id/confirm` - Confirm settlement

### 5. Personal Expense Controller
**File:** `src/controllers/personalExpenseController.js`

Similar to expense controller but for personal expenses.

### 6. Sync Controller
**File:** `src/controllers/syncController.js`

Create endpoints for:
- `POST /api/v1/sync` - Bulk sync
- `GET /api/v1/sync/last?userId=:id` - Get last sync time

---

## 📝 Creating Route Files

For each controller, create a corresponding route file:

**Template:** `src/routes/userRoutes.js`
```javascript
const express = require('express');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/:id', authenticate, userController.getUser);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, userController.deleteUser);

module.exports = router;
```

Create similar files for:
- `groupRoutes.js`
- `expenseRoutes.js`
- `settlementRoutes.js`
- `personalExpenseRoutes.js`
- `syncRoutes.js`

---

## 🧪 Testing

### Manual Testing with cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","name":"Test User"}'

# 2. Verify OTP (check console for OTP in dev mode)
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","otp":"123456"}'

# 3. Use the access token for authenticated requests
curl -X GET http://localhost:3000/api/v1/users/{userId} \
  -H "Authorization: Bearer {accessToken}"
```

### Testing with Postman

1. Import the API endpoints
2. Set environment variable for `accessToken`
3. Use `{{accessToken}}` in Authorization header

---

## 🔒 Security Checklist

- ✅ Environment variables for secrets
- ✅ JWT token expiration
- ✅ Password hashing (if using passwords)
- ✅ SQL injection protection (parameterized queries)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet security headers
- ⏳ Input validation (add for all endpoints)
- ⏳ HTTPS in production
- ⏳ OTP rate limiting

---

## 📚 Next Steps

1. **Create Remaining Controllers** - Use the templates above
2. **Create Route Files** - Connect controllers to routes
3. **Add Validation** - Use express-validator for all inputs
4. **Test All Endpoints** - Use Postman or write tests
5. **Deploy** - Use Heroku, AWS, or DigitalOcean
6. **Set up SMS** - Integrate Twilio for OTP
7. **Monitoring** - Add logging and error tracking
8. **Documentation** - Generate API docs with Swagger

---

## 🐛 Troubleshooting

**Database connection fails:**
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Check port 5432 is not blocked

**Migration fails:**
- Drop database and recreate: `DROP DATABASE kharchasplit; CREATE DATABASE kharchasplit;`
- Check PostgreSQL version (need 12+)

**OTP not sending:**
- Check console logs in development mode
- Configure Twilio for production

**Port already in use:**
- Change PORT in `.env`
- Or kill process: `lsof -ti:3000 | xargs kill`

---

## 📞 Support

- Backend code: `backend/src/`
- Database schema: `backend/migrations/001_initial_schema.sql`
- Mobile app integration: See `docs/DATABASE_SETUP.md`

---

**Status:** ✅ Core backend ready - Controllers need completion

**Created:** 2025-11-18
