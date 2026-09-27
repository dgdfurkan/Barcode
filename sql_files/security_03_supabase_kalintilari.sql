-- ============================================================================
-- Güvenlik Aşama 3: Supabase döneminden kalan roller ve yetkiler
--
-- NEDEN
-- Proje Supabase'den kendi PostgREST kurulumumuza taşındı. Eski kurulum
-- betikleri `anon` ve `authenticated` rollerine geniş yetkiler veriyordu:
--     GRANT ALL ON counting_items TO anon;
--     GRANT ALL ON dispatch_agenda_items TO anon;
--     GRANT ALL ON counting_items TO authenticated;   (ve benzerleri)
-- Bugün tarayıcı isteği `web_anon` olarak geliyor, yani bu yetkilere
-- ulaşılamıyor. Ama roller ve yetkiler duruyor: jeton imzalayan sır bir gün
-- sızarsa ya da ileride yanlış bir `role` claim'i üretilirse doğrudan tam
-- erişim demek. Kullanılmayan yetki, kapalı sanılan açık kapıdır.
--
-- NE YAPIYOR
-- Eski rollerin bütün yetkilerini geri alıyor, varsayılan yetkilerini
-- temizliyor, PostgREST'in authenticator rolüne verilmiş üyelikleri
-- kaldırıyor ve mümkünse rolleri düşürüyor. Rol bir nesnenin sahibiyse
-- düşürme başarısız olur; o durumda sebebini yazıp devam ediyor, çünkü
-- yetkiler yine de alınmış oluyor.
--
-- GÜVENLİ
-- Yalnız eski rollere dokunuyor. web_anon / web_user / web_admin / jetbarkod
-- ve authenticator'a ait hiçbir şey değişmiyor. Birden çok kez çalıştırılabilir.
--
-- ÇALIŞTIRMA
--   sudo -u postgres psql -d jetbarkod -f security_03_supabase_kalintilari.sql
-- ============================================================================

\set ON_ERROR_STOP on

DO $$
DECLARE
    eski_rol  text;
    eskiler   text[] := ARRAY['anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin'];
    sema      text;
BEGIN
    FOREACH eski_rol IN ARRAY eskiler LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = eski_rol) THEN
            RAISE NOTICE 'yok, atlandi: %', eski_rol;
            CONTINUE;
        END IF;

        -- 1) Tablo, dizi ve fonksiyon yetkilerini geri al
        FOREACH sema IN ARRAY ARRAY['public'] LOOP
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', sema, eski_rol);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', sema, eski_rol);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', sema, eski_rol);
            EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', sema, eski_rol);

            -- 2) Bundan sonra oluşacak nesneler için verilmiş varsayılan yetkiler
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I', sema, eski_rol);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I', sema, eski_rol);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %I', sema, eski_rol);
        END LOOP;

        -- 3) Veritabanı düzeyi
        EXECUTE format('REVOKE ALL ON DATABASE %I FROM %I', current_database(), eski_rol);

        -- 4) PostgREST'in authenticator rolü bu rolü üstlenemesin
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
            EXECUTE format('REVOKE %I FROM authenticator', eski_rol);
        END IF;

        RAISE NOTICE 'yetkileri geri alindi: %', eski_rol;

        -- 5) Rolü düşür. Bir nesnenin sahibiyse düşmez; sebebini yaz, devam et.
        BEGIN
            EXECUTE format('DROP ROLE %I', eski_rol);
            RAISE NOTICE 'rol dusuruldu: %', eski_rol;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'rol dusurulemedi (%): % — yetkileri yine de alindi', eski_rol, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- DOĞRULAMA: aşağıdaki sorgu HİÇBİR satır döndürmemeli
-- ============================================================================
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, table_name, privilege_type;

-- Kalan roller (anon / authenticated / service_role görünmemeli)
SELECT rolname FROM pg_roles
WHERE rolname NOT LIKE 'pg\_%'
ORDER BY rolname;
