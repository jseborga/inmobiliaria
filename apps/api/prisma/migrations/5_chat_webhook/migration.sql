-- Sprint 4 — Chat conversacional (WhatsApp webhook + bot + base para web chat).

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'WEB_CHAT', 'TELEGRAM');

-- AlterTable: WhatsappIntegration gana webhook secret + bot toggle.
ALTER TABLE "whatsapp_integrations"
    ADD COLUMN "webhook_secret" TEXT,
    ADD COLUMN "bot_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "external_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "last_property_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "from_bot" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_tenant_id_channel_external_id_key"
  ON "chat_sessions"("tenant_id", "channel", "external_id");
CREATE INDEX "chat_sessions_tenant_id_last_message_at_idx"
  ON "chat_sessions"("tenant_id", "last_message_at");

CREATE INDEX "chat_messages_session_id_created_at_idx"
  ON "chat_messages"("session_id", "created_at");
CREATE INDEX "chat_messages_tenant_id_created_at_idx"
  ON "chat_messages"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
