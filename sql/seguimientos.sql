-- Seguimiento post-contacto. Correr en el SQL Editor de Supabase si el
-- esquema base (schema_postgres.sql) ya se aplicó sin esta feature.

BEGIN;

DO $$ BEGIN
  CREATE TYPE seguimiento_estado AS ENUM (
    'pendiente_contacto',
    'pendiente_trabajo',
    'pendiente_calificacion',
    'finalizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS seguimientos_habilitados boolean NOT NULL DEFAULT true;

ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS seguimientos_habilitados boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS seguimientos (
    id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id        varchar(100) NOT NULL
                       REFERENCES trabajadores(provider_id) ON DELETE CASCADE,
    contactante_tipo   cuenta_tipo NOT NULL,
    contactante_id     varchar(150) NOT NULL,
    contactante_email  varchar(150) NOT NULL,
    contactante_nombre varchar(200) NOT NULL,
    estado             seguimiento_estado NOT NULL DEFAULT 'pendiente_contacto',
    proxima_fecha      timestamptz NOT NULL,
    email_enviado      boolean NOT NULL DEFAULT false,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seguimientos_contactante
    ON seguimientos (contactante_tipo, contactante_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_proxima
    ON seguimientos (proxima_fecha, estado);

ALTER TABLE seguimientos ENABLE ROW LEVEL SECURITY;

COMMIT;
