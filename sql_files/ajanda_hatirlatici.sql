-- =============================================================
-- Ürün Ajandası: hatırlatıcı sütunu
-- =============================================================
-- Ajandaya eklenen kayıtta "Hatırlatıcı kur" açıksa reminder = true olur.
-- Arama sayfasındaki zil ve Ajanda düğmesindeki ünlem bu sütunu okur.
--
-- Güvenli: yalnız sütun ekler, hiçbir satırı silmez ya da değiştirmez.
-- Sabit varsayılanlı sütun eklemek PostgreSQL 11+ için anlıktır, tabloyu
-- yeniden yazmaz. Birden çok kez çalıştırılabilir (IF NOT EXISTS).
--
-- Yetki: tabloya zaten web_user / web_admin için satır bazlı (username)
-- RLS ve tablo düzeyinde GRANT var (security_01_roles_and_rls.sql).
-- Yeni sütun bu kurallara kendiliğinden girer, ek GRANT gerekmez.
--
-- Bu dosya çalışmadan önce site bozulmaz: hatırlatıcılar geçici olarak
-- tarayıcıda tutulur, sütun gelince ilk açılışta buraya taşınır.
-- =============================================================

BEGIN;

ALTER TABLE public.dispatch_agenda_items
    ADD COLUMN IF NOT EXISTS reminder BOOLEAN NOT NULL DEFAULT false;

-- Zil yalnız açık hatırlatıcıları soruyor; küçük kısmi indeks yeter
CREATE INDEX IF NOT EXISTS idx_dai_user_reminder
    ON public.dispatch_agenda_items (username)
    WHERE reminder;

COMMIT;

-- PostgREST yeni sütunu hemen görsün (şema önbelleğini tazele)
NOTIFY pgrst, 'reload schema';

-- Doğrulama: tek satır, "reminder | boolean | NO | false" görünmeli
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dispatch_agenda_items'
  AND column_name = 'reminder';
