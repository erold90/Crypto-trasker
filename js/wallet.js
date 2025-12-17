// ============================================
// CRYPTO PORTFOLIO TRACKER - WALLET MODULE
// ============================================
// Reads balances directly from blockchain addresses

const Wallet = {

    // Wallet addresses configuration
    addresses: {
        XRP: '',
        QNT: '',  // Ethereum address for ERC-20
        HBAR: '',
        XDC: ''
    },

    // API endpoints
    APIS: {
        XRP: 'https://xrplcluster.com',
        ETHEREUM: 'https://api.etherscan.io/api',
        HBAR: 'https://mainnet-public.mirrornode.hedera.com',
        XDC: 'https://xdc.blocksscan.io/api'
    },

    // QNT token contract address on Ethereum
    QNT_CONTRACT: '0x4a220E6096B25EADb88358cb44068A3248254675',

    // psXDC token contract address (Prime Staked XDC - liquid staking)
    PSXDC_CONTRACT: '0x9B8e12b0BAC165B86967E771d98B520Ec3F665A6',

    // Initialize wallet module
    init() {
        this.loadAddresses();
    },

    // Load addresses from localStorage or defaults
    loadAddresses() {
        try {
            const saved = localStorage.getItem('cpt_wallets_v1');
            if (saved) {
                const addresses = JSON.parse(saved);
                this.addresses = { ...this.addresses, ...addresses };
            } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_WALLETS) {
                // Use default wallets from config
                this.addresses = { ...this.addresses, ...CONFIG.DEFAULT_WALLETS };
                this.saveAddresses();
            }
        } catch (e) {
            console.error('Error loading wallet addresses:', e);
        }
    },

    // Save addresses to localStorage
    saveAddresses() {
        localStorage.setItem('cpt_wallets_v1', JSON.stringify(this.addresses));
    },

    // Set wallet address
    setAddress(symbol, address) {
        this.addresses[symbol.toUpperCase()] = address;
        this.saveAddresses();
    },

    // Get wallet address
    getAddress(symbol) {
        return this.addresses[symbol.toUpperCase()] || '';
    },

    // ============================================
    // BLOCKCHAIN API CALLS
    // ============================================

    // Fetch XRP balance from XRPL
    async fetchXRPBalance(address) {
        if (!address) return null;

        try {
            const response = await fetch(this.APIS.XRP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: 'account_info',
                    params: [{
                        account: address,
                        ledger_index: 'validated'
                    }]
                })
            });

            const data = await response.json();

            if (data.result?.account_data?.Balance) {
                // Balance is in drops (1 XRP = 1,000,000 drops)
                const drops = parseInt(data.result.account_data.Balance);
                return drops / 1000000;
            }

            console.warn('XRP balance not found:', data);
            return null;
        } catch (e) {
            console.error('Error fetching XRP balance:', e);
            return null;
        }
    },

    // Fetch QNT (ERC-20) balance from Ethereum
    async fetchQNTBalance(address) {
        if (!address) return null;

        try {
            // Using Etherscan API (free tier, limited requests)
            const url = `${this.APIS.ETHEREUM}?module=account&action=tokenbalance&contractaddress=${this.QNT_CONTRACT}&address=${address}&tag=latest`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === '1' && data.result) {
                // QNT has 18 decimals
                const balance = parseInt(data.result) / Math.pow(10, 18);
                return balance;
            }

            console.warn('QNT balance not found:', data);
            return null;
        } catch (e) {
            console.error('Error fetching QNT balance:', e);
            return null;
        }
    },

    // Fetch HBAR balance from Hedera Mirror Node
    async fetchHBARBalance(accountId) {
        if (!accountId) return null;

        try {
            const url = `${this.APIS.HBAR}/api/v1/accounts/${accountId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.balance?.balance !== undefined) {
                // Balance is in tinybars (1 HBAR = 100,000,000 tinybars)
                const tinybars = data.balance.balance;
                return tinybars / 100000000;
            }

            console.warn('HBAR balance not found:', data);
            return null;
        } catch (e) {
            console.error('Error fetching HBAR balance:', e);
            return null;
        }
    },

    // Fetch XDC balance (native + psXDC staking)
    async fetchXDCBalance(address) {
        if (!address) return null;

        try {
            // Convert xdc prefix to 0x if needed
            const normalizedAddress = address.toLowerCase().startsWith('xdc')
                ? '0x' + address.slice(3)
                : address;

            let totalBalance = 0;

            // 1. Fetch native XDC balance
            const nativeUrl = `${this.APIS.XDC}?module=account&action=balance&address=${normalizedAddress}`;
            const nativeResponse = await fetch(nativeUrl);
            const nativeData = await nativeResponse.json();

            if (nativeData.status === '1' && nativeData.result) {
                const nativeBalance = parseInt(nativeData.result) / Math.pow(10, 18);
                totalBalance += nativeBalance;
                console.log(`XDC native balance: ${nativeBalance}`);
            }

            // 2. Fetch psXDC (staked) token balance
            const tokenUrl = `${this.APIS.XDC}?module=account&action=tokenbalance&contractaddress=${this.PSXDC_CONTRACT}&address=${normalizedAddress}`;
            const tokenResponse = await fetch(tokenUrl);
            const tokenData = await tokenResponse.json();

            if (tokenData.status === '1' && tokenData.result) {
                // psXDC has 18 decimals, 1:1 ratio with XDC
                const stakedBalance = parseInt(tokenData.result) / Math.pow(10, 18);
                totalBalance += stakedBalance;
                console.log(`XDC staked (psXDC) balance: ${stakedBalance}`);
            }

            console.log(`XDC total balance: ${totalBalance}`);
            return totalBalance > 0 ? totalBalance : null;
        } catch (e) {
            console.error('Error fetching XDC balance:', e);
            return null;
        }
    },

    // ============================================
    // SYNC FUNCTIONS
    // ============================================

    // Fetch balance for a specific asset
    async fetchBalance(symbol) {
        const address = this.getAddress(symbol);
        if (!address) return null;

        switch (symbol.toUpperCase()) {
            case 'XRP':
                return await this.fetchXRPBalance(address);
            case 'QNT':
                return await this.fetchQNTBalance(address);
            case 'HBAR':
                return await this.fetchHBARBalance(address);
            case 'XDC':
                return await this.fetchXDCBalance(address);
            default:
                console.warn(`Unknown symbol for wallet sync: ${symbol}`);
                return null;
        }
    },

    // Sync all wallet balances
    async syncAll() {
        const results = {
            success: [],
            failed: [],
            unchanged: []
        };

        for (const asset of state.portfolio) {
            const address = this.getAddress(asset.symbol);

            if (!address) {
                results.unchanged.push(asset.symbol);
                continue;
            }

            try {
                const balance = await this.fetchBalance(asset.symbol);

                if (balance !== null && !isNaN(balance)) {
                    const oldQty = asset.qty;
                    asset.qty = balance;

                    if (Math.abs(oldQty - balance) > 0.0001) {
                        results.success.push({
                            symbol: asset.symbol,
                            oldQty,
                            newQty: balance
                        });
                    } else {
                        results.unchanged.push(asset.symbol);
                    }
                } else {
                    results.failed.push(asset.symbol);
                }
            } catch (e) {
                console.error(`Error syncing ${asset.symbol}:`, e);
                results.failed.push(asset.symbol);
            }
        }

        // Save updated portfolio
        if (results.success.length > 0) {
            savePortfolio();
        }

        return results;
    },

    // Sync single asset
    async syncAsset(symbol) {
        const asset = state.portfolio.find(a => a.symbol === symbol.toUpperCase());
        if (!asset) return { success: false, message: 'Asset non trovato' };

        const address = this.getAddress(symbol);
        if (!address) return { success: false, message: 'Indirizzo wallet non configurato' };

        try {
            const balance = await this.fetchBalance(symbol);

            if (balance !== null && !isNaN(balance)) {
                const oldQty = asset.qty;
                asset.qty = balance;
                savePortfolio();

                return {
                    success: true,
                    oldQty,
                    newQty: balance,
                    changed: Math.abs(oldQty - balance) > 0.0001
                };
            }

            return { success: false, message: 'Impossibile leggere il saldo' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // Check if wallet is configured for an asset
    hasWallet(symbol) {
        return !!this.getAddress(symbol);
    },

    // Get sync status summary
    getSyncStatus() {
        const status = {};
        for (const asset of state.portfolio) {
            status[asset.symbol] = {
                configured: this.hasWallet(asset.symbol),
                address: this.getAddress(asset.symbol)
            };
        }
        return status;
    }
};

// Initialize on load
Wallet.init();

// Export
window.Wallet = Wallet;
