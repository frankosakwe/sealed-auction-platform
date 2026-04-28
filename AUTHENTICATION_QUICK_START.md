# Enhanced Authentication System - Quick Start Guide

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and update the secrets:
```bash
cp .env.example .env
```

Update the following variables in `.env`:
```env
# Generate secure random secrets
JWT_SECRET=your-super-secure-jwt-secret-here
REFRESH_TOKEN_SECRET=your-super-secure-refresh-token-secret-here
SESSION_SECRET=your-super-secure-session-secret-here

# Database
DATABASE_PATH=./auctions.db

# Security
NODE_ENV=development  # Use 'production' in production
PORT=3001
```

### 3. Start the Server
```bash
npm start
```

Or for development:
```bash
npm run dev
```

### 4. Test the Implementation
```bash
node test-authentication.js
```

## 🔐 Authentication Flow

### 1. User Registration
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePassword123!"
  }'
```

### 2. User Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePassword123!"
  }'
```

**Response includes:**
- Access token (24h expiry)
- Refresh token (7d expiry)
- Session ID
- Device information

### 3. Access Protected Endpoint
```bash
curl -X GET http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Refresh Access Token
```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN",
    "sessionId": "YOUR_SESSION_ID"
  }'
```

### 5. View Active Sessions
```bash
curl -X GET http://localhost:3001/api/auth/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6. Logout
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN",
    "sessionId": "YOUR_SESSION_ID"
  }'
```

## 📱 Multi-Device Support

The system supports concurrent sessions across multiple devices:

### Login from Multiple Devices
Each login creates a new session with unique refresh token.

### View All Sessions
```bash
curl -X GET http://localhost:3001/api/auth/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Revoke Specific Session
```bash
curl -X DELETE http://localhost:3001/api/auth/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Logout from All Devices
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logoutAll": true
  }'
```

## 🔒 Security Features

### Rate Limiting
- **Authentication**: 5 attempts per 15 minutes
- **API calls**: 100 requests per 15 minutes
- **Bid operations**: 30 requests per 15 minutes
- **Auction creation**: 10 requests per hour

### Token Security
- **Access tokens**: 24-hour expiry
- **Refresh tokens**: 7-day expiry with rotation
- **Token blacklisting** on logout
- **Secure token hashing** in database

### Session Management
- **Device fingerprinting** for session identification
- **IP address tracking** for security
- **Activity monitoring** with timestamps
- **Automatic cleanup** of expired sessions

## 🛠️ Implementation Checklist

### ✅ Completed Features
- [x] JWT token generation and validation
- [x] Password hashing with bcrypt
- [x] Session management
- [x] Refresh token rotation
- [x] Multi-device support
- [x] Security headers (helmet)
- [x] Rate limiting
- [x] Token blacklisting
- [x] Device fingerprinting
- [x] Automatic cleanup jobs

### 🔧 Configuration Options

#### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your-jwt-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Session Configuration
SESSION_SECRET=your-session-secret

# Rate Limiting
AUTH_RATE_LIMIT_MAX=5
AUTH_RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Security
NODE_ENV=development
PORT=3001
```

#### Token Expiration
- **Access Token**: 24 hours (configurable)
- **Refresh Token**: 7 days (configurable)
- **Session Cleanup**: Every hour

## 🧪 Testing

### Run All Tests
```bash
node test-authentication.js
```

### Test Coverage
- [x] User registration
- [x] User login
- [x] Token verification
- [x] Token refresh
- [x] Session management
- [x] Multi-device support
- [x] Rate limiting
- [x] Error handling
- [x] Security validation

### Manual Testing
Use the curl commands above or the provided test script.

## 📊 API Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/users` | Register user | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/refresh` | Refresh token | No |
| GET | `/api/auth/verify` | Verify token | Yes |
| GET | `/api/auth/sessions` | List sessions | Yes |
| DELETE | `/api/auth/sessions/:id` | Revoke session | Yes |
| POST | `/api/auth/logout` | Logout | Yes |

## 🔍 Monitoring

### Security Logs
The system logs all authentication events:
- Login attempts (success/failure)
- Token refresh events
- Session creation/revocation
- Rate limiting triggers

### Database Tables
- `users` - User accounts
- `refresh_tokens` - Refresh token storage
- `user_sessions` - Session management
- `password_reset_tokens` - Password reset functionality

## 🚨 Security Best Practices

### Production Deployment
1. **Use HTTPS** for all API calls
2. **Generate strong secrets** for all tokens
3. **Set NODE_ENV=production**
4. **Configure proper CORS** for your domain
5. **Monitor authentication logs**

### Client-Side Implementation
1. **Store refresh tokens securely** (httpOnly cookies recommended)
2. **Implement automatic token refresh**
3. **Handle token expiration gracefully**
4. **Clear tokens on logout**

### Security Monitoring
1. **Monitor failed login attempts**
2. **Track session patterns**
3. **Implement alerts for suspicious activity**
4. **Regular security audits**

## 📝 Next Steps

1. **Test the implementation** using the provided test script
2. **Update client applications** to handle refresh tokens
3. **Configure production environment variables**
4. **Set up monitoring and alerting**
5. **Implement additional security measures** as needed

## 🆘 Troubleshooting

### Common Issues

#### Server Won't Start
- Check Node.js installation: `node --version`
- Install dependencies: `npm install`
- Check environment variables in `.env`

#### Token Validation Fails
- Verify JWT_SECRET is set
- Check token expiration
- Ensure proper Authorization header format

#### Rate Limiting Too Strict
- Adjust rate limit values in `.env`
- Check for stuck IP addresses
- Monitor rate limit logs

#### Database Issues
- Check database file permissions
- Verify SQLite is working
- Check database schema

### Debug Mode
Set `NODE_ENV=development` for detailed error logs.

---

**🎉 Your enhanced authentication system is now ready!** 

The implementation includes all requested security features and follows industry best practices for authentication and session management.
