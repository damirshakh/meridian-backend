-- Sharh, baholash va savol-javob funksiyalari uchun jadvallar

CREATE TABLE product_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id), -- haqiqatan sotib olganini bildirish uchun (ixtiyoriy)
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE, -- admin moderatsiyasi uchun
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, user_id) -- bir mahsulotga bir marta sharh
);
CREATE INDEX idx_reviews_product ON product_reviews(product_id);

CREATE TABLE review_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    url             TEXT NOT NULL
);

CREATE TABLE product_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    answer          TEXT,
    answered_by     UUID REFERENCES users(id), -- admin javob bergan bo'lsa
    answered_at     TIMESTAMPTZ,
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_product ON product_questions(product_id);
