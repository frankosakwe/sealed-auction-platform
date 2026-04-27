const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const DatabaseSecurityLayer = require('./utils/database-security');

class AuctionDatabase {
  constructor(dbPath = './auctions.db') {
    this.dbPath = path.resolve(__dirname, dbPath);
    this.db = new Database(this.dbPath);
    this.securityLayer = new DatabaseSecurityLayer(this.db);
    this.initializeSchema();
  }

  initializeSchema() {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        hashed_password TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'moderator')),
        failed_login_attempts INTEGER DEFAULT 0,
        last_failed_login DATETIME,
        locked_until DATETIME,
        is_active INTEGER DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create password reset tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create auctions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auctions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        starting_bid REAL NOT NULL,
        current_highest_bid REAL DEFAULT 0,
        end_time DATETIME NOT NULL,
        creator_id TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'cancelled')),
        winner_id TEXT,
        winning_bid_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id),
        FOREIGN KEY (winner_id) REFERENCES users(id)
      )
    `);

    // Create bids table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bids (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL,
        bidder_id TEXT NOT NULL,
        amount REAL NOT NULL,
        encrypted_bid TEXT NOT NULL,
        encrypted_iv TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        revealed INTEGER DEFAULT 0,
        FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
        FOREIGN KEY (bidder_id) REFERENCES users(id)
      )
    `);

    // Create admin-related tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error', 'critical')),
        message TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        endpoint TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS revenue_tracking (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('auction_fee', 'commission', 'refund')),
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
        transaction_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (auction_id) REFERENCES auctions(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        is_public INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('user', 'auction', 'config', 'system')),
        target_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL CHECK(alert_type IN ('suspicious_login', 'failed_attempts', 'unusual_activity', 'security_breach')),
        severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
        message TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        details TEXT,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'false_positive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id)
      )
    `);

    // Create social sharing analytics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_shares (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK(platform IN ('twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'email', 'copy_link')),
        share_url TEXT NOT NULL,
        custom_message TEXT,
        image_generated INTEGER DEFAULT 0,
        user_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (auction_id) REFERENCES auctions(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create share engagement tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS share_engagement (
        id TEXT PRIMARY KEY,
        share_id TEXT NOT NULL,
        engagement_type TEXT NOT NULL CHECK(engagement_type IN ('click', 'view', 'conversion')),
        referrer_url TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES social_shares(id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
      CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
      CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
      CREATE INDEX IF NOT EXISTS idx_bids_bidder_id ON bids(bidder_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
      CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_revenue_tracking_status ON revenue_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_revenue_tracking_created_at ON revenue_tracking(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_social_shares_auction_id ON social_shares(auction_id);
      CREATE INDEX IF NOT EXISTS idx_social_shares_platform ON social_shares(platform);
      CREATE INDEX IF NOT EXISTS idx_social_shares_created_at ON social_shares(created_at);
      CREATE INDEX IF NOT EXISTS idx_share_engagement_share_id ON share_engagement(share_id);
      CREATE INDEX IF NOT EXISTS idx_share_engagement_type ON share_engagement(engagement_type);
    `);
  }

  // User operations
  createUser(id, username, password, email = null) {
    // Validate inputs
    const validation = this.securityLayer.validateInputs({ id, username, password, email });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = this.securityLayer.prepare(`
      INSERT INTO users (id, username, email, hashed_password)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(id, username, email, hashedPassword);
  }

  getUserByUsername(username) {
    const validation = this.securityLayer.validateInput(username);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid username format:', username);
      return null;
    }
    
    const stmt = this.securityLayer.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(validation.sanitized);
  }

  getUserById(id) {
    const validation = this.securityLayer.validateInput(id);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid user ID format:', id);
      return null;
    }
    
    const stmt = this.securityLayer.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(validation.sanitized);
  }

  // Account lockout methods
  incrementFailedLoginAttempts(username) {
    const validation = this.securityLayer.validateInput(username);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid username format:', username);
      return null;
    }

    const now = new Date().toISOString();
    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1,
          last_failed_login = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);
    return stmt.run(now, validation.sanitized);
  }

  lockAccount(username, lockDurationMinutes = 30) {
    const validation = this.securityLayer.validateInput(username);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid username format:', username);
      return null;
    }

    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDurationMinutes);
    
    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET locked_until = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);
    return stmt.run(lockedUntil.toISOString(), validation.sanitized);
  }

  resetFailedLoginAttempts(username) {
    const validation = this.securityLayer.validateInput(username);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid username format:', username);
      return null;
    }

    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);
    return stmt.run(validation.sanitized);
  }

  isAccountLocked(username) {
    const validation = this.securityLayer.validateInput(username);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid username format:', username);
      return false;
    }

    const stmt = this.securityLayer.prepare(`
      SELECT locked_until FROM users WHERE username = ?
    `);
    const result = stmt.get(validation.sanitized);
    
    if (!result || !result.locked_until) {
      return false;
    }

    const lockedUntil = new Date(result.locked_until);
    const now = new Date();
    
    // If lock has expired, reset it
    if (lockedUntil <= now) {
      this.resetFailedLoginAttempts(username);
      return false;
    }

    return true;
  }

  resetExpiredLockouts() {
    const now = new Date().toISOString();
    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE locked_until IS NOT NULL AND locked_until <= ?
    `);
    return stmt.run(now);
  }

  // Auction operations
  createAuction(auction) {
    // Validate auction data
    const validation = this.securityLayer.validateInputs({
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingBid: auction.startingBid,
      endTime: auction.endTime,
      creator: auction.creator
    });
    
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO auctions (id, title, description, starting_bid, current_highest_bid, end_time, creator_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.id,
      validation.sanitized.title,
      validation.sanitized.description || null,
      validation.sanitized.startingBid,
      validation.sanitized.startingBid,
      validation.sanitized.endTime,
      validation.sanitized.creator,
      auction.status
    );
  }

  getAuction(id) {
    const validation = this.securityLayer.validateInput(id);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid auction ID format:', id);
      return null;
    }
    
    const stmt = this.securityLayer.prepare('SELECT * FROM auctions WHERE id = ?');
    return stmt.get(validation.sanitized);
  }

  getAllAuctions() {
    const stmt = this.securityLayer.prepare('SELECT * FROM auctions ORDER BY created_at DESC');
    return stmt.all();
  }

  getActiveAuctions() {
    const stmt = this.securityLayer.prepare("SELECT * FROM auctions WHERE status = 'active' ORDER BY created_at DESC");
    return stmt.all();
  }

  getPaginatedAuctions(page = 1, limit = 10, status = null) {
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      throw new Error('Invalid page number');
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    const offset = (pageNum - 1) * limitNum;
    let query = 'SELECT * FROM auctions';
    let countQuery = 'SELECT COUNT(*) as total FROM auctions';
    
    if (status) {
      const statusValidation = this.securityLayer.validateInput(status);
      if (!statusValidation.valid) {
        throw new Error('Invalid status value');
      }
      query += " WHERE status = ?";
      countQuery += " WHERE status = ?";
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    
    const countStmt = this.securityLayer.prepare(countQuery);
    const auctionsStmt = this.securityLayer.prepare(query);
    
    const totalResult = status 
      ? countStmt.get(status) 
      : countStmt.get();
    
    const auctions = status 
      ? auctionsStmt.all(status, limitNum, offset) 
      : auctionsStmt.all(limitNum, offset);
    
    return {
      auctions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limitNum),
        hasMore: offset + auctions.length < totalResult.total
      }
    };
  }

  updateAuction(id, updates) {
    // Validate ID
    const idValidation = this.securityLayer.validateInput(id);
    if (!idValidation.valid) {
      throw new Error('Invalid auction ID');
    }
    
    // Validate update fields
    const validatedUpdates = {};
    const allowedFields = ['title', 'description', 'starting_bid', 'current_highest_bid', 'end_time', 'status'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        console.warn(`[SECURITY] Attempted to update disallowed field: ${key}`);
        continue;
      }
      
      const validation = this.securityLayer.validateInput(value);
      if (!validation.valid) {
        throw new Error(`Invalid value for field ${key}`);
      }
      validatedUpdates[key] = validation.sanitized;
    }
    
    if (Object.keys(validatedUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const fields = [];
    const values = [];
    
    Object.keys(validatedUpdates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(validatedUpdates[key]);
    });
    
    values.push(idValidation.sanitized);
    
    const stmt = this.securityLayer.prepare(`
      UPDATE auctions SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(...values);
  }

  closeAuction(id, winnerId, winningBidId) {
    // Validate all IDs
    const validations = this.securityLayer.validateInputs({
      id,
      winnerId: winnerId || null,
      winningBidId: winningBidId || null
    });
    
    if (!validations.valid) {
      throw new Error(validations.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE auctions 
      SET status = 'closed', winner_id = ?, winning_bid_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(
      validations.sanitized.winnerId,
      validations.sanitized.winningBidId,
      validations.sanitized.id
    );
  }

  // Bid operations
  createBid(bid) {
    // Validate bid data
    const validation = this.securityLayer.validateInputs({
      id: bid.id,
      auctionId: bid.auctionId,
      bidderId: bid.bidderId,
      amount: bid.amount
    });
    
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO bids (id, auction_id, bidder_id, amount, encrypted_bid, encrypted_iv)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.id,
      validation.sanitized.auctionId,
      validation.sanitized.bidderId,
      validation.sanitized.amount,
      bid.encryptedBid.encrypted,
      bid.encryptedBid.iv
    );
  }

  getBidsForAuction(auctionId) {
    const validation = this.securityLayer.validateInput(auctionId);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid auction ID format:', auctionId);
      return [];
    }
    
    const stmt = this.securityLayer.prepare('SELECT * FROM bids WHERE auction_id = ? ORDER BY amount DESC');
    return stmt.all(validation.sanitized);
  }

  getBidCount(auctionId) {
    const validation = this.securityLayer.validateInput(auctionId);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid auction ID format:', auctionId);
      return 0;
    }
    
    const stmt = this.securityLayer.prepare('SELECT COUNT(*) as count FROM bids WHERE auction_id = ?');
    const result = stmt.get(validation.sanitized);
    return result.count;
  }

  getHighestBid(auctionId) {
    const validation = this.securityLayer.validateInput(auctionId);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid auction ID format:', auctionId);
      return null;
    }
    
    const stmt = this.securityLayer.prepare('SELECT MAX(amount) as highest FROM bids WHERE auction_id = ?');
    const result = stmt.get(validation.sanitized);
    return result.highest;
  }

  // Password reset operations
  getUserByEmail(email) {
    const validation = this.securityLayer.validateInput(email);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid email format:', email);
      return null;
    }
    
    const stmt = this.securityLayer.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(validation.sanitized);
  }

  createPasswordResetToken(userId, token, expiresAt) {
    const validation = this.securityLayer.validateInputs({ userId, token, expiresAt });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    // Invalidate any existing tokens for this user
    this.invalidateUserResetTokens(userId);
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(crypto.randomUUID(), validation.sanitized.userId, validation.sanitized.token, validation.sanitized.expiresAt);
  }

  getValidResetToken(token) {
    const validation = this.securityLayer.validateInput(token);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid token format:', token);
      return null;
    }
    
    const stmt = this.securityLayer.prepare(`
      SELECT * FROM password_reset_tokens 
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `);
    return stmt.get(validation.sanitized);
  }

  invalidateResetToken(token) {
    const validation = this.securityLayer.validateInput(token);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid token format:', token);
      return false;
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE password_reset_tokens SET used = 1 WHERE token = ?
    `);
    const result = stmt.run(validation.sanitized);
    return result.changes > 0;
  }

  invalidateUserResetTokens(userId) {
    const validation = this.securityLayer.validateInput(userId);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid user ID format:', userId);
      return false;
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0
    `);
    const result = stmt.run(validation.sanitized);
    return result.changes > 0;
  }

  updateUserPassword(userId, newPassword) {
    const validation = this.securityLayer.validateInputs({ userId, newPassword });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const stmt = this.securityLayer.prepare(`
      UPDATE users SET hashed_password = ?, updated_at = datetime('now') WHERE id = ?
    `);
    return stmt.run(hashedPassword, validation.sanitized.userId);
  }

  // Cleanup expired tokens
  cleanupExpiredTokens() {
    const stmt = this.securityLayer.prepare(`
      DELETE FROM password_reset_tokens WHERE expires_at <= datetime('now')
    `);
    return stmt.run();
  }

  // Admin methods
  updateUserRole(userId, role) {
    const validation = this.securityLayer.validateInputs({ userId, role });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?
    `);
    return stmt.run(validation.sanitized.role, validation.sanitized.userId);
  }

  updateUserStatus(userId, isActive) {
    const validation = this.securityLayer.validateInputs({ userId, isActive });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?
    `);
    return stmt.run(validation.sanitized.isActive ? 1 : 0, validation.sanitized.userId);
  }

  getAllUsers(limit = 50, offset = 0) {
    const stmt = this.securityLayer.prepare(`
      SELECT id, username, email, role, failed_login_attempts, locked_until, 
             is_active, email_verified, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getUserStats() {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'moderator' THEN 1 END) as moderator_count,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users,
        COUNT(CASE WHEN locked_until > datetime('now') THEN 1 END) as locked_users
      FROM users
    `);
    return stmt.get();
  }

  getAuctionStats() {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_auctions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_auctions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_auctions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_auctions,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN current_highest_bid ELSE 0 END), 0) as total_revenue
      FROM auctions
    `);
    return stmt.get();
  }

  getRevenueStats(days = 30) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        transaction_type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount
      FROM revenue_tracking 
      WHERE created_at >= datetime('now', '-${days} days')
        AND status = 'completed'
      GROUP BY transaction_type
    `);
    return stmt.all();
  }

  createAuditLog(adminId, action, targetType, targetId, oldValues = null, newValues = null, ipAddress = null, userAgent = null) {
    const validation = this.securityLayer.validateInputs({ adminId, action, targetType, targetId });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO audit_logs (admin_id, action, target_type, target_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.adminId,
      validation.sanitized.action,
      validation.sanitized.targetType,
      validation.sanitized.targetId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    );
  }

  getAuditLogs(limit = 100, offset = 0) {
    const stmt = this.securityLayer.prepare(`
      SELECT al.*, u.username as admin_username
      FROM audit_logs al
      JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  createSecurityAlert(alertType, severity, message, userId = null, ipAddress = null, details = null) {
    const validation = this.securityLayer.validateInputs({ alertType, severity, message, userId });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO security_alerts (alert_type, severity, message, user_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.alertType,
      validation.sanitized.severity,
      validation.sanitized.message,
      validation.sanitized.userId,
      ipAddress,
      details ? JSON.stringify(details) : null
    );
  }

  getSecurityAlerts(status = null, limit = 50) {
    let query = `
      SELECT sa.*, u.username as user_username
      FROM security_alerts sa
      LEFT JOIN users u ON sa.user_id = u.id
    `;
    let params = [];
    
    if (status) {
      query += ' WHERE sa.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY sa.created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  updateSecurityAlertStatus(alertId, status, resolvedBy = null) {
    const validation = this.securityLayer.validateInputs({ alertId, status, resolvedBy });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE security_alerts 
      SET status = ?, resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `);
    return stmt.run(validation.sanitized.status, validation.sanitized.resolvedBy, validation.sanitized.alertId);
  }

  createSystemConfig(key, value, description = null, category = 'general', isPublic = 0) {
    const validation = this.securityLayer.validateInputs({ key, value, description, category });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO system_config (key, value, description, category, is_public)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.key,
      validation.sanitized.value,
      validation.sanitized.description,
      validation.sanitized.category,
      isPublic ? 1 : 0
    );
  }

  updateSystemConfig(key, value) {
    const validation = this.securityLayer.validateInputs({ key, value });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE system_config 
      SET value = ?, updated_at = datetime('now') 
      WHERE key = ?
    `);
    return stmt.run(validation.sanitized.value, validation.sanitized.key);
  }

  getSystemConfig(category = null, isPublic = null) {
    let query = 'SELECT * FROM system_config';
    let params = [];
    let conditions = [];
    
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    
    if (isPublic !== null) {
      conditions.push('is_public = ?');
      params.push(isPublic ? 1 : 0);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY category, key';
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  createSystemLog(level, message, userId = null, ipAddress = null, userAgent = null, endpoint = null) {
    const validation = this.securityLayer.validateInputs({ level, message, userId });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO system_logs (level, message, user_id, ip_address, user_agent, endpoint)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.level,
      validation.sanitized.message,
      validation.sanitized.userId,
      ipAddress,
      userAgent,
      endpoint
    );
  }

  getSystemLogs(level = null, limit = 100) {
    let query = `
      SELECT sl.*, u.username as user_username
      FROM system_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
    `;
    let params = [];
    
    if (level) {
      query += ' WHERE sl.level = ?';
      params.push(level);
    }
    
    query += ' ORDER BY sl.created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  trackRevenue(auctionId, transactionType, amount, currency = 'USD', transactionHash = null) {
    const validation = this.securityLayer.validateInputs({ auctionId, transactionType, amount });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    const stmt = this.securityLayer.prepare(`
      INSERT INTO revenue_tracking (auction_id, transaction_type, amount, currency, transaction_hash)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.auctionId,
      validation.sanitized.transactionType,
      validation.sanitized.amount,
      currency,
      transactionHash
    );
  }

  getRevenueSummary(days = 30) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as daily_revenue,
        COUNT(*) as transaction_count
      FROM revenue_tracking 
      WHERE created_at >= datetime('now', '-${days} days')
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    return stmt.all();
  }

  // Additional admin methods
  getAuctionsByStatus(status, limit = 50, offset = 0) {
    const validation = this.securityLayer.validateInputs({ status, limit, offset });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      SELECT a.*, u.username as creator_username
      FROM auctions a
      JOIN users u ON a.creator_id = u.id
      WHERE a.status = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(validation.sanitized.status, validation.sanitized.limit, validation.sanitized.offset);
  }

  getAllAuctions(limit = 50, offset = 0) {
    const validation = this.securityLayer.validateInputs({ limit, offset });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      SELECT a.*, u.username as creator_username
      FROM auctions a
      JOIN users u ON a.creator_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(validation.sanitized.limit, validation.sanitized.offset);
  }

  updateAuctionStatus(auctionId, status) {
    const validation = this.securityLayer.validateInputs({ auctionId, status });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      UPDATE auctions 
      SET status = ?, updated_at = datetime('now') 
      WHERE id = ?
    `);
    return stmt.run(validation.sanitized.status, validation.sanitized.auctionId);
  }

  getAuctionById(auctionId) {
    const validation = this.securityLayer.validateInput(auctionId);
    if (!validation.valid) {
      console.warn('[SECURITY] Invalid auction ID format:', auctionId);
      return null;
    }

    const stmt = this.securityLayer.prepare(`
      SELECT a.*, u.username as creator_username
      FROM auctions a
      JOIN users u ON a.creator_id = u.id
      WHERE a.id = ?
    `);
    return stmt.get(validation.sanitized);
  }

  getRevenueTransactions(limit = 50, offset = 0, status = null) {
    let query = `
      SELECT rt.*, a.title as auction_title
      FROM revenue_tracking rt
      JOIN auctions a ON rt.auction_id = a.id
    `;
    let params = [];
    let conditions = [];

    if (status) {
      conditions.push('rt.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY rt.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  getActiveAuctions() {
    const stmt = this.securityLayer.prepare(`
      SELECT * FROM auctions 
      WHERE status = 'active' AND end_time > datetime('now')
      ORDER BY end_time ASC
    `);
    return stmt.all();
  }

  closeAuction(auctionId, winnerId, winningBidId) {
    const validation = this.securityLayer.validateInputs({ auctionId, winnerId, winningBidId });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      UPDATE auctions 
      SET status = 'closed', winner_id = ?, winning_bid_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    return stmt.run(
      validation.sanitized.winnerId,
      validation.sanitized.winningBidId,
      validation.sanitized.auctionId
    );
  }

  // Social sharing methods
  createSocialShare(auctionId, platform, shareUrl, customMessage = null, imageGenerated = false, userId = null, ipAddress = null, userAgent = null) {
    const validation = this.securityLayer.validateInputs({ auctionId, platform, shareUrl, customMessage });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      INSERT INTO social_shares (auction_id, platform, share_url, custom_message, image_generated, user_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.auctionId,
      validation.sanitized.platform,
      validation.sanitized.shareUrl,
      validation.sanitized.customMessage,
      imageGenerated ? 1 : 0,
      userId,
      ipAddress,
      userAgent
    );
  }

  trackShareEngagement(shareId, engagementType, referrerUrl = null, ipAddress = null, userAgent = null) {
    const validation = this.securityLayer.validateInputs({ shareId, engagementType, referrerUrl });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const stmt = this.securityLayer.prepare(`
      INSERT INTO share_engagement (share_id, engagement_type, referrer_url, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      validation.sanitized.shareId,
      validation.sanitized.engagementType,
      validation.sanitized.referrerUrl,
      ipAddress,
      userAgent
    );
  }

  getShareStats(auctionId = null, days = 30) {
    let query = `
      SELECT 
        platform,
        COUNT(*) as total_shares,
        COUNT(CASE WHEN image_generated = 1 THEN 1 END) as image_shares,
        COUNT(DISTINCT user_id) as unique_users
      FROM social_shares 
      WHERE created_at >= datetime('now', '-${days} days')
    `;
    let params = [];

    if (auctionId) {
      query += ' AND auction_id = ?';
      params.push(auctionId);
    }

    query += ' GROUP BY platform ORDER BY total_shares DESC';

    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  getEngagementStats(shareId = null, days = 30) {
    let query = `
      SELECT 
        se.engagement_type,
        COUNT(*) as count,
        COUNT(DISTINCT se.ip_address) as unique_ips
      FROM share_engagement se
      JOIN social_shares ss ON se.share_id = ss.id
      WHERE se.created_at >= datetime('now', '-${days} days')
    `;
    let params = [];

    if (shareId) {
      query += ' AND se.share_id = ?';
      params.push(shareId);
    }

    query += ' GROUP BY se.engagement_type ORDER BY count DESC';

    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }

  getTopSharedAuctions(limit = 10, days = 30) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        a.id,
        a.title,
        COUNT(ss.id) as share_count,
        COUNT(DISTINCT ss.user_id) as unique_sharers,
        COUNT(se.id) as engagement_count
      FROM auctions a
      LEFT JOIN social_shares ss ON a.id = ss.auction_id
      LEFT JOIN share_engagement se ON ss.id = se.share_id
      WHERE ss.created_at >= datetime('now', '-${days} days') OR ss.created_at IS NULL
      GROUP BY a.id, a.title
      HAVING share_count > 0
      ORDER BY share_count DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  getShareAnalytics(days = 30) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        DATE(ss.created_at) as date,
        ss.platform,
        COUNT(ss.id) as shares,
        COUNT(DISTINCT ss.user_id) as unique_users,
        COUNT(se.id) as engagements
      FROM social_shares ss
      LEFT JOIN share_engagement se ON ss.id = se.share_id
      WHERE ss.created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(ss.created_at), ss.platform
      ORDER BY date DESC, ss.platform
    `);
    return stmt.all();
  }

  // Admin Dashboard Methods
  
  // User Management
  getAllUsers(page = 1, limit = 20, filters = {}) {
    let query = `
      SELECT id, username, email, role, failed_login_attempts, last_failed_login, 
             locked_until, is_active, email_verified, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.role) {
      query += ` AND role = ?`;
      params.push(filters.role);
    }
    
    if (filters.status) {
      query += ` AND is_active = ?`;
      params.push(filters.status === 'active' ? 1 : 0);
    }
    
    if (filters.search) {
      query += ` AND (username LIKE ? OR email LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const stmt = this.securityLayer.prepare(query);
    const users = stmt.all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countStmt = this.securityLayer.prepare(countQuery);
    const total = countStmt.get(...params.slice(0, -2)).count;
    
    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  updateUserRole(userId, newRole, adminId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const oldRole = user.role;
    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(newRole, userId);
    
    if (result.changes > 0) {
      this.logAuditAction(adminId, 'update_role', 'user', userId, oldRole, newRole);
    }
    
    return result.changes > 0;
  }
  
  toggleUserStatus(userId, adminId) {
    const user = this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const newStatus = user.is_active ? 0 : 1;
    const stmt = this.securityLayer.prepare(`
      UPDATE users 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(newStatus, userId);
    
    if (result.changes > 0) {
      this.logAuditAction(adminId, 'toggle_status', 'user', userId, user.is_active.toString(), newStatus.toString());
    }
    
    return result.changes > 0;
  }
  
  // Auction Moderation
  getAllAuctionsForAdmin(page = 1, limit = 20, filters = {}) {
    let query = `
      SELECT a.*, u.username as creator_username, w.username as winner_username
      FROM auctions a
      LEFT JOIN users u ON a.creator_id = u.id
      LEFT JOIN users w ON a.winner_id = w.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.search) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const stmt = this.securityLayer.prepare(query);
    const auctions = stmt.all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countStmt = this.securityLayer.prepare(countQuery);
    const total = countStmt.get(...params.slice(0, -2)).count;
    
    return { auctions, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  moderateAuction(auctionId, action, adminId, reason = '') {
    const auction = this.getAuction(auctionId);
    if (!auction) throw new Error('Auction not found');
    
    let newStatus;
    switch (action) {
      case 'close':
        newStatus = 'closed';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        break;
      case 'reopen':
        newStatus = 'active';
        break;
      default:
        throw new Error('Invalid moderation action');
    }
    
    const stmt = this.securityLayer.prepare(`
      UPDATE auctions 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(newStatus, auctionId);
    
    if (result.changes > 0) {
      this.logAuditAction(adminId, 'moderate_auction', 'auction', auctionId, auction.status, newStatus, reason);
    }
    
    return result.changes > 0;
  }
  
  // System Statistics
  getSystemStats() {
    const stats = {};
    
    // User stats
    const userStats = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'moderator' THEN 1 END) as moderator_users,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_users_30d
      FROM users
    `).get();
    stats.users = userStats;
    
    // Auction stats
    const auctionStats = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_auctions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_auctions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_auctions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_auctions,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_auctions_30d
      FROM auctions
    `).get();
    stats.auctions = auctionStats;
    
    // Bid stats
    const bidStats = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(CASE WHEN timestamp >= datetime('now', '-30 days') THEN 1 END) as bids_30d,
        AVG(amount) as avg_bid_amount,
        MAX(amount) as highest_bid
      FROM bids
    `).get();
    stats.bids = bidStats;
    
    // Revenue stats
    const revenueStats = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' AND created_at >= datetime('now', '-30 days') THEN amount ELSE 0 END) as revenue_30d
      FROM revenue_tracking
    `).get();
    stats.revenue = revenueStats;
    
    return stats;
  }
  
  // Revenue Tracking
  getRevenueTracking(page = 1, limit = 20, filters = {}) {
    let query = `
      SELECT rt.*, a.title as auction_title
      FROM revenue_tracking rt
      LEFT JOIN auctions a ON rt.auction_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) {
      query += ` AND rt.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.transaction_type) {
      query += ` AND rt.transaction_type = ?`;
      params.push(filters.transaction_type);
    }
    
    query += ` ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const stmt = this.securityLayer.prepare(query);
    const transactions = stmt.all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countStmt = this.securityLayer.prepare(countQuery);
    const total = countStmt.get(...params.slice(0, -2)).count;
    
    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  // Security Monitoring
  getSecurityAlerts(page = 1, limit = 20, filters = {}) {
    let query = `
      SELECT sa.*, u.username as user_username
      FROM security_alerts sa
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.severity) {
      query += ` AND sa.severity = ?`;
      params.push(filters.severity);
    }
    
    if (filters.status) {
      query += ` AND sa.status = ?`;
      params.push(filters.status);
    }
    
    query += ` ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const stmt = this.securityLayer.prepare(query);
    const alerts = stmt.all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countStmt = this.securityLayer.prepare(countQuery);
    const total = countStmt.get(...params.slice(0, -2)).count;
    
    return { alerts, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  updateSecurityAlert(alertId, status, resolvedBy, notes = '') {
    const stmt = this.securityLayer.prepare(`
      UPDATE security_alerts 
      SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, details = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(status, resolvedBy, notes, alertId);
    return result.changes > 0;
  }
  
  // Configuration Management
  getSystemConfig(category = null) {
    let query = 'SELECT * FROM system_config';
    const params = [];
    
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, key';
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }
  
  updateSystemConfig(key, value, adminId, description = '') {
    const stmt = this.securityLayer.prepare(`
      UPDATE system_config 
      SET value = ?, updated_at = CURRENT_TIMESTAMP, description = ?
      WHERE key = ?
    `);
    
    const result = stmt.run(value, description, key);
    
    if (result.changes > 0) {
      this.logAuditAction(adminId, 'update_config', 'config', key, '', `${key}: ${value}`);
    }
    
    return result.changes > 0;
  }
  
  createSystemConfig(key, value, category, description, isPublic = false, adminId) {
    const stmt = this.securityLayer.prepare(`
      INSERT INTO system_config (id, key, value, category, description, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const configId = this.generateId();
    const result = stmt.run(configId, key, value, category, description, isPublic ? 1 : 0);
    
    if (result.changes > 0) {
      this.logAuditAction(adminId, 'create_config', 'config', configId, '', `${key}: ${value}`);
    }
    
    return result.changes > 0;
  }
  
  // Audit Logging
  logAuditAction(adminId, action, targetType, targetId, oldValues = '', newValues = '', ipAddress = '', userAgent = '') {
    const stmt = this.securityLayer.prepare(`
      INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(this.generateId(), adminId, action, targetType, targetId, oldValues, newValues, ipAddress, userAgent);
  }
  
  getAuditLogs(page = 1, limit = 20, filters = {}) {
    let query = `
      SELECT al.*, u.username as admin_username
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.action) {
      query += ` AND al.action = ?`;
      params.push(filters.action);
    }
    
    if (filters.target_type) {
      query += ` AND al.target_type = ?`;
      params.push(filters.target_type);
    }
    
    if (filters.admin_id) {
      query += ` AND al.admin_id = ?`;
      params.push(filters.admin_id);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const stmt = this.securityLayer.prepare(query);
    const logs = stmt.all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countStmt = this.securityLayer.prepare(countQuery);
    const total = countStmt.get(...params.slice(0, -2)).count;
    
    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  // Utility methods
  close() {
    this.db.close();
  }

  // Security monitoring
  getSecurityStats() {
    return this.securityLayer.getSecurityStats();
  }

  getQueryLog(limit = 100) {
    return this.securityLayer.getQueryLog(limit);
  }

  clearQueryLog() {
    this.securityLayer.clearQueryLog();
  }

  // Bid History Analytics Methods
  getUserBidHistory(userId, filters = {}) {
    const { limit = 50, offset = 0, status, dateFrom, dateTo, sortBy = 'timestamp', sortOrder = 'DESC' } = filters;
    
    let query = `
      SELECT b.*, a.title as auction_title, a.status as auction_status, a.end_time,
             CASE WHEN a.winner_id = ? AND a.winning_bid_id = b.id THEN 1 ELSE 0 END as is_winning_bid
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.bidder_id = ?
    `;
    const params = [userId, userId];
    
    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    
    if (dateFrom) {
      query += ` AND b.timestamp >= ?`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND b.timestamp <= ?`;
      params.push(dateTo);
    }
    
    // Validate sort column
    const validSortColumns = ['timestamp', 'amount', 'auction_title', 'auction_status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'timestamp';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY b.${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }
  
  getUserBidStatistics(userId) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(DISTINCT auction_id) as unique_auctions,
        SUM(amount) as total_spent,
        AVG(amount) as avg_bid_amount,
        MAX(amount) as highest_bid,
        MIN(amount) as lowest_bid,
        COUNT(CASE WHEN a.winner_id = ? AND a.winning_bid_id = b.id THEN 1 END) as won_auctions,
        COUNT(CASE WHEN a.status = 'closed' AND a.winner_id != ? AND a.winner_id IS NOT NULL THEN 1 END) as lost_auctions
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.bidder_id = ?
    `);
    return stmt.get(userId, userId, userId);
  }
  
  getCompetitionAnalysis(userId, auctionId = null) {
    let query = `
      SELECT 
        u.username,
        COUNT(b.id) as bid_count,
        AVG(b.amount) as avg_bid,
        MAX(b.amount) as max_bid,
        SUM(b.amount) as total_spent,
        COUNT(CASE WHEN a.winner_id = u.id THEN 1 END) as auctions_won
      FROM users u
      JOIN bids b ON u.id = b.bidder_id
      JOIN auctions a ON b.auction_id = a.id
    `;
    const params = [];
    
    if (auctionId) {
      query += ` WHERE b.auction_id = ?`;
      params.push(auctionId);
    }
    
    query += ` GROUP BY u.id, u.username ORDER BY bid_count DESC LIMIT 20`;
    
    const stmt = this.securityLayer.prepare(query);
    return stmt.all(...params);
  }
  
  getSpendingAnalytics(userId, period = 'monthly') {
    let dateFormat;
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        dateFormat = '%Y-%W';
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m';
    }
    
    const stmt = this.securityLayer.prepare(`
      SELECT 
        strftime('${dateFormat}', b.timestamp) as period,
        COUNT(*) as bid_count,
        SUM(b.amount) as total_spent,
        AVG(b.amount) as avg_bid_amount,
        COUNT(CASE WHEN a.winner_id = ? THEN 1 END) as auctions_won
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.bidder_id = ?
        AND b.timestamp >= date('now', '-12 months')
      GROUP BY strftime('${dateFormat}', b.timestamp)
      ORDER BY period DESC
    `);
    return stmt.all(userId, userId);
  }
  
  getTimelineData(userId, limit = 100) {
    const stmt = this.securityLayer.prepare(`
      SELECT 
        b.timestamp,
        b.amount,
        b.id as bid_id,
        a.title as auction_title,
        a.status as auction_status,
        a.end_time,
        CASE WHEN a.winner_id = ? AND a.winning_bid_id = b.id THEN 'won' 
             WHEN a.status = 'closed' AND a.winner_id IS NOT NULL THEN 'lost'
             ELSE 'pending' END as result
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.bidder_id = ?
      ORDER BY b.timestamp DESC
      LIMIT ?
    `);
    return stmt.all(userId, userId, limit);
  }
  
  exportBidHistory(userId, format = 'json', filters = {}) {
    const bids = this.getUserBidHistory(userId, { ...filters, limit: 10000 });
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(bids);
      case 'json':
      default:
        return JSON.stringify(bids, null, 2);
    }
  }
  
  convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  // Export for in-memory compatibility (temporary)
  toMap() {
    const auctions = new Map();
    const bids = new Map();
    const users = new Map();

    this.getAllAuctions().forEach(auction => {
      auctions.set(auction.id, auction);
    });

    this.db.prepare('SELECT * FROM bids').all().forEach(bid => {
      bids.set(bid.id, bid);
    });

    this.db.prepare('SELECT * FROM users').all().forEach(user => {
      users.set(user.id, user);
    });

    return { auctions, bids, users };
  }
}

module.exports = AuctionDatabase;
