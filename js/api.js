// ============================================
// CRYPTO PORTFOLIO TRACKER - API MODULE
// ============================================
// Supports both proxy mode (Vercel) and direct mode (GitHub Pages)

const API = {

    // Build URL based on proxy mode
    buildCryptoUrl(endpoint, params = {}) {
        if (CONFIG.USE_PROXY) {
            // Use proxy endpoint
            const url = new URL(CONFIG.APIS.PROXY.CRYPTO, window.location.origin);
            url.searchParams.set('endpoint', endpoint);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
            return url.toString();
        } else {
            // Direct API call (requires API key in frontend - less secure)
            const url = new URL(`${CONFIG.APIS.DIRECT.CRYPTOCOMPARE}/${endpoint}`);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
            if (CONFIG.API_KEY) {
                url.searchParams.set('api_key', CONFIG.API_KEY);
            }
            return url.toString();
        }
    },

    buildFngUrl() {
        if (CONFIG.USE_PROXY) {
            return `${window.location.origin}${CONFIG.APIS.PROXY.FNG}`;
        } else {
            return CONFIG.APIS.DIRECT.FNG;
        }
    },

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

            // Generate historical snapshots from transactions on first load
            // Check if we need to regenerate (no generated snapshots or very few)
            const existingSnapshots = loadPortfolioSnapshots();
            const generatedCount = existingSnapshots.filter(s => s.generated).length;
            if (generatedCount < 100) {
                console.log('Generating historical snapshots from transactions...');
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

            const url = this.buildCryptoUrl('pricemultifull', {
                fsyms: symbols,
                tsyms: 'USD,EUR'
            });

            const priceRes = await fetch(url);
            const priceData = await priceRes.json();

            state.prices = priceData.RAW || {};

            // Calculate changes from history
            this.calculateChanges();

            console.log(`[API] Prices fetched via ${CONFIG.USE_PROXY ? 'proxy' : 'direct'}`);

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
            const url = this.buildFngUrl();
            const res = await fetch(url);
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
            // Skip if already cached and recent (730 days = 2 years)
            if (state.history[symbol]?.length >= 730) return;

            try {
                const url = this.buildCryptoUrl('v2/histoday', {
                    fsym: symbol,
                    tsym: 'USD',
                    limit: '730'  // 2 anni per supportare ALL timeframe
                });

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

    // Fetch hourly data for 1D/1W views
    async fetchHourlyHistory(hours = 24) {
        const symbols = [...state.portfolio.map(a => a.symbol), 'BTC'];

        // Initialize hourly history if not exists
        if (!state.hourlyHistory) state.hourlyHistory = {};

        const promises = symbols.map(async (symbol) => {
            try {
                const url = this.buildCryptoUrl('v2/histohour', {
                    fsym: symbol,
                    tsym: 'USD',
                    limit: hours.toString()
                });

                const res = await fetch(url);
                const data = await res.json();

                state.hourlyHistory[symbol] = data.Data?.Data || [];

            } catch (e) {
                console.error(`Error fetching hourly history for ${symbol}:`, e);
            }
        });

        await Promise.all(promises);
        console.log(`Loaded ${hours}h hourly data for ${symbols.length} assets`);
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

        console.log(`Auto-refresh started (${CONFIG.USE_PROXY ? 'proxy' : 'direct'} mode)`);
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
