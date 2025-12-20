// ============================================
// CRYPTO PORTFOLIO TRACKER - PORTFOLIO MODULE
// ============================================

// Input validation helpers
const Validation = {
    // Validate symbol (alphanumeric, 1-10 chars)
    symbol(symbol) {
        if (!symbol || typeof symbol !== 'string') return null;
        const clean = symbol.toUpperCase().trim();
        if (!/^[A-Z0-9]{1,10}$/.test(clean)) return null;
        return clean;
    },

    // Validate name (sanitize XSS, max 50 chars)
    name(name, fallback = '') {
        if (!name || typeof name !== 'string') return fallback;
        // Remove HTML tags and limit length
        return name.replace(/<[^>]*>/g, '').trim().substring(0, 50) || fallback;
    },

    // Validate positive number
    positiveNumber(value) {
        const num = parseFloat(value);
        if (!Number.isFinite(num) || num < 0) return null;
        return num;
    },

    // Validate non-zero positive number
    nonZeroNumber(value) {
        const num = this.positiveNumber(value);
        if (num === null || num === 0) return null;
        return num;
    }
};

const Portfolio = {

    // Memoization cache for portfolio history
    _historyCache: {
        data: null,
        timeRange: null,
        txCount: null,
        lastUpdate: null
    },

    // Invalidate history cache (call when data changes)
    invalidateHistoryCache() {
        this._historyCache.data = null;
    },

    // Get current price for symbol
    getPrice(symbol, currency = null) {
        const curr = currency || state.currency;
        return state.prices[symbol]?.[curr]?.PRICE || 0;
    },
    
    // Get total portfolio value
    getTotalValue() {
        let total = 0;
        state.portfolio.forEach(asset => {
            const price = this.getPrice(asset.symbol);
            const qty = parseFloat(asset.qty) || 0;
            total += qty * price;
        });
        return total;
    },

    // Get total invested
    // I costi sono memorizzati in EUR (costBasisEUR, avgPriceEUR, priceEUR)
    getTotalInvested() {
        let total = 0;

        state.portfolio.forEach(asset => {
            // Priorità: costBasisEUR > calcolo da transazioni > avgPriceEUR
            if (asset.costBasisEUR !== undefined && asset.costBasisEUR > 0) {
                // Usa il costo base memorizzato in EUR
                total += asset.costBasisEUR;
            } else {
                // Fallback: calcola dalle transazioni per questo asset
                const assetTxs = state.transactions.filter(
                    tx => tx.asset === asset.symbol && tx.type === 'BUY'
                );

                if (assetTxs.length > 0) {
                    // Calcola costo totale dalle transazioni (usa priceEUR)
                    let txCost = 0;
                    assetTxs.forEach(tx => {
                        const price = parseFloat(tx.priceEUR) || parseFloat(tx.price) || 0;
                        txCost += (parseFloat(tx.qty) || 0) * price;
                    });
                    total += txCost;
                } else {
                    // Ultimo fallback: usa avgPriceEUR * qty originale
                    const originalQty = this.getOriginalQty(asset.symbol);
                    const avgPrice = parseFloat(asset.avgPriceEUR) || parseFloat(asset.avgPrice) || 0;
                    total += originalQty * avgPrice;
                }
            }
        });

        // Converti in valuta corrente se non EUR
        if (state.currency !== 'EUR') {
            const eurToUsdRate = this.getEurToUsdRate();
            total *= eurToUsdRate;
        }

        return total;
    },

    // Tasso EUR → USD
    getEurToUsdRate() {
        const btcEur = state.prices['BTC']?.EUR?.PRICE;
        const btcUsd = state.prices['BTC']?.USD?.PRICE;
        if (btcEur && btcUsd) {
            return btcUsd / btcEur;
        }
        return 1.08; // Fallback
    },

    // Ottiene la quantità originale (prima del sync wallet)
    // Priorità: asset.originalQty > CONFIG.DEFAULT_PORTFOLIO.originalQty > asset.qty
    getOriginalQty(symbol) {
        // Prima cerca nell'asset corrente
        const asset = state.portfolio.find(a => a.symbol === symbol);
        if (asset && asset.originalQty !== undefined && asset.originalQty > 0) {
            return parseFloat(asset.originalQty);
        }

        // Fallback al CONFIG
        const defaultAsset = CONFIG.DEFAULT_PORTFOLIO.find(a => a.symbol === symbol);
        if (defaultAsset) {
            return parseFloat(defaultAsset.originalQty || defaultAsset.qty) || 0;
        }

        // Ultimo fallback: qty corrente
        return asset ? parseFloat(asset.qty) || 0 : 0;
    },
    
    // Get conversion rate (USD to current currency)
    getConversionRate() {
        if (state.currency === 'USD') return 1;
        
        // Use BTC as reference for conversion
        const btcUSD = state.prices['BTC']?.USD?.PRICE || 1;
        const btcEUR = state.prices['BTC']?.EUR?.PRICE || 1;
        return btcEUR / btcUSD;
    },
    
    // Get P&L
    getPnL() {
        const value = this.getTotalValue();
        const invested = this.getTotalInvested();
        const pnl = value - invested;
        const pct = invested > 0 ? (pnl / invested) * 100 : 0;
        
        return { value: pnl, pct };
    },
    
    // Get allocation data
    getAllocation() {
        const total = this.getTotalValue();

        return state.portfolio.map(asset => {
            const price = this.getPrice(asset.symbol);
            const qty = parseFloat(asset.qty) || 0;
            const value = qty * price;
            const pct = total > 0 ? (value / total) * 100 : 0;

            return {
                symbol: asset.symbol,
                name: asset.name,
                value,
                pct,
                color: CONFIG.COLORS[asset.symbol] || CONFIG.COLORS.DEFAULT
            };
        }).sort((a, b) => b.value - a.value);
    },
    
    // Add new asset
    addAsset(symbol, name, qty, avgPrice) {
        // Validate inputs
        const validSymbol = Validation.symbol(symbol);
        if (!validSymbol) {
            console.error('addAsset: Invalid symbol:', symbol);
            return false;
        }

        const qtyNum = Validation.positiveNumber(qty);
        const priceNum = Validation.positiveNumber(avgPrice);

        if (qtyNum === null || priceNum === null) {
            console.error('addAsset: Invalid qty or price:', qty, avgPrice);
            return false;
        }

        const validName = Validation.name(name, validSymbol);

        // Check if already exists
        const existing = state.portfolio.find(a => a.symbol === validSymbol);

        if (existing) {
            // Update existing - calculate new average price
            const totalQty = existing.qty + qtyNum;
            const totalCost = (existing.qty * existing.avgPrice) + (qtyNum * priceNum);
            existing.avgPrice = totalCost / totalQty;
            existing.qty = totalQty;
        } else {
            state.portfolio.push({
                symbol: validSymbol,
                name: validName,
                qty: qtyNum,
                avgPrice: priceNum
            });
        }

        savePortfolio();
        return true;
    },
    
    // Update asset
    updateAsset(symbol, qty, avgPrice) {
        const validSymbol = Validation.symbol(symbol);
        if (!validSymbol) return false;

        const asset = state.portfolio.find(a => a.symbol === validSymbol);
        if (!asset) return false;

        const qtyNum = Validation.positiveNumber(qty);
        const priceNum = Validation.positiveNumber(avgPrice);

        if (qtyNum === null || priceNum === null) {
            console.error('updateAsset: Invalid qty or price:', qty, avgPrice);
            return false;
        }

        asset.qty = qtyNum;
        asset.avgPrice = priceNum;

        savePortfolio();
        return true;
    },
    
    // Remove asset
    removeAsset(symbol) {
        const index = state.portfolio.findIndex(a => a.symbol === symbol);
        if (index === -1) return false;
        
        state.portfolio.splice(index, 1);
        savePortfolio();
        return true;
    },
    
    // Record a transaction
    addTransaction(type, asset, qty, price, note = '') {
        // Validate type
        const validType = (type || '').toUpperCase();
        if (!['BUY', 'SELL', 'SWAP'].includes(validType)) {
            console.error('addTransaction: Invalid type:', type);
            return null;
        }

        // Validate asset symbol
        const validAsset = Validation.symbol(asset);
        if (!validAsset) {
            console.error('addTransaction: Invalid asset:', asset);
            return null;
        }

        // Validate qty and price
        const qtyNum = Validation.nonZeroNumber(qty);
        const priceNum = Validation.positiveNumber(price);

        if (qtyNum === null || priceNum === null) {
            console.error('addTransaction: Invalid qty or price:', qty, price);
            return null;
        }

        // Sanitize note
        const validNote = Validation.name(note, '');

        const tx = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: validType,
            asset: validAsset,
            qty: qtyNum,
            price: priceNum,
            note: validNote
        };

        state.transactions.push(tx);
        saveTransactions();

        // Update portfolio based on transaction
        if (validType === 'BUY') {
            this.addAsset(validAsset, validAsset, qtyNum, priceNum);
        } else if (validType === 'SELL') {
            this.sellAsset(validAsset, qtyNum);
        }

        return tx;
    },
    
    // Sell asset (reduce qty)
    sellAsset(symbol, qty) {
        const asset = state.portfolio.find(a => a.symbol === symbol);
        if (!asset) return false;
        
        asset.qty = Math.max(0, asset.qty - parseFloat(qty));
        
        // Remove if qty is 0
        if (asset.qty <= 0) {
            this.removeAsset(symbol);
        } else {
            savePortfolio();
        }
        
        return true;
    },
    
    // Swap assets
    swapAssets(fromSymbol, fromQty, toSymbol, toQty, note = '') {
        const fromPrice = this.getPrice(fromSymbol, 'USD');
        const toPrice = this.getPrice(toSymbol, 'USD');
        
        // Record sell transaction
        this.addTransaction('SELL', fromSymbol, fromQty, fromPrice, `Swap to ${toSymbol}`);
        
        // Record buy transaction
        this.addTransaction('BUY', toSymbol, toQty, toPrice, `Swap from ${fromSymbol}. ${note}`);
        
        return true;
    },
    
    // Add price target
    addTarget(symbol, targetPrice, type, note = '') {
        const target = {
            id: Date.now(),
            symbol: symbol.toUpperCase(),
            price: parseFloat(targetPrice),
            type: type.toUpperCase(), // BUY, SELL
            note,
            createdAt: new Date().toISOString(),
            triggered: false
        };
        
        state.targets.push(target);
        saveTargets();
        
        return target;
    },
    
    // Remove target
    removeTarget(id) {
        const index = state.targets.findIndex(t => t.id === id);
        if (index === -1) return false;
        
        state.targets.splice(index, 1);
        saveTargets();
        return true;
    },
    
    // Check if any targets are hit
    checkTargets() {
        const triggered = [];
        
        state.targets.forEach(target => {
            if (target.triggered) return;
            
            const currentPrice = this.getPrice(target.symbol, 'USD');
            if (!currentPrice) return;
            
            let hit = false;
            
            if (target.type === 'SELL' && currentPrice >= target.price) {
                hit = true;
            } else if (target.type === 'BUY' && currentPrice <= target.price) {
                hit = true;
            }
            
            if (hit) {
                target.triggered = true;
                triggered.push(target);
            }
        });
        
        if (triggered.length > 0) {
            saveTargets();
        }
        
        return triggered;
    },
    
    // Get portfolio history (for chart)
    // Calcola il valore del portfolio in modo INCREMENTALE basandosi sulle transazioni
    // Usa lookup per DATA (non per indice) per correggere allineamento prezzi
    // Per timeframe ALL, parte dalla prima transazione
    getPortfolioHistory() {
        if (!state.portfolio.length) return [];

        // Use hourly data for short timeframes (1D, 1W)
        if (state.timeRange <= 7 && state.hourlyHistory) {
            return this.getHourlyPortfolioHistory();
        }

        // Check cache validity
        const cacheKey = `${state.timeRange}-${state.transactions.length}-${state.currency}`;
        if (this._historyCache.data &&
            this._historyCache.key === cacheKey &&
            this._historyCache.lastUpdate &&
            (Date.now() - this._historyCache.lastUpdate) < 30000) {
            return this._historyCache.data;
        }

        // Prepara le transazioni ordinate per data
        const sortedTx = [...state.transactions]
            .filter(tx => tx.type === 'BUY')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (sortedTx.length === 0) {
            console.log('📊 No BUY transactions found');
            return [];
        }

        // Crea una mappa di prezzi storici per ogni asset e data
        const priceMap = {};
        const allDates = new Set();

        state.portfolio.forEach(asset => {
            priceMap[asset.symbol] = {};
            const assetHistory = state.history[asset.symbol];
            if (assetHistory) {
                assetHistory.forEach(h => {
                    const dateStr = new Date(h.time * 1000).toISOString().split('T')[0];
                    priceMap[asset.symbol][dateStr] = h.close;
                    allDates.add(dateStr);
                });
            }
        });

        // Ordina tutte le date disponibili
        const sortedDates = Array.from(allDates).sort();

        if (sortedDates.length === 0) {
            console.log('📊 No price history available');
            return [];
        }

        // Determina la data di inizio
        const firstTxDate = sortedTx[0].date;
        const today = new Date().toISOString().split('T')[0];

        let startDate;
        if (state.timeRange === 0) {
            // ALL: parti dalla prima transazione
            startDate = firstTxDate;
        } else {
            // Timeframe specifico: parti da N giorni fa
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - state.timeRange);
            const daysAgoStr = daysAgo.toISOString().split('T')[0];
            // Ma non prima della prima transazione
            startDate = daysAgoStr > firstTxDate ? daysAgoStr : firstTxDate;
        }

        const rate = state.currency === 'EUR' ? this.getConversionRate() : 1;

        console.log(`📊 Chart: Building history from ${startDate} to ${today}, ${sortedTx.length} transactions`);

        const history = [];
        const lastKnownPrice = {};  // Per gestire date senza prezzo

        // Filtra le date dal startDate in poi
        const relevantDates = sortedDates.filter(d => d >= startDate && d <= today);

        for (const dateStr of relevantDates) {
            const timestamp = new Date(dateStr).getTime();

            // Calcola quali asset e quantità avevi a questa data
            const holdings = {};
            let invested = 0;

            for (const tx of sortedTx) {
                if (tx.date > dateStr) break;

                const symbol = tx.asset;
                const qty = parseFloat(tx.qty) || 0;
                const price = parseFloat(tx.price) || 0;

                holdings[symbol] = (holdings[symbol] || 0) + qty;
                invested += qty * price;
            }

            // Se non abbiamo ancora holdings, salta questa data
            if (Object.keys(holdings).length === 0) continue;

            // Calcola il valore del portfolio usando lookup per DATA
            let dayValue = 0;
            let hasValidPrice = false;

            for (const [symbol, qty] of Object.entries(holdings)) {
                // Cerca il prezzo per questa data specifica
                let price = priceMap[symbol]?.[dateStr];

                // Se non c'è prezzo per questa data, usa l'ultimo prezzo noto
                if (!price && lastKnownPrice[symbol]) {
                    price = lastKnownPrice[symbol];
                }

                if (price && price > 0) {
                    dayValue += price * qty;
                    lastKnownPrice[symbol] = price;
                    hasValidPrice = true;
                }
            }

            // Aggiungi solo se abbiamo almeno un prezzo valido
            if (hasValidPrice && dayValue > 0) {
                history.push({
                    time: timestamp,
                    value: dayValue * rate,
                    invested: invested * rate
                });
            }
        }

        console.log(`📊 Generated ${history.length} data points`);

        // Update cache
        this._historyCache = {
            data: history,
            key: cacheKey,
            lastUpdate: Date.now()
        };

        return history;
    },

    // Get hourly portfolio history for 1D/1W views
    getHourlyPortfolioHistory() {
        const firstAsset = state.portfolio[0];
        const baseHistory = state.hourlyHistory?.[firstAsset.symbol];

        if (!baseHistory || !baseHistory.length) {
            console.log('📊 No hourly data available');
            return [];
        }

        // For 1D use last 24 hours, for 1W use last 168 hours
        const hoursToShow = state.timeRange === 1 ? 24 : 168;
        const limit = Math.min(hoursToShow, baseHistory.length);
        const startIdx = Math.max(0, baseHistory.length - limit);

        console.log(`📊 Hourly Chart: ${limit} hours, timeRange=${state.timeRange}`);

        const history = [];

        for (let i = startIdx; i < baseHistory.length; i++) {
            const timestamp = baseHistory[i].time * 1000;
            let hourValue = 0;

            // Calculate portfolio value at this hour
            state.portfolio.forEach(asset => {
                const assetHistory = state.hourlyHistory?.[asset.symbol];
                if (assetHistory && assetHistory[i]) {
                    const qty = parseFloat(asset.qty) || 0;
                    hourValue += assetHistory[i].close * qty;
                }
            });

            // Convert if EUR
            if (state.currency === 'EUR') {
                hourValue *= this.getConversionRate();
            }

            history.push({
                time: timestamp,
                value: hourValue
            });
        }

        return history;
    },

    // Get transaction markers for chart
    getTransactionMarkers() {
        return state.transactions.map(tx => ({
            date: tx.date,
            type: tx.type,
            symbol: tx.asset,
            qty: tx.qty,
            price: tx.price,
            color: CONFIG.COLORS[tx.asset] || CONFIG.COLORS.DEFAULT
        }));
    },
    
    // Format helpers
    formatCurrency(value, compact = true) {
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        if (compact && Math.abs(value) >= 1000000) {
            return `${sym}${(value / 1000000).toFixed(2)}M`;
        }
        
        // Full precision for display
        return `${sym}${value.toLocaleString('it-IT', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    },
    
    // Compact format for table (no decimals for large numbers)
    formatCurrencyCompact(value) {
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        if (Math.abs(value) >= 10000) {
            return `${sym}${value.toLocaleString('it-IT', { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0 
            })}`;
        }
        
        return `${sym}${value.toLocaleString('it-IT', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    },
    
    formatPrice(price) {
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        if (price >= 1000) {
            return `${sym}${price.toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
        }
        if (price >= 1) {
            return `${sym}${price.toFixed(4)}`;
        }
        return `${sym}${price.toFixed(6)}`;
    },
    
    formatNumber(num, decimals = 2) {
        return num.toLocaleString('it-IT', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },
    
    formatPct(pct) {
        const sign = pct >= 0 ? '+' : '';
        return `${sign}${pct.toFixed(2)}%`;
    }
};

// Export
window.Portfolio = Portfolio;
