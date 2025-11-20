# Backend Invite System Implementation Guide

## Overview
This document outlines the backend implementation required for the invite system that tracks invitations through PostgreSQL instead of Firebase.

---

## 🎯 Changes Made to Mobile App

### 1. **Phone Format Fallbacks Removed**
- ✅ [CreateNewGroupScreen.tsx:469-484](../src/screens/CreateNewGroupScreen.tsx#L469-L484) - Commented out fallback phone formats
- ✅ [AddMemberScreen.tsx:317-334](../src/screens/AddMemberScreen.tsx#L317-L334) - Commented out fallback phone formats
- **Impact**: App now only tries `+91XXXXXXXXXX` format. Backend must standardize phone numbers.

### 2. **Backend API Added**
- ✅ [inviteApi.ts](../src/services/api/inviteApi.ts) - New API service for invite management
- ✅ [userApi.ts:138-163](../src/services/api/userApi.ts#L138-L163) - Added `checkRegisteredUsers()` endpoint

### 3. **Invite Handlers Updated**
- ✅ [CreateNewGroupScreen.tsx:601-644](../src/screens/CreateNewGroupScreen.tsx#L601-L644) - Uses backend invite API
- ✅ [AddMemberScreen.tsx:478-523](../src/screens/AddMemberScreen.tsx#L478-L523) - Uses backend invite API

---

## 📊 Required Backend Implementation

### Database Schema

```sql
-- Users table (ensure phone numbers are normalized)
ALTER TABLE users
ADD CONSTRAINT phone_format_check
CHECK (phone_number ~ '^\+91[0-9]{10}$');

CREATE INDEX idx_users_phone ON users(phone_number);

-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_phone_number VARCHAR(15) NOT NULL,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),

  -- Context about the invite
  context JSONB DEFAULT '{}',

  -- Track who accepted (if applicable)
  accepted_by_user_id UUID REFERENCES users(id),

  -- Metadata for analytics
  metadata JSONB DEFAULT '{}',

  CONSTRAINT fk_invited_by FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_accepted_by FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_invitations_phone ON invitations(invited_phone_number);
CREATE INDEX idx_invitations_code ON invitations(invite_code);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_invited_by ON invitations(invited_by_user_id);
CREATE INDEX idx_invitations_expires ON invitations(expires_at) WHERE status = 'pending';

-- Referral rewards tracking (optional)
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inviter_reward_amount DECIMAL(10, 2) DEFAULT 0,
  invitee_reward_amount DECIMAL(10, 2) DEFAULT 0,
  rewarded_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_invitation FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CONSTRAINT fk_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(id),
  CONSTRAINT fk_invitee FOREIGN KEY (invitee_user_id) REFERENCES users(id)
);
```

---

## 🔌 Backend API Endpoints

### 1. **Check User Registration**

**Endpoint**: `POST /api/v1/users/check-registration`

**Request Body**:
```json
{
  "phoneNumbers": ["+919823053949", "+919876543210", "+919123456789"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "registered": [
      {
        "phoneNumber": "+919823053949",
        "userId": "uuid-here",
        "name": "Sandeep Chandekar",
        "email": "sandeep@example.com",
        "profileImage": "https://..."
      }
    ],
    "unregistered": ["+919876543210", "+919123456789"]
  }
}
```

**Implementation Notes**:
```javascript
// Node.js/Express example
router.post('/check-registration', authMiddleware, async (req, res) => {
  try {
    const { phoneNumbers } = req.body;

    // Validate input
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumbers must be a non-empty array'
      });
    }

    // Batch lookup (efficient)
    const users = await db.query(
      `SELECT phone_number, id as user_id, name, email, profile_image
       FROM users
       WHERE phone_number = ANY($1) AND is_active = true`,
      [phoneNumbers]
    );

    const registeredPhones = new Set(users.rows.map(u => u.phone_number));
    const unregistered = phoneNumbers.filter(p => !registeredPhones.has(p));

    res.json({
      success: true,
      data: {
        registered: users.rows.map(u => ({
          phoneNumber: u.phone_number,
          userId: u.user_id,
          name: u.name,
          email: u.email,
          profileImage: u.profile_image
        })),
        unregistered
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

---

### 2. **Create Invite**

**Endpoint**: `POST /api/v1/invites/create`

**Request Body**:
```json
{
  "phoneNumbers": ["+919876543210"],
  "context": {
    "groupId": "uuid-optional",
    "groupName": "Trip to Goa",
    "message": "Join my group!"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "invites": [
      {
        "phoneNumber": "+919876543210",
        "inviteCode": "KS-ABC123XYZ",
        "shareUrl": "https://kharchasplit.com/invite/KS-ABC123XYZ",
        "shareMessage": "Hi! 👋\n\nI'm using KharchaSplit to split expenses...\n\n🎁 Join using code: KS-ABC123XYZ\n\nDownload: https://kharchasplit.com/invite/KS-ABC123XYZ"
      }
    ]
  }
}
```

**Implementation**:
```javascript
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { phoneNumbers, context } = req.body;
    const userId = req.user.id; // From auth middleware

    // Generate unique invite codes
    const invites = [];

    for (const phone of phoneNumbers) {
      // Generate unique code
      const inviteCode = `KS-${generateRandomCode(11)}`; // KS-ABC123XYZ

      // Check if phone is already registered
      const existingUser = await db.query(
        'SELECT id FROM users WHERE phone_number = $1',
        [phone]
      );

      if (existingUser.rows.length > 0) {
        // Skip if user already registered
        continue;
      }

      // Create invitation
      const result = await db.query(
        `INSERT INTO invitations
         (invited_by_user_id, invited_phone_number, invite_code, context, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
         RETURNING id, invite_code`,
        [userId, phone, inviteCode, JSON.stringify(context || {})]
      );

      // Get inviter details
      const inviter = await db.query(
        'SELECT name, referral_code FROM users WHERE id = $1',
        [userId]
      );

      const shareUrl = `https://kharchasplit.com/invite/${inviteCode}`;
      const shareMessage = generateShareMessage(
        inviter.rows[0].name,
        inviter.rows[0].referral_code || inviteCode,
        shareUrl
      );

      invites.push({
        phoneNumber: phone,
        inviteCode,
        shareUrl,
        shareMessage
      });
    }

    res.json({
      success: true,
      data: { invites }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function
function generateShareMessage(inviterName, referralCode, shareUrl) {
  return `Hi! 👋\n\n${inviterName} invited you to join KharchaSplit - the easiest way to split expenses with friends and family!\n\n🎁 Join using referral code: ${referralCode}\n\n📱 Download now:\n${shareUrl}\n\nLet's split smarter together! 💰`;
}

function generateRandomCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

---

### 3. **Check Invite Status**

**Endpoint**: `GET /api/v1/invites/status?inviteCode=KS-ABC123XYZ`

**Response**:
```json
{
  "success": true,
  "data": {
    "inviteCode": "KS-ABC123XYZ",
    "status": "pending",
    "phoneNumber": "+919876543210",
    "invitedBy": {
      "userId": "uuid",
      "name": "Sandeep"
    },
    "invitedAt": "2025-01-20T10:30:00Z",
    "expiresAt": "2025-02-20T10:30:00Z",
    "context": {
      "groupId": "uuid",
      "groupName": "Trip to Goa"
    }
  }
}
```

---

### 4. **Accept Invite (During Registration/Login)**

**Endpoint**: `POST /api/v1/invites/accept`

**Request Body**:
```json
{
  "inviteCode": "KS-ABC123XYZ"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invite accepted successfully",
  "data": {
    "referralBonus": {
      "inviter": 100,
      "invitee": 50
    }
  }
}
```

**Implementation**:
```javascript
router.post('/accept', authMiddleware, async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const { inviteCode } = req.body;
    const userId = req.user.id;

    // Get invite details
    const invite = await client.query(
      `SELECT id, invited_by_user_id, invited_phone_number, status, expires_at
       FROM invitations
       WHERE invite_code = $1`,
      [inviteCode]
    );

    if (invite.rows.length === 0) {
      throw new Error('Invalid invite code');
    }

    const inviteData = invite.rows[0];

    // Check if expired
    if (new Date() > new Date(inviteData.expires_at)) {
      await client.query(
        'UPDATE invitations SET status = $1 WHERE id = $2',
        ['expired', inviteData.id]
      );
      throw new Error('Invite has expired');
    }

    // Check if already accepted
    if (inviteData.status === 'accepted') {
      throw new Error('Invite already accepted');
    }

    // Update invite status
    await client.query(
      `UPDATE invitations
       SET status = 'accepted',
           accepted_at = NOW(),
           accepted_by_user_id = $1
       WHERE id = $2`,
      [userId, inviteData.id]
    );

    // Optional: Add referral rewards
    const inviterReward = 100;
    const inviteeReward = 50;

    await client.query(
      `INSERT INTO referral_rewards
       (invitation_id, inviter_user_id, invitee_user_id,
        inviter_reward_amount, invitee_reward_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [inviteData.id, inviteData.invited_by_user_id, userId,
       inviterReward, inviteeReward]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Invite accepted successfully',
      data: {
        referralBonus: {
          inviter: inviterReward,
          invitee: inviteeReward
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    client.release();
  }
});
```

---

### 5. **Get My Invites**

**Endpoint**: `GET /api/v1/invites/my-invites`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalInvites": 15,
    "acceptedInvites": 8,
    "pendingInvites": 5,
    "expiredInvites": 2,
    "invites": [
      {
        "id": "uuid",
        "phoneNumber": "+919876543210",
        "inviteCode": "KS-ABC123XYZ",
        "status": "accepted",
        "invitedAt": "2025-01-15T10:00:00Z",
        "acceptedAt": "2025-01-16T08:30:00Z"
      }
    ]
  }
}
```

---

## 🔧 Phone Number Normalization

### Migration Script

```sql
-- Normalize existing phone numbers to +91XXXXXXXXXX format
UPDATE users
SET phone_number =
  CASE
    -- If starts with +91 and is 13 chars, keep as is
    WHEN phone_number ~ '^\+91[0-9]{10}$' THEN phone_number

    -- If starts with 91 (no +), add +
    WHEN phone_number ~ '^91[0-9]{10}$' THEN '+' || phone_number

    -- If 10 digits only, add +91
    WHEN phone_number ~ '^[0-9]{10}$' THEN '+91' || phone_number

    -- If starts with 0 (old format), remove 0 and add +91
    WHEN phone_number ~ '^0[0-9]{10}$' THEN '+91' || SUBSTRING(phone_number FROM 2)

    ELSE phone_number
  END
WHERE phone_number IS NOT NULL;

-- Verify all are in correct format
SELECT phone_number
FROM users
WHERE phone_number !~ '^\+91[0-9]{10}$';
```

---

## 📱 Mobile App Integration

### Registration Flow with Invite

Update [OTPVerificationScreen.tsx](../src/screens/OTPVerificationScreen.tsx) to check for invite code:

```typescript
// After OTP verification and before navigation
const handleOTPVerified = async () => {
  try {
    // Check if there's an invite code in deep link or params
    const inviteCode = route.params?.inviteCode;

    if (inviteCode) {
      // Verify invite is valid
      const inviteStatus = await inviteApi.checkInviteStatus(inviteCode);

      if (inviteStatus.success && inviteStatus.data.status === 'pending') {
        // Store invite code to accept after registration
        await AsyncStorage.setItem('pendingInviteCode', inviteCode);
      }
    }

    // Continue with normal flow...
  } catch (error) {
    // Log but don't block registration
    console.error('Error checking invite:', error);
  }
};
```

Update [ProfileSetupScreen.tsx](../src/screens/ProfileSetupScreen.tsx) to accept invite after registration:

```typescript
// After successful profile creation
const handleProfileCreated = async () => {
  try {
    // Check for pending invite
    const pendingInvite = await AsyncStorage.getItem('pendingInviteCode');

    if (pendingInvite) {
      try {
        await inviteApi.acceptInvite(pendingInvite);
        await AsyncStorage.removeItem('pendingInviteCode');
        console.log('Invite accepted successfully');
      } catch (error) {
        console.error('Error accepting invite:', error);
      }
    }

    // Navigate to app...
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🎯 Testing Checklist

### Backend Tests

- [ ] Create invite for unregistered phone number
- [ ] Create invite for already registered phone number (should skip)
- [ ] Accept valid invite code
- [ ] Try to accept expired invite (should fail)
- [ ] Try to accept already accepted invite (should fail)
- [ ] Check registered users with bulk phone numbers (test with 100+ numbers)
- [ ] Verify phone number normalization
- [ ] Test referral rewards creation
- [ ] Get my invites with pagination

### Mobile App Tests

- [ ] Send invite from CreateGroupScreen
- [ ] Send invite from AddMemberScreen
- [ ] Verify invite is logged in backend
- [ ] Check that only `+91XXXXXXXXXX` format is used
- [ ] Verify Share dialog shows correct message
- [ ] Test registration with invite code
- [ ] Verify invite is marked as accepted after registration

---

## 📊 Analytics & Monitoring

### Key Metrics to Track

1. **Invite Metrics**:
   - Total invites sent
   - Invite acceptance rate
   - Average time to accept
   - Expired invites percentage

2. **User Growth**:
   - New users from invites
   - Viral coefficient (invites per user)
   - Most active inviters

3. **Performance**:
   - API response times
   - Database query performance
   - Cache hit rates

### Sample Analytics Queries

```sql
-- Invite acceptance rate
SELECT
  COUNT(*) FILTER (WHERE status = 'accepted') * 100.0 / COUNT(*) as acceptance_rate,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'expired') as expired
FROM invitations;

-- Top inviters
SELECT
  u.name,
  u.phone_number,
  COUNT(i.id) as total_invites,
  COUNT(*) FILTER (WHERE i.status = 'accepted') as accepted_invites
FROM users u
JOIN invitations i ON u.id = i.invited_by_user_id
GROUP BY u.id
ORDER BY accepted_invites DESC
LIMIT 10;

-- Average time to accept
SELECT
  AVG(EXTRACT(EPOCH FROM (accepted_at - invited_at)) / 3600) as avg_hours_to_accept
FROM invitations
WHERE status = 'accepted';
```

---

## 🚀 Next Steps

1. ✅ Implement all backend endpoints
2. ✅ Add database migration scripts
3. ✅ Update registration flow to handle invite codes
4. ✅ Test end-to-end invite flow
5. ✅ Add analytics dashboard for invite metrics
6. ✅ Implement deep linking for invite URLs
7. ✅ Add email/SMS notifications for invites (optional)

---

## 📞 Support

For questions or issues with the invite system implementation, please refer to:
- [Backend API Documentation](./API_DOCUMENTATION.md)
- [Database Schema Guide](./DATABASE_SETUP.md)
- GitHub Issues: https://github.com/your-repo/issues
