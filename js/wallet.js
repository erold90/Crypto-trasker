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

    // Last sync timestamp
    lastSync: null,

    // Race condition guard
    isSyncing: false,

    // Default timeout for API calls (10 seconds)
    API_TIMEOUT: 10000,

    // API endpoints
    APIS: {
        XRP: 'https://xrplcluster.com',
        ETHEREUM_V1: 'https://api.etherscan.io/api',  // V1 API (free tier)
        ETHEREUM_V2: 'https://api.etherscan.io/v2/api',  // V2 API (proxy)
        HBAR: 'https://mainnet-public.mirrornode.hedera.com',
        XDC_RPC: 'https://rpc.xinfin.network'  // Solo RPC (BlocksScan ha CORS issues)
    },

    // QNT token contract address on Ethereum
    QNT_CONTRACT: '0x4a220E6096B25EADb88358cb44068A3248254675',

    // Etherscan API key is now handled by server-side proxy
    // See /api/etherscan.js for the secure implementation

    // psXDC token contract address (Prime Staked XDC - liquid staking)
    PSXDC_CONTRACT: '0x9B8e12b0BAC165B86967E771d98B520Ec3F665A6',

    // Initialize wallet module
    init() {
        this.loadAddresses();
        this.loadLastSync();
    },

    // Fetch with timeout wrapper
    async fetchWithTimeout(url, options = {}, timeout = null) {
        const controller = new AbortController();
        const timeoutMs = timeout || this.API_TIMEOUT;

        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                throw new Error(`Timeout dopo ${timeoutMs / 1000}s`);
            }
            throw e;
        }
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
            const response = await this.fetchWithTimeout(this.APIS.XRP, {
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
            console.error('Error fetching XRP balance:', e.message);
            return null;
        }
    },

    // Fetch QNT (ERC-20) balance from Ethereum
    async fetchQNTBalance(address) {
        if (!address) return null;

        try {
            // Build URL based on proxy mode
            let url;
            if (CONFIG.USE_PROXY) {
                // Use proxy endpoint (V2 API)
                url = `${window.location.origin}${CONFIG.APIS.PROXY.ETHERSCAN}?module=account&action=tokenbalance&contractaddress=${this.QNT_CONTRACT}&address=${address}&tag=latest`;
            } else {
                // Direct call using V1 API (free tier compatible)
                url = `${this.APIS.ETHEREUM_V1}?module=account&action=tokenbalance&contractaddress=${this.QNT_CONTRACT}&address=${address}&tag=latest&apikey=${CONFIG.ETHERSCAN_API_KEY || ''}`;
            }

            const response = await this.fetchWithTimeout(url);
            const data = await response.json();

            if (data.status === '1' && data.result) {
                // QNT has 18 decimals
                const balance = parseInt(data.result) / Math.pow(10, 18);
                return balance;
            }

            console.warn('QNT balance not found:', data);
            return null;
        } catch (e) {
            console.error('Error fetching QNT balance:', e.message);
            return null;
        }
    },

    // Fetch HBAR balance from Hedera Mirror Node
    async fetchHBARBalance(accountId) {
        if (!accountId) return null;

        try {
            const url = `${this.APIS.HBAR}/api/v1/accounts/${accountId}`;
            const response = await this.fetchWithTimeout(url);
            const data = await response.json();

            if (data.balance?.balance !== undefined) {
                // Balance is in tinybars (1 HBAR = 100,000,000 tinybars)
                const tinybars = data.balance.balance;
                return tinybars / 100000000;
            }

            console.warn('HBAR balance not found:', data);
            return null;
        } catch (e) {
            console.error('Error fetching HBAR balance:', e.message);
            return null;
        }
    },

    // Fetch XDC balance (native + psXDC staking)
    // Usa solo RPC (BlocksScan ha problemi CORS su GitHub Pages)
    async fetchXDCBalance(address) {
        if (!address) return null;

        try {
            // Convert xdc prefix to 0x if needed
            const normalizedAddress = address.toLowerCase().startsWith('xdc')
                ? '0x' + address.slice(3)
                : address;

            let totalBalance = 0;

            // 1. Fetch native XDC balance via RPC
            try {
                const rpcResponse = await this.fetchWithTimeout(this.APIS.XDC_RPC, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getBalance',
                        params: [normalizedAddress, 'latest'],
                        id: 1
                    })
                });
                const rpcData = await rpcResponse.json();
                if (rpcData.result) {
                    const nativeBalance = parseInt(rpcData.result, 16) / Math.pow(10, 18);
                    totalBalance += nativeBalance;
                    console.log(`XDC native balance: ${nativeBalance.toFixed(2)}`);
                }
            } catch (e) {
                console.error('XDC native balance fetch failed:', e.message);
            }

            // 2. Fetch psXDC (staked) token balance via RPC
            try {
                // balanceOf(address) selector = 0x70a08231
                const paddedAddress = normalizedAddress.replace('0x', '').toLowerCase().padStart(64, '0');
                const data = '0x70a08231' + paddedAddress;

                const rpcResponse = await this.fetchWithTimeout(this.APIS.XDC_RPC, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{
                            to: this.PSXDC_CONTRACT,
                            data: data
                        }, 'latest'],
                        id: 1
                    })
                });

                const rpcData = await rpcResponse.json();
                if (rpcData.result && rpcData.result !== '0x') {
                    // psXDC has 18 decimals, 1:1 ratio with XDC
                    const stakedBalance = parseInt(rpcData.result, 16) / Math.pow(10, 18);
                    if (stakedBalance > 0) {
                        totalBalance += stakedBalance;
                        console.log(`XDC staked (psXDC): ${stakedBalance.toFixed(2)}`);
                    }
                }
            } catch (e) {
                console.warn('psXDC balance fetch failed:', e.message);
            }

            console.log(`XDC total: ${totalBalance.toFixed(2)}`);
            return totalBalance > 0 ? totalBalance : null;
        } catch (e) {
            console.error('Error fetching XDC balance:', e.message);
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
        // Race condition guard - prevent multiple concurrent syncs
        if (this.isSyncing) {
            console.warn('Sync already in progress, skipping...');
            return { success: [], failed: [], unchanged: [], skipped: true };
        }

        this.isSyncing = true;

        const results = {
            success: [],
            failed: [],
            unchanged: []
        };

        try {
            for (const asset of state.portfolio) {
                const address = this.getAddress(asset.symbol);

                if (!address) {
                    results.unchanged.push(asset.symbol);
                    continue;
                }

                try {
                    const balance = await this.fetchBalance(asset.symbol);

                    if (balance !== null && !isNaN(balance) && balance >= 0) {
                        const oldQty = parseFloat(asset.qty) || 0;

                        // Protezione: non sovrascrivere con 0 se avevamo un saldo valido
                        if (balance === 0 && oldQty > 0) {
                            console.warn(`${asset.symbol}: API ha restituito 0, ma avevamo ${oldQty}. Skipping.`);
                            results.failed.push(asset.symbol);
                            continue;
                        }

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
                    console.error(`Error syncing ${asset.symbol}:`, e.message);
                    results.failed.push(asset.symbol);
                }
            }

            // Save updated portfolio
            if (results.success.length > 0) {
                savePortfolio();
            }

            // Update last sync timestamp
            this.lastSync = new Date();
            this.saveLastSync();
        } finally {
            this.isSyncing = false;
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

            if (balance !== null && !isNaN(balance) && balance >= 0) {
                const oldQty = parseFloat(asset.qty) || 0;

                // Protezione: non sovrascrivere con 0 se avevamo un saldo valido
                // (potrebbe essere un errore API temporaneo)
                if (balance === 0 && oldQty > 0) {
                    console.warn(`${symbol}: API ha restituito 0, ma avevamo ${oldQty}. Verifica manualmente.`);
                    return {
                        success: false,
                        message: 'Saldo 0 sospetto - verifica manualmente',
                        oldQty,
                        apiBalance: balance
                    };
                }

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
    },

    // Save last sync timestamp to localStorage
    saveLastSync() {
        if (this.lastSync) {
            localStorage.setItem('cpt_last_sync_v1', this.lastSync.toISOString());
        }
    },

    // Load last sync timestamp from localStorage
    loadLastSync() {
        try {
            const saved = localStorage.getItem('cpt_last_sync_v1');
            if (saved) {
                this.lastSync = new Date(saved);
            }
        } catch (e) {
            console.error('Error loading last sync:', e);
        }
    },

    // Get formatted last sync time (e.g., "5 min fa")
    getLastSyncFormatted() {
        if (!this.lastSync) return 'Mai sincronizzato';

        const now = new Date();
        const diffMs = now - this.lastSync;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);

        if (diffSec < 60) return 'Adesso';
        if (diffMin < 60) return `${diffMin} min fa`;
        if (diffHours < 24) return `${diffHours} ore fa`;

        return this.lastSync.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Check if any wallet is configured
    hasAnyWallet() {
        return state.portfolio.some(asset => this.hasWallet(asset.symbol));
    },

    // ============================================
    // TRANSACTION HISTORY IMPORT
    // ============================================

    // Fetch XRP transaction history
    async fetchXRPTransactions(address) {
        if (!address) return [];

        try {
            const response = await fetch(this.APIS.XRP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: 'account_tx',
                    params: [{
                        account: address,
                        ledger_index_min: -1,
                        ledger_index_max: -1,
                        limit: 100
                    }]
                })
            });

            const data = await response.json();
            const transactions = [];

            if (data.result?.transactions) {
                for (const tx of data.result.transactions) {
                    const meta = tx.meta || tx.metaData;
                    const txData = tx.tx || tx;

                    // Only consider Payment transactions where we receive XRP
                    if (txData.TransactionType === 'Payment' && txData.Destination === address) {
                        const delivered = meta?.delivered_amount;
                        let amount = 0;

                        if (typeof delivered === 'string') {
                            amount = parseInt(delivered) / 1000000; // drops to XRP
                        } else if (typeof delivered === 'object' && delivered.value) {
                            continue; // Skip token payments
                        }

                        if (amount > 0) {
                            const date = new Date((txData.date + 946684800) * 1000); // Ripple epoch
                            transactions.push({
                                type: 'BUY',
                                asset: 'XRP',
                                qty: amount,
                                date: date.toISOString().split('T')[0],
                                timestamp: date.getTime(),
                                hash: txData.hash,
                                from: txData.Account
                            });
                        }
                    }
                }
            }

            return transactions;
        } catch (e) {
            console.error('Error fetching XRP transactions:', e);
            return [];
        }
    },

    // Fetch QNT (ERC-20) transaction history
    async fetchQNTTransactions(address) {
        if (!address) return [];

        try {
            // Build URL based on proxy mode
            let url;
            if (CONFIG.USE_PROXY) {
                // Use proxy endpoint (V2 API)
                url = `${window.location.origin}${CONFIG.APIS.PROXY.ETHERSCAN}?module=account&action=tokentx&contractaddress=${this.QNT_CONTRACT}&address=${address}&sort=asc`;
            } else {
                // Direct call using V1 API (free tier compatible)
                url = `${this.APIS.ETHEREUM_V1}?module=account&action=tokentx&contractaddress=${this.QNT_CONTRACT}&address=${address}&sort=asc&apikey=${CONFIG.ETHERSCAN_API_KEY || ''}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            const transactions = [];

            if (data.status === '1' && data.result) {
                for (const tx of data.result) {
                    // Only incoming transfers (to our address)
                    if (tx.to.toLowerCase() === address.toLowerCase()) {
                        const amount = parseInt(tx.value) / Math.pow(10, 18);
                        const date = new Date(parseInt(tx.timeStamp) * 1000);

                        transactions.push({
                            type: 'BUY',
                            asset: 'QNT',
                            qty: amount,
                            date: date.toISOString().split('T')[0],
                            timestamp: date.getTime(),
                            hash: tx.hash,
                            from: tx.from
                        });
                    }
                }
            }

            return transactions;
        } catch (e) {
            console.error('Error fetching QNT transactions:', e);
            return [];
        }
    },

    // Fetch HBAR transaction history
    async fetchHBARTransactions(accountId) {
        if (!accountId) return [];

        try {
            // Usa order=desc per ottenere le transazioni più recenti (dove ci sono gli acquisti)
            // Aumenta limit a 200 per catturare più storico
            const url = `${this.APIS.HBAR}/api/v1/transactions?account.id=${accountId}&limit=200&order=desc`;
            const response = await fetch(url);
            const data = await response.json();
            const transactions = [];
            const seenHashes = new Set();  // Evita duplicati

            if (data.transactions) {
                for (const tx of data.transactions) {
                    // Skip transazioni fallite
                    if (tx.result !== 'SUCCESS') continue;

                    // Find transfers to our account
                    const transfers = tx.transfers || [];
                    for (const transfer of transfers) {
                        if (transfer.account === accountId && transfer.amount > 0) {
                            const amount = transfer.amount / 100000000; // tinybars to HBAR
                            const date = new Date(parseFloat(tx.consensus_timestamp) * 1000);
                            const txId = tx.transaction_id;

                            // Skip se già processato (deduplicazione)
                            if (seenHashes.has(txId)) continue;

                            // Skip importi molto piccoli (rewards/dust) - considera solo trasferimenti significativi
                            // Soglia abbassata a 50 HBAR per catturare più transazioni
                            if (amount > 50) {
                                seenHashes.add(txId);
                                transactions.push({
                                    type: 'BUY',
                                    asset: 'HBAR',
                                    qty: amount,
                                    date: date.toISOString().split('T')[0],
                                    timestamp: date.getTime(),
                                    hash: txId,
                                    from: 'exchange'
                                });
                            }
                        }
                    }
                }
            }

            // Ordina per timestamp crescente (cronologico)
            transactions.sort((a, b) => a.timestamp - b.timestamp);

            console.log(`HBAR: Trovate ${transactions.length} transazioni significative`);
            return transactions;
        } catch (e) {
            console.error('Error fetching HBAR transactions:', e);
            return [];
        }
    },

    // Fetch XDC transaction history
    // NOTA: Non disponibile su GitHub Pages (BlocksScan ha problemi CORS)
    // Le transazioni XDC devono essere inserite manualmente in CONFIG.TRANSACTIONS
    async fetchXDCTransactions(address) {
        if (!address) return [];

        // XDC transaction history non disponibile via RPC
        // BlocksScan API ha problemi CORS da GitHub Pages
        console.log('XDC: Transaction history non disponibile (usa CONFIG.TRANSACTIONS)');
        return [];
    },

    // Fetch historical price for a specific date
    async fetchHistoricalPrice(symbol, timestamp) {
        try {
            // Build URL based on proxy mode
            let url;
            if (CONFIG.USE_PROXY) {
                // Use proxy endpoint
                const proxyUrl = new URL(CONFIG.APIS.PROXY.CRYPTO, window.location.origin);
                proxyUrl.searchParams.set('endpoint', 'pricehistorical');
                proxyUrl.searchParams.set('fsym', symbol);
                proxyUrl.searchParams.set('tsyms', 'EUR,USD');
                proxyUrl.searchParams.set('ts', Math.floor(timestamp / 1000).toString());
                url = proxyUrl.toString();
            } else {
                // Direct call (for GitHub Pages fallback)
                url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${symbol}&tsyms=EUR,USD&ts=${Math.floor(timestamp / 1000)}&api_key=${CONFIG.API_KEY || ''}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`HTTP error fetching price for ${symbol}: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (data[symbol] && (data[symbol].EUR > 0 || data[symbol].USD > 0)) {
                return {
                    EUR: data[symbol].EUR || 0,
                    USD: data[symbol].USD || 0
                };
            }

            // Se il prezzo è 0, potrebbe essere un problema dell'API
            console.warn(`${symbol}: Prezzo storico non disponibile per ${new Date(timestamp).toISOString().split('T')[0]}`);
            return null;
        } catch (e) {
            console.error(`Error fetching historical price for ${symbol}:`, e);
            return null;
        }
    },

    // Import all transactions from blockchain
    async importAllTransactions(progressCallback) {
        const allTransactions = [];
        const symbols = ['XRP', 'QNT', 'HBAR', 'XDC'];

        for (const symbol of symbols) {
            const address = this.getAddress(symbol);
            if (!address) continue;

            if (progressCallback) progressCallback(`Lettura ${symbol}...`);

            let txs = [];
            switch (symbol) {
                case 'XRP':
                    txs = await this.fetchXRPTransactions(address);
                    break;
                case 'QNT':
                    txs = await this.fetchQNTTransactions(address);
                    break;
                case 'HBAR':
                    txs = await this.fetchHBARTransactions(address);
                    break;
                case 'XDC':
                    txs = await this.fetchXDCTransactions(address);
                    break;
            }

            console.log(`${symbol}: found ${txs.length} transactions`);

            // Fetch historical prices for each transaction
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                if (progressCallback) progressCallback(`${symbol}: prezzo ${i + 1}/${txs.length}...`);

                const price = await this.fetchHistoricalPrice(symbol, tx.timestamp);
                if (price) {
                    tx.priceEUR = price.EUR;
                    tx.priceUSD = price.USD;
                    tx.valueEUR = tx.qty * price.EUR;
                    tx.valueUSD = tx.qty * price.USD;
                }

                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 200));
            }

            allTransactions.push(...txs);
        }

        // Sort by date
        allTransactions.sort((a, b) => a.timestamp - b.timestamp);

        return allTransactions;
    },

    // Calculate weighted average price from transactions
    calculateAveragePrice(transactions, symbol) {
        const assetTxs = transactions.filter(tx => tx.asset === symbol && tx.type === 'BUY');

        if (assetTxs.length === 0) return null;

        let totalQty = 0;
        let totalValueEUR = 0;
        let totalValueUSD = 0;
        let validPriceCount = 0;

        for (const tx of assetTxs) {
            totalQty += tx.qty;
            if (tx.valueEUR && tx.valueEUR > 0) {
                totalValueEUR += tx.valueEUR;
                validPriceCount++;
            }
            if (tx.valueUSD && tx.valueUSD > 0) {
                totalValueUSD += tx.valueUSD;
            }
        }

        // Se non abbiamo prezzi validi, ritorna null
        if (validPriceCount === 0 || totalQty === 0) {
            console.warn(`${symbol}: Nessun prezzo storico valido trovato per ${assetTxs.length} transazioni`);
            return null;
        }

        return {
            totalQty,
            avgPriceEUR: totalValueEUR / totalQty,
            avgPriceUSD: totalValueUSD / totalQty,
            transactions: assetTxs.length,
            validPrices: validPriceCount
        };
    }
};

// Initialize on load
Wallet.init();

// Export
window.Wallet = Wallet;
