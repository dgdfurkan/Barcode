/**
 * Merkezi API yapılandırması.
 * Tüm sayfalar bu dosyayı yükler.
 *
 * Veriler kendi VPS'imizde: PostgREST + JWT + RLS.
 * Supabase'le (servis ya da kütüphane) hiçbir bağ kalmadı; sorguları
 * `js/jb-db.js` içindeki yerel istemci kuruyor.
 */
if (!window.JETBARKOD_VPS_API) {
    window.JETBARKOD_VPS_API = {
        enabled: true,
        baseUrl: 'https://api.flowcobalt.com',
    };
}
