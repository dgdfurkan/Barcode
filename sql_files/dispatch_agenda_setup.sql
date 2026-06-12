-- =============================================================
-- Ürün Ajandası — müşteri eksik bildirimi / gönderim takibi
-- Hesap bazlı (username), hard delete
-- =============================================================

CREATE TABLE IF NOT EXISTS dispatch_agenda_items (
    id              UUID                     DEFAULT gen_random_uuid() PRIMARY KEY,
    username        TEXT                     NOT NULL,
    product_id      TEXT                     NOT NULL,
    product_name    TEXT                     NOT NULL,
    product_image   TEXT,
    barcodes        JSONB                    DEFAULT '[]'::jsonb,
    quantity        INTEGER                  NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reason_preset   TEXT                     NOT NULL DEFAULT 'Eksik ürün',
    reason_note     TEXT,
    pickup_required BOOLEAN                  NOT NULL DEFAULT false,
    address         TEXT,
    event_date      DATE,
    created_at      TIMESTAMPTZ              DEFAULT NOW(),
    updated_at      TIMESTAMPTZ              DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dai_username ON dispatch_agenda_items (username);
CREATE INDEX IF NOT EXISTS idx_dai_user_created ON dispatch_agenda_items (username, created_at DESC);

ALTER TABLE dispatch_agenda_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dispatch_agenda_items'
          AND policyname = 'dispatch_agenda_open_access'
    ) THEN
        CREATE POLICY dispatch_agenda_open_access ON dispatch_agenda_items
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON dispatch_agenda_items TO anon;
GRANT ALL ON dispatch_agenda_items TO authenticated;
