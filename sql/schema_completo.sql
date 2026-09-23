-- ==========================================================
-- Nexo de Tierras Argentinas — Esquema completo de la base
-- Ejecutar todo este archivo UNA sola vez en una base nueva
-- (si tu base ya tiene estas tablas, no hace falta correrlo)
-- ==========================================================

-- ---------- Calificaciones ----------

CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    stars TINYINT UNSIGNED NOT NULL CHECK (stars BETWEEN 1 AND 5),
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE ratings ADD UNIQUE KEY unique_ip_provider (provider_id, ip_address);

-- ---------- Trabajadores (Parte 1 del registro) ----------

CREATE TABLE IF NOT EXISTS trabajadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    edad TINYINT UNSIGNED NOT NULL,
    celular VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    instagram VARCHAR(100) NULL,
    estudios ENUM('primario', 'secundario', 'terciario', 'universitario') NOT NULL,
    foto VARCHAR(255) NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Oficios (Parte 2 del registro) ----------
-- La columna "oficio" guarda una LISTA en JSON (varios oficios de
-- un mismo rubro juntos, ej: ["Albañilería","Pintura"])

CREATE TABLE IF NOT EXISTS oficios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    rubro VARCHAR(100) NOT NULL,
    oficio VARCHAR(150) NOT NULL,
    certificaciones TEXT NULL,
    descripcion TEXT NULL,
    foto_trabajo VARCHAR(255) NULL,  -- columna vieja, ya no se usa (ver oficios_media)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider_oficio (provider_id),
    CONSTRAINT fk_oficio_trabajador FOREIGN KEY (provider_id)
        REFERENCES trabajadores(provider_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Fotos/videos de cada oficio (varios por oficio) ----------

CREATE TABLE IF NOT EXISTS oficios_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    oficio_id INT NOT NULL,
    tipo ENUM('foto', 'video') NOT NULL,
    archivo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_oficio (oficio_id),
    CONSTRAINT fk_media_oficio FOREIGN KEY (oficio_id)
        REFERENCES oficios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Cuentas de "persona común" (no trabajador) ----------

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Links de "olvidé mi contraseña" ----------

CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('trabajador', 'usuario') NOT NULL,
    identificador VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expira DATETIME NOT NULL,
    usado TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Analítica interna del equipo ----------

CREATE TABLE IF NOT EXISTS busquedas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    termino VARCHAR(150) NOT NULL,
    usuario_nombre VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_termino (termino)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vistas_perfil (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    tipo ENUM('llamada', 'whatsapp', 'email', 'instagram') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Nexo de Tierras Argentinas — Sistema de calificaciones
-- Ejecutar esto una sola vez en phpMyAdmin (o la consola MySQL de tu hosting)

CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    stars TINYINT UNSIGNED NOT NULL CHECK (stars BETWEEN 1 AND 5),
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Evita que la misma IP califique dos veces a la misma persona
ALTER TABLE ratings ADD UNIQUE KEY unique_ip_provider (provider_id, ip_address);
-- ==========================================================
-- Sistema de seguimiento post-contacto (mensajitos + mail)
-- ==========================================================

-- Permite que una persona diga "no quiero recibir más estos mensajes"
-- de forma global (deja de preguntarle para siempre, de cualquier trabajador)
ALTER TABLE usuarios ADD COLUMN seguimientos_habilitados TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE trabajadores ADD COLUMN seguimientos_habilitados TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS seguimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,              -- el trabajador contactado
    contactante_tipo ENUM('usuario', 'trabajador') NOT NULL,
    contactante_id VARCHAR(150) NOT NULL,           -- id de usuarios, o provider_id si es un trabajador
    contactante_email VARCHAR(150) NOT NULL,
    contactante_nombre VARCHAR(200) NOT NULL,
    estado ENUM('pendiente_contacto', 'pendiente_trabajo', 'pendiente_calificacion', 'finalizado')
        NOT NULL DEFAULT 'pendiente_contacto',
    proxima_fecha DATETIME NOT NULL,
    email_enviado TINYINT(1) NOT NULL DEFAULT 0,    -- para no mandar el mismo mail 2 veces mientras espera
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_contactante (contactante_tipo, contactante_id),
    INDEX idx_proxima (proxima_fecha, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;