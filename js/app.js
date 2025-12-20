// ============================================
// CRYPTO PORTFOLIO TRACKER - APP CONTROLLER
// ============================================

const App = {
    
    // Initialize application
    async init() {
        console.log('🚀 Crypto Portfolio Tracker starting...');

        // Initialize charts
        Charts.init();

        // Initialize calculator
        Calculator.init();

        // Bind events
        this.bindEvents();

        // Fetch initial data
        await API.fetchAll();

        // Auto-sync wallets on startup (if any configured)
        await this.autoSyncWallets();

        // Start auto-refresh
        API.startAutoRefresh();

        console.log('✅ App initialized');
    },

    // Auto-sync wallets on startup
    async autoSyncWallets() {
        if (Wallet.hasAnyWallet()) {
            console.log('🔄 Auto-syncing wallets...');
            UI.updateSyncStatus('Sincronizzazione...');

            try {
                const results = await Wallet.syncAll();

                if (results.success.length > 0) {
                    console.log(`✅ Synced: ${results.success.map(r => r.symbol).join(', ')}`);
                }
                if (results.failed.length > 0) {
                    console.warn(`⚠️ Failed: ${results.failed.join(', ')}`);
                }

                Analysis.runAll();
                UI.renderAll();
            } catch (e) {
                console.error('Auto-sync error:', e);
            }

            UI.updateSyncStatus();
        }
    },
    
    // Bind event listeners
    bindEvents() {
        // Currency toggle
        document.querySelectorAll('.currency-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setCurrency(btn.dataset.currency));
        });
        
        // Time range buttons
        document.querySelectorAll('.chart-range-btn').forEach(btn => {
            btn.addEventListener('click', () => Charts.setTimeRange(parseInt(btn.dataset.range)));
        });
        
        // Manual refresh
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            API.fetchAll();
        });
        
        // Edit mode toggle
        document.getElementById('editBtn')?.addEventListener('click', () => this.toggleEditMode());

        // Wallet sync button
        document.getElementById('syncWalletBtn')?.addEventListener('click', () => {
            UI.showWalletModal();
        });

        // Modal close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) UI.hideModal(modal.id);
            });
        });
    },
    
    // Set currency
    setCurrency(currency) {
        state.currency = currency;
        saveSettings();
        
        // Update UI
        document.querySelectorAll('.currency-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === currency);
        });
        
        // Update calculator
        Calculator.updateCurrencyDisplay();
        
        UI.renderAll();
    },
    
    // Toggle edit mode
    toggleEditMode() {
        state.isEditing = !state.isEditing;
        
        const btn = document.getElementById('editBtn');
        if (btn) {
            btn.innerHTML = state.isEditing 
                ? '<span class="icon">💾</span> Salva'
                : '<span class="icon">✏️</span> Modifica';
            btn.classList.toggle('active', state.isEditing);
        }
        
        document.getElementById('assetTable')?.classList.toggle('editing', state.isEditing);
        
        if (!state.isEditing) {
            // Save changes when exiting edit mode
            this.saveEdits();
        }
        
        UI.renderAssetTable();
    },
    
    // Save edits from table
    saveEdits() {
        state.portfolio.forEach((asset, idx) => {
            const qtyInput = document.getElementById(`qty-${idx}`);
            const avgInput = document.getElementById(`avg-${idx}`);
            
            if (qtyInput) asset.qty = parseFloat(qtyInput.value) || 0;
            if (avgInput) asset.avgPrice = parseFloat(avgInput.value) || 0;
        });
        
        savePortfolio();
        Analysis.runAll();
    }
};

// ============================================
// UI MODULE
// ============================================

const UI = {
    
    // Show/hide loading state
    showLoading(show) {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.toggle('active', show);
    },
    
    // Pulse the live indicator
    pulseIndicator() {
        const indicator = document.getElementById('liveIndicator');
        if (indicator) {
            indicator.classList.add('pulse');
            setTimeout(() => indicator.classList.remove('pulse'), 1000);
        }
    },
    
    // Render all UI components
    renderAll() {
        this.updateTimestamp();
        this.renderKPIs();
        this.renderActionBanner();
        this.renderActionsPanel();
        this.renderAssetTable();
        this.renderConditions();
        Charts.renderMain();
        Charts.renderAllocation();
    },
    
    // Update prices only (for auto-refresh)
    updatePrices() {
        this.updateTimestamp();
        // Don't update table while editing to preserve input values
        if (!state.isEditing) {
            this.renderAssetTable();
        }
    },
    
    // Update KPIs only
    updateKPIs() {
        this.renderKPIs();
        this.renderActionBanner();
    },
    
    // Update timestamp
    updateTimestamp() {
        const el = document.getElementById('lastUpdate');
        if (el && state.lastUpdate) {
            el.textContent = state.lastUpdate.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    },
    
    // Render KPI cards
    renderKPIs() {
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        // Total value - FULL PRECISION
        const totalValue = Portfolio.getTotalValue();
        const totalEl = document.getElementById('kpiTotal');
        if (totalEl) {
            totalEl.textContent = Portfolio.formatCurrency(totalValue, false);
        }
        
        // P&L - FULL PRECISION
        const pnl = Portfolio.getPnL();
        const pnlValueEl = document.getElementById('kpiPnlValue');
        const pnlPctEl = document.getElementById('kpiPnlPct');
        
        if (pnlValueEl) {
            pnlValueEl.textContent = `${pnl.value >= 0 ? '+' : ''}${Portfolio.formatCurrency(pnl.value, false)}`;
            pnlValueEl.className = `kpi-value ${pnl.value >= 0 ? 'positive' : 'negative'}`;
        }
        if (pnlPctEl) {
            pnlPctEl.textContent = `(${Portfolio.formatPct(pnl.pct)})`;
            pnlPctEl.className = `kpi-pct ${pnl.pct >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Health indicator
        const healthEl = document.getElementById('healthIndicator');
        if (healthEl) {
            if (pnl.pct > 20) healthEl.className = 'health-dot ok';
            else if (pnl.pct > 0) healthEl.className = 'health-dot warning';
            else healthEl.className = 'health-dot danger';
        }
        
        // Fear & Greed
        const fngValueEl = document.getElementById('kpiFngValue');
        const fngLabelEl = document.getElementById('kpiFngLabel');
        const fngIndicatorEl = document.getElementById('fngIndicator');
        
        if (fngValueEl) {
            fngValueEl.textContent = `${state.fng.value}/100`;
            fngValueEl.style.color = this.getFngColor(state.fng.value);
        }
        if (fngLabelEl) {
            fngLabelEl.textContent = state.fng.label;
        }
        if (fngIndicatorEl) {
            if (state.fng.value <= 25 || state.fng.value >= 75) {
                fngIndicatorEl.className = 'health-dot danger';
            } else if (state.fng.value <= 40 || state.fng.value >= 60) {
                fngIndicatorEl.className = 'health-dot warning';
            } else {
                fngIndicatorEl.className = 'health-dot ok';
            }
        }
        
        // BTC Trend
        const btcValueEl = document.getElementById('kpiBtcValue');
        const btcLabelEl = document.getElementById('kpiBtcLabel');
        const btcIndicatorEl = document.getElementById('btcIndicator');
        
        if (state.btcTrend && btcValueEl) {
            const pct = state.btcTrend.pct;
            btcValueEl.innerHTML = `${state.btcTrend.above ? '↗' : '↘'} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
            btcValueEl.className = `kpi-value ${state.btcTrend.above ? 'positive' : 'negative'}`;
        }
        if (btcLabelEl && state.btcTrend) {
            btcLabelEl.textContent = state.btcTrend.above ? 'Sopra 200 MA' : 'Sotto 200 MA';
        }
        if (btcIndicatorEl && state.btcTrend) {
            btcIndicatorEl.className = state.btcTrend.above ? 'health-dot ok' : 'health-dot danger';
        }
    },
    
    // Get Fear & Greed color
    getFngColor(value) {
        if (value <= 25) return '#ef4444';
        if (value <= 40) return '#f59e0b';
        if (value <= 60) return '#64748b';
        if (value <= 75) return '#22c55e';
        return '#ef4444';
    },
    
    // Render action banner
    renderActionBanner() {
        const banner = Analysis.getActionBanner();
        const container = document.getElementById('actionBanner');
        if (!container) return;
        
        container.className = `action-banner ${banner.type}`;
        container.innerHTML = `
            <div class="banner-content">
                <div class="banner-icon">${banner.icon}</div>
                <div class="banner-text">
                    <h2>${banner.title}</h2>
                    <p>${banner.subtitle}</p>
                </div>
            </div>
            <div class="banner-badge">${banner.badge}</div>
        `;
    },
    
    // Render recommended actions panel
    renderActionsPanel() {
        const container = document.getElementById('actionsPanelContent');
        if (!container) return;
        
        const actions = Analysis.getRecommendedActions();
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        if (actions.length === 0 || (actions.length === 1 && actions[0].type === 'HOLD')) {
            container.innerHTML = `
                <div class="action-card hold">
                    <div class="action-card-icon">✅</div>
                    <div class="action-card-content">
                        <div class="action-card-header">
                            <span class="action-card-title">Nessuna azione richiesta</span>
                        </div>
                        <p class="action-card-details">Il mercato è in fase neutrale. Continua a monitorare gli indicatori e mantieni le tue posizioni.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Separate sell and buy actions
        const sellActions = actions.filter(a => a.type === 'SELL');
        const buyActions = actions.filter(a => a.type === 'BUY');
        
        let html = '';
        
        // Sell actions
        if (sellActions.length > 0) {
            html += `<div class="actions-section sell">
                <div class="actions-section-title">📉 Prendi Profitto</div>
                <div class="actions-cards">`;
            
            sellActions.forEach(action => {
                html += this.renderActionCard(action, sym);
            });
            
            html += `</div></div>`;
        }
        
        // Buy actions
        if (buyActions.length > 0) {
            html += `<div class="actions-section buy">
                <div class="actions-section-title">📈 Opportunità Acquisto</div>
                <div class="actions-cards">`;
            
            buyActions.forEach(action => {
                html += this.renderActionCard(action, sym);
            });
            
            html += `</div></div>`;
        }
        
        container.innerHTML = html;
    },
    
    // Render single action card
    renderActionCard(action, sym) {
        const color = CONFIG.COLORS[action.asset] || CONFIG.COLORS.DEFAULT;
        
        let priceInfo = '';
        if (action.currentPrice) {
            priceInfo = `<span class="action-price">Prezzo: ${sym}${action.currentPrice.toFixed(4)}</span>`;
        }
        if (action.targetPrice) {
            priceInfo += `<span class="action-target">Target: ${sym}${action.targetPrice.toFixed(4)}</span>`;
        }
        
        let quantityInfo = '';
        if (action.quantity && action.value) {
            quantityInfo = `
                <div class="action-quantity">
                    <span class="qty-amount">${action.quantity.toFixed(2)} ${action.asset}</span>
                    <span class="qty-value">≈ ${sym}${action.value.toFixed(0)}</span>
                </div>
            `;
        }
        
        return `
            <div class="action-card ${action.type.toLowerCase()}" style="--action-color: ${action.color}">
                <div class="action-card-badge" style="background: ${color}">${action.asset}</div>
                <div class="action-card-content">
                    <div class="action-card-header">
                        <span class="action-card-icon">${action.icon}</span>
                        <span class="action-card-action" style="color: ${action.color}">${action.action}</span>
                    </div>
                    <div class="action-card-reason">${action.reason}</div>
                    <div class="action-card-details">${action.details}</div>
                    ${quantityInfo}
                    <div class="action-card-prices">
                        ${priceInfo}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Render asset table
    renderAssetTable() {
        const tbody = document.getElementById('assetTbody');
        if (!tbody) return;
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        tbody.innerHTML = state.portfolio.map((asset, idx) => {
            const price = Portfolio.getPrice(asset.symbol);
            const analysis = state.analysis[asset.symbol] || {};
            const changes = state.changes[asset.symbol] || { d1: 0, d7: 0, d30: 0 };
            const color = CONFIG.COLORS[asset.symbol] || CONFIG.COLORS.DEFAULT;
            
            // Calculate values
            const value = asset.qty * price;
            const rate = Portfolio.getConversionRate();

            // Usa costBasis per calcoli P&L (più accurato di qty*avgPrice)
            let invested;
            let avgPriceConverted;

            if (asset.costBasis && asset.costBasis > 0) {
                // costBasis è in USD, il costo totale investito per questo asset
                invested = asset.costBasis * rate;
                // PMC = costBasis / quantità originale (non quella sync)
                const originalQty = Portfolio.getOriginalQty(asset.symbol) || asset.qty;
                avgPriceConverted = (asset.costBasis / originalQty) * rate;
            } else {
                // Fallback al vecchio metodo
                avgPriceConverted = asset.avgPrice * rate;
                invested = asset.qty * avgPriceConverted;
            }

            const pnl = value - invested;
            const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
            
            // RSI styling
            const rsi = analysis.rsi || 50;
            let rsiClass = '';
            if (rsi < 30) rsiClass = 'oversold';
            else if (rsi > 70) rsiClass = 'overbought';
            
            // Heat styling
            const heat = analysis.heat || 0;
            let heatClass = '';
            if (heat < 30) heatClass = 'cold';
            else if (heat < 60) heatClass = 'warm';
            else if (heat < 80) heatClass = 'hot';
            else heatClass = 'extreme';
            
            // Signal
            const signal = analysis.signal || { color: 'ok', label: 'Neutro' };
            
            // Advice
            const advice = analysis.advice || { action: 'HOLD', reason: '', icon: '✅', color: '#00D4AA' };
            
            return `
                <tr>
                    <td>
                        <div class="asset-cell">
                            <div class="signal-dot ${signal.color}"></div>
                            <div class="asset-icon" style="background: ${color}">${asset.symbol.substring(0, 2)}</div>
                            <div class="asset-info">
                                <span class="asset-name">${asset.name}</span>
                                <span class="asset-symbol">${asset.symbol}</span>
                            </div>
                        </div>
                    </td>
                    <td class="price-cell">
                        ${Portfolio.formatPrice(price)}
                    </td>
                    <td>
                        <span class="change-badge ${changes.d1 >= 0 ? 'positive' : 'negative'}">
                            ${Portfolio.formatPct(changes.d1)}
                        </span>
                    </td>
                    <td>
                        <span class="change-badge ${changes.d7 >= 0 ? 'positive' : 'negative'}">
                            ${Portfolio.formatPct(changes.d7)}
                        </span>
                    </td>
                    <td>
                        <span class="change-badge ${changes.d30 >= 0 ? 'positive' : 'negative'}">
                            ${Portfolio.formatPct(changes.d30)}
                        </span>
                    </td>
                    <td class="qty-cell">
                        ${state.isEditing 
                            ? `<input type="number" class="edit-input" id="qty-${idx}" value="${asset.qty}" step="0.01">`
                            : Portfolio.formatNumber(asset.qty, 2)}
                    </td>
                    <td class="pmc-cell">
                        ${state.isEditing 
                            ? `<input type="number" class="edit-input" id="avg-${idx}" value="${asset.avgPrice}" step="0.0001">`
                            : Portfolio.formatPrice(avgPriceConverted)}
                    </td>
                    <td class="value-cell">
                        ${Portfolio.formatCurrencyCompact(value)}
                    </td>
                    <td>
                        <div class="pnl-cell">
                            <span class="pnl-value ${pnl >= 0 ? 'positive' : 'negative'}">
                                ${pnl >= 0 ? '+' : ''}${Portfolio.formatCurrencyCompact(pnl)}
                            </span>
                            <span class="pnl-pct ${pnlPct >= 0 ? 'positive' : 'negative'}">
                                ${Portfolio.formatPct(pnlPct)}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="rsi-cell">
                            <div class="rsi-bar">
                                <div class="rsi-fill ${rsiClass}" style="width: ${rsi}%"></div>
                                <div class="rsi-marker" style="left: ${rsi}%"></div>
                            </div>
                            <span class="rsi-value ${rsiClass}">${rsi.toFixed(0)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="heat-cell">
                            <div class="heat-bar">
                                <div class="heat-fill ${heatClass}" style="width: ${heat}%"></div>
                            </div>
                            <span class="heat-value ${heatClass}">${heat.toFixed(0)}%</span>
                        </div>
                    </td>
                    <td>
                        <div class="advice-cell-compact" style="border-color: ${advice.color}" title="${advice.reason}">
                            <span class="advice-icon">${advice.icon}</span>
                            <span class="advice-action" style="color: ${advice.color}">${advice.action}</span>
                        </div>
                    </td>
                    <td class="actions-cell">
                        ${state.isEditing 
                            ? `<button class="btn-delete" onclick="UI.deleteAsset('${asset.symbol}')">🗑️</button>`
                            : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // Render conditions detector
    renderConditions() {
        const conditions = Analysis.getMarketConditions();
        
        // Buy conditions
        const buyContainer = document.getElementById('buyConditions');
        if (buyContainer) {
            buyContainer.innerHTML = conditions.buy.map(c => `
                <div class="condition-item ${c.active ? 'active' : ''}">
                    <span class="condition-label">${c.label}</span>
                    <span class="condition-value">${c.active ? '✔ ' : ''}${c.value}</span>
                </div>
            `).join('');
        }
        
        const buyCount = document.getElementById('buyCount');
        if (buyCount) {
            buyCount.textContent = `${conditions.buyActive}/${conditions.buy.length}`;
        }
        
        // Sell conditions
        const sellContainer = document.getElementById('sellConditions');
        if (sellContainer) {
            sellContainer.innerHTML = conditions.sell.map(c => `
                <div class="condition-item ${c.active ? 'active' : ''}">
                    <span class="condition-label">${c.label}</span>
                    <span class="condition-value">${c.active ? '⚠ ' : ''}${c.value}</span>
                </div>
            `).join('');
        }
        
        const sellCount = document.getElementById('sellCount');
        if (sellCount) {
            sellCount.textContent = `${conditions.sellActive}/${conditions.sell.length}`;
        }
    },
    
    // Delete asset
    deleteAsset(symbol) {
        if (!confirm(`Eliminare ${symbol} dal portfolio?`)) return;
        
        Portfolio.removeAsset(symbol);
        Analysis.runAll();
        this.renderAll();
    },
    
    // Show modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },
    
    // Hide modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },
    
    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // Add transaction form handler
    handleAddTransaction(e) {
        e.preventDefault();
        
        const type = document.getElementById('txType').value;
        const asset = document.getElementById('txAsset').value;
        const qty = document.getElementById('txQty').value;
        const price = document.getElementById('txPrice').value;
        const note = document.getElementById('txNote').value;
        
        if (!asset || !qty || !price) {
            this.showToast('Compila tutti i campi obbligatori', 'error');
            return;
        }
        
        Portfolio.addTransaction(type, asset, qty, price, note);
        Analysis.runAll();
        this.renderAll();
        this.hideModal('addTxModal');
        this.showToast('Transazione registrata!', 'success');
        
        // Reset form
        e.target.reset();
    },
    
    // Add asset form handler
    handleAddAsset(e) {
        e.preventDefault();
        
        const symbol = document.getElementById('assetSymbol').value;
        const name = document.getElementById('assetName').value;
        const qty = document.getElementById('assetQty').value;
        const avgPrice = document.getElementById('assetAvgPrice').value;
        
        if (!symbol || !qty || !avgPrice) {
            this.showToast('Compila tutti i campi obbligatori', 'error');
            return;
        }
        
        Portfolio.addAsset(symbol, name, qty, avgPrice);
        Analysis.runAll();
        this.renderAll();
        this.hideModal('addAssetModal');
        this.showToast(`${symbol} aggiunto al portfolio!`, 'success');

        // Reset form
        e.target.reset();
    },

    // ============================================
    // WALLET FUNCTIONS
    // ============================================

    // Update sync status display on button
    updateSyncStatus(customText = null) {
        const btn = document.getElementById('syncWalletBtn');
        if (!btn) return;

        if (customText) {
            btn.innerHTML = `<span class="icon">⏳</span> ${customText}`;
            btn.disabled = true;
        } else {
            const lastSync = Wallet.getLastSyncFormatted();
            btn.innerHTML = `<span class="icon">🔗</span> Sync <span class="sync-time">(${lastSync})</span>`;
            btn.disabled = false;
        }
    },

    // Show wallet configuration modal
    showWalletModal() {
        const container = document.getElementById('walletConfigList');
        if (!container) return;

        const html = state.portfolio.map(asset => {
            const address = Wallet.getAddress(asset.symbol);
            const hasAddress = !!address;
            const color = CONFIG.COLORS[asset.symbol] || CONFIG.COLORS.DEFAULT;

            return `
                <div class="wallet-config-item">
                    <div class="wallet-asset-info">
                        <div class="asset-icon" style="background: ${color}">${asset.symbol.substring(0, 2)}</div>
                        <div class="wallet-asset-details">
                            <span class="wallet-asset-symbol">${asset.symbol}</span>
                            <span class="wallet-asset-qty">${Portfolio.formatNumber(asset.qty, 2)} ${asset.symbol}</span>
                        </div>
                    </div>
                    <div class="wallet-address-wrapper">
                        <input type="text"
                               class="wallet-address-input"
                               id="wallet-${asset.symbol}"
                               value="${address}"
                               placeholder="Inserisci indirizzo ${asset.symbol}..."
                               onchange="UI.saveWalletAddress('${asset.symbol}', this.value)">
                        <div class="wallet-status ${hasAddress ? 'configured' : ''}">
                            ${hasAddress ? '✓' : '○'}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-sync"
                            onclick="UI.syncSingleWallet('${asset.symbol}')"
                            ${!hasAddress ? 'disabled' : ''}>
                        🔄
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        this.showModal('walletModal');
    },

    // Save wallet address
    saveWalletAddress(symbol, address) {
        Wallet.setAddress(symbol, address.trim());

        // Update UI
        const statusEl = document.querySelector(`#wallet-${symbol}`)?.parentElement?.querySelector('.wallet-status');
        const syncBtn = document.querySelector(`#wallet-${symbol}`)?.parentElement?.parentElement?.querySelector('.btn-sync');

        if (statusEl) {
            statusEl.classList.toggle('configured', !!address.trim());
            statusEl.textContent = address.trim() ? '✓' : '○';
        }
        if (syncBtn) {
            syncBtn.disabled = !address.trim();
        }

        this.showToast(`Indirizzo ${symbol} salvato`, 'success');
    },

    // Sync single wallet
    async syncSingleWallet(symbol) {
        this.showToast(`Sincronizzazione ${symbol}...`, 'info');

        const result = await Wallet.syncAsset(symbol);

        if (result.success) {
            if (result.changed) {
                this.showToast(`${symbol}: ${Portfolio.formatNumber(result.oldQty, 2)} → ${Portfolio.formatNumber(result.newQty, 2)}`, 'success');
            } else {
                this.showToast(`${symbol}: saldo invariato`, 'info');
            }
            Analysis.runAll();
            this.renderAll();
            this.showWalletModal(); // Refresh modal
        } else {
            this.showToast(`Errore ${symbol}: ${result.message}`, 'error');
        }
    },

    // Sync all wallets
    async syncAllWallets() {
        this.showToast('Sincronizzazione wallet in corso...', 'info');
        this.updateSyncStatus('Sincronizzazione...');

        const results = await Wallet.syncAll();

        if (results.success.length > 0) {
            const summary = results.success.map(r =>
                `${r.symbol}: ${Portfolio.formatNumber(r.newQty, 2)}`
            ).join(', ');
            this.showToast(`Aggiornati: ${summary}`, 'success');
        }

        if (results.failed.length > 0) {
            this.showToast(`Errori: ${results.failed.join(', ')}`, 'error');
        }

        if (results.success.length === 0 && results.failed.length === 0) {
            this.showToast('Nessun wallet configurato', 'info');
        }

        Analysis.runAll();
        this.renderAll();
        this.updateSyncStatus(); // Update button with last sync time
        this.showWalletModal(); // Refresh modal
    },

    // ============================================
    // ADD NEW TRANSACTION
    // ============================================

    // Show add transaction modal
    showAddTransactionModal() {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('txDate').value = today;

        // Reset form
        document.getElementById('txQty').value = '';
        document.getElementById('txPriceEUR').value = '';
        document.getElementById('txNote').value = '';
        document.getElementById('txTotalEUR').textContent = '€0.00';

        // Update qty hint for selected asset
        this.updateTransactionQtyDiff();

        this.showModal('addTransactionModal');
    },

    // Calculate and show quantity difference (wallet qty - transactions qty)
    updateTransactionQtyDiff() {
        const symbol = document.getElementById('txAsset').value;
        const hintEl = document.getElementById('txQtyHint');
        const qtyInput = document.getElementById('txQty');

        // Get current wallet balance
        const asset = state.portfolio.find(a => a.symbol === symbol);
        const walletQty = asset ? parseFloat(asset.qty) || 0 : 0;

        // Get total qty from transactions
        const txQty = state.transactions
            .filter(tx => tx.asset === symbol && tx.type === 'BUY')
            .reduce((sum, tx) => sum + (parseFloat(tx.qty) || 0), 0);

        // Calculate difference
        const diff = walletQty - txQty;

        if (diff > 0.01) {
            hintEl.textContent = `(Differenza: +${diff.toFixed(2)} ${symbol})`;
            hintEl.style.color = 'var(--success)';
            // Auto-fill quantity with difference
            qtyInput.value = diff.toFixed(4);
            this.updateTransactionTotal();
        } else if (diff < -0.01) {
            hintEl.textContent = `(Eccedenza: ${diff.toFixed(2)} ${symbol})`;
            hintEl.style.color = 'var(--warning)';
        } else {
            hintEl.textContent = '(Bilancio OK)';
            hintEl.style.color = 'var(--text-secondary)';
        }
    },

    // Update total EUR when qty or price changes
    updateTransactionTotal() {
        const qty = parseFloat(document.getElementById('txQty').value) || 0;
        const price = parseFloat(document.getElementById('txPriceEUR').value) || 0;
        const total = qty * price;
        document.getElementById('txTotalEUR').textContent = `€${total.toFixed(2)}`;
    },

    // Save new transaction
    saveNewTransaction(event) {
        event.preventDefault();

        const symbol = document.getElementById('txAsset').value;
        const qty = parseFloat(document.getElementById('txQty').value);
        const priceEUR = parseFloat(document.getElementById('txPriceEUR').value);
        const date = document.getElementById('txDate').value;
        const note = document.getElementById('txNote').value || `Acquisto ${symbol}`;

        if (!qty || qty <= 0 || !priceEUR || priceEUR <= 0 || !date) {
            this.showToast('Compila tutti i campi obbligatori', 'error');
            return;
        }

        // Create new transaction
        const newTx = {
            id: Date.now(),
            date: date,
            type: 'BUY',
            asset: symbol,
            qty: qty,
            priceEUR: priceEUR,
            note: note
        };

        // Add to state
        state.transactions.push(newTx);

        // Sort by date
        state.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Save transactions
        saveTransactions();

        // Ricalcola costBasisEUR, originalQty, avgPriceEUR dalle transazioni
        // Single source of truth!
        recalculateFromTransactions();

        // Regenerate historical snapshots
        generateAndSaveHistoricalSnapshots();

        // Refresh UI
        Analysis.runAll();
        this.renderAll();

        // Close modal
        this.hideModal('addTransactionModal');

        const totalCost = qty * priceEUR;
        this.showToast(`Acquisto ${qty.toFixed(2)} ${symbol} (€${totalCost.toFixed(2)}) salvato!`, 'success');
    }
};

// Initialize on DOM ready with error boundary
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await App.init();
    } catch (e) {
        console.error('Fatal error initializing app:', e);

        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:20px;background:#ef4444;color:white;text-align:center;z-index:9999;font-family:sans-serif;';
        errorDiv.innerHTML = `
            <strong>Errore di caricamento</strong><br>
            <small>${e.message || 'Errore sconosciuto'}</small><br>
            <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:white;color:#ef4444;border:none;border-radius:4px;cursor:pointer;">
                Ricarica pagina
            </button>
        `;
        document.body.prepend(errorDiv);
    }
});

// Export
window.App = App;
window.UI = UI;
