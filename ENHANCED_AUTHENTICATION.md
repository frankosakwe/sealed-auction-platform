# Enhanced Authentication System Documentation

## Overview

This document describes the comprehensive enhanced authentication system implemented for the sealed-auction-platform, featuring JWT tokens, refresh token rotation, session management, multi-device support, and robust security measures.

## Security Features Implemented

### ✅ JWT Token Generation and Validation
- **Secure token generation** using RS256 algorithm with configurable secrets
- **24-hour access token expiration** for security
- **Token blacklisting** for immediate revocation
- **Comprehensive error handling** with appropriate HTTP status codes

### ✅ Password Hashing with Bcrypt
- **Bcrypt with salt rounds of 10** for secure password storage
- **Automatic hashing** on user registration and password changes
- **Secure comparison** during login verification

### ✅ Session Management
- **Database-backed sessions** for persistence across server restarts
- **Device fingerprinting** for session identification
- **Activity tracking** with timestamps for last activity
- **Session revocation** capabilities for individual or all sessions

### ✅ Refresh Token Rotation
- **Automatic token rotation** on each refresh request
- **7-day refresh token expiration** for extended sessions
- **Secure token hashing** for database storage
- **Immediate revocation** of old refresh tokens

### ✅ Multi-Device Support
- **Concurrent sessions** across multiple devices
- **Device information tracking** (browser, OS, IP address)
- **Per-device session management** with revocation capabilities
- **Session listing** for user visibility

### ✅ Security Headers
- **Helmet middleware** for comprehensive header security
- **CORS configuration** for cross-origin request handling
- **Content Security Policy** for XSS prevention

### ✅ Rate Limiting
- **Tiered rate limiting** for different endpoint types:
  - Authentication endpoints: 5 requests per 15 minutes
  - Bid operations: 30 requests per 15 minutes
  - Read operations: 100 requests per 15 minutes
  - Auction creation: 10 requests per hour
- **IP-based limiting** with configurable windows
- **Standardized error responses**

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
**Purpose**: User authentication with refresh token generation

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "id": "user-id",
  "userId": "user-id",
  "username": "username",
  "role": "user|admin|moderator",
  "token": "jwt-access-token",
  "expiresIn": "24h",
  "refreshToken": "refresh-token-string",
  "refreshTokenExpiresIn": "7d",
  "sessionId": "session-id",
  "deviceInfo": "Chrome on Windows",
  "_links": {
    "verify": { "href": "/api/auth/verify", "method": "GET" },
    "refresh": { "href": "/api/auth/refresh", "method": "POST" },
    "sessions": { "href": "/api/auth/sessions", "method": "GET" },
    "auctions": { "href": "/api/auctions", "method": "GET" }
  }
}
```

#### POST /api/auth/refresh
**Purpose**: Refresh access token with rotation

**Request Body**:
```json
{
  "refreshToken": "refresh-token-string",
  "sessionId": "session-id"
}
```

**Response**:
```json
{
  "token": "new-jwt-access-token",
  "refreshToken": "new-refresh-token-string",
  "expiresIn": "24h",
  "refreshTokenExpiresIn": "7d",
  "_links": {
    "verify": { "href": "/api/auth/verify", "method": "GET" },
    "sessions": { "href": "/api/auth/sessions", "method": "GET" },
    "logout": { "href": "/api/auth/logout", "method": "POST" }
  }
}
```

#### GET /api/auth/sessions
**Purpose**: List all active user sessions

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "sessions": [
    {
      "id": "session-id",
      "deviceInfo": "Chrome on Windows",
      "ipAddress": "192.168.1.100",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T12:00:00Z",
      "tokenCreatedAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-01T12:00:00Z",
      "expiresAt": "2024-01-08T00:00:00Z",
      "isActive": true
    }
  ],
  "totalSessions": 1,
  "_links": {
    "self": { "href": "/api/auth/sessions", "method": "GET" },
    "logout": { "href": "/api/auth/logout", "method": "POST" },
    "refresh": { "href": "/api/auth/refresh", "method": "POST" }
  }
}
```

#### DELETE /api/auth/sessions/:sessionId
**Purpose**: Revoke a specific session

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "message": "Session revoked successfully",
  "revokedSessionId": "session-id",
  "_links": {
    "sessions": { "href": "/api/auth/sessions", "method": "GET" }
  }
}
```

#### POST /api/auth/logout
**Purpose**: User logout with token revocation

**Headers**: `Authorization: Bearer <access-token>`

**Request Body** (optional):
```json
{
  "refreshToken": "refresh-token-string",
  "sessionId": "session-id",
  "logoutAll": false
}
```

**Response**:
```json
{
  "message": "Logged out successfully",
  "loggedOutFromAllDevices": false,
  "_links": {
    "login": { "href": "/api/auth/login", "method": "POST" }
  }
}
```

#### GET /api/auth/verify
**Purpose**: Verify access token validity

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "valid": true,
  "user": {
    "userId": "user-id",
    "username": "username"
  },
  "_links": {
    "self": { "href": "/api/auth/verify", "method": "GET" },
    "logout": { "href": "/api/auth/logout", "method": "POST" }
  }
}
```

## Database Schema

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_revoked INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### User Sessions Table
```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_id TEXT NOT NULL,
  device_fingerprint TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (refresh_token_id) REFERENCES refresh_tokens(id) ON DELETE CASCADE
);
```

## Security Best Practices

### Token Management
- **Short-lived access tokens** (24 hours) minimize exposure risk
- **Refresh token rotation** prevents token reuse attacks
- **Secure token hashing** in database prevents token leakage
- **Automatic cleanup** of expired tokens reduces database bloat

### Session Security
- **Device fingerprinting** prevents session hijacking
- **IP address tracking** for anomaly detection
- **Activity monitoring** for security auditing
- **Multi-device revocation** for compromised account scenarios

### Rate Limiting
- **Tiered limits** balance security with usability
- **Authentication endpoints** have strict limits to prevent brute force
- **IP-based tracking** prevents distributed attacks
- **Standardized responses** avoid information leakage

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key-here

# Session Configuration
SESSION_SECRET=your-session-secret-change-in-production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=3600000
```

## Usage Examples

### Complete Authentication Flow

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user123',
    password: 'securePassword123'
  })
});

const { token, refreshToken, sessionId } = await loginResponse.json();

// 2. Use access token for API calls
const auctionsResponse = await fetch('/api/auctions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 3. Refresh token when access token expires
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken,
    sessionId
  })
});

const { token: newToken, refreshToken: newRefreshToken } = await refreshResponse.json();

// 4. Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${newToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refreshToken: newRefreshToken,
    sessionId
  })
});
```

### Session Management

```javascript
// Get all active sessions
const sessionsResponse = await fetch('/api/auth/sessions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { sessions } = await sessionsResponse.json();

// Revoke a specific session
await fetch(`/api/auth/sessions/${sessionId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Logout from all devices
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    logoutAll: true
  })
});
```

## Testing

The system includes comprehensive test coverage in `test-authentication.js`:

```bash
# Run authentication tests
node test-authentication.js
```

Test coverage includes:
- User registration and login
- Token generation and verification
- Token refresh and rotation
- Session management
- Multi-device support
- Rate limiting
- Error handling
- Security validation

## Security Considerations

### Production Deployment
1. **Use strong, random secrets** for JWT and refresh tokens
2. **Enable HTTPS** to prevent token interception
3. **Configure proper CORS** for your domain
4. **Set secure cookie flags** if using cookies
5. **Implement monitoring** for authentication events

### Token Storage
- **Store refresh tokens securely** (httpOnly cookies recommended)
- **Implement token rotation** on client side
- **Handle token expiration** gracefully
- **Clear tokens on logout** and password change

### Monitoring and Auditing
- **Log authentication events** for security monitoring
- **Track failed login attempts** for breach detection
- **Monitor session patterns** for anomaly detection
- **Implement alerts** for suspicious activities

## Migration Notes

### From Basic Authentication
1. **Existing users** will need to re-login to get refresh tokens
2. **Client applications** must be updated to handle refresh tokens
3. **Token storage** strategy needs to be implemented
4. **Error handling** should account for new response formats

### Database Updates
The system automatically creates the necessary tables on startup. No manual database migration is required.

## Performance Considerations

### Token Storage
- **Hashed tokens** prevent token size issues
- **Automatic cleanup** maintains database performance
- **Indexed queries** ensure fast session lookups

### Rate Limiting
- **Memory-based storage** for optimal performance
- **Sliding windows** for accurate rate limiting
- **Configurable limits** for different environments

This enhanced authentication system provides enterprise-grade security while maintaining excellent usability and performance characteristics.
