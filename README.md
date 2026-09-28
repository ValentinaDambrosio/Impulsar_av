# Impulsar

Directorio de oficios del barrio. Frontend estático + funciones serverless en
**Vercel**, con **Supabase** (PostgreSQL + Storage) como base.

Antes esto era PHP + MySQL sobre Apache. La lógica es la misma: los endpoints
de `api/` hacen lo mismo que hacían los `.php`, devuelven el mismo JSON y los
mismos códigos de error. Lo que cambió es dónde corre.

---

## Cómo está armado

```
index.html, perfil.html, …   el frontend, HTML/CSS/JS vanilla, sin build
css/  images/  js/           igual que antes
api/
  [ruta].js                  la única función: reparte /api/<ruta> al endpoint
  _endpoints/                los endpoints, uno por archivo (antes eran .php)
  _lib/                      lo compartido (era api/db.php)
    db.js                    conexión a Postgres
    sesion.js                cookie firmada (era $_SESSION)
    archivos.js              Supabase Storage (era move_uploaded_file)
    validar.js               las validaciones de los formularios
    http.js                  helpers de request/response + IP real
    make.js                  webhook de los mails
    seguimiento.js           popup y mails post-contacto
sql/schema_postgres.sql      el esquema traducido de MySQL
sql/seguimientos.sql         alta de la feature si el esquema ya existía
migracion/                   MySQL → Supabase, para los datos que ya existen
```

Vercel sirve los `.html` como archivos estáticos y publica `api/[ruta].js` como
**una sola función** que atiende todas las rutas `/api/...`. Es así porque el
plan Hobby no deja más de 12 funciones por deploy y hay más de 12 rutas. Las
carpetas que empiezan con `_` Vercel no las publica: son código común.

Para agregar un endpoint: crear el archivo en `api/_endpoints/` y sumarlo al
mapa `RUTAS` de `api/[ruta].js`.

## Equivalencias

| Antes | Ahora |
|---|---|
| PHP 8 + PDO | Node 22, funciones de Vercel |
| MySQL / InnoDB | PostgreSQL (Supabase) |
| `$_SESSION` + `session_start()` | cookie firmada con HMAC (`api/_lib/sesion.js`) |
| `password_hash()` / `password_verify()` | `bcryptjs` — **los hash que ya existen siguen sirviendo** |
| `move_uploaded_file()` → `uploads/` | Supabase Storage, 3 buckets |
| `$_FILES` | `formidable` |
| URL del webhook escrita en `db.php` | variable de entorno `MAKE_WEBHOOK_URL` |

El esquema de la base **no cambió**: mismas tablas, mismas claves foráneas,
mismos `ON DELETE CASCADE`, mismos `UNIQUE`. Solo se tradujo el dialecto
(`AUTO_INCREMENT` → `IDENTITY`, `ENUM` → `CREATE TYPE`, los `INDEX` de adentro
del `CREATE TABLE` pasaron a `CREATE INDEX` aparte). Ver `sql/schema_postgres.sql`.

## Variables de entorno

Copiar `.env.example` y completar. Las de DATABASE/SUPABASE/SESSION van sí o sí:

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Supabase → Database → Connection string → **Transaction pooler (6543)** |
| `SUPABASE_URL` | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `MAKE_WEBHOOK_URL` | el webhook de Make (opcional: sin esto no salen los mails) |
| `SITE_URL` | el dominio, para armar el link de recuperación y los de seguimiento |
| `CRON_SECRET` | clave para que Make pida `/api/seguimientos_para_email?clave=...` |

⚠️ La `service_role` saltea la seguridad de la base. Va solo en las variables de
Vercel, nunca en `js/`.

## Puesta en marcha

1. Crear el proyecto en Supabase.
2. Correr `sql/schema_postgres.sql` en el SQL Editor.
3. Correr `sql/storage_buckets.sql`: crea los tres buckets públicos
   (`fotos-perfil`, `fotos-trabajo`, `videos-trabajo`) con sus límites.
   Si el esquema ya estaba aplicado sin seguimientos, correr también
   `sql/seguimientos.sql`.
4. Importar el repo en Vercel y cargar las variables de entorno.
5. Migrar los datos que ya existen (abajo).
6. Deploy.

## Migrar los datos que ya existen

Dos pasos, porque la base vieja vive en otra máquina:

```bash
# 1. donde esté MySQL — solo lee, no modifica nada
php migracion/exportar_mysql.php > datos.json
# copiar datos.json y la carpeta uploads/ a migracion/export/

# 2. acá
cd migracion && npm install
npm run seco        # simulacro, no escribe
npm run importar
```

**Las contraseñas no se migran porque no hace falta.** Al quedarnos con la misma
columna `password_hash`, los hash bcrypt que generó PHP entran tal cual.
Verificado: `bcryptjs` acepta el prefijo `$2y$` de PHP sin tocar nada.

## Lo que se arregló de paso

- **Las calificaciones detrás de un proxy.** `submit_rating.php` usaba
  `$_SERVER["REMOTE_ADDR"]` con un `UNIQUE (provider_id, ip_address)`. En Vercel
  —y detrás de cualquier CDN— esa es la IP del proxy, la misma para todos: el
  primer voto bloqueaba a todo el mundo. Ahora se lee la IP real del header
  (`api/_lib/http.js` → `ipDelCliente`).
- **Slugs que se pisaban.** `registro.php` consultaba si el slug estaba libre y
  después insertaba; entre las dos cosas, dos registros simultáneos con el mismo
  nombre se quedaban con el mismo. Ahora decide la base con el `UNIQUE` y se
  reintenta al chocar.
- **Cualquiera podía cargarle oficios a otro.** `guardar_oficios.php` solo
  verificaba que el `provider_id` existiera, no que fuera tuyo. Ahora también
  tiene que coincidir con la sesión.
- **Links de recuperación reusables.** `resetear_password.php` leía y después
  actualizaba sin bloquear la fila; dos peticiones con el mismo token podían
  pasar las dos. Ahora la consulta lleva `FOR UPDATE`.
- **N+1 en el perfil.** Se hacía una consulta de media por cada oficio. Ahora es
  un `LEFT JOIN` con `json_agg`.

## Lo que quedó afuera, a propósito

- **`js/main.js`.** `index.html` del zip lo cargaba pero el archivo nunca estuvo
  en el repo (tiraba 404). Se sacó el `<script>`.
- **`uploads/`.** Se deja en el repo a propósito: es la fuente de la migración a
  Storage. Una vez migrado y verificado, se puede borrar en un commit aparte.

## Pendiente de seguridad

`api/db.php` tenía commiteados `$CRON_SECRET = "impulsar2026"` y la URL del
webhook de Make. Borrar el archivo **no los saca del historial de git**: siguen
siendo visibles en cualquier clon del repo. **Hay que rotar el webhook en Make.**

## Qué falta probar

Nada de esto se probó corriendo: no hay MySQL ni Postgres en la máquina donde se
escribió. Sí está verificado que los endpoints de `/api` cargan sin errores de import,
que la firma de las cookies rechaza payloads alterados, y que `bcryptjs` lee los
hash de PHP.

Recorrido para la primera prueba real:

1. Registro de trabajador (parte 1 + parte 2 con fotos y video)
2. Login / logout / recuperar contraseña
3. Directorio: fotos y promedios
4. Perfil: media, calificar, intentar calificar dos veces (tiene que rebotar)
5. Panel: estadísticas, editar perfil, cambiar foto, borrar un oficio
6. Registro de usuario común desde el modal
7. Contacto logueado → a los 5 días (o adelantando `proxima_fecha` en la base)
   tiene que aparecer el popup de seguimiento
