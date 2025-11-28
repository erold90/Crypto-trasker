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
    DEFAULT_PORTFOLIO: [
        { symbol: 'XRP', name: 'XRP', qty: 10001.87, avgPrice: 0.5795 },
        { symbol: 'QNT', name: 'Quant', qty: 60.04, avgPrice: 74.29 },
        { symbol: 'HBAR', name: 'Hedera', qty: 40005.10, avgPrice: 0.1942 },
        { symbol: 'XDC', name: 'XDC Network', qty: 100000, avgPrice: 0.07755 }
    ],
    
    // LocalStorage Keys
    STORAGE: {
        PORTFOLIO: 'cpt_portfolio_v1',
        TRANSACTIONS: 'cpt_transactions_v1',
        SETTINGS: 'cpt_settings_v1',
        TARGETS: 'cpt_targets_v1'
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

function loadFromStorage() {
    try {
        // Load portfolio
        const savedPortfolio = localStorage.getItem(CONFIG.STORAGE.PORTFOLIO);
        state.portfolio = savedPortfolio 
            ? JSON.parse(savedPortfolio) 
            : JSON.parse(JSON.stringify(CONFIG.DEFAULT_PORTFOLIO));
        
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

// Export
window.CONFIG = CONFIG;
window.state = state;
window.savePortfolio = savePortfolio;
window.saveTransactions = saveTransactions;
window.saveTargets = saveTargets;
window.saveSettings = saveSettings;
