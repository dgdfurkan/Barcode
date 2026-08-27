-- =====================================================================
-- Jet Barkod — RLS doğrulama testi
-- =====================================================================
-- AMACI: security_01_roles_and_rls.sql uygulandıktan sonra
--        "herkes yalnızca kendi verisini görüyor mu?" sorusunu KANITLAMAK.
--
-- NEREDE ÇALIŞTIRILIR: önce TEST veritabanında (jetbarkod_rlstest),
--        üretimde değil. Kendi test verisini yaratır ve sonunda siler.
--
-- Çalıştırma:
--   sudo -u postgres psql -d jetbarkod_rlstest -f security_verify.sql
--
-- BEKLENEN: en sonda "SONUC: TUM TESTLER GECTI" satırı.
--           Herhangi bir test kalırsa script hata verip durur.
--
-- NOT: Bu script hiçbir parola/token DEĞERİ yazdırmaz. Çıktıyı
--      güvenle paylaşabilirsiniz.
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- Test verisi (sahte, sonunda silinir)
-- ---------------------------------------------------------------------
INSERT INTO users (username, password, company, trial_end, is_active, is_admin, premium_features)
VALUES
    ('__rls_ali',  'sifre_ali',  'Test A', NOW() + INTERVAL '30 days', true, false, '{"stokSayimi":true}'::jsonb),
    ('__rls_veli', 'sifre_veli', 'Test B', NOW() + INTERVAL '30 days', true, false, '{}'::jsonb)
ON CONFLICT (username) DO NOTHING;

INSERT INTO counting_items (username, table_name, product_id, warehouse_stock)
VALUES
    ('__rls_ali',  'Ana Sayım', 'p1', 5),
    ('__rls_veli', 'Ana Sayım', 'p2', 7)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Yardımcı: bir testi çalıştır, beklenen ile karşılaştır
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assert_eq(test_adi text, gercek bigint, beklenen bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF gercek IS DISTINCT FROM beklenen THEN
        RAISE EXCEPTION 'TEST BASARISIZ: % -> beklenen %, gelen %', test_adi, beklenen, gercek;
    END IF;
    RAISE NOTICE '  [GECTI] % (%)', test_adi, gercek;
END $$;

-- =====================================================================
DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 1) web_user: KENDI verisini gorebiliyor mu? ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    SELECT count(*) INTO n FROM users;
    PERFORM pg_temp.assert_eq('ali users tablosunda 1 satir (kendisi) goruyor', n, 1);

    SELECT count(*) INTO n FROM users WHERE username = '__rls_ali';
    PERFORM pg_temp.assert_eq('gordugu satir gercekten kendisi', n, 1);

    SELECT count(*) INTO n FROM counting_items;
    PERFORM pg_temp.assert_eq('ali kendi sayim satirini goruyor', n, 1);

    RESET role;
END $$;

DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 2) web_user: BASKASININ verisini goremiyor mu? ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    -- Acikca veli'yi sorgulasa bile bos donmeli
    SELECT count(*) INTO n FROM users WHERE username = '__rls_veli';
    PERFORM pg_temp.assert_eq('ali, veli''nin users satirini GOREMIYOR', n, 0);

    SELECT count(*) INTO n FROM counting_items WHERE username = '__rls_veli';
    PERFORM pg_temp.assert_eq('ali, veli''nin sayim verisini GOREMIYOR', n, 0);

    RESET role;
END $$;

DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 3) web_anon: giris yapmamis ziyaretci ne goruyor? ===';

    SET LOCAL role = web_anon;
    SET LOCAL request.jwt.claims = '{}';

    BEGIN
        SELECT count(*) INTO n FROM users;
        RAISE EXCEPTION 'TEST BASARISIZ: web_anon users tablosunu OKUYABILDI (% satir)', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] web_anon users tablosuna erisemiyor (yetki reddedildi)';
    END;

    BEGIN
        SELECT count(*) INTO n FROM guest_chats;
        RAISE EXCEPTION 'TEST BASARISIZ: web_anon guest_chats OKUYABILDI (% satir)', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] web_anon guest_chats tablosuna erisemiyor';
    END;

    BEGIN
        SELECT count(*) INTO n FROM admin_settings;
        RAISE EXCEPTION 'TEST BASARISIZ: web_anon admin_settings OKUYABILDI (telegram token!)';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] web_anon admin_settings tablosuna erisemiyor';
    END;

    -- system_features bilerek aciktir (ozellik bayraklari)
    SELECT count(*) INTO n FROM system_features;
    RAISE NOTICE '  [BILGI] web_anon system_features okuyabiliyor (bilerek): % satir', n;

    RESET role;
END $$;

DO $$
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 4) Parola kolonlari erisilebilir mi? ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    BEGIN
        PERFORM password FROM users WHERE username = '__rls_ali';
        RAISE EXCEPTION 'TEST BASARISIZ: web_user KENDI parolasini bile okuyabildi!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] web_user password kolonunu okuyamiyor';
    END;

    BEGIN
        PERFORM password_hash FROM users WHERE username = '__rls_ali';
        RAISE EXCEPTION 'TEST BASARISIZ: web_user password_hash okuyabildi!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE '  [GECTI] web_user password_hash kolonunu okuyamiyor';
        WHEN undefined_column THEN
            RAISE NOTICE '  [ATLANDI] password_hash kolonu henuz yok (security_02 ekleyecek)';
    END;

    RESET role;
END $$;

DO $$
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 5) Kullanici kendine premium/admin verebiliyor mu? ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    BEGIN
        UPDATE users SET premium_features = '{"stokSayimi":true,"lowStockAlert":true}'::jsonb
        WHERE username = '__rls_ali';
        RAISE EXCEPTION 'TEST BASARISIZ: kullanici KENDINE PREMIUM VEREBILDI!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] kullanici premium_features yazamiyor';
    END;

    BEGIN
        UPDATE users SET is_admin = true WHERE username = '__rls_ali';
        RAISE EXCEPTION 'TEST BASARISIZ: kullanici KENDINI ADMIN YAPABILDI!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] kullanici is_admin yazamiyor';
    END;

    BEGIN
        UPDATE users SET trial_end = NOW() + INTERVAL '10 years' WHERE username = '__rls_ali';
        RAISE EXCEPTION 'TEST BASARISIZ: kullanici kendi trial suresini UZATABILDI!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '  [GECTI] kullanici trial_end yazamiyor';
    END;

    RESET role;
END $$;

DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 6) Kullanici KENDI sayim verisini yazabiliyor mu? (bozulmadi mi) ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    UPDATE users SET counting_data = '{"_test":1}'::jsonb WHERE username = '__rls_ali';
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.assert_eq('ali counting_data yazabiliyor', n, 1);

    INSERT INTO counting_items (username, table_name, product_id, warehouse_stock)
    VALUES ('__rls_ali', 'Test Tablo', 'p9', 3);
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.assert_eq('ali kendi adina satir ekleyebiliyor', n, 1);

    RESET role;
END $$;

DO $$
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 7) Kullanici BASKASI ADINA veri yazabiliyor mu? ===';

    SET LOCAL role = web_user;
    SET LOCAL request.jwt.claims = '{"username":"__rls_ali","is_admin":false}';

    BEGIN
        INSERT INTO counting_items (username, table_name, product_id, warehouse_stock)
        VALUES ('__rls_veli', 'Sahte', 'p8', 1);
        RAISE EXCEPTION 'TEST BASARISIZ: ali, VELI ADINA veri yazabildi!';
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        RAISE NOTICE '  [GECTI] ali veli adina veri yazamiyor';
    END;

    RESET role;
END $$;

DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 8) web_admin butun kullanicilari gorebiliyor mu? ===';

    SET LOCAL role = web_admin;
    SET LOCAL request.jwt.claims = '{"username":"admin","is_admin":true}';

    SELECT count(*) INTO n FROM users WHERE username LIKE '__rls_%';
    PERFORM pg_temp.assert_eq('admin her iki test kullanicisini goruyor', n, 2);

    RESET role;
END $$;

DO $$
DECLARE n bigint;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 9) is_admin claim''i FALSE ise web_admin bos donuyor mu? ===';
-- (Token imzali oldugu icin claim taklit edilemez; yine de kemer+askı)

    SET LOCAL role = web_admin;
    SET LOCAL request.jwt.claims = '{"username":"sahte","is_admin":false}';

    SELECT count(*) INTO n FROM users;
    PERFORM pg_temp.assert_eq('is_admin=false iken admin politikasi hicbir satir vermiyor', n, 0);

    RESET role;
END $$;

DO $$
DECLARE n bigint; bypass boolean;
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 10) API rolu (jetbarkod) verisini gorebiliyor mu? ===';
-- Bu test ilk seferde ATLANMISTI ve uretimde login''i 500''e dusurdu:
-- tablolar postgres''e ait oldugu icin jetbarkod sahip degil ve BYPASSRLS
-- olmadan RLS ona da uygulaniyor. Bir daha kacmasin diye buraya sabitlendi.

    SELECT rolbypassrls INTO bypass FROM pg_roles WHERE rolname = 'jetbarkod';
    IF bypass IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST BASARISIZ: jetbarkod rolunde BYPASSRLS YOK — API veriyi goremez!';
    END IF;
    RAISE NOTICE '  [GECTI] jetbarkod rolunde BYPASSRLS var';

    SET LOCAL role = jetbarkod;
    SELECT count(*) INTO n FROM users;
    IF n = 0 THEN
        RAISE EXCEPTION 'TEST BASARISIZ: API rolu HIC kullanici goremiyor — login kirilir!';
    END IF;
    RAISE NOTICE '  [GECTI] API rolu % kullanici goruyor', n;
    RESET role;
END $$;

DO $$
BEGIN
RAISE NOTICE '';
RAISE NOTICE '=== 11) Parola kolonlari API icin hazir mi? ===';

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') THEN
        RAISE EXCEPTION 'TEST BASARISIZ: password_hash kolonu YOK — login sorgusu patlar!';
    END IF;
    RAISE NOTICE '  [GECTI] password_hash kolonu var';

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='users'
                 AND column_name='password' AND is_nullable='NO') THEN
        RAISE EXCEPTION 'TEST BASARISIZ: password kolonu hala NOT NULL — bcrypt gecisi patlar!';
    END IF;
    RAISE NOTICE '  [GECTI] password kolonu NULL kabul ediyor (bcrypt gecisi icin sart)';
END $$;

-- ---------------------------------------------------------------------
-- Temizlik
-- ---------------------------------------------------------------------
DELETE FROM counting_items WHERE username LIKE '__rls_%';
DELETE FROM users WHERE username LIKE '__rls_%';

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '======================================';
    RAISE NOTICE 'SONUC: TUM TESTLER GECTI';
    RAISE NOTICE '======================================';
END $$;

COMMIT;
