// ============================================
// CRYPTO PORTFOLIO TRACKER - API MODULE
// ============================================

const API = {
    
    // Fetch all data
    async fetchAll() {
        state.isLoading = true;
        UI.showLoading(true);
        
        try {
            await Promise.all([
                this.fetchPrices(),
                this.fetchFearGreed(),
                this.fetchHistory()
            ]);
            
            // Run analysis after data loaded
            Analysis.runAll();

            state.lastUpdate = new Date();
            state.isLoading = false;

            // Render UI
            UI.renderAll();

            // Save daily portfolio snapshot for history chart
            const totalValue = Portfolio.getTotalValue();
            const totalInvested = Portfolio.getTotalInvested();
            const pnl = totalValue - totalInvested;
            savePortfolioSnapshot(totalValue, totalInvested, pnl);

            // Generate historical snapshots from transactions (if not already done)
            const existingSnapshots = loadPortfolioSnapshots();
            if (existingSnapshots.length < 30) {
                console.log('Generating historical snapshots from existing transactions...');
                generateAndSaveHistoricalSnapshots();
            }
            
        } catch (error) {
            console.error('Error fetching data:', error);
            state.isLoading = false;
        }
        
        UI.showLoading(false);
    },
    
    // Fetch live prices with 24h, 7d, 30d changes
    async fetchPrices() {
        try {
            const symbols = [...state.portfolio.map(a => a.symbol), 'BTC'].join(',');
            
            // Fetch current prices
            const priceUrl = `${CONFIG.APIS.CRYPTOCOMPARE}/pricemultifull?fsyms=${symbols}&tsyms=USD,EUR&api_key=${CONFIG.API_KEY}`;
            const priceRes = await fetch(priceUrl);
            const priceData = await priceRes.json();
            
            state.prices = priceData.RAW || {};
            
            // Calculate changes from history
            this.calculateChanges();
            
        } catch (e) {
            console.error('Error fetching prices:', e);
        }
    },
    
    // Calculate 24h, 7d, 30d changes
    calculateChanges() {
        const symbols = [...state.portfolio.map(a => a.symbol), 'BTC'];
        
        symbols.forEach(symbol => {
            const history = state.history[symbol];
            const currentPrice = state.prices[symbol]?.USD?.PRICE;
            
            if (!history || !currentPrice) {
                state.changes[symbol] = { d1: 0, d7: 0, d30: 0 };
                return;
            }
            
            const len = history.length;
            
            // Get prices from history
            const price1d = len > 1 ? history[len - 2]?.close : currentPrice;
            const price7d = len > 7 ? history[len - 8]?.close : currentPrice;
            const price30d = len > 30 ? history[len - 31]?.close : currentPrice;
            
            state.changes[symbol] = {
                d1: price1d ? ((currentPrice - price1d) / price1d) * 100 : 0,
                d7: price7d ? ((currentPrice - price7d) / price7d) * 100 : 0,
                d30: price30d ? ((currentPrice - price30d) / price30d) * 100 : 0
            };
        });
    },
    
    // Fetch Fear & Greed Index
    async fetchFearGreed() {
        try {
            const res = await fetch(CONFIG.APIS.FNG);
            const data = await res.json();
            const val = parseInt(data.data[0].value);
            
            let label = 'Neutral';
            if (val <= 20) label = 'Extreme Fear';
            else if (val <= 40) label = 'Fear';
            else if (val <= 60) label = 'Neutral';
            else if (val <= 80) label = 'Greed';
            else label = 'Extreme Greed';
            
            state.fng = { value: val, label };
            
        } catch (e) {
            console.error('Error fetching Fear & Greed:', e);
        }
    },
    
    // Fetch historical data for all assets
    async fetchHistory() {
        const symbols = [...state.portfolio.map(a => a.symbol), 'BTC'];
        
        const promises = symbols.map(async (symbol) => {
            // Skip if already cached and recent
            if (state.history[symbol]?.length >= 365) return;
            
            try {
                const url = `${CONFIG.APIS.CRYPTOCOMPARE}/v2/histoday?fsym=${symbol}&tsym=USD&limit=365&api_key=${CONFIG.API_KEY}`;
                const res = await fetch(url);
                const data = await res.json();
                
                state.history[symbol] = data.Data?.Data || [];
                
            } catch (e) {
                console.error(`Error fetching history for ${symbol}:`, e);
            }
        });
        
        await Promise.all(promises);
        
        // Analyze BTC trend
        this.analyzeBTCTrend();
    },
    
    // Analyze BTC trend vs 200 MA
    analyzeBTCTrend() {
        const btcHistory = state.history['BTC'];
        if (!btcHistory || btcHistory.length < 200) return;
        
        const closes = btcHistory.map(d => d.close);
        const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
        const lastPrice = closes[closes.length - 1];
        
        state.btcTrend = {
            price: lastPrice,
            sma200,
            above: lastPrice > sma200,
            pct: ((lastPrice - sma200) / sma200) * 100
        };
    },
    
    // Start auto-refresh timers
    startAutoRefresh() {
        // Clear existing timers
        this.stopAutoRefresh();
        
        // Prices - every 30 seconds
        state.timers.prices = setInterval(async () => {
            UI.pulseIndicator();
            await this.fetchPrices();
            Analysis.runAll();
            UI.updatePrices();
            UI.updateKPIs();
        }, CONFIG.REFRESH.PRICES);
        
        // Charts - every 60 seconds
        state.timers.charts = setInterval(() => {
            Charts.renderMain();
            Charts.renderAllocation();
        }, CONFIG.REFRESH.CHARTS);
        
        // Fear & Greed - every 5 minutes
        state.timers.fng = setInterval(async () => {
            await this.fetchFearGreed();
            UI.updateKPIs();
        }, CONFIG.REFRESH.FNG);
        
        // History - every 15 minutes
        state.timers.history = setInterval(async () => {
            await this.fetchHistory();
            Charts.renderMain();
        }, CONFIG.REFRESH.HISTORY);
        
        console.log('Auto-refresh started');
    },
    
    // Stop auto-refresh
    stopAutoRefresh() {
        Object.values(state.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        state.timers = { prices: null, charts: null, fng: null, history: null };
    }
};

// Export
window.API = API;
