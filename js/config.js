// ============================================
// CRYPTO PORTFOLIO TRACKER - CONFIGURATION
// ============================================

const CONFIG = {
    // API Configuration
    API_KEY: "73be90ad076a9a24abd824e9725f034ad1b8bef2adc76b4eab37e26684ee2c86",
    
    APIS: {
        CRYPTOCOMPARE: 'https://min-api.cryptocompare.com/data',
        FNG: 'https://api.alternative.me/fng/'
    },
    
    // Auto-refresh intervals (milliseconds)
    REFRESH: {
        PRICES: 10000,      // 10 secondi
        CHARTS: 30000,      // 30 secondi
        FNG: 300000,        // 5 minuti
        HISTORY: 900000     // 15 minuti
    },
    
    // Asset Colors
    COLORS: {
        XRP: '#0088FF',
        QNT: '#00D4AA',
        HBAR: '#8B5CF6',
        XDC: '#FF6B6B',
        BTC: '#F7931A',
        ETH: '#627EEA',
        USDC: '#2775CA',
        DEFAULT: '#6B7280'
    },
    
    // All-Time High Data (USD)
    ATH: {
        XRP: 3.84,
        QNT: 428.45,
        HBAR: 0.57,
        XDC: 0.195,
        BTC: 73750,
        ETH: 4891
    },
    
    // Resistance Levels
    RESISTANCE: {
        XRP: [0.75, 1.00, 1.50, 2.00, 2.50, 3.00, 3.84],
        QNT: [100, 150, 200, 250, 300, 350, 428],
        HBAR: [0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.57],
        XDC: [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.195]
    },
    
    // Support Levels
    SUPPORT: {
        XRP: [0.30, 0.40, 0.50, 0.55, 0.60],
        QNT: [50, 60, 70, 80, 90],
        HBAR: [0.05, 0.08, 0.10, 0.12, 0.15],
        XDC: [0.03, 0.04, 0.05, 0.06, 0.07]
    },
    
    // Transaction History
    TRANSACTIONS: [
        { id: 1, date: '2024-08-30', type: 'BUY', asset: 'XRP', qty: 10001.87, price: 0.5795, note: 'Prima posizione XRP' },
        { id: 2, date: '2025-08-29', type: 'BUY', asset: 'HBAR', qty: 10005.10, price: 0.2360, note: 'Entrata HBAR' },
        { id: 3, date: '2025-08-30', type: 'BUY', asset: 'XDC', qty: 25000, price: 0.08115, note: 'Prima tranche XDC' },
        { id: 4, date: '2025-09-04', type: 'BUY', asset: 'XDC', qty: 30000, price: 0.07988, note: 'Accumulo XDC' },
        { id: 5, date: '2025-09-11', type: 'BUY', asset: 'XDC', qty: 15000, price: 0.07744, note: 'Terza tranche XDC' },
        { id: 6, date: '2025-09-26', type: 'BUY', asset: 'HBAR', qty: 10000, price: 0.2068, note: 'Accumulo HBAR' },
        { id: 7, date: '2025-09-26', type: 'BUY', asset: 'XDC', qty: 30000, price: 0.07241, note: 'Quarta tranche XDC' },
        { id: 8, date: '2025-11-10', type: 'BUY', asset: 'HBAR', qty: 10000, price: 0.1952, note: 'HBAR in discount' },
        { id: 9, date: '2025-11-19', type: 'BUY', asset: 'HBAR', qty: 10000, price: 0.1392, note: 'HBAR zona accumulo' },
        { id: 10, date: '2025-11-22', type: 'BUY', asset: 'QNT', qty: 30.36, price: 73.05, note: 'Prima posizione QNT' },
        { id: 11, date: '2025-11-22', type: 'BUY', asset: 'QNT', qty: 29.68, price: 75.64, note: 'Seconda tranche QNT' }
    ],
    
    // Default Portfolio
    // costBasis = costo totale investito in USD (calcolato dalle transazioni)
    // Non cambia quando la qty viene aggiornata dal wallet sync
    DEFAULT_PORTFOLIO: [
        { symbol: 'XRP', name: 'XRP', qty: 10001.87, avgPrice: 0.5795, costBasis: 5796.08 },
        { symbol: 'QNT', name: 'Quant', qty: 60.04, avgPrice: 74.29, costBasis: 4462.79 },
        { symbol: 'HBAR', name: 'Hedera', qty: 40005.10, avgPrice: 0.1942, costBasis: 7773.20 },
        { symbol: 'XDC', name: 'XDC Network', qty: 100000, avgPrice: 0.07755, costBasis: 7759.05 }
    ],
    
    // LocalStorage Keys
    STORAGE: {
        PORTFOLIO: 'cpt_portfolio_v1',
        TRANSACTIONS: 'cpt_transactions_v1',
        SETTINGS: 'cpt_settings_v1',
        TARGETS: 'cpt_targets_v1',
        WALLETS: 'cpt_wallets_v1',
        HISTORY_SNAPSHOTS: 'cpt_history_snapshots_v1'
    },

    // Default Wallet Addresses
    DEFAULT_WALLETS: {
        XRP: 'rLRR1mFDEdYCH5fUgxR6FD3UE9DLsWV7CH',
        QNT: '0xA64D794A712279DA9f6CC4eafE1C774D7a353eF9',
        HBAR: '0.0.10081465',
        XDC: '0x5dba231a4dbf07713fe94c6d555c8ebe78a11c8c'  // Include psXDC staking
    },
    
    // Analysis Thresholds
    THRESHOLDS: {
        RSI_OVERSOLD: 30,
        RSI_OVERBOUGHT: 70,
        RSI_EXTREME_LOW: 25,
        RSI_EXTREME_HIGH: 80,
        FNG_FEAR: 25,
        FNG_GREED: 75,
        ATH_PROXIMITY: 15,  // % from ATH
        PNL_HIGH: 50,       // % profit
        PNL_EXTREME: 100    // % profit
    }
};

// ============================================
// GLOBAL STATE
// ============================================

const state = {
    // Data
    portfolio: [],
    transactions: [],
    targets: [],
    
    // Market Data
    prices: {},           // { symbol: { USD: {...}, EUR: {...} } }
    history: {},          // { symbol: [...days] }
    changes: {},          // { symbol: { d1: %, d7: %, d30: % } }
    
    // Indicators
    fng: { value: 50, label: 'Neutral' },
    btcTrend: null,
    analysis: {},         // { symbol: { rsi, heat, advice, ... } }
    
    // UI State
    currency: 'EUR',
    timeRange: 365,
    isEditing: false,
    isLoading: true,
    lastUpdate: null,
    
    // Refresh Timers
    timers: {
        prices: null,
        charts: null,
        fng: null,
        history: null
    }
};

// ============================================
// STORAGE FUNCTIONS
// ============================================

function sanitizePortfolio(portfolio) {
    // Fix corrupted data (strings instead of numbers)
    let needsSave = false;
    portfolio.forEach(asset => {
        const originalQty = asset.qty;
        const originalPrice = asset.avgPrice;
        asset.qty = parseFloat(asset.qty) || 0;
        asset.avgPrice = parseFloat(asset.avgPrice) || 0;

        // Ensure costBasis exists (copy from defaults if missing)
        if (asset.costBasis === undefined || asset.costBasis === null) {
            const defaultAsset = CONFIG.DEFAULT_PORTFOLIO.find(d => d.symbol === asset.symbol);
            if (defaultAsset && defaultAsset.costBasis) {
                asset.costBasis = defaultAsset.costBasis;
                needsSave = true;
                console.log(`Added costBasis for ${asset.symbol}: $${asset.costBasis}`);
            }
        } else {
            asset.costBasis = parseFloat(asset.costBasis) || 0;
        }

        if (originalQty !== asset.qty || originalPrice !== asset.avgPrice) {
            needsSave = true;
            console.warn(`Fixed corrupted data for ${asset.symbol}: qty=${originalQty}->${asset.qty}, avgPrice=${originalPrice}->${asset.avgPrice}`);
        }
    });
    return needsSave;
}

function loadFromStorage() {
    try {
        // Load portfolio
        const savedPortfolio = localStorage.getItem(CONFIG.STORAGE.PORTFOLIO);
        state.portfolio = savedPortfolio
            ? JSON.parse(savedPortfolio)
            : JSON.parse(JSON.stringify(CONFIG.DEFAULT_PORTFOLIO));

        // Sanitize portfolio data (fix any corrupted values)
        const needsSave = sanitizePortfolio(state.portfolio);
        if (needsSave) {
            localStorage.setItem(CONFIG.STORAGE.PORTFOLIO, JSON.stringify(state.portfolio));
            console.log('Portfolio data sanitized and saved');
        }

        // Load transactions
        const savedTx = localStorage.getItem(CONFIG.STORAGE.TRANSACTIONS);
        state.transactions = savedTx
            ? JSON.parse(savedTx)
            : JSON.parse(JSON.stringify(CONFIG.TRANSACTIONS));

        // Load targets
        const savedTargets = localStorage.getItem(CONFIG.STORAGE.TARGETS);
        state.targets = savedTargets ? JSON.parse(savedTargets) : [];

        // Load settings
        const savedSettings = localStorage.getItem(CONFIG.STORAGE.SETTINGS);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            state.currency = settings.currency || 'EUR';
        }

    } catch (e) {
        console.error('Error loading from storage:', e);
        state.portfolio = JSON.parse(JSON.stringify(CONFIG.DEFAULT_PORTFOLIO));
        state.transactions = JSON.parse(JSON.stringify(CONFIG.TRANSACTIONS));
    }
}

function savePortfolio() {
    localStorage.setItem(CONFIG.STORAGE.PORTFOLIO, JSON.stringify(state.portfolio));
}

function saveTransactions() {
    localStorage.setItem(CONFIG.STORAGE.TRANSACTIONS, JSON.stringify(state.transactions));
}

function saveTargets() {
    localStorage.setItem(CONFIG.STORAGE.TARGETS, JSON.stringify(state.targets));
}

function saveSettings() {
    localStorage.setItem(CONFIG.STORAGE.SETTINGS, JSON.stringify({
        currency: state.currency
    }));
}

// Initialize storage on load
loadFromStorage();

// ============================================
// PORTFOLIO HISTORY SNAPSHOTS
// ============================================

// Save daily portfolio snapshot
function savePortfolioSnapshot(totalValue, totalInvested, pnl) {
    try {
        const snapshots = loadPortfolioSnapshots();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if we already have a snapshot for today
        const existingIndex = snapshots.findIndex(s => s.date === today);

        const snapshot = {
            date: today,
            timestamp: Date.now(),
            value: parseFloat(totalValue) || 0,
            invested: parseFloat(totalInvested) || 0,
            pnl: parseFloat(pnl) || 0,
            currency: state.currency
        };

        if (existingIndex >= 0) {
            // Update today's snapshot
            snapshots[existingIndex] = snapshot;
        } else {
            // Add new snapshot
            snapshots.push(snapshot);
        }

        // Keep only last 365 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 365);
        const filtered = snapshots.filter(s => new Date(s.date) >= cutoffDate);

        // Sort by date
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

        localStorage.setItem(CONFIG.STORAGE.HISTORY_SNAPSHOTS, JSON.stringify(filtered));
        console.log(`📊 Portfolio snapshot saved for ${today}: €${totalValue.toFixed(2)}`);

        return filtered;
    } catch (e) {
        console.error('Error saving portfolio snapshot:', e);
        return [];
    }
}

// Load portfolio snapshots
function loadPortfolioSnapshots() {
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE.HISTORY_SNAPSHOTS);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading portfolio snapshots:', e);
    }
    return [];
}

// Get snapshots for chart display
function getPortfolioHistory(days = 30) {
    const snapshots = loadPortfolioSnapshots();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return snapshots
        .filter(s => new Date(s.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Generate historical snapshots from transactions
// This reconstructs portfolio value history based on actual transaction dates
function generateHistoricalSnapshots(transactions, priceHistory) {
    if (!transactions || transactions.length === 0) {
        console.log('No transactions to generate history from');
        return [];
    }

    // Sort transactions by date (oldest first)
    const sortedTx = [...transactions]
        .filter(tx => tx.type === 'BUY')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedTx.length === 0) {
        console.log('No BUY transactions found');
        return [];
    }

    console.log(`📊 Processing ${sortedTx.length} BUY transactions`);

    // Get the first transaction date
    const firstTxDate = new Date(sortedTx[0].date);
    const today = new Date();

    // Build a map of cumulative holdings at each date
    const holdingsAtDate = {};
    const cumulativeHoldings = {};

    // Iterate through each day from first transaction to today
    const currentDate = new Date(firstTxDate);
    let txIndex = 0;

    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];

        // Apply any transactions that happened on this date
        while (txIndex < sortedTx.length && sortedTx[txIndex].date === dateStr) {
            const tx = sortedTx[txIndex];
            const symbol = tx.asset;
            cumulativeHoldings[symbol] = (cumulativeHoldings[symbol] || 0) + (parseFloat(tx.qty) || 0);
            txIndex++;
        }

        // Save holdings for this date (only if we have any holdings)
        if (Object.keys(cumulativeHoldings).length > 0) {
            holdingsAtDate[dateStr] = { ...cumulativeHoldings };
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Build price lookup maps by date for each asset
    const priceMaps = {};
    for (const [symbol, history] of Object.entries(priceHistory)) {
        if (!history || !Array.isArray(history)) continue;
        priceMaps[symbol] = {};
        history.forEach(day => {
            if (day && day.time && day.close) {
                const dateStr = new Date(day.time * 1000).toISOString().split('T')[0];
                priceMaps[symbol][dateStr] = day.close;
            }
        });
    }

    // Get conversion rate
    const conversionRate = state.prices['BTC']?.EUR?.PRICE && state.prices['BTC']?.USD?.PRICE
        ? state.prices['BTC'].EUR.PRICE / state.prices['BTC'].USD.PRICE
        : 0.92;

    // Generate snapshots for each date we have holdings
    const snapshots = [];

    for (const [dateStr, holdings] of Object.entries(holdingsAtDate)) {
        let totalValue = 0;
        let hasValidPrice = false;

        for (const [symbol, qty] of Object.entries(holdings)) {
            const priceUSD = priceMaps[symbol]?.[dateStr];
            if (priceUSD && priceUSD > 0) {
                const priceEUR = priceUSD * conversionRate;
                totalValue += qty * priceEUR;
                hasValidPrice = true;
            }
        }

        if (hasValidPrice && totalValue > 0) {
            snapshots.push({
                date: dateStr,
                timestamp: new Date(dateStr).getTime(),
                value: totalValue,
                invested: 0,
                pnl: 0,
                currency: 'EUR',
                generated: true
            });
        }
    }

    // Sort by date
    snapshots.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`📈 Generated ${snapshots.length} historical snapshots from ${sortedTx.length} transactions`);
    if (snapshots.length > 0) {
        console.log(`   First: ${snapshots[0].date} = €${snapshots[0].value.toFixed(2)}`);
        console.log(`   Last: ${snapshots[snapshots.length-1].date} = €${snapshots[snapshots.length-1].value.toFixed(2)}`);
    }

    return snapshots;
}

// Generate and save historical snapshots
function generateAndSaveHistoricalSnapshots() {
    // Use transactions from state and price history from state
    const transactions = state.transactions;
    const priceHistory = state.history;

    if (!priceHistory || Object.keys(priceHistory).length === 0) {
        console.log('Price history not loaded yet');
        return false;
    }

    const generatedSnapshots = generateHistoricalSnapshots(transactions, priceHistory);

    if (generatedSnapshots.length === 0) {
        return false;
    }

    // Load existing snapshots
    const existingSnapshots = loadPortfolioSnapshots();

    // Create a map of existing snapshots by date (prefer real snapshots over generated)
    const snapshotMap = {};

    // First add generated snapshots
    generatedSnapshots.forEach(s => {
        snapshotMap[s.date] = s;
    });

    // Then override with existing real snapshots (they take priority)
    existingSnapshots.forEach(s => {
        if (!s.generated) {
            snapshotMap[s.date] = s;
        }
    });

    // Convert back to array and sort
    const mergedSnapshots = Object.values(snapshotMap)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Keep only last 365 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const filtered = mergedSnapshots.filter(s => new Date(s.date) >= cutoffDate);

    // Save
    localStorage.setItem(CONFIG.STORAGE.HISTORY_SNAPSHOTS, JSON.stringify(filtered));
    console.log(`💾 Saved ${filtered.length} total snapshots (${generatedSnapshots.length} generated + existing real)`);

    return true;
}

// Force regenerate all historical snapshots (call from console)
function forceRegenerateSnapshots() {
    console.log('🔄 Forcing snapshot regeneration...');
    // Clear existing snapshots
    localStorage.removeItem(CONFIG.STORAGE.HISTORY_SNAPSHOTS);
    // Regenerate
    const result = generateAndSaveHistoricalSnapshots();
    if (result) {
        console.log('✅ Regeneration complete! Refresh the page to see changes.');
        // Force chart refresh
        if (window.Charts) {
            Charts.renderMain();
        }
    } else {
        console.log('❌ Regeneration failed - check transactions and price history');
    }
    return result;
}

// Debug: show snapshot info
function debugSnapshots() {
    const snapshots = loadPortfolioSnapshots();
    console.log(`Total snapshots: ${snapshots.length}`);
    if (snapshots.length > 0) {
        console.log('First 5:', snapshots.slice(0, 5));
        console.log('Last 5:', snapshots.slice(-5));
        const generated = snapshots.filter(s => s.generated).length;
        console.log(`Generated: ${generated}, Real: ${snapshots.length - generated}`);
    }
    console.log('Transactions:', state.transactions.length);
    return snapshots;
}

// Show visual debug panel (for mobile)
function showDebugPanel() {
    const snapshots = loadPortfolioSnapshots();
    const generated = snapshots.filter(s => s.generated).length;
    const real = snapshots.length - generated;

    // Get first and last snapshot info
    let firstInfo = 'N/A';
    let lastInfo = 'N/A';
    if (snapshots.length > 0) {
        const first = snapshots[0];
        const last = snapshots[snapshots.length - 1];
        firstInfo = `${first.date}: €${first.value?.toFixed(0) || 0}`;
        lastInfo = `${last.date}: €${last.value?.toFixed(0) || 0}`;
    }

    // Get transaction info
    const txCount = state.transactions?.length || 0;
    const buyTx = state.transactions?.filter(t => t.type === 'BUY').length || 0;

    const html = `
        <div id="debugPanel" style="
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(0,0,0,0.95);
            border: 2px solid #0088FF;
            border-radius: 12px;
            padding: 16px;
            z-index: 99999;
            font-family: monospace;
            font-size: 12px;
            color: #fff;
        ">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <strong style="color:#0088FF;">📊 Debug Snapshots</strong>
                <span onclick="document.getElementById('debugPanel').remove()" style="cursor:pointer;">✕</span>
            </div>
            <div style="display:grid; gap:8px;">
                <div><span style="color:#888;">Snapshots totali:</span> <strong>${snapshots.length}</strong></div>
                <div><span style="color:#888;">Generati:</span> <strong style="color:#00D4AA;">${generated}</strong></div>
                <div><span style="color:#888;">Reali:</span> <strong style="color:#F7931A;">${real}</strong></div>
                <div><span style="color:#888;">Primo:</span> <strong>${firstInfo}</strong></div>
                <div><span style="color:#888;">Ultimo:</span> <strong>${lastInfo}</strong></div>
                <hr style="border-color:#333;">
                <div><span style="color:#888;">Transazioni:</span> <strong>${txCount}</strong> (${buyTx} BUY)</div>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button onclick="forceRegenerateSnapshots(); showDebugPanel();" style="
                    flex:1; padding:10px; background:#0088FF; color:#fff; border:none; border-radius:8px; font-weight:bold;
                ">🔄 Rigenera</button>
                <button onclick="document.getElementById('debugPanel').remove();" style="
                    flex:1; padding:10px; background:#333; color:#fff; border:none; border-radius:8px;
                ">Chiudi</button>
            </div>
        </div>
    `;

    // Remove existing panel if any
    const existing = document.getElementById('debugPanel');
    if (existing) existing.remove();

    // Add new panel
    document.body.insertAdjacentHTML('beforeend', html);
}

// Export
window.CONFIG = CONFIG;
window.state = state;
window.savePortfolio = savePortfolio;
window.saveTransactions = saveTransactions;
window.saveTargets = saveTargets;
window.saveSettings = saveSettings;
window.savePortfolioSnapshot = savePortfolioSnapshot;
window.loadPortfolioSnapshots = loadPortfolioSnapshots;
window.getPortfolioHistory = getPortfolioHistory;
window.generateAndSaveHistoricalSnapshots = generateAndSaveHistoricalSnapshots;
window.forceRegenerateSnapshots = forceRegenerateSnapshots;
window.debugSnapshots = debugSnapshots;
window.showDebugPanel = showDebugPanel;
