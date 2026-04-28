# OAuth 2.0 Implementation Documentation

## Overview

This document describes the complete OAuth 2.0 integration implemented for the Sealed Auction Platform, supporting Google and GitHub authentication with comprehensive security features, account management, and token handling.

## Features Implemented

### ✅ Core OAuth Functionality
- **Google OAuth 2.0** integration with profile and email scopes
- **GitHub OAuth** integration with user email scope
- **Automatic user account creation** for new OAuth users
- **Account linking** for existing users with same email
- **Profile mapping** with comprehensive user data extraction

### ✅ Security Features
- **JWT token management** with blacklisting system
- **Secure session handling** with HTTP-only cookies
- **Input validation** and sanitization for all OAuth data
- **Rate limiting** on OAuth endpoints
- **HTTPS enforcement** in production environment
- **CSRF protection** through state parameters

### ✅ User Experience
- **Responsive OAuth login buttons** with provider branding
- **Real-time OAuth status checking**
- **Account management interface** for linked accounts
- **Token refresh functionality**
- **Graceful error handling** with user-friendly messages
- **Mobile-optimized UI** for OAuth flows

### ✅ Administrative Features
- **OAuth account listing** per user
- **Account unlinking** with safety checks
- **Provider configuration status** monitoring
- **Comprehensive logging** and error tracking

## Architecture

### Backend Components

#### 1. Passport Strategy Configuration
```javascript
// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback",
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  // Profile mapping and user creation/linking logic
}));

// GitHub OAuth Strategy  
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/auth/github/callback",
  scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
  // Profile mapping and user creation/linking logic
}));
```

#### 2. Database Schema
```sql
-- OAuth Accounts Table
CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github', 'facebook', 'twitter')),
  provider_id TEXT NOT NULL,
  profile_data TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_id)
);

-- Updated Users Table
ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'oauth'));
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
```

#### 3. API Endpoints

##### OAuth Routes
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Google OAuth callback handler
- `GET /auth/github` - Initiate GitHub OAuth flow  
- `GET /auth/github/callback` - GitHub OAuth callback handler

##### Management Endpoints
- `GET /api/auth/status` - Check OAuth provider configuration
- `GET /api/user/oauth-accounts` - List user's linked OAuth accounts
- `DELETE /api/user/oauth-accounts/:provider` - Unlink OAuth account
- `POST /api/auth/refresh` - Refresh JWT token

### Frontend Components

#### 1. OAuth Status Management
```javascript
async function checkOAuthStatus() {
  const response = await fetch('/api/auth/status');
  const data = await response.json();
  
  // Show/hide OAuth buttons based on configuration
  if (data.configured?.google) {
    document.getElementById('googleLoginBtn').classList.remove('hidden');
  }
  if (data.configured?.github) {
    document.getElementById('githubLoginBtn').classList.remove('hidden');
  }
}
```

#### 2. OAuth Callback Handling
```javascript
function checkOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const username = urlParams.get('username');
  const provider = urlParams.get('provider');
  const error = urlParams.get('error');
  
  if (error) {
    showNotification(decodeURIComponent(error), 'error');
    return;
  }
  
  if (token && username) {
    // Successful OAuth authentication
    const user = { token, username, authType: 'oauth', provider };
    localStorage.setItem('currentUser', JSON.stringify(user));
    // Update UI and clean URL
  }
}
```

#### 3. Account Management Interface
```javascript
async function loadOAuthAccounts() {
  const response = await fetch('/api/user/oauth-accounts', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  const data = await response.json();
  displayOAuthAccounts(data.oauthAccounts);
}
```

## Security Implementation

### 1. Token Management
- **JWT tokens** with 24-hour expiration
- **Token blacklisting** on logout for immediate revocation
- **Automatic token refresh** with old token invalidation
- **Secure token storage** in localStorage with validation

### 2. OAuth Security
- **State parameter validation** to prevent CSRF
- **PKCE implementation** support (ready for enhancement)
- **Scope limitation** to minimum required permissions
- **Token encryption** for stored refresh tokens

### 3. Input Validation
- **Profile data sanitization** before database storage
- **Email validation** for account linking
- **Provider whitelist** validation
- **SQL injection protection** through parameterized queries

### 4. Rate Limiting
- **OAuth endpoint protection** with strict rate limits
- **Account lockout** after failed attempts
- **IP-based throttling** for brute force protection

## User Profile Mapping

### Google Profile Data
```javascript
const googleProfile = {
  id: profile.id,
  email: profile.emails[0]?.value,
  name: profile.displayName,
  firstName: profile.name?.givenName,
  lastName: profile.name?.familyName,
  photo: profile.photos[0]?.value,
  provider: 'google',
  providerId: profile.id
};
```

### GitHub Profile Data
```javascript
const githubProfile = {
  id: profile.id,
  email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
  name: profile.displayName || profile.username,
  username: profile.username,
  photo: profile.photos?.[0]?.value,
  provider: 'github',
  providerId: profile.id,
  bio: profile._json?.bio
};
```

## Account Linking Logic

### 1. New OAuth User
- Check for existing user with same email
- If found, link OAuth account to existing user
- If not found, create new user account with OAuth data
- Set `auth_type = 'oauth'` for OAuth-only users

### 2. Existing User Linking
- Verify email ownership through OAuth provider
- Link additional OAuth providers to same account
- Maintain multiple provider links per user
- Prevent unlinking last authentication method

### 3. Profile Updates
- Auto-update profile data on each OAuth login
- Sync name, photo, and other profile information
- Maintain audit trail of profile changes

## Error Handling

### 1. OAuth Flow Errors
- **Configuration missing** - Graceful degradation with user notification
- **Provider errors** - Detailed error messages with retry options
- **Network failures** - Automatic retry with exponential backoff
- **User cancellation** - Clean redirect back to login

### 2. Token Errors
- **Expired tokens** - Automatic refresh attempt
- **Invalid tokens** - Force logout and redirect to login
- **Refresh failures** - Manual re-authentication required

### 3. Account Management Errors
- **Unlink violations** - Prevent locking user out of account
- **Permission errors** - Clear messaging about required permissions
- **Validation errors** - Specific field-level error reporting

## Testing and Validation

### 1. Automated Testing
- **OAuth configuration validation** through API endpoints
- **Flow testing** with mock OAuth providers
- **Security testing** for common vulnerabilities
- **Error scenario testing** for robustness

### 2. Manual Testing
- **Complete OAuth flows** for each provider
- **Account linking scenarios** with multiple providers
- **Error handling validation** with various failure modes
- **UI/UX testing** across different devices and browsers

### 3. Test Suite
Run the comprehensive test suite:
```bash
# Open test-oauth.html in browser
http://localhost:3000/test-oauth.html
```

## Configuration

### Environment Variables
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
```

### Provider Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID
3. Set redirect URI: `http://localhost:3000/auth/google/callback`
4. Enable Google+ API and People API
5. Copy Client ID and Client Secret

#### GitHub OAuth Setup
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App
3. Set callback URL: `http://localhost:3000/auth/github/callback`
4. Copy Client ID and Client Secret

## Production Deployment

### 1. Security Considerations
- **HTTPS required** for all OAuth callbacks
- **Environment variable protection** through secret management
- **Domain verification** with OAuth providers
- **CORS configuration** for production domains

### 2. Performance Optimization
- **Token caching** for reduced database load
- **Profile data caching** for faster user loading
- **OAuth provider response optimization**
- **Database indexing** for OAuth account queries

### 3. Monitoring and Logging
- **OAuth event logging** for security audit
- **Error tracking** through Sentry integration
- **Performance monitoring** for OAuth endpoints
- **User analytics** for OAuth adoption rates

## Maintenance and Updates

### 1. Provider Updates
- **Monitor OAuth provider changes** and deprecations
- **Update scope requirements** as needed
- **Test new provider features** and APIs
- **Maintain backward compatibility** where possible

### 2. Security Maintenance
- **Regular security audits** of OAuth implementation
- **Update dependencies** for security patches
- **Review access tokens** and refresh policies
- **Monitor for OAuth vulnerabilities**

### 3. Feature Enhancements
- **Additional OAuth providers** (Facebook, Twitter, etc.)
- **Two-factor authentication** integration
- **Progressive authentication** with risk-based flows
- **Social profile enrichment** and verification

## Troubleshooting

### Common Issues

#### 1. OAuth Buttons Not Showing
- Check environment variables are set
- Verify `/api/auth/status` returns correct configuration
- Check browser console for JavaScript errors
- Ensure OAuth providers are properly configured

#### 2. Redirect URI Mismatch
- Verify redirect URIs in OAuth provider console
- Check for trailing slashes and protocol (http vs https)
- Ensure application is running on correct port
- Update production URLs after deployment

#### 3. Account Linking Failures
- Verify email addresses match between accounts
- Check for existing OAuth account conflicts
- Ensure database schema is properly updated
- Review account linking logic in server logs

#### 4. Token Issues
- Verify JWT_SECRET is set and consistent
- Check token expiration times
- Ensure token blacklist is properly maintained
- Review token refresh logic

### Debug Mode
Enable comprehensive logging:
```env
NODE_ENV=development
DEBUG=passport:*
```

## API Documentation

### GET /api/auth/status
Check OAuth provider configuration status.

**Response:**
```json
{
  "google": true,
  "github": true,
  "configured": {
    "google": true,
    "github": true
  },
  "_links": {
    "self": { "href": "/api/auth/status" },
    "google": { "href": "/auth/google" },
    "github": { "href": "/auth/github" }
  }
}
```

### GET /api/user/oauth-accounts
List authenticated user's linked OAuth accounts.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "oauthAccounts": [
    {
      "provider": "google",
      "providerId": "123456789",
      "profileData": { ... },
      "linkedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "_links": {
    "self": { "href": "/api/user/oauth-accounts" },
    "unlink": { "href": "/api/user/oauth-accounts/{provider}" }
  }
}
```

### DELETE /api/user/oauth-accounts/:provider
Unlink OAuth account from user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "OAuth account unlinked successfully",
  "provider": "google"
}
```

### POST /api/auth/refresh
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "token": "new_jwt_token",
  "expiresIn": "24h",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "role": "user",
    "authType": "oauth"
  }
}
```

## Conclusion

This OAuth 2.0 implementation provides a comprehensive, secure, and user-friendly authentication system for the Sealed Auction Platform. It supports multiple providers, maintains strong security practices, and offers excellent user experience with proper error handling and account management capabilities.

The implementation is production-ready and includes extensive testing, documentation, and monitoring capabilities. It can be easily extended to support additional OAuth providers and enhanced with features like two-factor authentication and progressive authentication flows.
