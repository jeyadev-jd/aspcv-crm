-- Security hardening migration
-- 1. Add tokenVersion to User for session invalidation on password change
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- 2. Add isActive soft-delete to Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 3. Indexes for Task
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_entityType_entityId_idx" ON "Task"("entityType", "entityId");


-- 4. Atomic reference number sequences (safe under concurrent load)
CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS wo_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS gr_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS mr_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Seed sequences from existing data so new numbers don't collide with old ones
SELECT setval('wo_number_seq', COALESCE((SELECT COUNT(*) FROM "WorkOrder"), 0) + 1, false);
SELECT setval('gr_number_seq', COALESCE((SELECT COUNT(*) FROM "GoodsReceipt"), 0) + 1, false);
SELECT setval('mr_number_seq', COALESCE((SELECT COUNT(*) FROM "MaterialRequest"), 0) + 1, false);
SELECT setval('invoice_number_seq', COALESCE((SELECT COUNT(*) FROM "Invoice"), 0) + 1, false);

-- 5. Index on Invoice(date, status) for analytics queries
CREATE INDEX IF NOT EXISTS "Invoice_date_status_idx" ON "Invoice"("date", "status");
