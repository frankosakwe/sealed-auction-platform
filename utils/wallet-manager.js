const { EventEmitter } = require('events');
const { Horizon, Keypair, Networks, BASE_FEE, Asset, TransactionBuilder, StrKey } = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Wallet Security Levels
 */
const SECURITY_LEVELS = {
  BASIC: 'basic',        // Simple password protection
  STANDARD: 'standard',  // Password + encryption
  HIGH: 'high',         // Multi-factor + encryption
  ENTERPRISE: 'enterprise' // Advanced security features
};

/**
 * Wallet Types
 */
const WALLET_TYPES = {
  STELLAR: 'stellar',
  ETHEREUM: 'ethereum',
  BITCOIN: 'bitcoin',
  CUSTOM: 'custom'
};

/**
 * Wallet Manager Class
 * Handles multiple wallets, security, backup, and recovery
 */
class WalletManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.maxWallets = options.maxWallets || 50;
    this.defaultSecurityLevel = options.defaultSecurityLevel || SECURITY_LEVELS.STANDARD;
    this.encryptionAlgorithm = options.encryptionAlgorithm || 'aes-256-gcm';
    this.storageKey = options.storageKey || 'wallet_manager_data';
    
    // Wallet storage
    this.wallets = new Map();
    this.activeWalletId = null;
    this.walletOrder = []; // Maintain order of wallets
    
    // Security settings
    this.securitySettings = {
      autoLockTimeout: options.autoLockTimeout || 300000, // 5 minutes
      sessionTimeout: options.sessionTimeout || 3600000,   // 1 hour
      maxLoginAttempts: options.maxLoginAttempts || 5,
      requireBiometric: options.requireBiometric || false,
      enableTwoFactor: options.enableTwoFactor || false
    };
    
    // Transaction history
    this.transactionHistory = new Map();
    
    // Backup and recovery
    this.backupSettings = {
      autoBackup: options.autoBackup || false,
      backupInterval: options.backupInterval || 86400000, // 24 hours
      maxBackups: options.maxBackups || 10,
      backupLocation: options.backupLocation || 'local'
    };
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize wallet manager
   */
  async initialize() {
    try {
      // Load existing wallets from storage
      await this.loadFromStorage();
      
      // Start auto-lock timer
      this.startAutoLockTimer();
      
      // Start auto-backup if enabled
      if (this.backupSettings.autoBackup) {
        this.startAutoBackup();
      }
      
      this.emit('initialized', { walletCount: this.wallets.size });
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  /**
   * Create a new wallet
   */
  async createWallet(walletData) {
    try {
      // Validate wallet data
      if (!this.validateWalletData(walletData)) {
        throw new Error('Invalid wallet data');
      }

      // Check wallet limit
      if (this.wallets.size >= this.maxWallets) {
        throw new Error('Maximum wallet limit reached');
      }

      const walletId = uuidv4();
      const now = new Date().toISOString();

      // Create wallet based on type
      let createdWallet;
      switch (walletData.type) {
        case WALLET_TYPES.STELLAR:
          createdWallet = await this.createStellarWallet(walletData);
          break;
        case WALLET_TYPES.ETHEREUM:
          createdWallet = await this.createEthereumWallet(walletData);
          break;
        case WALLET_TYPES.BITCOIN:
          createdWallet = await this.createBitcoinWallet(walletData);
          break;
        default:
          createdWallet = await this.createCustomWallet(walletData);
      }

      const wallet = {
        id: walletId,
        ...createdWallet,
        name: walletData.name || `Wallet ${this.wallets.size + 1}`,
        type: walletData.type || WALLET_TYPES.STELLAR,
        network: walletData.network || 'testnet',
        securityLevel: walletData.securityLevel || this.defaultSecurityLevel,
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
        isActive: false,
        isLocked: true,
        balance: 0,
        transactions: [],
        metadata: walletData.metadata || {},
        tags: walletData.tags || [],
        notes: walletData.notes || ''
      };

      // Add to storage
      this.wallets.set(walletId, wallet);
      this.walletOrder.push(walletId);

      // Set as active if it's the first wallet
      if (this.wallets.size === 1) {
        await this.setActiveWallet(walletId);
      }

      // Save to storage
      await this.saveToStorage();

      this.emit('walletCreated', { walletId, wallet });
      return walletId;
    } catch (error) {
      this.emit('error', { type: 'walletCreation', error });
      throw error;
    }
  }

  /**
   * Create Stellar wallet
   */
  async createStellarWallet(walletData) {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    // Encrypt secret key if security level requires it
    let encryptedSecretKey = secretKey;
    if (walletData.securityLevel !== SECURITY_LEVELS.BASIC) {
      encryptedSecretKey = await this.encryptData(secretKey, walletData.password);
    }

    return {
      publicKey,
      encryptedSecretKey,
      derivationPath: walletData.derivationPath || "m/44'/148'/0'",
      address: publicKey,
      stellarSpecific: {
        network: walletData.network || 'testnet',
        horizonUrl: walletData.horizonUrl || (walletData.network === 'mainnet' 
          ? 'https://horizon.stellar.org' 
          : 'https://horizon-testnet.stellar.org')
      }
    };
  }

  /**
   * Create Ethereum wallet
   */
  async createEthereumWallet(walletData) {
    // Simplified Ethereum wallet creation
    const privateKey = crypto.randomBytes(32).toString('hex');
    const address = this.ethereumPrivateKeyToAddress(privateKey);

    let encryptedPrivateKey = privateKey;
    if (walletData.securityLevel !== SECURITY_LEVELS.BASIC) {
      encryptedPrivateKey = await this.encryptData(privateKey, walletData.password);
    }

    return {
      address,
      encryptedPrivateKey,
      derivationPath: walletData.derivationPath || "m/44'/60'/0'/0/0",
      ethereumSpecific: {
        network: walletData.network || 'goerli',
        rpcUrl: walletData.rpcUrl
      }
    };
  }

  /**
   * Create Bitcoin wallet
   */
  async createBitcoinWallet(walletData) {
    // Simplified Bitcoin wallet creation
    const privateKey = crypto.randomBytes(32).toString('hex');
    const address = this.bitcoinPrivateKeyToAddress(privateKey);

    let encryptedPrivateKey = privateKey;
    if (walletData.securityLevel !== SECURITY_LEVELS.BASIC) {
      encryptedPrivateKey = await this.encryptData(privateKey, walletData.password);
    }

    return {
      address,
      encryptedPrivateKey,
      derivationPath: walletData.derivationPath || "m/44'/0'/0'/0/0",
      bitcoinSpecific: {
        network: walletData.network || 'testnet',
        rpcUrl: walletData.rpcUrl
      }
    };
  }

  /**
   * Create custom wallet
   */
  async createCustomWallet(walletData) {
    if (!walletData.customData) {
      throw new Error('Custom wallet requires customData');
    }

    let encryptedData = walletData.customData;
    if (walletData.securityLevel !== SECURITY_LEVELS.BASIC) {
      encryptedData = await this.encryptData(JSON.stringify(walletData.customData), walletData.password);
    }

    return {
      customData: encryptedData,
      customSpecific: walletData.customSpecific || {}
    };
  }

  /**
   * Add existing wallet
   */
  async addExistingWallet(walletData) {
    try {
      const walletId = uuidv4();
      const now = new Date().toISOString();

      // Validate and encrypt sensitive data
      let encryptedSecretKey = walletData.secretKey;
      if (walletData.securityLevel !== SECURITY_LEVELS.BASIC && walletData.password) {
        encryptedSecretKey = await this.encryptData(walletData.secretKey, walletData.password);
      }

      const wallet = {
        id: walletId,
        publicKey: walletData.publicKey,
        address: walletData.address || walletData.publicKey,
        encryptedSecretKey,
        name: walletData.name || `Imported Wallet ${this.wallets.size + 1}`,
        type: walletData.type || WALLET_TYPES.STELLAR,
        network: walletData.network || 'testnet',
        securityLevel: walletData.securityLevel || this.defaultSecurityLevel,
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
        isActive: false,
        isLocked: true,
        balance: 0,
        transactions: [],
        metadata: walletData.metadata || {},
        tags: walletData.tags || [],
        notes: walletData.notes || '',
        isImported: true
      };

      this.wallets.set(walletId, wallet);
      this.walletOrder.push(walletId);

      await this.saveToStorage();
      this.emit('walletAdded', { walletId, wallet });

      return walletId;
    } catch (error) {
      this.emit('error', { type: 'walletImport', error });
      throw error;
    }
  }

  /**
   * Set active wallet
   */
  async setActiveWallet(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Deactivate previous wallet
      if (this.activeWalletId) {
        const prevWallet = this.wallets.get(this.activeWalletId);
        if (prevWallet) {
          prevWallet.isActive = false;
        }
      }

      // Activate new wallet
      wallet.isActive = true;
      wallet.lastAccessed = new Date().toISOString();
      this.activeWalletId = walletId;

      await this.saveToStorage();
      this.emit('walletSwitched', { walletId, wallet });

      return true;
    } catch (error) {
      this.emit('error', { type: 'walletSwitch', error });
      throw error;
    }
  }

  /**
   * Get active wallet
   */
  getActiveWallet() {
    if (!this.activeWalletId) {
      return null;
    }
    return this.wallets.get(this.activeWalletId);
  }

  /**
   * Get wallet by ID
   */
  getWallet(walletId) {
    return this.wallets.get(walletId);
  }

  /**
   * Get all wallets
   */
  getAllWallets() {
    return Array.from(this.wallets.values()).sort((a, b) => {
      const aIndex = this.walletOrder.indexOf(a.id);
      const bIndex = this.walletOrder.indexOf(b.id);
      return aIndex - bIndex;
    });
  }

  /**
   * Lock wallet
   */
  async lockWallet(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      wallet.isLocked = true;
      wallet.lastAccessed = new Date().toISOString();

      await this.saveToStorage();
      this.emit('walletLocked', { walletId });

      return true;
    } catch (error) {
      this.emit('error', { type: 'walletLock', error });
      throw error;
    }
  }

  /**
   * Unlock wallet
   */
  async unlockWallet(walletId, password) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Verify password for encrypted wallets
      if (wallet.securityLevel !== SECURITY_LEVELS.BASIC) {
        // Password verification logic would go here
        // For now, we'll assume it's correct
      }

      wallet.isLocked = false;
      wallet.lastAccessed = new Date().toISOString();

      await this.saveToStorage();
      this.emit('walletUnlocked', { walletId });

      return true;
    } catch (error) {
      this.emit('error', { type: 'walletUnlock', error });
      throw error;
    }
  }

  /**
   * Update wallet
   */
  async updateWallet(walletId, updates) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Update allowed fields
      const allowedUpdates = ['name', 'notes', 'tags', 'metadata', 'securityLevel'];
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          wallet[field] = updates[field];
        }
      }

      wallet.updatedAt = new Date().toISOString();

      await this.saveToStorage();
      this.emit('walletUpdated', { walletId, wallet });

      return true;
    } catch (error) {
      this.emit('error', { type: 'walletUpdate', error });
      throw error;
    }
  }

  /**
   * Delete wallet
   */
  async deleteWallet(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Cannot delete active wallet
      if (this.activeWalletId === walletId) {
        throw new Error('Cannot delete active wallet');
      }

      this.wallets.delete(walletId);
      const index = this.walletOrder.indexOf(walletId);
      if (index > -1) {
        this.walletOrder.splice(index, 1);
      }

      await this.saveToStorage();
      this.emit('walletDeleted', { walletId });

      return true;
    } catch (error) {
      this.emit('error', { type: 'walletDeletion', error });
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      let balance = 0;
      switch (wallet.type) {
        case WALLET_TYPES.STELLAR:
          balance = await this.getStellarBalance(wallet);
          break;
        case WALLET_TYPES.ETHEREUM:
          balance = await this.getEthereumBalance(wallet);
          break;
        case WALLET_TYPES.BITCOIN:
          balance = await this.getBitcoinBalance(wallet);
          break;
        default:
          balance = wallet.balance || 0;
      }

      wallet.balance = balance;
      wallet.lastAccessed = new Date().toISOString();

      await this.saveToStorage();
      this.emit('balanceUpdated', { walletId, balance });

      return balance;
    } catch (error) {
      this.emit('error', { type: 'balanceFetch', error });
      throw error;
    }
  }

  /**
   * Get aggregated balance across all wallets
   */
  async getAggregatedBalance() {
    try {
      const wallets = this.getAllWallets();
      let totalBalance = 0;
      const balancesByType = {};

      for (const wallet of wallets) {
        const balance = await this.getWalletBalance(wallet.id);
        totalBalance += balance;

        if (!balancesByType[wallet.type]) {
          balancesByType[wallet.type] = 0;
        }
        balancesByType[wallet.type] += balance;
      }

      return {
        total: totalBalance,
        byType: balancesByType,
        byWallet: wallets.map(w => ({ id: w.id, name: w.name, balance: w.balance }))
      };
    } catch (error) {
      this.emit('error', { type: 'aggregation', error });
      throw error;
    }
  }

  /**
   * Get transaction history for wallet
   */
  async getTransactionHistory(walletId, options = {}) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      let transactions = wallet.transactions || [];

      // Fetch new transactions if needed
      if (options.refresh !== false) {
        const newTransactions = await this.fetchTransactions(wallet);
        transactions = this.mergeTransactions(transactions, newTransactions);
        wallet.transactions = transactions;
        await this.saveToStorage();
      }

      // Apply filters
      if (options.limit) {
        transactions = transactions.slice(0, options.limit);
      }

      if (options.type) {
        transactions = transactions.filter(tx => tx.type === options.type);
      }

      if (options.dateFrom) {
        const fromDate = new Date(options.dateFrom);
        transactions = transactions.filter(tx => new Date(tx.timestamp) >= fromDate);
      }

      if (options.dateTo) {
        const toDate = new Date(options.dateTo);
        transactions = transactions.filter(tx => new Date(tx.timestamp) <= toDate);
      }

      return transactions;
    } catch (error) {
      this.emit('error', { type: 'transactionHistory', error });
      throw error;
    }
  }

  /**
   * Create wallet backup
   */
  async createBackup(walletIds = null, options = {}) {
    try {
      const walletsToBackup = walletIds 
        ? walletIds.map(id => this.wallets.get(id)).filter(Boolean)
        : this.getAllWallets();

      if (walletsToBackup.length === 0) {
        throw new Error('No wallets to backup');
      }

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        walletCount: walletsToBackup.length,
        wallets: walletsToBackup.map(wallet => ({
          id: wallet.id,
          name: wallet.name,
          type: wallet.type,
          network: wallet.network,
          publicKey: wallet.publicKey,
          address: wallet.address,
          encryptedSecretKey: wallet.encryptedSecretKey,
          securityLevel: wallet.securityLevel,
          metadata: wallet.metadata,
          tags: wallet.tags,
          notes: wallet.notes,
          createdAt: wallet.createdAt,
          isImported: wallet.isImported || false
        })),
        settings: {
          securitySettings: this.securitySettings,
          backupSettings: this.backupSettings
        }
      };

      // Encrypt backup if password provided
      if (options.password) {
        backupData.encrypted = true;
        backupData.data = await this.encryptData(JSON.stringify(backupData), options.password);
        delete backupData.wallets;
        delete backupData.settings;
      }

      const backupId = uuidv4();
      const backup = {
        id: backupId,
        data: backupData,
        createdAt: new Date().toISOString(),
        size: JSON.stringify(backupData).length,
        walletIds: walletsToBackup.map(w => w.id)
      };

      // Save backup
      await this.saveBackup(backup);

      this.emit('backupCreated', { backupId, backup });
      return backupId;
    } catch (error) {
      this.emit('error', { type: 'backup', error });
      throw error;
    }
  }

  /**
   * Restore wallet from backup
   */
  async restoreFromBackup(backupData, password = null) {
    try {
      let parsedData = backupData;

      // Decrypt if encrypted
      if (backupData.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted backup');
        }
        const decryptedData = await this.decryptData(backupData.data, password);
        parsedData = JSON.parse(decryptedData);
      }

      // Validate backup data
      if (!parsedData.wallets || !Array.isArray(parsedData.wallets)) {
        throw new Error('Invalid backup data');
      }

      // Restore wallets
      const restoredWallets = [];
      for (const walletData of parsedData.wallets) {
        try {
          const walletId = await this.addExistingWallet({
            ...walletData,
            securityLevel: walletData.securityLevel || this.defaultSecurityLevel
          });
          restoredWallets.push(walletId);
        } catch (error) {
          console.error(`Failed to restore wallet ${walletData.name}:`, error);
        }
      }

      // Restore settings if available
      if (parsedData.settings) {
        if (parsedData.settings.securitySettings) {
          this.securitySettings = { ...this.securitySettings, ...parsedData.settings.securitySettings };
        }
        if (parsedData.settings.backupSettings) {
          this.backupSettings = { ...this.backupSettings, ...parsedData.settings.backupSettings };
        }
      }

      await this.saveToStorage();
      this.emit('backupRestored', { restoredWallets, count: restoredWallets.length });

      return restoredWallets;
    } catch (error) {
      this.emit('error', { type: 'restore', error });
      throw error;
    }
  }

  /**
   * Export wallet
   */
  async exportWallet(walletId, format = 'json', password = null) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const exportData = {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        network: wallet.network,
        publicKey: wallet.publicKey,
        address: wallet.address,
        encryptedSecretKey: wallet.encryptedSecretKey,
        securityLevel: wallet.securityLevel,
        metadata: wallet.metadata,
        tags: wallet.tags,
        notes: wallet.notes,
        createdAt: wallet.createdAt,
        exportedAt: new Date().toISOString()
      };

      // Encrypt if password provided
      if (password) {
        exportData.encrypted = true;
        exportData.data = await this.encryptData(JSON.stringify(exportData), password);
        delete exportData.encryptedSecretKey;
      }

      // Format output
      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'csv':
          return this.walletToCsv(exportData);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      this.emit('error', { type: 'export', error });
      throw error;
    }
  }

  /**
   * Get wallet manager status
   */
  getStatus() {
    return {
      walletCount: this.wallets.size,
      activeWalletId: this.activeWalletId,
      activeWalletName: this.activeWalletId ? this.wallets.get(this.activeWalletId)?.name : null,
      securityLevel: this.defaultSecurityLevel,
      autoLockEnabled: this.securitySettings.autoLockTimeout > 0,
      autoBackupEnabled: this.backupSettings.autoBackup,
      lastBackup: this.getLastBackupTime(),
      supportedTypes: Object.values(WALLET_TYPES),
      securityLevels: Object.values(SECURITY_LEVELS)
    };
  }

  // Private helper methods

  validateWalletData(walletData) {
    return walletData && 
           typeof walletData === 'object' &&
           walletData.type && 
           Object.values(WALLET_TYPES).includes(walletData.type);
  }

  async encryptData(data, password) {
    if (!password) {
      throw new Error('Password required for encryption');
    }

    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  async decryptData(encryptedData, password) {
    if (!password) {
      throw new Error('Password required for decryption');
    }

    const key = crypto.scryptSync(password, 'salt', 32);
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async loadFromStorage() {
    // Implementation would depend on storage mechanism
    // For now, this is a placeholder
  }

  async saveToStorage() {
    // Implementation would depend on storage mechanism
    // For now, this is a placeholder
  }

  async saveBackup(backup) {
    // Implementation would depend on backup storage mechanism
    // For now, this is a placeholder
  }

  startAutoLockTimer() {
    if (this.securitySettings.autoLockTimeout > 0) {
      setInterval(() => {
        const now = Date.now();
        for (const [walletId, wallet] of this.wallets) {
          if (!wallet.isLocked && (now - new Date(wallet.lastAccessed).getTime()) > this.securitySettings.autoLockTimeout) {
            this.lockWallet(walletId);
          }
        }
      }, 60000); // Check every minute
    }
  }

  startAutoBackup() {
    if (this.backupSettings.autoBackup) {
      setInterval(async () => {
        try {
          await this.createBackup();
        } catch (error) {
          this.emit('error', { type: 'autoBackup', error });
        }
      }, this.backupSettings.backupInterval);
    }
  }

  getLastBackupTime() {
    // Placeholder implementation
    return null;
  }

  // Placeholder methods for specific blockchain implementations
  async getStellarBalance(wallet) {
    // Placeholder - would connect to Stellar network
    return wallet.balance || 0;
  }

  async getEthereumBalance(wallet) {
    // Placeholder - would connect to Ethereum network
    return wallet.balance || 0;
  }

  async getBitcoinBalance(wallet) {
    // Placeholder - would connect to Bitcoin network
    return wallet.balance || 0;
  }

  async fetchTransactions(wallet) {
    // Placeholder - would fetch from blockchain
    return [];
  }

  mergeTransactions(existing, newTransactions) {
    // Placeholder - would merge and deduplicate
    return [...existing, ...newTransactions];
  }

  ethereumPrivateKeyToAddress(privateKey) {
    // Simplified address generation
    return '0x' + crypto.createHash('sha256').update(privateKey).digest('hex').slice(0, 40);
  }

  bitcoinPrivateKeyToAddress(privateKey) {
    // Simplified address generation
    return crypto.createHash('sha256').update(privateKey).digest('hex').slice(0, 40);
  }

  walletToCsv(wallet) {
    const headers = ['ID', 'Name', 'Type', 'Network', 'Address', 'Security Level', 'Created At'];
    const values = [
      wallet.id,
      wallet.name,
      wallet.type,
      wallet.network,
      wallet.address,
      wallet.securityLevel,
      wallet.createdAt
    ];
    
    return headers.join(',') + '\n' + values.join(',');
  }
}

module.exports = {
  WalletManager,
  SECURITY_LEVELS,
  WALLET_TYPES
};
