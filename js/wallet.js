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

    // API endpoints
    APIS: {
        XRP: 'https://xrplcluster.com',
        ETHEREUM: 'https://api.etherscan.io/v2/api',  // V2 API
        HBAR: 'https://mainnet-public.mirrornode.hedera.com',
        XDC: 'https://xdc.blocksscan.io/api',
        XDC_RPC: 'https://rpc.xinfin.network'  // RPC alternativo per balance
    },

    // QNT token contract address on Ethereum
    QNT_CONTRACT: '0x4a220E6096B25EADb88358cb44068A3248254675',

    // Etherscan API key (free tier: 5 calls/sec, 100k calls/day)
    ETHERSCAN_API_KEY: 'X5NADVXS5711WTDXEQIAY34WJ1HXAGA5FE',

    // psXDC token contract address (Prime Staked XDC - liquid staking)
    PSXDC_CONTRACT: '0x9B8e12b0BAC165B86967E771d98B520Ec3F665A6',

    // Initialize wallet module
    init() {
        this.loadAddresses();
        this.loadLastSync();
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
            // Using Etherscan V2 API with chainid=1 (Ethereum mainnet)
            const url = `${this.APIS.ETHEREUM}?chainid=1&module=account&action=tokenbalance&contractaddress=${this.QNT_CONTRACT}&address=${address}&tag=latest&apikey=${this.ETHERSCAN_API_KEY}`;

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
            let useRpcFallback = false;

            // 1. Try BlocksScan API first
            try {
                const nativeUrl = `${this.APIS.XDC}?module=account&action=balance&address=${normalizedAddress}`;
                const nativeResponse = await fetch(nativeUrl, { timeout: 5000 });

                if (nativeResponse.ok) {
                    const nativeData = await nativeResponse.json();
                    if (nativeData.status === '1' && nativeData.result) {
                        const nativeBalance = parseInt(nativeData.result) / Math.pow(10, 18);
                        totalBalance += nativeBalance;
                        console.log(`XDC native balance (BlocksScan): ${nativeBalance}`);
                    }
                } else {
                    useRpcFallback = true;
                }
            } catch (e) {
                console.warn('BlocksScan API failed, using RPC fallback');
                useRpcFallback = true;
            }

            // 1b. Fallback to RPC if BlocksScan fails
            if (useRpcFallback) {
                try {
                    const rpcResponse = await fetch(this.APIS.XDC_RPC, {
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
                        console.log(`XDC native balance (RPC): ${nativeBalance}`);
                    }
                } catch (e) {
                    console.error('XDC RPC fallback failed:', e);
                }
            }

            // 2. Try to fetch psXDC (staked) token balance
            try {
                const tokenUrl = `${this.APIS.XDC}?module=account&action=tokenbalance&contractaddress=${this.PSXDC_CONTRACT}&address=${normalizedAddress}`;
                const tokenResponse = await fetch(tokenUrl, { timeout: 5000 });

                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    if (tokenData.status === '1' && tokenData.result) {
                        // psXDC has 18 decimals, 1:1 ratio with XDC
                        const stakedBalance = parseInt(tokenData.result) / Math.pow(10, 18);
                        totalBalance += stakedBalance;
                        console.log(`XDC staked (psXDC) balance: ${stakedBalance}`);
                    }
                }
            } catch (e) {
                console.warn('psXDC balance fetch failed (API may be down)');
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
                console.error(`Error syncing ${asset.symbol}:`, e);
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
            const url = `${this.APIS.ETHEREUM}?chainid=1&module=account&action=tokentx&contractaddress=${this.QNT_CONTRACT}&address=${address}&sort=asc&apikey=${this.ETHERSCAN_API_KEY}`;
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

    // Fetch XDC transaction history (native + psXDC)
    async fetchXDCTransactions(address) {
        if (!address) return [];

        try {
            const normalizedAddress = address.toLowerCase().startsWith('xdc')
                ? '0x' + address.slice(3)
                : address;

            const transactions = [];

            // 1. Native XDC transactions via BlocksScan API
            try {
                const nativeUrl = `${this.APIS.XDC}?module=account&action=txlist&address=${normalizedAddress}&sort=asc`;
                const nativeResponse = await fetch(nativeUrl, { timeout: 10000 });

                if (!nativeResponse.ok) {
                    console.warn('XDC BlocksScan API non disponibile per transazioni (status:', nativeResponse.status, ')');
                    return transactions;
                }

                const nativeData = await nativeResponse.json();

                if (nativeData.status === '1' && nativeData.result && Array.isArray(nativeData.result)) {
                    for (const tx of nativeData.result) {
                        if (tx.to && tx.to.toLowerCase() === normalizedAddress.toLowerCase() && tx.value !== '0') {
                            const amount = parseInt(tx.value) / Math.pow(10, 18);
                            const date = new Date(parseInt(tx.timeStamp) * 1000);

                            // Skip very small amounts (likely fees/dust)
                            if (amount > 1) {
                                transactions.push({
                                    type: 'BUY',
                                    asset: 'XDC',
                                    qty: amount,
                                    date: date.toISOString().split('T')[0],
                                    timestamp: date.getTime(),
                                    hash: tx.hash,
                                    from: tx.from
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('XDC transactions API error:', e.message);
            }

            console.log(`XDC: Trovate ${transactions.length} transazioni`);
            return transactions;
        } catch (e) {
            console.error('Error fetching XDC transactions:', e);
            return [];
        }
    },

    // Fetch historical price for a specific date
    async fetchHistoricalPrice(symbol, timestamp) {
        try {
            // CryptoCompare API for historical price
            const url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${symbol}&tsyms=EUR,USD&ts=${Math.floor(timestamp / 1000)}&api_key=${CONFIG.API_KEY}`;
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
