// ============================================
// CRYPTO PORTFOLIO TRACKER - ANALYSIS MODULE
// ============================================

const Analysis = {
    
    // Run all analysis
    runAll() {
        state.portfolio.forEach(asset => {
            state.analysis[asset.symbol] = this.analyzeAsset(asset);
        });
    },
    
    // Analyze single asset
    analyzeAsset(asset) {
        const symbol = asset.symbol;
        const history = state.history[symbol];
        const price = state.prices[symbol]?.USD?.PRICE || 0;
        const changes = state.changes[symbol] || { d1: 0, d7: 0, d30: 0 };
        
        // Calculate RSI
        const rsi = history ? this.calculateRSI(history.map(d => d.close), 14) : 50;
        
        // Calculate heat (surriscaldamento)
        const heat = this.calculateHeat(symbol, price, rsi, changes);
        
        // Calculate P&L
        const pnlPct = asset.avgPrice > 0 ? ((price - asset.avgPrice) / asset.avgPrice) * 100 : 0;
        
        // ATH distance
        const ath = CONFIG.ATH[symbol] || price;
        const athDistance = ((ath - price) / ath) * 100;
        
        // Generate advice
        const advice = this.generateAdvice(symbol, rsi, heat, pnlPct, athDistance);
        
        // Signal for traffic light
        const signal = this.getSignal(rsi, heat, pnlPct);
        
        return {
            rsi,
            heat,
            pnlPct,
            athDistance,
            advice,
            signal,
            changes
        };
    },
    
    // Calculate RSI
    calculateRSI(prices, period = 14) {
        if (!prices || prices.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        // Calculate first average
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },
    
    // Calculate heat (surriscaldamento) 0-100%
    calculateHeat(symbol, price, rsi, changes) {
        let heat = 0;
        
        // Factor 1: RSI contribution (0-30 points)
        // RSI 30 = 0 heat, RSI 70 = 30 heat
        if (rsi > 50) {
            heat += Math.min(30, (rsi - 50) * 1.5);
        }
        
        // Factor 2: ATH proximity (0-30 points)
        const ath = CONFIG.ATH[symbol] || price;
        const athDist = ((ath - price) / ath) * 100;
        if (athDist < 30) {
            heat += Math.min(30, (30 - athDist));
        }
        
        // Factor 3: Recent performance (0-20 points)
        // If 7d and 30d are very positive, add heat
        const recentGain = (changes.d7 + changes.d30) / 2;
        if (recentGain > 0) {
            heat += Math.min(20, recentGain / 2);
        }
        
        // Factor 4: Resistance proximity (0-20 points)
        const resistances = CONFIG.RESISTANCE[symbol] || [];
        const nextResistance = resistances.find(r => r > price);
        if (nextResistance) {
            const distToRes = ((nextResistance - price) / price) * 100;
            if (distToRes < 10) {
                heat += Math.min(20, 20 - distToRes * 2);
            }
        }
        
        return Math.min(100, Math.max(0, heat));
    },
    
    // Generate advice for asset
    generateAdvice(symbol, rsi, heat, pnlPct, athDistance) {
        const t = CONFIG.THRESHOLDS;
        
        // STRONG BUY signals
        if (rsi <= t.RSI_EXTREME_LOW && heat < 20) {
            return {
                action: 'ACCUMULA',
                strength: 'strong',
                reason: 'RSI in zona estrema + prezzo freddo',
                icon: '💰',
                color: '#00D4AA'
            };
        }
        
        if (rsi <= t.RSI_OVERSOLD && state.fng.value <= t.FNG_FEAR) {
            return {
                action: 'ACCUMULA',
                strength: 'strong',
                reason: 'RSI basso + Fear nel mercato',
                icon: '💰',
                color: '#00D4AA'
            };
        }
        
        // MODERATE BUY
        if (rsi <= t.RSI_OVERSOLD && heat < 30) {
            return {
                action: 'CONSIDERA ACQUISTO',
                strength: 'moderate',
                reason: 'RSI in ipervenduto',
                icon: '📥',
                color: '#0088FF'
            };
        }
        
        // STRONG SELL signals
        if (rsi >= t.RSI_EXTREME_HIGH && pnlPct >= t.PNL_EXTREME) {
            return {
                action: 'PRENDI PROFITTO',
                strength: 'strong',
                reason: `RSI estremo + ${pnlPct.toFixed(0)}% profitto`,
                icon: '🎯',
                color: '#FF6B6B'
            };
        }
        
        if (heat >= 80 && pnlPct >= t.PNL_HIGH) {
            return {
                action: 'VENDI PARZIALE',
                strength: 'strong',
                reason: 'Prezzo surriscaldato + buon profitto',
                icon: '📤',
                color: '#FF6B6B'
            };
        }
        
        // MODERATE SELL
        if (rsi >= t.RSI_OVERBOUGHT && state.fng.value >= t.FNG_GREED) {
            return {
                action: 'PRUDENZA',
                strength: 'moderate',
                reason: 'RSI alto + Greed nel mercato',
                icon: '⚠️',
                color: '#FBBF24'
            };
        }
        
        if (athDistance <= t.ATH_PROXIMITY && pnlPct > 30) {
            return {
                action: 'VALUTA VENDITA',
                strength: 'moderate',
                reason: `Solo ${athDistance.toFixed(0)}% da ATH`,
                icon: '🏔️',
                color: '#FBBF24'
            };
        }
        
        // CAUTION
        if (heat >= 60 || rsi >= 65) {
            return {
                action: 'MONITORA',
                strength: 'light',
                reason: 'Prezzo in zona calda',
                icon: '👀',
                color: '#FBBF24'
            };
        }
        
        // DEFAULT - HOLD
        return {
            action: 'HOLD',
            strength: 'neutral',
            reason: 'Nessun segnale estremo',
            icon: '✅',
            color: '#00D4AA'
        };
    },
    
    // Get traffic light signal
    getSignal(rsi, heat, pnlPct) {
        // Red - Danger/Overbought
        if (rsi >= 75 || heat >= 75) {
            return { color: 'danger', label: 'Caldo' };
        }
        
        // Orange - Warning
        if (rsi >= 65 || heat >= 50) {
            return { color: 'warning', label: 'Tiepido' };
        }
        
        // Blue - Opportunity
        if (rsi <= 30 || heat <= 20) {
            return { color: 'opportunity', label: 'Freddo' };
        }
        
        // Green - OK
        return { color: 'ok', label: 'Neutro' };
    },
    
    // Get global market conditions
    getMarketConditions() {
        const buyConditions = [];
        const sellConditions = [];
        
        // === BUY CONDITIONS ===
        
        // 1. Fear & Greed Extreme Fear
        buyConditions.push({
            label: 'Fear & Greed ≤ 25',
            value: `F&G = ${state.fng.value}`,
            active: state.fng.value <= 25
        });
        
        // 2. BTC sotto 200 MA
        const btcBelow = state.btcTrend && !state.btcTrend.above;
        buyConditions.push({
            label: 'BTC sotto 200 MA',
            value: state.btcTrend ? `${state.btcTrend.pct.toFixed(1)}%` : '--',
            active: btcBelow
        });
        
        // 3. RSI basso su 2+ asset
        const lowRSI = Object.values(state.analysis).filter(a => a.rsi < 30).length;
        buyConditions.push({
            label: 'RSI < 30 su 2+ asset',
            value: `${lowRSI} asset`,
            active: lowRSI >= 2
        });
        
        // 4. Portfolio in perdita (sotto PMC)
        const pnl = this.getPortfolioPnL();
        buyConditions.push({
            label: 'Portfolio sotto PMC',
            value: `${pnl.toFixed(1)}%`,
            active: pnl < -10
        });
        
        // 5. Distanza da ATH > 50% su 2+ asset
        const farFromATH = Object.values(state.analysis).filter(a => a.athDistance > 50).length;
        buyConditions.push({
            label: 'Lontano da ATH (>50%)',
            value: `${farFromATH} asset`,
            active: farFromATH >= 2
        });
        
        // 6. Surriscaldamento basso (freddo)
        const coldAssets = Object.values(state.analysis).filter(a => a.heat < 25).length;
        buyConditions.push({
            label: 'Mercato freddo',
            value: `${coldAssets} asset`,
            active: coldAssets >= 2
        });
        
        // === SELL CONDITIONS ===
        
        // 1. Fear & Greed Extreme Greed
        sellConditions.push({
            label: 'Fear & Greed ≥ 75',
            value: `F&G = ${state.fng.value}`,
            active: state.fng.value >= 75
        });
        
        // 2. BTC molto sopra 200 MA
        const btcHigh = state.btcTrend && state.btcTrend.above && state.btcTrend.pct > 30;
        sellConditions.push({
            label: 'BTC sopra 200 MA (+30%)',
            value: state.btcTrend ? `${state.btcTrend.pct > 0 ? '+' : ''}${state.btcTrend.pct.toFixed(1)}%` : '--',
            active: btcHigh
        });
        
        // 3. RSI alto su 2+ asset
        const highRSI = Object.values(state.analysis).filter(a => a.rsi > 70).length;
        sellConditions.push({
            label: 'RSI > 70 su 2+ asset',
            value: `${highRSI} asset`,
            active: highRSI >= 2
        });
        
        // 4. Portfolio in forte profitto
        sellConditions.push({
            label: 'Portfolio +50% profitto',
            value: `${pnl > 0 ? '+' : ''}${pnl.toFixed(1)}%`,
            active: pnl >= 50
        });
        
        // 5. Vicino ATH su 2+ asset
        const nearATH = Object.values(state.analysis).filter(a => a.athDistance < 15).length;
        sellConditions.push({
            label: 'Vicino ATH (<15%)',
            value: `${nearATH} asset`,
            active: nearATH >= 2
        });
        
        // 6. Surriscaldamento alto
        const hotAssets = Object.values(state.analysis).filter(a => a.heat > 70).length;
        sellConditions.push({
            label: 'Mercato surriscaldato',
            value: `${hotAssets} asset`,
            active: hotAssets >= 2
        });
        
        return {
            buy: buyConditions,
            sell: sellConditions,
            buyActive: buyConditions.filter(c => c.active).length,
            sellActive: sellConditions.filter(c => c.active).length
        };
    },
    
    // Helper: Get portfolio P&L percentage
    getPortfolioPnL() {
        let totalValue = 0;
        let totalInvested = 0;
        
        state.portfolio.forEach(asset => {
            const price = state.prices[asset.symbol]?.USD?.PRICE || 0;
            totalValue += asset.qty * price;
            totalInvested += asset.qty * asset.avgPrice;
        });
        
        return totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
    },
    
    // Generate detailed recommended actions
    getRecommendedActions() {
        const actions = [];
        const conditions = this.getMarketConditions();
        
        state.portfolio.forEach(asset => {
            const analysis = state.analysis[asset.symbol];
            if (!analysis) return;
            
            const price = state.prices[asset.symbol]?.USD?.PRICE || 0;
            const priceEUR = state.prices[asset.symbol]?.EUR?.PRICE || 0;
            const displayPrice = state.currency === 'EUR' ? priceEUR : price;
            
            const pnlPct = analysis.pnlPct || 0;
            const rsi = analysis.rsi || 50;
            const heat = analysis.heat || 0;
            const athDistance = analysis.athDistance || 0;
            
            const sym = state.currency === 'EUR' ? '€' : '$';
            
            // === SELL ACTIONS ===
            
            // Strong sell: RSI extreme + high profit
            if (rsi >= 80 && pnlPct >= 50) {
                const sellPct = pnlPct >= 100 ? 30 : 20;
                const sellQty = (asset.qty * sellPct) / 100;
                const sellValue = sellQty * displayPrice;
                
                actions.push({
                    type: 'SELL',
                    priority: 1,
                    asset: asset.symbol,
                    action: `Vendi ${sellPct}%`,
                    quantity: sellQty,
                    value: sellValue,
                    currentPrice: displayPrice,
                    targetPrice: null,
                    reason: `RSI estremo (${rsi.toFixed(0)}) + Profitto ${pnlPct.toFixed(0)}%`,
                    details: `Prendi profitto su ${sellQty.toFixed(2)} ${asset.symbol} (${sym}${sellValue.toFixed(0)})`,
                    icon: '🎯',
                    color: '#EF4444'
                });
            }
            // Moderate sell: near ATH + good profit
            else if (athDistance <= 15 && pnlPct >= 30) {
                const sellPct = 15;
                const sellQty = (asset.qty * sellPct) / 100;
                const sellValue = sellQty * displayPrice;
                const ath = CONFIG.ATH[asset.symbol] || price;
                
                actions.push({
                    type: 'SELL',
                    priority: 2,
                    asset: asset.symbol,
                    action: `Vendi ${sellPct}%`,
                    quantity: sellQty,
                    value: sellValue,
                    currentPrice: displayPrice,
                    targetPrice: ath * (state.currency === 'EUR' ? (priceEUR/price) : 1),
                    reason: `Solo ${athDistance.toFixed(0)}% da ATH`,
                    details: `Valuta vendita parziale vicino ai massimi storici`,
                    icon: '🏔️',
                    color: '#F59E0B'
                });
            }
            // Heat warning
            else if (heat >= 75 && pnlPct >= 20) {
                const sellPct = 10;
                const sellQty = (asset.qty * sellPct) / 100;
                const sellValue = sellQty * displayPrice;
                
                actions.push({
                    type: 'SELL',
                    priority: 3,
                    asset: asset.symbol,
                    action: `Considera ${sellPct}%`,
                    quantity: sellQty,
                    value: sellValue,
                    currentPrice: displayPrice,
                    targetPrice: null,
                    reason: `Surriscaldamento ${heat.toFixed(0)}%`,
                    details: `Asset in zona calda, proteggi parte dei profitti`,
                    icon: '🔥',
                    color: '#F59E0B'
                });
            }
            
            // === BUY ACTIONS ===
            
            // Strong buy: RSI extreme low + fear
            if (rsi <= 25 && state.fng.value <= 30) {
                const support = this.getNextSupport(asset.symbol, price);
                const supportDisplay = support * (state.currency === 'EUR' ? (priceEUR/price) : 1);
                
                actions.push({
                    type: 'BUY',
                    priority: 1,
                    asset: asset.symbol,
                    action: 'Accumula forte',
                    quantity: null,
                    value: null,
                    currentPrice: displayPrice,
                    targetPrice: supportDisplay,
                    reason: `RSI ${rsi.toFixed(0)} + Fear ${state.fng.value}`,
                    details: `Zona di accumulo ideale. Supporto a ${sym}${supportDisplay.toFixed(4)}`,
                    icon: '💰',
                    color: '#00D4AA'
                });
            }
            // Moderate buy: RSI low
            else if (rsi <= 35 && heat <= 25) {
                const support = this.getNextSupport(asset.symbol, price);
                const supportDisplay = support * (state.currency === 'EUR' ? (priceEUR/price) : 1);
                
                actions.push({
                    type: 'BUY',
                    priority: 2,
                    asset: asset.symbol,
                    action: 'Considera acquisto',
                    quantity: null,
                    value: null,
                    currentPrice: displayPrice,
                    targetPrice: supportDisplay,
                    reason: `RSI basso (${rsi.toFixed(0)}) + Mercato freddo`,
                    details: `Buon punto di ingresso. Target: ${sym}${supportDisplay.toFixed(4)}`,
                    icon: '📥',
                    color: '#0088FF'
                });
            }
            // DCA opportunity: asset in loss
            else if (pnlPct <= -20 && rsi <= 45) {
                actions.push({
                    type: 'BUY',
                    priority: 3,
                    asset: asset.symbol,
                    action: 'DCA consigliato',
                    quantity: null,
                    value: null,
                    currentPrice: displayPrice,
                    targetPrice: null,
                    reason: `In perdita ${pnlPct.toFixed(0)}%`,
                    details: `Abbassa il PMC con un piccolo acquisto`,
                    icon: '📊',
                    color: '#0088FF'
                });
            }
        });
        
        // Sort by priority
        actions.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'SELL' ? -1 : 1;
            return a.priority - b.priority;
        });
        
        // If no actions, add HOLD message
        if (actions.length === 0) {
            actions.push({
                type: 'HOLD',
                priority: 0,
                asset: 'ALL',
                action: 'Mantieni posizioni',
                quantity: null,
                value: null,
                currentPrice: null,
                targetPrice: null,
                reason: 'Nessun segnale estremo',
                details: 'Il mercato è in fase neutrale. Continua a monitorare gli indicatori.',
                icon: '✅',
                color: '#00D4AA'
            });
        }
        
        return actions;
    },
    
    // Get next support level
    getNextSupport(symbol, currentPrice) {
        const supports = CONFIG.SUPPORT[symbol] || [];
        for (let i = supports.length - 1; i >= 0; i--) {
            if (supports[i] < currentPrice * 0.98) {
                return supports[i];
            }
        }
        return currentPrice * 0.9;
    },
    
    // Get next resistance level
    getNextResistance(symbol, currentPrice) {
        const resistances = CONFIG.RESISTANCE[symbol] || [];
        for (const r of resistances) {
            if (r > currentPrice * 1.02) {
                return r;
            }
        }
        return CONFIG.ATH[symbol] || currentPrice * 1.2;
    },
    
    // Get overall action banner
    getActionBanner() {
        const conditions = this.getMarketConditions();
        
        if (conditions.buyActive >= 2) {
            return {
                type: 'buy',
                title: 'Opportunità di Accumulo',
                subtitle: `${conditions.buyActive} condizioni favorevoli attive`,
                badge: 'CONSIDERA BUY',
                icon: '💰'
            };
        }
        
        if (conditions.sellActive >= 2) {
            return {
                type: 'sell',
                title: 'Zona di Prudenza',
                subtitle: `${conditions.sellActive} segnali di attenzione attivi`,
                badge: 'CONSIDERA SELL',
                icon: '⚠️'
            };
        }
        
        if (conditions.buyActive === 1 || conditions.sellActive === 1) {
            return {
                type: 'monitor',
                title: 'Monitoraggio Attivo',
                subtitle: 'Alcuni indicatori richiedono attenzione',
                badge: 'MONITORA',
                icon: '👀'
            };
        }
        
        return {
            type: 'hold',
            title: 'Tutto Sotto Controllo',
            subtitle: 'Nessun segnale estremo - Mercato neutrale',
            badge: 'HODL',
            icon: '✅'
        };
    }
};

// Export
window.Analysis = Analysis;
