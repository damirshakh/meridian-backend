-- Promokod/chegirma kuponlari
CREATE TABLE promo_codes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(50) UNIQUE NOT NULL,
    discount_type     VARCHAR(10) NOT NULL, -- percent | fixed
    discount_value    NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_uses          INT, -- NULL bo'lsa cheksiz
    used_count        INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at        TIMESTAMPTZ, -- NULL bo'lsa muddatsiz
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buyurtmaga qo'llangan promokodni va chegirma summasini saqlash uchun
ALTER TABLE orders ADD COLUMN promo_code_id UUID REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
