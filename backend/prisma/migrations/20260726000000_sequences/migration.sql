-- Atomic reference number sequences (safe under concurrent load)
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
