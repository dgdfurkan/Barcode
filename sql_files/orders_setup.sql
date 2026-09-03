-- =============================================================
-- Siparişler — depo panelinden düşen siparişler ve içindeki ürünler
-- Hesap bazlı (username). Kalıp dispatch_agenda_setup.sql ile aynı.
--
-- Amaç: depocu barkodları okuturken sipariş anında telefona düşsün,
-- toplama işlemi orada tek tek işaretlenerek yürütülsün.
--
-- Kaynak alanların panelde nereden geldiği:
--   banko        productLocations[0].locationBarcode
--   toplam_adet  basketProductCount
--   poset_sayisi totalBagUsageCount
--   durum        status (500/600/800 gibi panel durum kodu)
--   toplayici    picker.name
--   kurye        courier.name
-- =============================================================

CREATE TABLE IF NOT EXISTS orders (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    username        TEXT        NOT NULL,
    -- Getir sipariş kimliği. Aynı sipariş iki kez yazılmasın diye tekil.
    order_id        TEXT        NOT NULL,
    banko           TEXT,
    kolon           TEXT,
    durum           INTEGER,
    -- Toplama durumumuz. Panelin durumundan ayrı tutuluyor; depocu
    -- kendi akışında ilerliyor.
    toplama_durumu  TEXT        NOT NULL DEFAULT 'bekliyor'
                                CHECK (toplama_durumu IN ('bekliyor', 'toplaniyor', 'toplandi')),
    toplam_adet     INTEGER,
    poset_sayisi    INTEGER,
    eksik_urun_var  BOOLEAN     NOT NULL DEFAULT false,
    toplayici       TEXT,
    kurye           TEXT,
    sepet_zamani    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT orders_username_order_id_key UNIQUE (username, order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    order_uuid      UUID        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    -- Panelin satır sırası. Detay yanıtıyla eşleştirme bunun üzerinden.
    sira            INTEGER     NOT NULL,
    urun_id         TEXT,
    urun_adi        TEXT,
    gorsel_id       TEXT,
    -- Getir kilogramla satılan üründe de adet alanını kullanıyor; birim
    -- neyse o yazılıyor, adede çevrilmiyor.
    adet            NUMERIC(10, 3) NOT NULL DEFAULT 1,
    birim           TEXT,
    ana_kategori    TEXT,
    sinif           TEXT,
    alt_sinif       TEXT,
    -- Toplama sırası: fırın ve dondurma başa, su sona, benzer kategoriler
    -- yan yana. Site tarafında hesaplanıp buraya yazılıyor.
    toplama_sirasi  INTEGER,
    alindi          BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    -- Aynı satır iki kez yazılmasın. Eklenti aynı siparişi her tazelemede
    -- gönderiyor; upsert bu kısıtla çalışıyor, silme gerekmiyor.
    CONSTRAINT order_items_order_sira_key UNIQUE (order_uuid, sira)
);

CREATE INDEX IF NOT EXISTS idx_orders_username        ON orders (username);
CREATE INDEX IF NOT EXISTS idx_orders_user_created    ON orders (username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_toplama    ON orders (username, toplama_durumu);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items (order_uuid, sira);

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Yetki
--
-- Roller bu sunucuda web_anon / web_user / web_admin. Supabase'in
-- anon/authenticated rolleri YOK; ilk yazımda onlar kullanılmıştı ve
-- GRANT'lar "role does not exist" ile düştü.
--
-- Politika da "herkese açık" değil. Her kullanıcı yalnız kendi siparişini
-- görüyor; kalıp security_01_roles_and_rls.sql içindeki kullanıcı bazlı
-- tablolarla aynı. Sipariş satırlarının kendi username'i yok, bağlı olduğu
-- siparişin sahibi üzerinden süzülüyor.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS orders_open_access      ON public.orders;
DROP POLICY IF EXISTS order_items_open_access ON public.order_items;

DROP POLICY IF EXISTS orders_self ON public.orders;
CREATE POLICY orders_self ON public.orders
    FOR ALL TO web_user
    USING (username = public.auth_username())
    WITH CHECK (username = public.auth_username());

DROP POLICY IF EXISTS orders_admin ON public.orders;
CREATE POLICY orders_admin ON public.orders
    FOR ALL TO web_admin
    USING (public.auth_is_admin())
    WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS order_items_self ON public.order_items;
CREATE POLICY order_items_self ON public.order_items
    FOR ALL TO web_user
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_uuid
          AND o.username = public.auth_username()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_uuid
          AND o.username = public.auth_username()
    ));

DROP POLICY IF EXISTS order_items_admin ON public.order_items;
CREATE POLICY order_items_admin ON public.order_items
    FOR ALL TO web_admin
    USING (public.auth_is_admin())
    WITH CHECK (public.auth_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders      TO web_user, web_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO web_user, web_admin;
