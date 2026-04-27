-- Sprint 6 — Telegram para notificaciones a agentes.

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('LEAD_NEW', 'VISIT_REQUESTED', 'VISIT_CONFIRMED');

-- AlterTable: User gana telegram_chat_id (asociado por bot al recibir /start).
ALTER TABLE "users"
    ADD COLUMN "telegram_chat_id" TEXT;

-- CreateTable
CREATE TABLE "telegram_integrations" (
    "tenant_id" TEXT NOT NULL,
    "bot_token_enc" TEXT,
    "bot_username" TEXT,
    "test_mode" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_integrations_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "telegram_integrations" ADD CONSTRAINT "telegram_integrations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
