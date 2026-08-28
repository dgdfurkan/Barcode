(function () {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        let requestUrl = '';
        try {
            requestUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        } catch (e) {}

        // Sadece Getir API çağrılarını işle
        const isGetirApi = requestUrl.includes('getirapi.com');

        // Token'ı request headers'ından yakala (sayfa zaten gönderiyor, biz sadece okuyoruz)
        let capturedToken = null;
        if (isGetirApi) {
            try {
                const hdrs = args[1]?.headers;
                if (hdrs) {
                    if (hdrs instanceof Headers) {
                        capturedToken = hdrs.get('Authorization') || hdrs.get('authorization');
                    } else if (typeof hdrs === 'object') {
                        capturedToken = hdrs['Authorization'] || hdrs['authorization'] || null;
                    }
                }
                // Request objesi olabilir
                if (!capturedToken && args[0] instanceof Request) {
                    capturedToken = args[0].headers.get('Authorization');
                }
            } catch (e) {}
        }

        const response = await originalFetch.apply(this, args);

        if (isGetirApi) {
            // Token yakalandıysa content.js'e gönder
            if (capturedToken) {
                window.postMessage({ type: 'GETIR_TOKEN_CAPTURED', token: capturedToken }, '*');
            }
            // Response verisini gönder (ID tespiti için)
            response.clone().json().then(data => {
                window.postMessage({ type: 'GETIR_DATA_RECEIVED', payload: data, url: requestUrl }, '*');
            }).catch(() => {});
        }

        return response;
    };
})();