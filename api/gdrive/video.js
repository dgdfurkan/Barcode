// Google Drive Video Streaming Proxy Endpoint
// Proxies Google Drive video streams to bypass CORS restrictions
// Compatible with Vercel/Next.js serverless functions

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { fileId } = req.query;

    if (!fileId) {
        return res.status(400).json({ ok: false, error: 'fileId parameter is required' });
    }

    try {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        // Get Range header from request for video streaming
        const rangeHeader = req.headers.range || '';
        
        const fetchOptions = {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        // Add Range header if present
        if (rangeHeader) {
            fetchOptions.headers['Range'] = rangeHeader;
        }

        const response = await fetch(downloadUrl, fetchOptions);

        if (!response.ok) {
            return res.status(response.status).json({
                ok: false,
                error: 'Failed to fetch video from Google Drive',
                status: response.status
            });
        }

        // Forward important headers for video streaming
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        const acceptRanges = response.headers.get('accept-ranges');

        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        if (contentRange) {
            res.setHeader('Content-Range', contentRange);
        }
        if (acceptRanges) {
            res.setHeader('Accept-Ranges', acceptRanges);
        }

        // Set status code for partial content (206) if Range header was present
        if (rangeHeader && response.status === 206) {
            res.status(206);
        } else {
            res.status(200);
        }

        // For HEAD requests, don't send body
        if (req.method === 'HEAD') {
            return res.end();
        }

        // Stream the response body
        // Convert ReadableStream to buffer and send
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        
        // Concatenate chunks into a single buffer
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const buffer = Buffer.concat(chunks, totalLength);
        
        // Send the buffer
        res.send(buffer);

    } catch (error) {
        console.error('Error proxying video:', error);
        return res.status(500).json({
            ok: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}
