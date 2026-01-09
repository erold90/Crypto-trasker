# Crypto Portfolio Tracker

Tracker per il tuo portfolio crypto con grafici, analisi e wallet sync.

## Deployment

### Vercel (Consigliato - Sicuro)

1. Fai deploy su Vercel
2. Configura le variabili d'ambiente in Project Settings:
   - `CRYPTOCOMPARE_API_KEY` - da https://www.cryptocompare.com/cryptopian/api-keys
   - `ETHERSCAN_API_KEY` - da https://etherscan.io/myapikey

Le API keys sono sicure sul server e non esposte nel frontend.

### GitHub Pages (Meno sicuro)

Per GitHub Pages, le API keys devono essere configurate nel browser:

1. Apri la console del browser (F12)
2. Esegui: `setupApiKeys()`
3. Inserisci le tue API keys quando richiesto
4. Le chiavi vengono salvate in localStorage

Per rimuovere le chiavi: `clearApiKeys()`

## Sviluppo locale

```bash
# Copia il file di esempio
cp .env.example .env.local

# Modifica .env.local con le tue API keys
# Poi avvia il server di sviluppo
```

## Sicurezza

**IMPORTANTE:** Non committare mai API keys nel codice!
- Usa variabili d'ambiente per Vercel
- Usa localStorage per GitHub Pages
- Il file `.env.local` è già nel `.gitignore`
