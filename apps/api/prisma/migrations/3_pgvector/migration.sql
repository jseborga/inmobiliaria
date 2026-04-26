-- Sprint 2 — RAG semántico con pgvector.
--
-- IMPORTANTE: requiere imagen de Postgres con pgvector instalado.
-- En docker-compose.prod.yml se actualiza a `imresamu/postgis-pgvector:16-3.4-alpine`
-- (mantiene PostGIS y agrega pgvector como extensión disponible).
--
-- Vector dim = 1536: matchea OpenAI text-embedding-3-small.
-- Si después se cambia el modelo a uno de otra dim, hay que migrar la columna
-- (DROP + ADD con la nueva dim) y re-indexar todas las propiedades.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "properties"
  ADD COLUMN "embedding" vector(1536),
  ADD COLUMN "embedding_model" TEXT,
  ADD COLUMN "embedded_at" TIMESTAMP(3);

-- Index HNSW con cosine distance (lo que usamos en la query).
-- m=16 / ef_construction=64 son los defaults razonables para hasta ~1M filas.
CREATE INDEX "properties_embedding_hnsw_idx"
  ON "properties" USING hnsw ("embedding" vector_cosine_ops);
