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
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_username        ON orders (username);
CREATE INDEX IF NOT EXISTS idx_orders_user_created    ON orders (username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_toplama    ON orders (username, toplama_durumu);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items (order_uuid, sira);

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_open_access'
    ) THEN
        CREATE POLICY orders_open_access ON orders FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_open_access'
    ) THEN
        CREATE POLICY order_items_open_access ON order_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON orders      TO anon;
GRANT ALL ON orders      TO authenticated;
GRANT ALL ON order_items TO anon;
GRANT ALL ON order_items TO authenticated;
