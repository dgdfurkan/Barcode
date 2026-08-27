/**
 * Merkezi API yapılandırması.
 * Tüm sayfalar bu dosyayı yükler.
 *
 * NOT: Eski Supabase projesi (ytekbbxvfdheiexsojpx) tamamen terk edildi.
 * URL ve anon key repodan kaldırıldı. Veriler kendi VPS'imizde,
 * PostgREST + JWT + RLS ile korunuyor.
 *
 * @supabase/supabase-js kütüphanesi hâlâ yükleniyor ama yalnızca PostgREST
 * sorgu kurucusu olarak kullanılıyor — Supabase servisiyle ilgisi yok.
 */
if (!window.JETBARKOD_VPS_API) {
    window.JETBARKOD_VPS_API = {
        enabled: true,
        baseUrl: 'https://api.flowcobalt.com',
    };
}
