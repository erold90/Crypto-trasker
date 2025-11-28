// ============================================
// CRYPTO PORTFOLIO TRACKER - CALCULATOR MODULE
// ============================================

const Calculator = {
    
    // State
    selectedCoin: null,
    currentPrice: null,
    priceTimer: null,
    searchTimer: null,
    coinListCache: null,
    coinListCacheTime: null,
    
    // Initialize calculator
    init() {
        const searchInput = document.getElementById('coinSearch');
        const amountInput = document.getElementById('calcAmount');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length >= 1) {
                    this.handleSearch(searchInput.value);
                }
            });
            
            // Close results when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-wrapper')) {
                    this.hideResults();
                }
            });
        }
        
        if (amountInput) {
            amountInput.addEventListener('input', () => this.calculateResult());
        }
        
        // Update currency display when currency changes
        this.updateCurrencyDisplay();
        
        // Pre-load coin list
        this.loadCoinList();
    },
    
    // Load coin list (cached)
    async loadCoinList() {
        // Check cache (valid for 1 hour)
        if (this.coinListCache && this.coinListCacheTime && (Date.now() - this.coinListCacheTime) < 3600000) {
            return this.coinListCache;
        }
        
        try {
            const url = `https://min-api.cryptocompare.com/data/all/coinlist?api_key=${CONFIG.API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.Data) {
                this.coinListCache = Object.values(data.Data);
                this.coinListCacheTime = Date.now();
                console.log(`✅ Loaded ${this.coinListCache.length} coins`);
            }
        } catch (e) {
            console.error('Failed to load coin list:', e);
        }
        
        return this.coinListCache;
    },
    
    // Handle search input
    handleSearch(query) {
        // Debounce search
        clearTimeout(this.searchTimer);
        
        if (query.length < 1) {
            this.hideResults();
            return;
        }
        
        this.searchTimer = setTimeout(() => {
            this.searchCoins(query);
        }, 300);
    },
    
    // Search coins via API
    async searchCoins(query) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        // Show loading
        resultsContainer.innerHTML = '<div class="search-loading">Ricerca...</div>';
        resultsContainer.style.display = 'block';
        
        try {
            // Load coin list if not cached
            if (!this.coinListCache) {
                await this.loadCoinList();
            }
            
            if (!this.coinListCache || this.coinListCache.length === 0) {
                throw new Error('No coin list available');
            }
            
            // Filter results by query
            const queryLower = query.toLowerCase();
            const coins = this.coinListCache
                .filter(coin => {
                    const symbolMatch = coin.Symbol?.toLowerCase().includes(queryLower);
                    const nameMatch = coin.CoinName?.toLowerCase().includes(queryLower);
                    return symbolMatch || nameMatch;
                })
                .sort((a, b) => {
                    // Prioritize exact symbol matches
                    const aExactSymbol = a.Symbol?.toLowerCase() === queryLower ? 0 : 1;
                    const bExactSymbol = b.Symbol?.toLowerCase() === queryLower ? 0 : 1;
                    if (aExactSymbol !== bExactSymbol) return aExactSymbol - bExactSymbol;
                    
                    // Then symbol starts with query
                    const aStartsWith = a.Symbol?.toLowerCase().startsWith(queryLower) ? 0 : 1;
                    const bStartsWith = b.Symbol?.toLowerCase().startsWith(queryLower) ? 0 : 1;
                    if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
                    
                    // Then by sort order (popularity)
                    return (parseInt(a.SortOrder) || 9999) - (parseInt(b.SortOrder) || 9999);
                })
                .slice(0, 15)
                .map(coin => ({
                    symbol: coin.Symbol,
                    name: coin.CoinName,
                    icon: this.getCoinIcon(coin.Symbol)
                }));
            
            this.renderResults(coins);
            
        } catch (e) {
            console.error('Search error:', e);
            resultsContainer.innerHTML = '<div class="search-no-results">Errore di ricerca. Riprova.</div>';
        }
    },
    
    // Render search results
    renderResults(coins) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (coins.length === 0) {
            resultsContainer.innerHTML = '<div class="search-no-results">Nessun risultato</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        resultsContainer.innerHTML = coins.map(coin => `
            <div class="search-result-item" onclick="Calculator.selectCoin('${coin.symbol}', '${coin.name.replace(/'/g, "\\'")}')">
                <span class="search-result-icon">${coin.icon}</span>
                <span class="search-result-symbol">${coin.symbol}</span>
                <span class="search-result-name">${coin.name}</span>
            </div>
        `).join('');
        
        resultsContainer.style.display = 'block';
    },
    
    // Hide search results
    hideResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    },
    
    // Select a coin
    async selectCoin(symbol, name) {
        this.selectedCoin = { symbol, name };
        
        // Hide search, show selected coin
        document.getElementById('coinSearch').value = '';
        this.hideResults();
        
        document.getElementById('selectedCoinField').style.display = 'block';
        document.getElementById('selectedCoinSymbol').textContent = symbol;
        document.getElementById('selectedCoinName').textContent = name;
        document.getElementById('selectedCoinIcon').textContent = this.getCoinIcon(symbol);
        
        // Fetch price
        await this.fetchPrice();
        
        // Start price updates
        this.startPriceUpdates();
        
        // Calculate result
        this.calculateResult();
    },
    
    // Clear selected coin
    clearCoin() {
        this.selectedCoin = null;
        this.currentPrice = null;
        
        // Stop price updates
        this.stopPriceUpdates();
        
        // Hide selected coin, show search
        document.getElementById('selectedCoinField').style.display = 'none';
        document.getElementById('calcPrice').textContent = '--';
        document.getElementById('calcLiveDot').textContent = '🔴';
        document.getElementById('calcResultValue').textContent = '--';
        document.getElementById('calcResultNote').textContent = 'Seleziona una coin e inserisci un importo';
    },
    
    // Fetch current price
    async fetchPrice() {
        if (!this.selectedCoin) return;
        
        const symbol = this.selectedCoin.symbol;
        const currency = state.currency;
        
        try {
            const url = `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=${currency}&api_key=${CONFIG.API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data[currency]) {
                this.currentPrice = data[currency];
                this.updatePriceDisplay();
                this.calculateResult();
            } else {
                this.currentPrice = null;
                document.getElementById('calcPrice').textContent = 'N/A';
                document.getElementById('calcLiveDot').textContent = '🔴';
            }
            
        } catch (e) {
            console.error('Price fetch error:', e);
            this.currentPrice = null;
        }
    },
    
    // Update price display
    updatePriceDisplay() {
        const priceEl = document.getElementById('calcPrice');
        const dotEl = document.getElementById('calcLiveDot');
        
        if (!priceEl || !this.currentPrice) return;
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        // Format price based on value
        let formattedPrice;
        if (this.currentPrice >= 1000) {
            formattedPrice = this.currentPrice.toLocaleString('it-IT', { maximumFractionDigits: 2 });
        } else if (this.currentPrice >= 1) {
            formattedPrice = this.currentPrice.toFixed(4);
        } else {
            formattedPrice = this.currentPrice.toFixed(8);
        }
        
        priceEl.textContent = `${sym}${formattedPrice}`;
        dotEl.textContent = '🟢';
        
        // Flash effect
        priceEl.classList.add('price-updated');
        setTimeout(() => priceEl.classList.remove('price-updated'), 300);
    },
    
    // Start price updates
    startPriceUpdates() {
        this.stopPriceUpdates();
        
        // Update every 10 seconds
        this.priceTimer = setInterval(() => {
            this.fetchPrice();
        }, 10000);
    },
    
    // Stop price updates
    stopPriceUpdates() {
        if (this.priceTimer) {
            clearInterval(this.priceTimer);
            this.priceTimer = null;
        }
    },
    
    // Calculate result
    calculateResult() {
        const amountInput = document.getElementById('calcAmount');
        const resultValueEl = document.getElementById('calcResultValue');
        const resultNoteEl = document.getElementById('calcResultNote');
        
        if (!amountInput || !resultValueEl) return;
        
        const amount = parseFloat(amountInput.value) || 0;
        
        if (!this.selectedCoin) {
            resultValueEl.textContent = '--';
            resultNoteEl.textContent = 'Seleziona una coin e inserisci un importo';
            return;
        }
        
        if (!this.currentPrice || this.currentPrice === 0) {
            resultValueEl.textContent = '--';
            resultNoteEl.textContent = 'Prezzo non disponibile';
            return;
        }
        
        if (amount <= 0) {
            resultValueEl.textContent = '--';
            resultNoteEl.textContent = 'Inserisci un importo da investire';
            return;
        }
        
        // Calculate coins
        const coins = amount / this.currentPrice;
        
        // Format result
        let formattedCoins;
        if (coins >= 1000) {
            formattedCoins = coins.toLocaleString('it-IT', { maximumFractionDigits: 2 });
        } else if (coins >= 1) {
            formattedCoins = coins.toFixed(4);
        } else if (coins >= 0.0001) {
            formattedCoins = coins.toFixed(6);
        } else {
            formattedCoins = coins.toFixed(8);
        }
        
        resultValueEl.textContent = `${formattedCoins} ${this.selectedCoin.symbol}`;
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        resultNoteEl.textContent = `Con ${sym}${amount.toLocaleString('it-IT')} al prezzo attuale`;
    },
    
    // Update currency display
    updateCurrencyDisplay() {
        const currencyEl = document.getElementById('calcCurrency');
        if (currencyEl) {
            currencyEl.textContent = state.currency;
        }
        
        // If coin is selected, refetch price in new currency
        if (this.selectedCoin) {
            this.fetchPrice();
        }
    },
    
    // Get coin icon/emoji
    getCoinIcon(symbol) {
        const icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'XRP': '✕',
            'USDT': '₮',
            'BNB': '◆',
            'SOL': '◎',
            'ADA': '₳',
            'DOGE': 'Ð',
            'DOT': '●',
            'MATIC': '⬡',
            'LINK': '⬡',
            'HBAR': 'ℏ',
            'QNT': '◈',
            'XDC': '◇',
            'LTC': 'Ł',
            'AVAX': '▲',
            'XLM': '*',
            'ATOM': '⚛',
            'UNI': '🦄',
            'SHIB': '🐕'
        };
        
        return icons[symbol.toUpperCase()] || '●';
    }
};

// Export
window.Calculator = Calculator;
