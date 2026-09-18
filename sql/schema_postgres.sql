-- Impulsar — esquema en PostgreSQL (Supabase)
--
-- Traducción de schema_completo.sql (MySQL/InnoDB). Es la misma estructura:
-- mismas tablas, mismas claves foráneas, mismos CASCADE, mismas restricciones
-- UNIQUE. Lo único que cambia es el dialecto.
--
-- Qué cambió y por qué:
--   INT AUTO_INCREMENT      → integer GENERATED ALWAYS AS IDENTITY
--   TINYINT UNSIGNED        → smallint (Postgres no tiene tipos sin signo)
--   TINYINT(1)              → boolean
--   TIMESTAMP DEFAULT ...   → timestamptz DEFAULT now()  (con zona horaria)
--   ENUM('a','b')           → CREATE TYPE ... AS ENUM
--   INDEX dentro del CREATE → CREATE INDEX aparte (MySQL lo permite adentro, Postgres no)
--   ENGINE / CHARSET        → se van, no existen
--
-- Los CHECK, los FOREIGN KEY y los UNIQUE pasan tal cual.

BEGIN;

-- ─────────────────────────── tipos ───────────────────────────

CREATE TYPE estudios_nivel AS ENUM ('primario', 'secundario', 'terciario', 'universitario');
CREATE TYPE media_tipo     AS ENUM ('foto', 'video');
CREATE TYPE cuenta_tipo    AS ENUM ('trabajador', 'usuario');
CREATE TYPE contacto_tipo  AS ENUM ('llamada', 'whatsapp', 'email', 'instagram');

-- ─────────────────────────── tablas ───────────────────────────

CREATE TABLE IF NOT EXISTS trabajadores (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id   varchar(100)   NOT NULL UNIQUE,
    nombre        varchar(100)   NOT NULL,
    apellido      varchar(100)   NOT NULL,
    edad          smallint       NOT NULL CHECK (edad BETWEEN 0 AND 255),
    celular       varchar(30)    NOT NULL,
    email         varchar(150)   NOT NULL UNIQUE,
    instagram     varchar(100),
    estudios      estudios_nivel NOT NULL,
    foto          varchar(255),
    password_hash varchar(255)   NOT NULL,
    created_at    timestamptz    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        varchar(100) NOT NULL,
    apellido      varchar(100) NOT NULL,
    email         varchar(150) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

-- `oficio` guarda a veces un JSON y a veces un string suelto. Se deja como text
-- y se sigue decodificando en el código (decodificarOficios), igual que en PHP.
-- Convertirlo a jsonb sería más prolijo pero cambia el dato: queda para otro PR.
CREATE TABLE IF NOT EXISTS oficios (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id     varchar(100) NOT NULL
                    REFERENCES trabajadores(provider_id) ON DELETE CASCADE,
    rubro           varchar(100) NOT NULL,
    oficio          varchar(150) NOT NULL,
    certificaciones text,
    descripcion     text,
    created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oficios_media (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oficio_id  integer     NOT NULL REFERENCES oficios(id) ON DELETE CASCADE,
    tipo       media_tipo  NOT NULL,
    archivo    varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Antes la clave única era (provider_id, ip_address) con REMOTE_ADDR. Detrás de
-- un CDN o proxy esa es la IP del proxy, así que el primer voto bloqueaba a todos
-- los demás. Se conserva la columna y la restricción, pero ahora se guarda la IP
-- real leída de X-Forwarded-For. Ver ipDelCliente() en api/_lib/http.js
CREATE TABLE IF NOT EXISTS ratings (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id varchar(100) NOT NULL
                REFERENCES trabajadores(provider_id) ON DELETE CASCADE,
    stars       smallint     NOT NULL CHECK (stars BETWEEN 1 AND 5),
    ip_address  varchar(45)  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT unique_ip_provider UNIQUE (provider_id, ip_address)
);

CREATE TABLE IF NOT EXISTS password_resets (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo          cuenta_tipo  NOT NULL,
    identificador varchar(150) NOT NULL,
    email         varchar(150) NOT NULL,
    token         varchar(64)  NOT NULL UNIQUE,
    expira        timestamptz  NOT NULL,
    usado         boolean      NOT NULL DEFAULT false,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS busquedas (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    termino        varchar(150) NOT NULL,
    usuario_nombre varchar(200),
    created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vistas_perfil (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id varchar(100) NOT NULL
                REFERENCES trabajadores(provider_id) ON DELETE CASCADE,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contactos (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id varchar(100)  NOT NULL
                REFERENCES trabajadores(provider_id) ON DELETE CASCADE,
    tipo        contacto_tipo NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────────────────── índices ───────────────────────────
-- En MySQL iban adentro del CREATE TABLE; en Postgres van aparte.

CREATE INDEX IF NOT EXISTS idx_provider_oficio ON oficios (provider_id);
CREATE INDEX IF NOT EXISTS idx_oficio          ON oficios_media (oficio_id);
CREATE INDEX IF NOT EXISTS idx_ratings_provider ON ratings (provider_id);
CREATE INDEX IF NOT EXISTS idx_token           ON password_resets (token);
CREATE INDEX IF NOT EXISTS idx_termino         ON busquedas (termino);
CREATE INDEX IF NOT EXISTS idx_vistas_provider ON vistas_perfil (provider_id);
CREATE INDEX IF NOT EXISTS idx_contactos_provider ON contactos (provider_id);

-- El panel agrupa las vistas por día sobre los últimos 30 días.
-- Con esto no hace un scan completo de la tabla.
CREATE INDEX IF NOT EXISTS idx_vistas_provider_fecha
    ON vistas_perfil (provider_id, created_at DESC);

-- ───────────────────── seguridad a nivel de fila ─────────────────────
-- Toda la app entra por las funciones de /api con la service_role key, que
-- saltea RLS. Se prende igual para que nadie pueda leer estas tablas usando
-- la clave pública (anon) de Supabase, que es visible desde el navegador.
-- Sin políticas definidas, RLS activo = nadie que no sea service_role entra.

ALTER TABLE trabajadores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE oficios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE oficios_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE busquedas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistas_perfil   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos       ENABLE ROW LEVEL SECURITY;

COMMIT;
