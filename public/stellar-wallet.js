// Stellar Wallet Integration
class StellarWallet {
    constructor() {
        this.server = null;
        this.network = 'testnet';
        this.connected = false;
        this.account = null;
        this.keypair = null;
        this.contractId = null;
    }

    // Initialize Stellar connection
    async initialize(network = 'testnet') {
        this.network = network;
        const rpcUrl = network === 'mainnet' 
            ? 'https://mainnet.stellar.org' 
            : 'https://soroban-testnet.stellar.org';
        
        this.server = new stellarSdk.Server(rpcUrl);
        return true;
    }

    // Connect wallet with secret key
    async connectWithSecret(secretKey) {
        try {
            this.keypair = stellarSdk.Keypair.fromSecret(secretKey);
            this.account = await this.server.loadAccount(this.keypair.publicKey());
            this.connected = true;
            
            // Emit connection event
            window.dispatchEvent(new CustomEvent('stellarWalletConnected', {
                detail: {
                    publicKey: this.keypair.publicKey(),
                    balance: this.getBalance()
                }
            }));
            
            return true;
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            return false;
        }
    }

    // Create new wallet
    createWallet() {
        this.keypair = stellarSdk.Keypair.random();
        return {
            publicKey: this.keypair.publicKey(),
            secretKey: this.keypair.secret()
        };
    }

    // Get account balance
    async getBalance() {
        if (!this.account) return 0;
        
        const balance = this.account.balances
            .find(b => b.asset_type === 'native');
        return parseFloat(balance.balance) || 0;
    }

    // Get commitment hash for bid
    getCommitment(bidAmount, secret) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(`${bidAmount}${secret}`).digest('hex');
    }

    // Create auction on blockchain
    async createAuction(title, description, startingBid, duration) {
        if (!this.connected) throw new Error('Wallet not connected');
        
        try {
            const account = await this.server.loadAccount(this.keypair.publicKey());
            
            const transaction = new stellarSdk.TransactionBuilder(account, {
                fee: stellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'mainnet' 
                    ? stellarSdk.Networks.PUBLIC 
                    : stellarSdk.Networks.TESTNET
            })
            .addOperation(stellarSdk.Operation.invokeContractFunction({
                contract: this.contractId,
                function: 'create_auction',
                args: [
                    stellarSdk.nativeToScVal(title),
                    stellarSdk.nativeToScVal(description),
                    stellarSdk.nativeToScVal(startingBid),
                    stellarSdk.nativeToScVal(duration)
                ]
            }))
            .setTimeout(30)
            .build();

            transaction.sign(this.keypair);
            const result = await this.server.sendTransaction(transaction);
            
            if (result.status === 'SUCCESS') {
                return result.hash;
            } else {
                throw new Error(`Transaction failed: ${result.status}`);
            }
        } catch (error) {
            console.error('Failed to create auction:', error);
            throw error;
        }
    }

    // Commit bid to blockchain
    async commitBid(auctionId, commitment, bidAmount) {
        if (!this.connected) throw new Error('Wallet not connected');
        
        try {
            const account = await this.server.loadAccount(this.keypair.publicKey());
            
            const transaction = new stellarSdk.TransactionBuilder(account, {
                fee: stellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'mainnet' 
                    ? stellarSdk.Networks.PUBLIC 
                    : stellarSdk.Networks.TESTNET
            })
            .addOperation(stellarSdk.Operation.invokeContractFunction({
                contract: this.contractId,
                function: 'commit_bid',
                args: [
                    stellarSdk.nativeToScVal(auctionId),
                    stellarSdk.nativeToScVal(commitment),
                    stellarSdk.nativeToScVal(bidAmount)
                ]
            }))
            .addOperation(stellarSdk.Operation.payment({
                destination: this.contractId,
                asset: stellarSdk.Asset.native(),
                amount: bidAmount.toString()
            }))
            .setTimeout(30)
            .build();

            transaction.sign(this.keypair);
            const result = await this.server.sendTransaction(transaction);
            
            if (result.status === 'SUCCESS') {
                return result.hash;
            } else {
                throw new Error(`Transaction failed: ${result.status}`);
            }
        } catch (error) {
            console.error('Failed to commit bid:', error);
            throw error;
        }
    }

    // Reveal bid on blockchain
    async revealBid(bidId, bidAmount, secret) {
        if (!this.connected) throw new Error('Wallet not connected');
        
        try {
            const account = await this.server.loadAccount(this.keypair.publicKey());
            
            const transaction = new stellarSdk.TransactionBuilder(account, {
                fee: stellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'mainnet' 
                    ? stellarSdk.Networks.PUBLIC 
                    : stellarSdk.Networks.TESTNET
            })
            .addOperation(stellarSdk.Operation.invokeContractFunction({
                contract: this.contractId,
                function: 'reveal_bid',
                args: [
                    stellarSdk.nativeToScVal(bidId),
                    stellarSdk.nativeToScVal(bidAmount),
                    stellarSdk.nativeToScVal(secret)
                ]
            }))
            .setTimeout(30)
            .build();

            transaction.sign(this.keypair);
            const result = await this.server.sendTransaction(transaction);
            
            if (result.status === 'SUCCESS') {
                return result.hash;
            } else {
                throw new Error(`Transaction failed: ${result.status}`);
            }
        } catch (error) {
            console.error('Failed to reveal bid:', error);
            throw error;
        }
    }

    // End auction on blockchain
    async endAuction(auctionId) {
        if (!this.connected) throw new Error('Wallet not connected');
        
        try {
            const account = await this.server.loadAccount(this.keypair.publicKey());
            
            const transaction = new stellarSdk.TransactionBuilder(account, {
                fee: stellarSdk.BASE_FEE,
                networkPassphrase: this.network === 'mainnet' 
                    ? stellarSdk.Networks.PUBLIC 
                    : stellarSdk.Networks.TESTNET
            })
            .addOperation(stellarSdk.Operation.invokeContractFunction({
                contract: this.contractId,
                function: 'end_auction',
                args: [stellarSdk.nativeToScVal(auctionId)]
            }))
            .setTimeout(30)
            .build();

            transaction.sign(this.keypair);
            const result = await this.server.sendTransaction(transaction);
            
            if (result.status === 'SUCCESS') {
                return result.hash;
            } else {
                throw new Error(`Transaction failed: ${result.status}`);
            }
        } catch (error) {
            console.error('Failed to end auction:', error);
            throw error;
        }
    }

    // Get auction from blockchain
    async getAuction(auctionId) {
        if (!this.contractId) throw new Error('Contract not set');
        
        try {
            const result = await this.server.simulateTransaction(
                new stellarSdk.TransactionBuilder(
                    new stellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '1'), 
                    {
                        fee: stellarSdk.BASE_FEE,
                        networkPassphrase: this.network === 'mainnet' 
                            ? stellarSdk.Networks.PUBLIC 
                            : stellarSdk.Networks.TESTNET
                    }
                )
                .addOperation(stellarSdk.Operation.invokeContractFunction({
                    contract: this.contractId,
                    function: 'get_auction',
                    args: [stellarSdk.nativeToScVal(auctionId)]
                }))
                .setTimeout(30)
                .build()
            );

            if (result.result) {
                return stellarSdk.scValToNative(result.result);
            } else {
                throw new Error('Failed to get auction data');
            }
        } catch (error) {
            console.error('Failed to get auction:', error);
            throw error;
        }
    }

    // Get user's auctions from blockchain
    async getUserAuctions(userAddress) {
        if (!this.contractId) throw new Error('Contract not set');
        
        try {
            const result = await this.server.simulateTransaction(
                new stellarSdk.TransactionBuilder(
                    new stellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '1'), 
                    {
                        fee: stellarSdk.BASE_FEE,
                        networkPassphrase: this.network === 'mainnet' 
                            ? stellarSdk.Networks.PUBLIC 
                            : stellarSdk.Networks.TESTNET
                    }
                )
                .addOperation(stellarSdk.Operation.invokeContractFunction({
                    contract: this.contractId,
                    function: 'get_user_auctions',
                    args: [stellarSdk.nativeToScVal(userAddress)]
                }))
                .setTimeout(30)
                .build()
            );

            if (result.result) {
                return stellarSdk.scValToNative(result.result);
            } else {
                throw new Error('Failed to get user auctions');
            }
        } catch (error) {
            console.error('Failed to get user auctions:', error);
            throw error;
        }
    }

    // Disconnect wallet
    disconnect() {
        this.connected = false;
        this.account = null;
        this.keypair = null;
        
        // Emit disconnection event
        window.dispatchEvent(new CustomEvent('stellarWalletDisconnected'));
    }

    // Fund testnet account
    async fundTestnet(publicKey) {
        if (this.network !== 'testnet') {
            throw new Error('Funding only available on testnet');
        }
        
        try {
            const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error('Funding failed');
            }
        } catch (error) {
            console.error('Failed to fund account:', error);
            throw error;
        }
    }
}

// Export for use in other files
window.StellarWallet = StellarWallet;
