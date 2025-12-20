// Vercel Serverless Function - Etherscan API Proxy
// Protects API key from being exposed in frontend code

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

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
        const { module, action, ...params } = req.query;

        if (!module || !action) {
            res.status(400).json({ error: 'Missing module or action parameter' });
            return;
        }

        // Validate module/action (whitelist allowed operations)
        const allowedOperations = [
            'account:tokenbalance',
            'account:tokentx',
            'account:balance',
            'account:txlist'
        ];

        const operation = `${module}:${action}`;
        if (!allowedOperations.includes(operation)) {
            res.status(400).json({ error: 'Invalid operation' });
            return;
        }

        // Build query string
        const queryParams = new URLSearchParams({
            chainid: params.chainid || '1',  // Default to Ethereum mainnet
            module,
            action,
            ...params,
            apikey: ETHERSCAN_API_KEY
        });

        const url = `${ETHERSCAN_BASE}?${queryParams.toString()}`;

        console.log(`[Etherscan Proxy] ${module}:${action}`);

        const response = await fetch(url);
        const data = await response.json();

        // Cache successful responses for 30 seconds
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
        res.status(response.status).json(data);

    } catch (error) {
        console.error('[Etherscan Proxy Error]', error.message);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
};
