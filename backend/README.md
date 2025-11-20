# KharchaSplit Backend API

PostgreSQL-based REST API for the KharchaSplit expense splitting application.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Testing](#testing)

---

## ✨ Features

- ✅ **OTP-based Authentication** - Secure phone number verification
- ✅ **JWT Tokens** - Access and refresh token system
- ✅ **PostgreSQL Database** - Robust relational database
- ✅ **RESTful API** - Standard HTTP methods
- ✅ **Input Validation** - Request validation middleware
- ✅ **Error Handling** - Centralized error management
- ✅ **Rate Limiting** - Protection against abuse
- ✅ **Security** - Helmet, CORS, compression
- ✅ **Soft Deletes** - Data recovery capability
- ✅ **Auto Timestamps** - Automatic created_at/updated_at

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 12+
- **Authentication:** JWT + OTP
- **Validation:** express-validator
- **Security:** Helmet, bcrypt
- **Logging:** Morgan

---

## 📦 Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher
- npm or yarn

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DB_HOST=localhost
DB_NAME=kharchasplit
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key
```

### 3. Create Database

```bash
# Using psql
createdb kharchasplit

# Or manually
psql -U postgres
CREATE DATABASE kharchasplit;
\q
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will be running at `http://localhost:3000`

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Send OTP
```http
POST /api/v1/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

#### Verify OTP & Login
```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phoneNumber": "+1234567890",
      "name": "John Doe"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### Logout
```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Protected Endpoints

All protected endpoints require:
```http
Authorization: Bearer {accessToken}
```

#### User Endpoints
- `GET /api/v1/users/:id` - Get user profile
- `PUT /api/v1/users/:id` - Update user profile
- `DELETE /api/v1/users/:id` - Delete user account

#### Group Endpoints
- `GET /api/v1/groups?userId=:id` - Get user's groups
- `GET /api/v1/groups/:id` - Get group details
- `POST /api/v1/groups` - Create group
- `PUT /api/v1/groups/:id` - Update group
- `DELETE /api/v1/groups/:id` - Delete group
- `POST /api/v1/groups/:id/members` - Add member
- `DELETE /api/v1/groups/:id/members/:userId` - Remove member

#### Expense Endpoints
- `GET /api/v1/expenses?groupId=:id` - Get group expenses
- `GET /api/v1/expenses/:id` - Get expense details
- `POST /api/v1/expenses` - Create expense
- `PUT /api/v1/expenses/:id` - Update expense
- `DELETE /api/v1/expenses/:id` - Delete expense

#### Settlement Endpoints
- `GET /api/v1/settlements?groupId=:id` - Get settlements
- `POST /api/v1/settlements` - Create settlement
- `PATCH /api/v1/settlements/:id/confirm` - Confirm settlement

#### Personal Expense Endpoints
- `GET /api/v1/personal-expenses?userId=:id` - Get personal expenses
- `POST /api/v1/personal-expenses` - Create personal expense
- `PUT /api/v1/personal-expenses/:id` - Update personal expense
- `DELETE /api/v1/personal-expenses/:id` - Delete personal expense

#### Sync Endpoints
- `POST /api/v1/sync` - Bulk sync operation
- `GET /api/v1/sync/last?userId=:id` - Get last sync time

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js         # PostgreSQL connection
│   ├── controllers/
│   │   └── authController.js   # Request handlers
│   ├── middleware/
│   │   ├── auth.js             # Authentication
│   │   ├── validation.js       # Request validation
│   │   └── errorHandler.js     # Error handling
│   ├── routes/
│   │   └── authRoutes.js       # Route definitions
│   ├── utils/
│   │   ├── jwt.js              # JWT helpers
│   │   └── otp.js              # OTP generation
│   └── server.js               # App entry point
├── migrations/
│   ├── 001_initial_schema.sql  # Database schema
│   └── migrate.js              # Migration runner
├── package.json
├── .env.example
└── README.md
```

---

## 🔧 Development

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | development |
| `PORT` | Server port | 3000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | kharchasplit |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | Token expiry | 7d |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests | 100 |

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run migrate    # Run database migrations
npm test           # Run tests (not implemented yet)
```

### Database Commands

```bash
# Connect to database
psql -U postgres -d kharchasplit

# View tables
\dt

# View table structure
\d users

# Query examples
SELECT * FROM users;
SELECT * FROM groups WHERE created_by = 'user_id';
```

---

## 🚀 Deployment

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create kharchasplit-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t kharchasplit-api .
docker run -p 3000:3000 kharchasplit-api
```

---

## 🧪 Testing

### Manual Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","name":"Test User"}'

# Get user (with auth)
curl -X GET http://localhost:3000/api/v1/users/{id} \
  -H "Authorization: Bearer {token}"
```

### Postman Collection

Import the API endpoints into Postman for easy testing.

---

## 🔒 Security

- ✅ JWT tokens with expiration
- ✅ Bcrypt password hashing
- ✅ SQL injection protection (parameterized queries)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Input validation
- ⚠️ Use HTTPS in production
- ⚠️ Rotate JWT secrets regularly
- ⚠️ Enable OTP rate limiting

---

## 📝 License

MIT License - See LICENSE file for details

---

## 👥 Contributors

- Your Name - Initial work

---

## 📞 Support

- Documentation: See `BACKEND_SETUP_COMPLETE.md`
- Issues: GitHub Issues
- Email: support@kharchasplit.com

---

**Happy Coding!** 🚀
