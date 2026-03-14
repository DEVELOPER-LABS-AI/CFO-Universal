-- Add client_id to merchant_mapping_cache for mapping CREDIT merchants to clients
ALTER TABLE "merchant_mapping_cache" ADD COLUMN "client_id" TEXT;

-- Index for client_id lookups
CREATE INDEX "merchant_mapping_cache_client_id_idx" ON "merchant_mapping_cache"("client_id");
