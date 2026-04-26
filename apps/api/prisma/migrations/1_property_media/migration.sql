-- Property: agrega URLs de video y tour 360 (links externos: YouTube, Vimeo,
-- Matterport, Kuula, etc.). Ambos opcionales, sin validación a nivel DB
-- (la validación se hace en el DTO).

ALTER TABLE "properties"
    ADD COLUMN "video_url"    TEXT,
    ADD COLUMN "tour_360_url" TEXT;
