-- Bosh sahifadagi banner-slayder uchun jadval
CREATE TABLE banners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(150),
    subtitle        VARCHAR(255),
    image_url       TEXT NOT NULL,
    link_type       VARCHAR(20) NOT NULL DEFAULT 'none', -- none | product | category | url
    link_value      VARCHAR(255), -- mos ravishda: slug yoki to'liq URL
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Trenddagi mahsulot" deb admin qo'lda belgilashi uchun
ALTER TABLE products ADD COLUMN is_trending BOOLEAN NOT NULL DEFAULT FALSE;

-- Chegirmadagi mahsulotlarni tez topish uchun indeks (compare_at_price > price bo'lsa chegirma bor)
CREATE INDEX idx_products_sale ON products (compare_at_price) WHERE compare_at_price IS NOT NULL;
CREATE INDEX idx_products_trending ON products (is_trending) WHERE is_trending = TRUE;
