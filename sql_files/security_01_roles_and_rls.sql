-- =====================================================================
-- Jet Barkod — Güvenlik sertleştirme, Aşama 1: Roller + RLS
-- =====================================================================
-- Bu dosya IDEMPOTENT'tir: birden fazla kez çalıştırılabilir.
-- HİÇBİR VERİYİ SİLMEZ, hiçbir kolonu düşürmez.
--
-- Çalıştırma:  sudo -u postgres psql -d jetbarkod -f security_01_roles_and_rls.sql
--
-- Bu dosya TEK BAŞINA hiçbir şeyi bozmaz: yeni roller ve politikalar
-- oluşturur ama PostgREST hâlâ eski 'jetbarkod' anon rolüyle çalıştığı
-- sürece davranış değişmez. Geçiş, Aşama 3'te postgrest.env değişince olur.
--
-- ÖNEMLİ: Node API'nin bağlandığı rol (jetbarkod) bu script tarafından
-- BYPASSRLS alır — bkz. bölüm 1b. Tablolar `postgres`'e ait olduğu için
-- jetbarkod sahip DEĞİLDİR ve bu olmadan RLS ona da uygulanır.
-- RLS asıl olarak PostgREST'in geçtiği web_anon / web_user / web_admin
-- rolleri için geçerlidir.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Roller
-- ---------------------------------------------------------------------
-- authenticator: PostgREST bu rolle bağlanır. Kendi başına HİÇBİR yetkisi
-- yoktur; sadece JWT'deki 'role' claim'ine göre diğer rollere geçebilir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        -- NOLOGIN olarak oluşturulur: parolası set edilene kadar (Aşama 3)
        -- bu rolle bağlanmak mümkün olmasın.
        CREATE ROLE authenticator NOINHERIT NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_user') THEN
        CREATE ROLE web_user NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_admin') THEN
        CREATE ROLE web_admin NOLOGIN;
    END IF;
END
$$;

GRANT web_anon  TO authenticator;
GRANT web_user  TO authenticator;
GRANT web_admin TO authenticator;

-- Şemayı görebilsinler (tablo yetkisi ayrıca veriliyor)
GRANT USAGE ON SCHEMA public TO web_anon, web_user, web_admin;

-- Varsayılan olarak HİÇBİR ŞEY yok. Aşağıda tek tek, açıkça veriyoruz.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM web_anon, web_user, web_admin;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM web_anon, web_user, web_admin;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM web_anon, web_user, web_admin;

-- Gelecekte eklenecek tablolar da otomatik açılmasın
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM web_anon, web_user, web_admin;

-- ---------------------------------------------------------------------
-- 1b) API rolü RLS'i baypas etmeli
-- ---------------------------------------------------------------------
-- ÖNEMLİ DERS: "tablo sahibi RLS'i baypas eder" doğrudur AMA bu kurulumda
-- tablolar `postgres` kullanıcısına ait, API ise `jetbarkod` rolüyle
-- bağlanıyor. Yani jetbarkod SAHİP DEĞİL ve RLS ona da uygulanıyor.
-- Bu fark edilmezse API hiçbir satırı göremez ve yazma işlemleri
-- "new row violates row-level security policy" ile patlar.
--
-- Çözüm: API rolüne açıkça BYPASSRLS ver. Bu güvenliği zayıflatmaz —
-- tarayıcının kullandığı web_anon/web_user/web_admin rolleri BYPASSRLS
-- ALMAZ, RLS onlara aynen uygulanır. jetbarkod yalnızca sunucu tarafı
-- bağlantısıdır ve her endpoint kendi yetki kontrolünü yapar.
DO $$
DECLARE
    api_role text := 'jetbarkod';
    owner_name text;
BEGIN
    SELECT tableowner INTO owner_name FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'users';

    RAISE NOTICE 'users tablosunun sahibi: %, API rolu: %', owner_name, api_role;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('ALTER ROLE %I BYPASSRLS', api_role);
        RAISE NOTICE 'API rolune BYPASSRLS verildi: %', api_role;
    ELSE
        RAISE WARNING 'API rolu bulunamadi: % — API RLS''e takilabilir!', api_role;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1c) Parola kolonları
-- ---------------------------------------------------------------------
-- password_hash: API ilk girişte düz metin parolayı bcrypt'e taşıyıp
-- buraya yazar ve password kolonunu NULL'lar. Bu yüzden password'ün
-- NOT NULL kısıtı kaldırılmalı.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;

-- ---------------------------------------------------------------------
-- 2) JWT claim yardımcıları
-- ---------------------------------------------------------------------
-- PostgREST, JWT claim'lerini request.jwt.claims ayarına koyar.
CREATE OR REPLACE FUNCTION public.auth_username()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT nullif(
        current_setting('request.jwt.claims', true)::json ->> 'username',
        ''
    );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(
        (current_setting('request.jwt.claims', true)::json ->> 'is_admin')::boolean,
        false
    );
$$;

GRANT EXECUTE ON FUNCTION public.auth_username()  TO web_anon, web_user, web_admin;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()  TO web_anon, web_user, web_admin;

-- ---------------------------------------------------------------------
-- 3) Tüm tablolarda RLS'i aç
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users','user_data','counting_items','shelf_missing_shelves','shelf_missing_items',
        'dispatch_agenda_items','stock_requests','guest_chats','messages','ip_logs',
        'blocked_ips','rate_limits','admin_settings','system_features','feature_history',
        'updates','user_update_status'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 4) users — kendi satırı, parola kolonları ASLA okunamaz
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
    FOR SELECT TO web_user
    USING (username = public.auth_username());

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE TO web_user
    USING (username = public.auth_username())
    WITH CHECK (username = public.auth_username());

DROP POLICY IF EXISTS users_admin_all ON public.users;
CREATE POLICY users_admin_all ON public.users
    FOR ALL TO web_admin
    USING (public.auth_is_admin())
    WITH CHECK (public.auth_is_admin());

-- Kolon bazlı yetki: password / password_hash listede YOK -> hiç okunamaz.
GRANT SELECT (
    id, username, company, contact_email, trial_end, allowed_ips, tracked_ips,
    max_ip_count, ip_tracking_enabled, is_active, is_admin, premium_features,
    counting_data, chat_messages, last_chat_update, created_at, updated_at
) ON public.users TO web_user;

-- Kullanıcı yalnızca kendi içeriğini yazabilir.
-- premium_features / trial_end / is_admin BİLEREK yok: kullanıcı kendine
-- premium veya admin veremesin.
GRANT UPDATE (counting_data, chat_messages, last_chat_update) ON public.users TO web_user;

-- keyboard_shortcuts kolonu varsa ona da izin ver (vps_schema_patch.sql ile geliyor)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='keyboard_shortcuts'
    ) THEN
        EXECUTE 'GRANT SELECT (keyboard_shortcuts), UPDATE (keyboard_shortcuts) ON public.users TO web_user';
    END IF;
END
$$;

-- Admin paneli: parola kolonları hariç tam yetki
GRANT SELECT (
    id, username, company, contact_email, trial_end, allowed_ips, tracked_ips,
    max_ip_count, ip_tracking_enabled, is_active, is_admin, premium_features,
    counting_data, chat_messages, last_chat_update, created_at, updated_at
) ON public.users TO web_admin;
GRANT INSERT, DELETE ON public.users TO web_admin;
GRANT UPDATE (
    company, contact_email, trial_end, allowed_ips, tracked_ips, max_ip_count,
    ip_tracking_enabled, is_active, is_admin, premium_features, counting_data,
    chat_messages, last_chat_update, updated_at
) ON public.users TO web_admin;

-- ---------------------------------------------------------------------
-- 5) Kullanıcıya ait tablolar — hepsi username ile kendi satırı
--    (istemci kodu zaten .eq('username', ...) ile filtreliyordu;
--     artık veritabanı bunu ZORUNLU kılıyor)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'user_data','counting_items','shelf_missing_shelves','shelf_missing_items',
        'dispatch_agenda_items','stock_requests','user_update_status'
    ]
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_self', t);
        EXECUTE format($f$
            CREATE POLICY %I ON public.%I
                FOR ALL TO web_user
                USING (username = public.auth_username())
                WITH CHECK (username = public.auth_username())
        $f$, t || '_self', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
        EXECUTE format($f$
            CREATE POLICY %I ON public.%I
                FOR ALL TO web_admin
                USING (public.auth_is_admin())
                WITH CHECK (public.auth_is_admin())
        $f$, t || '_admin', t);

        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO web_user, web_admin', t);
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 6) Herkese açık okunur referans tabloları (yazma yalnız admin)
-- ---------------------------------------------------------------------
-- system_features: özellik bayrakları — giriş yapmamış sayfa da okuyor
DROP POLICY IF EXISTS system_features_read ON public.system_features;
CREATE POLICY system_features_read ON public.system_features
    FOR SELECT TO web_anon, web_user, web_admin USING (true);

DROP POLICY IF EXISTS system_features_admin ON public.system_features;
CREATE POLICY system_features_admin ON public.system_features
    FOR ALL TO web_admin USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());

GRANT SELECT ON public.system_features TO web_anon, web_user, web_admin;
GRANT INSERT, UPDATE, DELETE ON public.system_features TO web_admin;

-- updates: sürüm notları — giriş yapmış kullanıcı okur
DROP POLICY IF EXISTS updates_read ON public.updates;
CREATE POLICY updates_read ON public.updates
    FOR SELECT TO web_user, web_admin USING (true);

DROP POLICY IF EXISTS updates_admin ON public.updates;
CREATE POLICY updates_admin ON public.updates
    FOR ALL TO web_admin USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());

GRANT SELECT ON public.updates TO web_user, web_admin;
GRANT INSERT, UPDATE, DELETE ON public.updates TO web_admin;

-- feature_history: yalnız admin
DROP POLICY IF EXISTS feature_history_admin ON public.feature_history;
CREATE POLICY feature_history_admin ON public.feature_history
    FOR ALL TO web_admin USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_history TO web_admin;

-- ---------------------------------------------------------------------
-- 7) Yalnız admin — hassas tablolar (web_user/web_anon HİÇBİR yetki almaz)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['messages','ip_logs','blocked_ips','guest_chats']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
            CONTINUE;
        END IF;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
        EXECUTE format($f$
            CREATE POLICY %I ON public.%I
                FOR ALL TO web_admin
                USING (public.auth_is_admin())
                WITH CHECK (public.auth_is_admin())
        $f$, t || '_admin', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO web_admin', t);
    END LOOP;
END
$$;

-- admin_settings: Telegram bot token'ı burada. PostgREST üzerinden
-- HİÇBİR role okuma yetkisi verilmiyor — yalnızca Node API (owner rolü) okur.
-- Admin panelinin token yazması da API üzerinden yapılacak.
-- (Politika yok = RLS açık + grant yok = tamamen erişilemez.)

-- rate_limits: yalnızca API (owner) kullanır, hiçbir web rolüne açılmaz.

COMMIT;

-- ---------------------------------------------------------------------
-- Doğrulama
-- ---------------------------------------------------------------------
\echo ''
\echo '=== RLS durumu (hepsi t olmalı) ==='
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo '=== web_anon yetkileri (yalnızca system_features SELECT olmalı) ==='
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'web_anon'
ORDER BY table_name, privilege_type;

\echo ''
\echo '=== API rolu (jetbarkod) BYPASSRLS almis mi? (t olmali) ==='
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'jetbarkod';

\echo ''
\echo '=== API rolu verileri gorebiliyor mu? (0 OLMAMALI) ==='
SET ROLE jetbarkod;
SELECT count(*) AS api_rolunun_gordugu_kullanici FROM users;
RESET ROLE;

\echo ''
\echo '=== web_user users kolonlarinda password gorunuyor mu? (BOŞ olmalı) ==='
SELECT table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE grantee = 'web_user'
  AND table_name = 'users'
  AND column_name IN ('password', 'password_hash');
