-- Sprint 1.5 — Configuración de IA por tenant.
--
-- Modelo:
--  · PlatformAISettings: singleton, keys master del super-admin.
--  · TenantAISettings:   1 por tenant. Modo DISABLED/PLATFORM/OWN + overrides.
--  · AIUsage:            log de cada llamada para reportes y billing.
--
-- Las keys se almacenan encriptadas (AES-256-GCM, ver common/crypto/key-cipher.ts).

-- CreateEnum
CREATE TYPE "TenantAIMode" AS ENUM ('DISABLED', 'PLATFORM', 'OWN');

-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('DESCRIPTION', 'CHATBOT', 'EMBEDDINGS');

-- CreateTable
CREATE TABLE "platform_ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "default_provider" TEXT,
    "default_model" TEXT,
    "claude_key_enc" TEXT,
    "openai_key_enc" TEXT,
    "openrouter_key_enc" TEXT,
    "embeddings_provider" TEXT,
    "embeddings_model" TEXT,
    "embeddings_key_enc" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ai_settings" (
    "tenant_id" TEXT NOT NULL,
    "mode" "TenantAIMode" NOT NULL DEFAULT 'DISABLED',
    "provider" TEXT,
    "model" TEXT,
    "claude_key_enc" TEXT,
    "openai_key_enc" TEXT,
    "openrouter_key_enc" TEXT,
    "monthly_token_limit" INTEGER,
    "monthly_token_used" INTEGER NOT NULL DEFAULT 0,
    "monthly_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_ai_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature" "AIFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_tenant_id_created_at_idx" ON "ai_usage"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_tenant_id_billable_created_at_idx" ON "ai_usage"("tenant_id", "billable", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_ai_settings" ADD CONSTRAINT "tenant_ai_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
