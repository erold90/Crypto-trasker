// Vercel Serverless Function - Fear & Greed Index Proxy
// This API doesn't require a key, but we proxy it anyway for consistency

const FNG_URL = 'https://api.alternative.me/fng/';

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
        const { limit } = req.query;
        const url = limit ? `${FNG_URL}?limit=${limit}` : FNG_URL;

        console.log('[FNG Proxy] Fetching Fear & Greed Index');

        const response = await fetch(url);
        const data = await response.json();

        // Cache for 5 minutes (FNG updates once per day)
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        res.status(response.status).json(data);

    } catch (error) {
        console.error('[FNG Proxy Error]', error.message);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
};
