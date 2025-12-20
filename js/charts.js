// ============================================
// CRYPTO PORTFOLIO TRACKER - CHARTS MODULE
// ============================================

const Charts = {
    mainChart: null,
    allocationChart: null,
    showBtcComparison: false,
    
    // Initialize charts
    init() {
        // Do NOT register datalabels globally - we'll use it only for allocation chart
        
        // Bind BTC toggle
        const btcToggle = document.getElementById('btcCompareToggle');
        if (btcToggle) {
            btcToggle.addEventListener('change', (e) => {
                this.showBtcComparison = e.target.checked;
                this.renderMain();
            });
        }
    },
    
    // Get BTC comparison data - INCREMENTAL
    // Calcola quanto BTC avresti potuto comprare con ogni transazione
    // e mostra il valore cumulativo nel tempo
    getBtcComparisonData(portfolioHistory) {
        if (!portfolioHistory.length) return null;

        const btcHistory = state.history['BTC'];
        if (!btcHistory || !btcHistory.length) return null;

        // Prepara le transazioni BUY ordinate per data
        const sortedTx = [...state.transactions]
            .filter(tx => tx.type === 'BUY')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (sortedTx.length === 0) return null;

        // Crea mappa prezzi BTC per data
        const btcPriceMap = {};
        btcHistory.forEach(h => {
            const dateStr = new Date(h.time * 1000).toISOString().split('T')[0];
            btcPriceMap[dateStr] = h.close;
        });

        const limit = state.timeRange === 0 ? btcHistory.length : Math.min(state.timeRange, btcHistory.length);
        const startIdx = btcHistory.length - limit;
        const conversionRate = state.currency === 'EUR' ? Portfolio.getConversionRate() : 1;

        console.log(`📊 BTC Comparison: Calculating incremental BTC comparison, ${sortedTx.length} transactions`);

        // Calcola i BTC cumulativi a ogni punto nel tempo
        const btcData = [];

        for (let i = startIdx; i < btcHistory.length; i++) {
            const timestamp = btcHistory[i].time * 1000;
            const dateStr = new Date(timestamp).toISOString().split('T')[0];
            const btcPriceToday = btcHistory[i].close;

            // Calcola quanti BTC avresti accumulato fino a questa data
            let totalBtcAccumulated = 0;

            for (const tx of sortedTx) {
                // Considera solo transazioni fino a questa data
                if (tx.date > dateStr) break;

                // Quanto hai investito in questa transazione (in USD)
                const investedUSD = (parseFloat(tx.qty) || 0) * (parseFloat(tx.price) || 0);

                // Prezzo BTC alla data della transazione
                const btcPriceAtTx = btcPriceMap[tx.date] || btcPriceToday;

                // Quanti BTC avresti potuto comprare
                const btcBought = investedUSD / btcPriceAtTx;

                totalBtcAccumulated += btcBought;
            }

            // Valore dei BTC accumulati a oggi
            const btcValue = totalBtcAccumulated * btcPriceToday * conversionRate;

            btcData.push(btcValue);
        }

        return btcData;
    },
    
    // Render main portfolio chart
    renderMain() {
        const canvas = document.getElementById('mainChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const history = Portfolio.getPortfolioHistory();

        if (!history.length) return;

        // Prepare data
        const labels = history.map(h => h.time);
        const values = history.map(h => h.value);

        // Extract invested line from history (dynamic, grows with each purchase)
        const investedValues = history.map(h => h.invested || 0);
        const currentInvested = investedValues[investedValues.length - 1] || Portfolio.getTotalInvested();

        // Calculate stats for display
        const currentValue = values[values.length - 1] || 0;
        const startValue = values[0] || 0;
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values.filter(v => v > 0));  // Ignora zeri
        const periodPnl = currentValue - startValue;
        const periodPnlPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;

        // Update chart stats bar
        this.updateChartStats(maxValue, minValue, currentInvested, periodPnl, periodPnlPct);

        // Get transaction markers
        const transactions = Portfolio.getTransactionMarkers();
        const txDates = new Set(transactions.map(t => t.date));

        // Point styling for transaction markers
        const pointColors = [];
        const pointRadii = [];
        const pointBorders = [];

        history.forEach(h => {
            const dateStr = new Date(h.time).toISOString().split('T')[0];
            const txOnDay = transactions.filter(t => t.date === dateStr);

            if (txOnDay.length > 0) {
                pointColors.push(txOnDay[0].color);
                pointRadii.push(8);
                pointBorders.push('#ffffff');
            } else {
                pointColors.push('transparent');
                pointRadii.push(0);
                pointBorders.push('transparent');
            }
        });

        // Create dynamic gradient based on profit/loss relative to invested
        const profitGradient = this.createProfitLossGradient(ctx, values, currentInvested);

        // Prepare datasets
        const datasets = [
            {
                label: 'Valore Portfolio',
                data: values,
                borderColor: '#0088FF',
                backgroundColor: profitGradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: pointColors,
                pointRadius: pointRadii,
                pointBorderColor: pointBorders,
                pointBorderWidth: 2,
                pointHoverRadius: 10,
                order: 1
            },
            {
                label: 'Capitale Investito',
                data: investedValues,  // Linea dinamica che cresce con ogni acquisto
                borderColor: '#10B981',  // Verde (diverso da BTC arancione)
                borderDash: [10, 5],
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                tension: 0.1,  // Leggera curva per transizioni più smooth
                order: 3
            }
        ];
        
        // Add BTC comparison line if enabled
        if (this.showBtcComparison) {
            const btcData = this.getBtcComparisonData(history);
            if (btcData) {
                datasets.push({
                    label: 'Se avessi comprato BTC',
                    data: btcData,
                    borderColor: '#F7931A',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    order: 2
                });
            }
        }
        
        // Destroy existing chart
        if (this.mainChart) {
            this.mainChart.destroy();
        }
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        this.mainChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: this.showBtcComparison,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#94a3b8',
                            usePointStyle: true,
                            pointStyle: 'line',
                            padding: 20,
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 12
                            },
                            filter: (item) => item.text !== 'Capitale Investito'
                        }
                    },
                    datalabels: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 20, 30, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 16,
                        displayColors: true,
                        callbacks: {
                            title: (ctx) => {
                                const date = new Date(ctx[0].parsed.x);
                                return date.toLocaleDateString('it-IT', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                            },
                            label: (ctx) => {
                                const value = ctx.raw.toLocaleString('it-IT', { maximumFractionDigits: 0 });
                                
                                if (ctx.datasetIndex === 0) {
                                    return ` Portfolio: ${sym}${value}`;
                                }
                                if (ctx.dataset.label === 'Se avessi comprato BTC') {
                                    return ` BTC: ${sym}${value}`;
                                }
                                if (ctx.dataset.label === 'Capitale Investito') {
                                    return ` Investito: ${sym}${value}`;
                                }
                                return ` ${ctx.dataset.label}: ${sym}${value}`;
                            },
                            afterBody: (ctx) => {
                                if (!this.showBtcComparison) return '';
                                
                                const portfolioValue = ctx[0]?.raw || 0;
                                const btcDataset = ctx.find(c => c.dataset.label === 'Se avessi comprato BTC');
                                const btcValue = btcDataset?.raw || 0;
                                
                                if (btcValue > 0 && portfolioValue > 0) {
                                    const diff = portfolioValue - btcValue;
                                    const diffPct = ((portfolioValue / btcValue) - 1) * 100;
                                    const winning = diff >= 0;
                                    
                                    return `\n${winning ? '🏆' : '📉'} ${winning ? 'Stai battendo' : 'BTC ti batte di'} ${winning ? '+' : ''}${diffPct.toFixed(1)}%`;
                                }
                                return '';
                            },
                            afterLabel: (ctx) => {
                                if (ctx.datasetIndex !== 0) return '';
                                
                                const dateStr = new Date(ctx.parsed.x).toISOString().split('T')[0];
                                const txs = transactions.filter(tx => tx.date === dateStr);
                                
                                if (txs.length > 0) {
                                    return txs.map(tx => 
                                        `📍 ${tx.type} ${tx.symbol}: ${tx.qty.toLocaleString()}`
                                    ).join('\n');
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: state.timeRange <= 1 ? 'hour' :
                                  state.timeRange <= 7 ? 'day' :
                                  state.timeRange <= 30 ? 'day' :
                                  state.timeRange <= 90 ? 'week' : 'month',
                            displayFormats: {
                                hour: 'HH:mm',
                                day: 'd MMM',
                                week: 'd MMM',
                                month: 'MMM yyyy'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: "'JetBrains Mono', monospace",
                                size: 11
                            },
                            maxTicksLimit: state.timeRange <= 7 ? 7 : 12
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: "'JetBrains Mono', monospace",
                                size: 11
                            },
                            callback: (val) => `${sym}${(val / 1000).toFixed(0)}K`
                        }
                    }
                }
            }
        });
        
        // Update comparison stats
        this.updateComparisonStats(history);
    },
    
    // Create gradient helper
    createGradient(ctx, colorStart, colorEnd) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    },

    // Create dynamic profit/loss gradient based on invested line
    createProfitLossGradient(ctx, values, invested) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        const canvas = ctx.canvas;
        const chartArea = canvas.height;

        // Determine overall position relative to invested
        const currentValue = values[values.length - 1] || 0;
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

        if (avgValue >= invested) {
            // In profit - green gradient
            gradient.addColorStop(0, 'rgba(0, 212, 170, 0.4)');
            gradient.addColorStop(0.5, 'rgba(0, 212, 170, 0.15)');
            gradient.addColorStop(1, 'rgba(0, 212, 170, 0.0)');
        } else {
            // In loss - red gradient
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
            gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        }

        return gradient;
    },

    // Update chart stats bar
    updateChartStats(maxValue, minValue, invested, periodPnl, periodPnlPct) {
        const sym = state.currency === 'EUR' ? '€' : '$';

        // ATH
        const athEl = document.getElementById('chartATH');
        if (athEl) {
            athEl.textContent = `${sym}${maxValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
        }

        // Min
        const minEl = document.getElementById('chartMin');
        if (minEl) {
            minEl.textContent = `${sym}${minValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
        }

        // Invested
        const investedEl = document.getElementById('chartInvested');
        if (investedEl) {
            investedEl.textContent = `${sym}${invested.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
        }

        // P&L
        const pnlEl = document.getElementById('chartPnl');
        const pnlBadge = document.getElementById('chartPnlBadge');
        if (pnlEl) {
            const sign = periodPnl >= 0 ? '+' : '';
            pnlEl.textContent = `${sign}${sym}${periodPnl.toLocaleString('it-IT', { maximumFractionDigits: 0 })} (${sign}${periodPnlPct.toFixed(1)}%)`;
            pnlEl.className = `chart-stat-value ${periodPnl >= 0 ? 'positive' : 'negative'}`;
        }
        if (pnlBadge) {
            pnlBadge.className = `chart-stat pnl-badge ${periodPnl >= 0 ? '' : 'negative'}`;
        }
    },
    
    // Update comparison statistics
    // Confronta performance portfolio vs BTC rispetto al capitale investito
    updateComparisonStats(portfolioHistory) {
        const statsContainer = document.getElementById('btcCompareStats');
        if (!statsContainer) return;

        if (!this.showBtcComparison || !portfolioHistory.length) {
            statsContainer.style.display = 'none';
            return;
        }

        const btcData = this.getBtcComparisonData(portfolioHistory);
        if (!btcData || !btcData.length) {
            statsContainer.style.display = 'none';
            return;
        }

        const currentPortfolio = portfolioHistory[portfolioHistory.length - 1].value;
        const currentBtc = btcData[btcData.length - 1];

        // Usa il totale investito (ultima posizione della history)
        const totalInvested = portfolioHistory[portfolioHistory.length - 1].invested || Portfolio.getTotalInvested();

        // Evita divisione per zero
        if (totalInvested <= 0) {
            statsContainer.style.display = 'none';
            return;
        }

        // Calcola gain % rispetto al capitale investito
        const portfolioGain = ((currentPortfolio / totalInvested) - 1) * 100;
        const btcGain = ((currentBtc / totalInvested) - 1) * 100;
        const difference = portfolioGain - btcGain;
        const winning = difference >= 0;

        const sym = state.currency === 'EUR' ? '€' : '$';

        statsContainer.style.display = 'flex';
        statsContainer.innerHTML = `
            <div class="compare-stat">
                <span class="compare-label">Il tuo Portfolio</span>
                <span class="compare-value ${portfolioGain >= 0 ? 'positive' : 'negative'}">
                    ${portfolioGain >= 0 ? '+' : ''}${portfolioGain.toFixed(1)}%
                </span>
            </div>
            <div class="compare-vs">VS</div>
            <div class="compare-stat">
                <span class="compare-label">100% Bitcoin</span>
                <span class="compare-value ${btcGain >= 0 ? 'positive' : 'negative'}" style="color: #F7931A">
                    ${btcGain >= 0 ? '+' : ''}${btcGain.toFixed(1)}%
                </span>
            </div>
            <div class="compare-result ${winning ? 'winning' : 'losing'}">
                <span class="compare-icon">${winning ? '🏆' : '📉'}</span>
                <span class="compare-diff">${winning ? '+' : ''}${difference.toFixed(1)}%</span>
            </div>
        `;
    },
    
    // Render allocation donut chart
    renderAllocation() {
        const canvas = document.getElementById('allocationChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const allocation = Portfolio.getAllocation();
        
        if (!allocation.length) return;
        
        // Prepare data
        const labels = allocation.map(a => a.symbol);
        const values = allocation.map(a => a.value);
        const colors = allocation.map(a => a.color);
        
        // Destroy existing chart
        if (this.allocationChart) {
            this.allocationChart.destroy();
        }
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        this.allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 10,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 20, 30, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return `${sym}${ctx.raw.toLocaleString('it-IT', { maximumFractionDigits: 0 })} (${pct}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: {
                            family: "'JetBrains Mono', monospace",
                            weight: 'bold',
                            size: 12
                        },
                        formatter: (value, ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = (value / total) * 100;
                            return pct >= 5 ? `${pct.toFixed(0)}%` : '';
                        }
                    }
                }
            },
            plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : []
        });
        
        // Render allocation list
        this.renderAllocationList(allocation);
    },
    
    // Render allocation list below chart
    renderAllocationList(allocation) {
        const container = document.getElementById('allocationList');
        if (!container) return;
        
        const sym = state.currency === 'EUR' ? '€' : '$';
        
        container.innerHTML = allocation.map(a => `
            <div class="allocation-item">
                <div class="allocation-info">
                    <div class="allocation-dot" style="background: ${a.color}"></div>
                    <span class="allocation-name">${a.symbol}</span>
                </div>
                <div class="allocation-values">
                    <span class="allocation-value">${sym}${a.value.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                    <span class="allocation-pct">${a.pct.toFixed(1)}%</span>
                </div>
            </div>
        `).join('');
    },
    
    // Set time range
    async setTimeRange(days) {
        state.timeRange = days;

        // Update buttons
        document.querySelectorAll('.chart-range-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.range) === days);
        });

        // Load hourly data for 1D/1W views
        if (days <= 7) {
            const hours = days === 1 ? 24 : 168;  // 24 hours or 7 days worth
            UI.showLoading(true);
            await API.fetchHourlyHistory(hours);
            UI.showLoading(false);
        }

        this.renderMain();
    }
};

// Export
window.Charts = Charts;
