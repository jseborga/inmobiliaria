-- Sprint 3 — Visitas presenciales + OTP por WhatsApp.

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "OtpContext" AS ENUM ('VISIT_BOOKING');

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "VisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" TEXT,
    "notes" TEXT,
    "phone_verified_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "context" "OtpContext" NOT NULL DEFAULT 'VISIT_BOOKING',
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "tenant_id" TEXT,
    "test_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_integrations" (
    "tenant_id" TEXT NOT NULL,
    "base_url" TEXT,
    "instance" TEXT,
    "api_key_enc" TEXT,
    "test_mode" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "visits_tenant_id_status_scheduled_at_idx" ON "visits"("tenant_id", "status", "scheduled_at");
CREATE INDEX "visits_tenant_id_scheduled_at_idx" ON "visits"("tenant_id", "scheduled_at");
CREATE INDEX "visits_assigned_user_id_scheduled_at_idx" ON "visits"("assigned_user_id", "scheduled_at");
CREATE INDEX "visits_property_id_idx" ON "visits"("property_id");

-- CreateIndex
CREATE INDEX "phone_otps_phone_context_created_at_idx" ON "phone_otps"("phone", "context", "created_at");
CREATE INDEX "phone_otps_expires_at_idx" ON "phone_otps"("expires_at");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visits" ADD CONSTRAINT "visits_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visits" ADD CONSTRAINT "visits_assigned_user_id_fkey"
    FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visits" ADD CONSTRAINT "visits_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_integrations" ADD CONSTRAINT "whatsapp_integrations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
