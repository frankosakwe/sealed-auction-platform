# Stellar Sealed-Bid Auction System

A decentralized sealed-bid auction platform built on the Stellar blockchain with Soroban smart contracts, featuring private-input encryption and real-time updates.

## 🌟 Architecture Overview

This is a **full-stack blockchain application** with three main components:

### 🔗 Smart Contracts (Stellar/Soroban)
- **Location**: `contracts/src/lib.rs`
- **Language**: Rust
- **Features**: 
  - Commit-reveal bidding scheme
  - On-chain auction management
  - Secure bid encryption
  - Automatic winner determination

### 🖥️ Backend (Node.js)
- **Location**: `server.js`
- **Features**:
  - Stellar RPC integration
  - Real-time updates via Socket.io
  - API endpoints for auction management
  - Wallet connection services

### 🌐 Frontend (HTML/JavaScript)
- **Location**: `public/`
- **Features**:
  - Stellar wallet integration
  - Modern responsive UI
  - Real-time auction updates
  - Bid commitment and revelation

## 🚀 Quick Start

### Prerequisites

1. **Install Rust** (for smart contracts):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install Soroban CLI**:
   ```bash
   cargo install --locked soroban-cli
   ```

3. **Install Node.js** (v18+):
   ```bash
   # Download from https://nodejs.org/
   ```

### Setup Steps

1. **Clone and Install**:
   ```bash
   git clone https://github.com/akordavid373/sealed-auction-platform.git
   cd sealed-bid-auction
   npm install
   ```

2. **Build Smart Contract**:
   ```bash
   npm run build-contract
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Stellar keys
   ```

4. **Deploy Contract**:
   ```bash
   npm run deploy-contract
   ```

5. **Start Application**:
   ```bash
   npm start
   ```

6. **Open Browser**: http://localhost:3000

## 🔐 Smart Contract Features

### Core Functions

```rust
// Create new auction
create_auction(title, description, starting_bid, duration)

// Commit sealed bid
commit_bid(auction_id, commitment, bid_amount)

// Reveal bid amount
reveal_bid(bid_id, bid_amount, secret)

// End auction and determine winner
end_auction(auction_id)

// Cancel auction (creator only)
cancel_auction(auction_id)
```

### Security Features

- **Commit-Reveal Scheme**: Prevents front-running attacks
- **On-Chain Storage**: All auction data immutable
- **Cryptographic Security**: SHA256 commitment hashes
- **Access Control**: Only creators can cancel auctions

## 💫 Stellar Integration

### Wallet Connection

```javascript
// Connect with secret key
const wallet = new StellarWallet();
await wallet.connectWithSecret('your_secret_key');

// Or create new wallet
const newWallet = wallet.createWallet();
console.log(newWallet.publicKey, newWallet.secretKey);
```

### Transaction Flow

1. **Create Auction**: Call smart contract with auction parameters
2. **Commit Bid**: Submit encrypted commitment hash
3. **Reveal Bid**: Submit actual bid amount and secret
4. **End Auction**: Automatically determine highest bidder
5. **Withdraw**: Winner receives funds automatically

### Network Support

- **Testnet**: Free development and testing
- **Mainnet**: Production deployment
- **Future**: Custom networks support

## 🛠️ Development Commands

### Smart Contract Development

```bash
# Build contract
npm run build-contract

# Test contract
npm run test-contract

# Deploy to testnet
npm run deploy-contract
```

### Backend Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Start with auto-reload
nodemon server.js
```

### Frontend Development

Frontend is served from the backend - no separate build step needed.

## 📊 API Endpoints

### Stellar Integration

```javascript
// GET /api/stellar/contract-info
// Returns contract address and network info

// POST /api/stellar/create-auction
// Creates auction on blockchain

// POST /api/stellar/commit-bid
// Commits bid to blockchain

// POST /api/stellar/reveal-bid
// Reveals bid on blockchain

// GET /api/stellar/auctions
// Lists all blockchain auctions
```

### Real-time Events

```javascript
// Socket.io events
socket.on('auctionCreated', (auction) => { /* ... */ });
socket.on('bidCommitted', (data) => { /* ... */ });
socket.on('bidRevealed', (data) => { /* ... */ });
socket.on('auctionEnded', (auction) => { /* ... */ });
```

## 🔧 Configuration

### Environment Variables

```bash
# Stellar Configuration
STELLAR_NETWORK=testnet
SECRET_KEY=your_secret_key_here
PUBLIC_KEY=your_public_key_here
CONTRACT_ID=deployed_contract_id

# RPC URLs
TESTNET_RPC_URL=https://soroban-testnet.stellar.org
MAINNET_RPC_URL=https://mainnet.stellar.org

# Application
PORT=3000
NODE_ENV=development
```

### Contract Deployment

```bash
# Testnet deployment
npm run deploy-contract -- --network testnet

# Mainnet deployment
npm run deploy-contract -- --network mainnet
```

## 🧪 Testing

### Smart Contract Tests

```bash
cd contracts
cargo test
```

### Integration Tests

```bash
npm test
```

### Manual Testing

1. Connect wallet with testnet account
2. Create auction with test parameters
3. Place bids using commit-reveal
4. Verify auction end and winner selection

## 🌍 Deployment Options

### Local Development

```bash
npm run dev
# Runs on http://localhost:3000
```

### Cloud Deployment

#### Heroku
```bash
heroku create stellar-auction
git push heroku main
heroku config:set STELLAR_NETWORK=testnet
```

#### Railway
```bash
railway login
railway init
railway up
```

#### Docker
```bash
docker build -t stellar-auction .
docker run -p 3000:3000 stellar-auction
```

## 🔒 Security Considerations

### Smart Contract Security

- **Audit**: Contract should be professionally audited
- **Testing**: Comprehensive test coverage required
- **Upgradability**: Consider proxy patterns for updates

### Key Management

- **Secret Keys**: Never expose in frontend
- **Environment**: Use secure environment variables
- **Backup**: Secure key backup procedures

### Network Security

- **HTTPS**: Required for production
- **Rate Limiting**: API protection implemented
- **Input Validation**: All inputs validated

## 📱 Mobile Compatibility

The application is fully responsive and works on:
- **Desktop browsers** (Chrome, Firefox, Safari)
- **Mobile browsers** (iOS Safari, Chrome Mobile)
- **Tablets** (iPad, Android tablets)

## 🔄 Transaction Flow Diagram

```
User → Frontend → Backend → Stellar Network
  ↓        ↓        ↓         ↓
Create   Form     API    Smart Contract
Auction  Submit   Call   create_auction()
  ↓        ↓        ↓         ↓
Commit   Hash     API    Smart Contract
Bid     Submit   Call   commit_bid()
  ↓        ↓        ↓         ↓
Reveal   Amount   API    Smart Contract
Bid     Submit   Call   reveal_bid()
  ↓        ↓        ↓         ↓
End      Timer    API    Smart Contract
Auction  Check    Call   end_auction()
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📞 Support

- **Issues**: GitHub Issues
- **Documentation**: This README
- **Community**: Discord/Telegram (coming soon)

## 🎉 What's Next?

### Planned Features

- [ ] **Mobile App**: React Native implementation
- [ ] **NFT Integration**: Asset-based auctions
- [ ] **Multi-Currency**: Support for various tokens
- [ ] **Governance**: DAO-based auction platform
- [ ] **Analytics**: Advanced auction analytics

### Technical Improvements

- [ ] **Gas Optimization**: Reduce transaction costs
- [ ] **Scalability**: Handle high-volume auctions
- [ ] **UI/UX**: Enhanced user experience
- [ ] **Testing**: Expanded test coverage

---

**Built with ❤️ for the Stellar ecosystem**

🌟 **Repository**: https://github.com/akordavid373/sealed-auction-platform

🚀 **Live Demo**: (Coming soon)

📧 **Contact**: [Your contact information]
