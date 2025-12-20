// Vercel Serverless Function - CryptoCompare API Proxy
// Protects API key from being exposed in frontend code

const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY;
const CRYPTOCOMPARE_BASE = 'https://min-api.cryptocompare.com/data';

module.exports = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Get the endpoint from query parameter
        const { endpoint, ...params } = req.query;

        if (!endpoint) {
            res.status(400).json({ error: 'Missing endpoint parameter' });
            return;
        }

        // Validate endpoint (whitelist allowed endpoints)
        const allowedEndpoints = [
            'pricemultifull',
            'v2/histoday',
            'v2/histohour',
            'price',
            'pricehistorical',
            'all/coinlist'
        ];

        if (!allowedEndpoints.some(e => endpoint.startsWith(e))) {
            res.status(400).json({ error: 'Invalid endpoint' });
            return;
        }

        // Build query string from remaining params
        const queryParams = new URLSearchParams(params);
        queryParams.append('api_key', CRYPTOCOMPARE_API_KEY);

        const url = `${CRYPTOCOMPARE_BASE}/${endpoint}?${queryParams.toString()}`;

        console.log(`[CryptoCompare Proxy] ${endpoint}`);

        const response = await fetch(url);
        const data = await response.json();

        // Cache successful responses for 10 seconds
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
        res.status(response.status).json(data);

    } catch (error) {
        console.error('[CryptoCompare Proxy Error]', error.message);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
};
