/**
 * Merkezi Supabase / VPS API yapılandırması.
 * Tüm sayfalar bu dosyayı yükler.
 */
window.JETBARKOD_SUPABASE_LEGACY = {
    url: 'https://ytekbbxvfdheiexsojpx.supabase.co',
    anonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWtiYnh2ZmRoZWlleHNvanB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTgzMDcsImV4cCI6MjA3Mzg5NDMwN30.J4jvfRg2j6UOumDSqOyvYs3Iza8VX0SnNU_7wE41Tdg',
};

if (!window.JETBARKOD_VPS_API) {
    window.JETBARKOD_VPS_API = {
        enabled: true,
        baseUrl: 'https://api.flowcobalt.com',
    };
}
