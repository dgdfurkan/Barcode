// Google Drive File Type Detection Endpoint
// Detects if a Google Drive file is a video or image by checking Content-Type

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { fileId } = req.query;

    if (!fileId) {
        return res.status(400).json({ ok: false, error: 'fileId parameter is required' });
    }

    try {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        // Try HEAD request first
        let response;
        try {
            response = await fetch(downloadUrl, {
                method: 'HEAD',
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        } catch (headError) {
            // If HEAD fails, try GET but only read headers
            try {
                response = await fetch(downloadUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Range': 'bytes=0-0' // Request only first byte
                    }
                });
            } catch (getError) {
                return res.status(500).json({
                    ok: false,
                    error: 'Failed to fetch file metadata',
                    details: getError.message
                });
            }
        }

        const contentType = response.headers.get('content-type') || '';
        
        let kind = 'unknown';
        if (contentType.startsWith('video/')) {
            kind = 'video';
        } else if (contentType.startsWith('image/')) {
            kind = 'image';
        }

        return res.status(200).json({
            ok: true,
            kind: kind,
            contentType: contentType
        });

    } catch (error) {
        console.error('Error detecting file type:', error);
        return res.status(500).json({
            ok: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}

