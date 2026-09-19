-- Manzilga xarita orqali aniq joylashuvni saqlash imkoniyati
ALTER TABLE addresses ADD COLUMN latitude NUMERIC(10,7);
ALTER TABLE addresses ADD COLUMN longitude NUMERIC(10,7);

-- Foydalanuvchi profilini kengaytirish: sozlamalar (til, bildirishnoma)
ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'uz';
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
