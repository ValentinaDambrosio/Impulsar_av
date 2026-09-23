/* Paso 2 de la migración: meter el JSON de MySQL en Supabase.
 *
 *   npm install
 *   node importar_supabase.mjs --dry-run    ← muestra qué haría, no escribe
 *   node importar_supabase.mjs              ← escribe de verdad
 *
 * Espera encontrar:
 *   migracion/export/datos.json     (lo que escupe exportar_mysql.php)
 *   migracion/export/uploads/...    (la carpeta uploads/ tal cual del proyecto viejo)
 *
 * Variables de entorno: las mismas de .env.example (DATABASE_URL,
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Las contraseñas NO se tocan: los hash bcrypt de PHP entran tal cual en la
 * columna password_hash y siguen funcionando. Es la ventaja de haberse quedado
 * con el mismo esquema.
 */

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECO = process.argv.includes("--dry-run");
const AQUI = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const EXPORT = join(AQUI, "export");

for (const v of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[v]) {
    console.error(`Falta la variable de entorno ${v}`);
    process.exit(1);
  }
}

const datos = JSON.parse(readFileSync(join(EXPORT, "datos.json"), "utf8"));
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const log = (...a) => console.log(SECO ? "[seco]" : "[ok] ", ...a);

/* ───────────────── archivos → Supabase Storage ───────────────── */

const TIPOS = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime"
};

async function subirArchivo(bucket, carpeta, nombre) {
  if (!nombre) return null;

  const origen = join(EXPORT, "uploads", carpeta, nombre);
  if (!existsSync(origen)) {
    console.warn(`  ! falta el archivo ${carpeta}/${nombre}`);
    return null;
  }

  if (SECO) return nombre;

  const ext = nombre.split(".").pop().toLowerCase();
  const { error } = await supabase.storage.from(bucket).upload(
    nombre,
    readFileSync(origen),
    { contentType: TIPOS[ext] || "application/octet-stream", upsert: true }
  );

  if (error) {
    console.warn(`  ! no se pudo subir ${carpeta}/${nombre}: ${error.message}`);
    return null;
  }

  // Se guarda el mismo nombre que tenía en disco: la columna no cambia
  return nombre;
}

/* ───────────────── filas → Postgres ───────────────── */

/* Las columnas id son GENERATED ALWAYS AS IDENTITY, así que para conservar los
   IDs originales (oficios_media.oficio_id depende de ellos) hace falta
   OVERRIDING SYSTEM VALUE. Al final se reacomodan las secuencias. */

async function importarTrabajadores() {
  log(`trabajadores: ${datos.trabajadores.length}`);

  for (const t of datos.trabajadores) {
    const foto = await subirArchivo("fotos-perfil", "fotos-perfil", t.foto);
    if (SECO) continue;

    await sql`
      INSERT INTO trabajadores
        (provider_id, nombre, apellido, edad, celular, email, instagram,
         estudios, foto, password_hash, created_at)
      VALUES
        (${t.provider_id}, ${t.nombre}, ${t.apellido}, ${Number(t.edad)},
         ${t.celular}, ${t.email}, ${t.instagram || null},
         ${t.estudios}, ${foto}, ${t.password_hash}, ${t.created_at})
      ON CONFLICT (provider_id) DO NOTHING
    `;
  }
}

async function importarUsuarios() {
  log(`usuarios: ${datos.usuarios.length}`);
  if (SECO) return;

  for (const u of datos.usuarios) {
    await sql`
      INSERT INTO usuarios (id, nombre, apellido, email, password_hash, created_at)
      OVERRIDING SYSTEM VALUE
      VALUES (${Number(u.id)}, ${u.nombre}, ${u.apellido}, ${u.email},
              ${u.password_hash}, ${u.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

async function importarOficios() {
  log(`oficios: ${datos.oficios.length}`);

  for (const o of datos.oficios) {
    if (!SECO) {
      await sql`
        INSERT INTO oficios (id, provider_id, rubro, oficio, certificaciones, descripcion, created_at)
        OVERRIDING SYSTEM VALUE
        VALUES (${Number(o.id)}, ${o.provider_id}, ${o.rubro},
                ${JSON.stringify(o.oficios)}, ${JSON.stringify(o.certificaciones)},
                ${o.descripcion || null}, ${o.created_at})
        ON CONFLICT (id) DO NOTHING
      `;
    }

    for (const m of o.media) {
      const carpeta = m.tipo === "video" ? "videos-trabajo" : "fotos-trabajo";
      const archivo = await subirArchivo(carpeta, carpeta, m.archivo);
      if (SECO || !archivo) continue;

      await sql`
        INSERT INTO oficios_media (oficio_id, tipo, archivo)
        VALUES (${Number(o.id)}, ${m.tipo}, ${archivo})
      `;
    }
  }
}

async function importarResto() {
  log(`ratings: ${datos.ratings.length}, vistas: ${datos.vistas.length}, ` +
      `contactos: ${datos.contactos.length}, búsquedas: ${datos.busquedas.length}`);
  if (SECO) return;

  for (const r of datos.ratings) {
    await sql`
      INSERT INTO ratings (provider_id, stars, ip_address, created_at)
      VALUES (${r.provider_id}, ${Number(r.stars)}, ${r.ip_address}, ${r.created_at})
      ON CONFLICT (provider_id, ip_address) DO NOTHING
    `;
  }

  // vistas_perfil venía agrupado por día: se reponen esa cantidad de filas,
  // fechadas ese día, que es lo único que consulta el panel.
  for (const v of datos.vistas) {
    for (let i = 0; i < Number(v.cantidad); i++) {
      await sql`
        INSERT INTO vistas_perfil (provider_id, created_at)
        VALUES (${v.provider_id}, ${v.fecha})
      `;
    }
  }

  for (const c of datos.contactos) {
    for (let i = 0; i < Number(c.cantidad); i++) {
      await sql`
        INSERT INTO contactos (provider_id, tipo) VALUES (${c.provider_id}, ${c.tipo})
      `;
    }
  }

  for (const b of datos.busquedas) {
    await sql`
      INSERT INTO busquedas (termino, usuario_nombre, created_at)
      VALUES (${b.termino}, ${b.usuario_nombre || null}, ${b.created_at})
    `;
  }

  const seguimientos = datos.seguimientos || [];
  log(`seguimientos: ${seguimientos.length}`);
  for (const s of seguimientos) {
    await sql`
      INSERT INTO seguimientos
        (id, provider_id, contactante_tipo, contactante_id, contactante_email,
         contactante_nombre, estado, proxima_fecha, email_enviado, created_at, updated_at)
      OVERRIDING SYSTEM VALUE
      VALUES
        (${Number(s.id)}, ${s.provider_id}, ${s.contactante_tipo}, ${String(s.contactante_id)},
         ${s.contactante_email}, ${s.contactante_nombre}, ${s.estado}, ${s.proxima_fecha},
         ${Boolean(Number(s.email_enviado))}, ${s.created_at}, ${s.updated_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/* Después de insertar IDs a mano, las secuencias quedaron atrás: el próximo
   INSERT normal intentaría reusar un ID existente y fallaría. */
async function reacomodarSecuencias() {
  log("reacomodando secuencias");
  if (SECO) return;

  for (const tabla of ["trabajadores", "usuarios", "oficios", "oficios_media",
                       "ratings", "password_resets", "busquedas",
                       "vistas_perfil", "contactos", "seguimientos"]) {
    await sql`
      SELECT setval(
        pg_get_serial_sequence(${tabla}, 'id'),
        COALESCE((SELECT MAX(id) FROM ${sql(tabla)}), 1)
      )
    `;
  }
}

/* ───────────────── main ───────────────── */

console.log(SECO ? "\n=== SIMULACIÓN (no escribe nada) ===\n" : "\n=== IMPORTANDO ===\n");

await importarTrabajadores();
await importarUsuarios();
await importarOficios();
await importarResto();
await reacomodarSecuencias();

await sql.end();

console.log("\nListo.");
console.log("Probá entrar con una cuenta existente: la contraseña de siempre tiene que funcionar.");
