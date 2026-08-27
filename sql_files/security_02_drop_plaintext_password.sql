-- =====================================================================
-- Jet Barkod — Güvenlik Aşama 6: düz metin parola kolonunu düşür
-- =====================================================================
-- ÖN KOŞUL: vps-api/server.js'in düz metin yolu kaldırılmış sürümü
--           deploy edilmiş olmalı (yoksa login kırılır).
--
-- Çalıştırma: sudo -u postgres psql -d jetbarkod -f security_02_drop_plaintext_password.sql
--
-- GÜVENLİK AĞI: hâlâ hash'i olmayan kullanıcı varsa script DURUR ve
-- hiçbir şey silmez.
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    hashsiz int;
    duz_metin int;
BEGIN
    SELECT count(*) INTO hashsiz FROM users WHERE password_hash IS NULL;
    IF hashsiz > 0 THEN
        RAISE EXCEPTION
            'DURDURULDU: % kullanicinin bcrypt hash''i yok. Once admin panelinden parolalarini belirleyin, sonra tekrar calistirin.',
            hashsiz;
    END IF;

    SELECT count(*) INTO duz_metin FROM users WHERE password IS NOT NULL;
    RAISE NOTICE 'Tum kullanicilarin hash''i var. Silinecek duz metin parola sayisi: %', duz_metin;
END
$$;

ALTER TABLE public.users DROP COLUMN IF EXISTS password;

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '======================================';
    RAISE NOTICE 'users.password kolonu DUSURULDU.';
    RAISE NOTICE 'Artik veritabaninda hicbir duz metin parola yok.';
    RAISE NOTICE '======================================';
END $$;

COMMIT;

\echo ''
\echo '=== users tablosunda kalan parola kolonlari (yalniz password_hash olmali) ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='users' AND column_name LIKE '%password%';
