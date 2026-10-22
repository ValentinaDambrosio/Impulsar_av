# Impulsar

Impulsar es un directorio de oficios y servicios del barrio. Permite explorar y
contactar trabajadores, crear perfiles, publicar trabajos y administrar la
información desde un panel personal.

La aplicación usa páginas estáticas con HTML, CSS y JavaScript, una API serverless
en Vercel y Supabase para PostgreSQL y almacenamiento de archivos.

## Funcionalidades

- Registro e inicio de sesión para trabajadores y usuarios.
- Directorio con búsqueda, filtros, perfiles y medios de trabajos.
- Registro y edición de oficios, certificaciones y datos de perfil.
- Contacto y calificaciones de trabajadores.
- Panel personal y seguimiento de contactos.
- Recuperación de contraseña y correos enviados mediante Make.
- Invitación opcional al canal de WhatsApp luego de completar el registro.

## Tecnologías

- Node.js 22 o superior para la API y las herramientas del proyecto.
- JavaScript, HTML y CSS sin framework ni compilación de frontend.
- Vercel Functions para las rutas `/api/*`.
- Supabase PostgreSQL y Supabase Storage.
- `postgres`, `@supabase/supabase-js`, `bcryptjs` y `formidable`.

## Estructura

```text
*.html                 Páginas de la aplicación
css/                   Estilos
js/                    Lógica del frontend
images/                Recursos visuales
api/[ruta].js          Dispatcher de las rutas API
api/_endpoints/        Implementación de cada endpoint
api/_lib/              Conexión, sesiones, archivos y utilidades compartidas
sql/                   Esquema, buckets y cambios de base de datos
migracion/             Herramientas para importar datos del sistema anterior
uploads/               Archivos de origen para la migración
```

Vercel ejecuta `api/[ruta].js` como dispatcher: cada `/api/<nombre>` se deriva
al endpoint correspondiente de `api/_endpoints/`. Para añadir una ruta, crear su
endpoint e importarlo y registrarlo en `api/[ruta].js`.

## Requisitos

- Node.js 22 o superior y npm.
- Una cuenta y un proyecto de Supabase.
- Vercel CLI para probar localmente la API.
- PHP y acceso a la base MySQL anterior solo si se va a hacer la migración.

## Configuración

1. Instalar dependencias desde la raíz:

   ```powershell
   npm ci
   ```

2. Crear `.env.local` a partir de `.env.example`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Completar los valores de Supabase y los secretos. Para `DATABASE_URL`, usar
   el **Transaction pooler** de Supabase, normalmente en el puerto `6543`.

4. Configurar la base de datos en Supabase:

   - Ejecutar `sql/schema_postgres.sql` en el SQL Editor.
   - Ejecutar `sql/storage_buckets.sql` para crear los buckets de archivos.
   - Ejecutar `sql/seguimientos.sql` si la base existente todavía no tiene las
     tablas o columnas de seguimiento que define ese archivo.

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la API a PostgreSQL. Requerida. |
| `SUPABASE_URL` | URL del proyecto Supabase. Requerida. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso de servidor a Supabase. Requerida y secreta. |
| `SESSION_SECRET` | Firma de las cookies de sesión. Requerida; usar un valor aleatorio de al menos 32 caracteres. |
| `MAKE_WEBHOOK_URL` | Webhook de Make para los correos. Opcional. |
| `SITE_URL` | Dominio público para armar enlaces de recuperación y seguimiento. |
| `CRON_SECRET` | Secreto para proteger el endpoint de seguimiento solicitado por Make. |
| `CANAL_WHATSAPP_URL` | Enlace público al canal; lo entrega el endpoint de configuración del canal. |

Generar secretos desde PowerShell con Node:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` y `CRON_SECRET` son valores de
servidor: no incluirlos en `js/`, HTML ni repositorios públicos. `.env.local` está
ignorado por Git. La URL del canal sí es pública, pero también se configura en el
servidor para que el navegador no lea directamente archivos de entorno.

## Desarrollo local

El frontend estático puede abrirse con un servidor de archivos, pero las
operaciones de registro, sesión y datos necesitan que también estén disponibles
las rutas `/api`. Para probar la aplicación completa:

```powershell
npx vercel dev
```

Abrir la URL local que informa Vercel. Si el proyecto aún no está vinculado a
Vercel, iniciar sesión y vincularlo con `npx vercel login` y `npx vercel link`.
Vercel CLI debe poder leer `.env.local` para las funciones locales.

No hay un script de pruebas automatizadas definido en `package.json`.

## Despliegue

Importar el repositorio en Vercel y configurar allí las variables de entorno de
producción, incluyendo `CANAL_WHATSAPP_URL`. Verificar que las variables de
Supabase y los buckets estén configurados antes de probar registros o subidas.
Vercel sirve las páginas estáticas y publica la API mediante `api/[ruta].js`.

## Migración desde MySQL

La carpeta `migracion/` contiene el exportador PHP y el importador a Supabase.
La importación espera `migracion/export/datos.json` y, si corresponde, la carpeta
`migracion/export/uploads/` con las imágenes y videos originales.

1. En el entorno con acceso a MySQL, exportar los datos:

   ```powershell
   php migracion/exportar_mysql.php > migracion/datos.json
   ```

2. Copiar el JSON exportado y los archivos necesarios a `migracion/export/`.
3. Desde `migracion/`, instalar dependencias y verificar primero el simulacro:

   ```powershell
   Set-Location migracion
   npm install
   npm run seco
   ```

4. Cuando el simulacro sea correcto, ejecutar la importación real:

   ```powershell
   npm run importar
   ```

El importador necesita `DATABASE_URL`, `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. El modo `seco` no escribe datos ni sube archivos.
Los archivos de exportación pueden contener información personal; no deben
publicarse ni subirse al repositorio.
