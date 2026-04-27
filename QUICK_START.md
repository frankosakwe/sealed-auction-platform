# Quick Start Guide

## 🚀 Setup Instructions

### Option 1: Automatic Setup (Recommended)
1. **Double-click `setup.bat`**
   - This will check for Node.js and install all dependencies
   - Follow the on-screen instructions
<!-- 
### Option 2: Manual Setup
1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Version 18.x or higher recommended

2. **Install Dependencies**
   ```bash
   npm install
   ``` -->

## 🏃‍♂️ Running the Application

### Production Mode
```bash
# Double-click start.bat OR run:
npm start
```
Then open: http://localhost:3000

### Development Mode (with auto-reload)
```bash
# Double-click dev.bat OR run:
npm run dev
```
Then open: http://localhost:3000

## 🎯 First Time Usage

1. **Create an Account**
   - Click "Login" → "Register"
   - Enter username and password
   - Click "Register"

2. **Create Your First Auction**
   - Go to "Create Auction" tab
   - Fill in auction details
   - Click "Create Auction"

3. **Place a Test Bid**
   - Go to "Auctions" tab
   - Click "Place Bid" on your auction
   - Enter bid amount and secret key
   - Save the secret key securely!

## 🔧 Troubleshooting

### "Node.js is not recognized"
- Run `setup.bat` first
- Or install Node.js from https://nodejs.org/

### "Port 3000 is already in use"
- Close other applications using port 3000
- Or change the port in `server.js` (line 285)

### "Dependencies failed to install"
- Check your internet connection
- Try running `npm install` manually
- Clear npm cache: `npm cache clean --force`

## 📱 Accessing the Application

Once running, access the auction system at:
- **Local**: http://localhost:3000
- **Network**: http://YOUR_IP:3000 (for other devices on same network)

## 🧪 Testing

Run the test suite:
```bash
node test.js
```

## 📚 Features Available

- ✅ User registration and login
- ✅ Create sealed-bid auctions
- ✅ Place encrypted bids
- ✅ Real-time auction updates
- ✅ Automatic auction closure
- ✅ Winner determination
- ✅ Modern responsive UI

## 🔐 Security Notes

- **Secret Keys**: Never share or lose your bid secret keys
- **Passwords**: Stored securely with bcrypt hashing
- **Encryption**: All bids are encrypted with AES-256
- **Rate Limiting**: Protection against brute force attacks

## 📞 Need Help?

1. Check the console output for error messages
2. Verify Node.js is installed: `node --version`
3. Ensure all dependencies are installed: `npm list`
4. Try restarting the server

Enjoy your Private-Input Sealed-Bid Auction System! 🎉
