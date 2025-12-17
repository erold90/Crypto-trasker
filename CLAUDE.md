# Crypto Portfolio Tracker - Documentazione Progetto

## Panoramica

**Crypto Portfolio Tracker** è un'applicazione web per il monitoraggio di un portafoglio crypto con approccio conservativo. Supporta tracking in tempo reale, analisi tecnica, e sincronizzazione automatica dei saldi dalla blockchain.

**Live:** https://golden-sable-b5562a.netlify.app/

---

## Struttura del Progetto

```
/Crypto-trasker/
├── index.html           # Pagina principale
├── README.md            # Readme base
├── CLAUDE.md            # Questa documentazione
├── css/
│   └── styles.css       # Stili (dark theme)
└── js/
    ├── config.js        # Configurazione, stato globale, storage
    ├── api.js           # Fetch prezzi e dati da API esterne
    ├── portfolio.js     # Calcoli portafoglio (valore, P&L, allocazione)
    ├── analysis.js      # Analisi tecnica (RSI, Heat, segnali)
    ├── charts.js        # Grafici Chart.js
    ├── calculator.js    # Calcolatore acquisti
    ├── wallet.js        # Sync saldi da blockchain
    └── app.js           # Controller principale e UI
```

---

## Tecnologie

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Grafici:** Chart.js con plugin
- **API Prezzi:** CryptoCompare
- **API Sentiment:** Alternative.me (Fear & Greed Index)
- **Storage:** LocalStorage
- **Deploy:** Netlify

---

## Funzionalità Principali

### 1. Portfolio Tracking
- Prezzi live in USD/EUR
- Calcolo valore totale e P&L
- Allocazione percentuale per asset
- Auto-refresh ogni 10 secondi

### 2. Analisi Tecnica
- RSI (14 periodi)
- Heat Index (indicatore surriscaldamento)
- Fear & Greed Index
- Trend BTC vs 200 MA
- Condizioni di accumulo/prudenza

### 3. Raccomandazioni AI
- Segnali per asset: ACCUMULA, PRENDI PROFITTO, HOLD, MONITORA
- Azioni prioritizzate a livello portafoglio

### 4. Sync Wallet da Blockchain
- **XRP:** XRPL API
- **QNT:** Etherscan API (ERC-20)
- **HBAR:** Hedera Mirror Node
- **XDC:** BlocksScan API + psXDC (liquid staking)

### 5. Gestione Transazioni
- Registrazione BUY/SELL
- Calcolo prezzo medio ponderato
- Storico transazioni

---

## Wallet Configurati

| Asset | Indirizzo | Note |
|-------|-----------|------|
| XRP | `rLRR1mFDEdYCH5fUgxR6FD3UE9DLsWV7CH` | XRP Ledger |
| QNT | `0xA64D794A712279DA9f6CC4eafE1C774D7a353eF9` | Ethereum ERC-20 |
| HBAR | `0.0.10081465` | Hedera Account |
| XDC | `0x5dba231a4dbf07713fe94c6d555c8ebe78a11c8c` | Include psXDC staking |

---

## API Endpoints

```javascript
// Prezzi crypto
CryptoCompare: 'https://min-api.cryptocompare.com/data'

// Fear & Greed Index
Alternative.me: 'https://api.alternative.me/fng/'

// Blockchain APIs
XRP:  'https://xrplcluster.com'
ETH:  'https://api.etherscan.io/api'
HBAR: 'https://mainnet-public.mirrornode.hedera.com'
XDC:  'https://xdc.blocksscan.io/api'
```

---

## LocalStorage Keys

```javascript
cpt_portfolio_v1     // Portafoglio (symbol, qty, avgPrice)
cpt_transactions_v1  // Storico transazioni
cpt_settings_v1      // Impostazioni (currency)
cpt_targets_v1       // Price targets
cpt_wallets_v1       // Indirizzi wallet
```

---

## Comandi Utili (Console Browser)

```javascript
// Pulire tutti i dati
localStorage.clear(); location.reload();

// Vedere stato portafoglio
console.log(state.portfolio);

// Vedere indirizzi wallet
console.log(Wallet.addresses);

// Sync manuale tutti i wallet
Wallet.syncAll();

// Sync singolo asset
Wallet.syncAsset('XRP');
```

---

## Note Tecniche

### Protezione NaN
Tutte le funzioni di calcolo usano `parseFloat(value) || 0` per evitare NaN da dati corrotti.

### Auto-sanitizzazione
Al caricamento, `sanitizePortfolio()` corregge automaticamente dati corrotti nel LocalStorage.

### Edit Mode
Durante la modifica manuale delle quantità, l'auto-refresh della tabella viene disabilitato per preservare i valori negli input.

### XDC + Staking
Per XDC, il sistema legge sia il saldo nativo che i token psXDC (Prime Staked XDC) e li somma automaticamente.

---

## Sviluppo

### Branch
- `main` - Produzione (Netlify)
- `claude/*` - Feature branches

### Deploy
Netlify fa deploy automatico da `main`. Per applicare modifiche:
1. Creare PR dal branch feature
2. Merge in main
3. Deploy automatico

---

## Changelog Recente

### v1.1.0 (Dicembre 2024)
- Aggiunta sincronizzazione wallet da blockchain
- Supporto XRP, QNT (ERC-20), HBAR, XDC
- Supporto psXDC (liquid staking su Prime Numbers)
- Fix bug calcolo transazioni BUY
- Fix NaN su dati corrotti
- Fix edit mode durante auto-refresh
- Auto-sanitizzazione dati al caricamento

### v1.0.0
- Release iniziale
- Portfolio tracking
- Analisi tecnica
- Grafici e KPI
