// ============================================
// CRYPTO PORTFOLIO TRACKER - PORTFOLIO MODULE
// ============================================

const Portfolio = {
    
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
    getTotalInvested() {
        let total = 0;
        const rate = this.getConversionRate();

        state.portfolio.forEach(asset => {
            // avgPrice is in USD, convert if needed
            const qty = parseFloat(asset.qty) || 0;
            const avgPrice = parseFloat(asset.avgPrice) || 0;
            const avgInCurrency = avgPrice * rate;
            total += qty * avgInCurrency;
        });
        return total;
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
        // Check if already exists
        const existing = state.portfolio.find(a => a.symbol === symbol.toUpperCase());

        // Ensure numeric values
        const qtyNum = parseFloat(qty);
        const priceNum = parseFloat(avgPrice);

        if (existing) {
            // Update existing - calculate new average price
            const totalQty = existing.qty + qtyNum;
            const totalCost = (existing.qty * existing.avgPrice) + (qtyNum * priceNum);
            existing.avgPrice = totalCost / totalQty;
            existing.qty = totalQty;
        } else {
            state.portfolio.push({
                symbol: symbol.toUpperCase(),
                name: name || symbol.toUpperCase(),
                qty: parseFloat(qty),
                avgPrice: parseFloat(avgPrice)
            });
        }
        
        savePortfolio();
        return true;
    },
    
    // Update asset
    updateAsset(symbol, qty, avgPrice) {
        const asset = state.portfolio.find(a => a.symbol === symbol);
        if (!asset) return false;
        
        asset.qty = parseFloat(qty);
        asset.avgPrice = parseFloat(avgPrice);
        
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
        const tx = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: type.toUpperCase(), // BUY, SELL, SWAP
            asset: asset.toUpperCase(),
            qty: parseFloat(qty),
            price: parseFloat(price),
            note
        };
        
        state.transactions.push(tx);
        saveTransactions();
        
        // Update portfolio based on transaction
        if (type === 'BUY') {
            this.addAsset(asset, asset, qty, price);
        } else if (type === 'SELL') {
            this.sellAsset(asset, qty);
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
    // Combines real snapshots (when available) with estimated values (from price history)
    getPortfolioHistory() {
        if (!state.portfolio.length) return [];

        const firstAsset = state.portfolio[0];
        const baseHistory = state.history[firstAsset.symbol];

        if (!baseHistory) return [];

        const limit = state.timeRange === 0 ? baseHistory.length : Math.min(state.timeRange, baseHistory.length);
        const startIdx = baseHistory.length - limit;

        // Load real snapshots and create date-keyed map
        const snapshots = loadPortfolioSnapshots();
        const snapshotMap = {};
        snapshots.forEach(s => {
            snapshotMap[s.date] = s.value;
        });

        console.log(`📊 Chart: ${snapshots.length} snapshots loaded, timeRange=${state.timeRange}`);

        const history = [];
        let snapshotHits = 0;
        let estimatedDays = 0;

        for (let i = startIdx; i < baseHistory.length; i++) {
            const timestamp = baseHistory[i].time * 1000;
            const dateStr = new Date(timestamp).toISOString().split('T')[0];

            let dayValue = 0;

            // Check if we have a real snapshot for this date
            if (snapshotMap[dateStr] !== undefined) {
                // Use real snapshot value
                dayValue = snapshotMap[dateStr];
                snapshotHits++;
            } else {
                // Estimate from price history (legacy method)
                state.portfolio.forEach(asset => {
                    const assetHistory = state.history[asset.symbol];
                    if (assetHistory && assetHistory[i]) {
                        const qty = parseFloat(asset.qty) || 0;
                        dayValue += assetHistory[i].close * qty;
                    }
                });

                // Convert if EUR
                if (state.currency === 'EUR') {
                    dayValue *= this.getConversionRate();
                }
                estimatedDays++;
            }

            history.push({
                time: timestamp,
                value: dayValue
            });
        }

        console.log(`   Snapshot hits: ${snapshotHits}, Estimated days: ${estimatedDays}`);

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
