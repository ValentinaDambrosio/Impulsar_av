/* Subida de archivos. Reemplaza a move_uploaded_file() y a la carpeta uploads/.
 *
 * En Vercel el disco es de solo lectura, así que los archivos van a Supabase
 * Storage. Se conservan los mismos tres buckets que eran carpetas, los mismos
 * límites de tamaño y los mismos tipos permitidos que validaba PHP.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";

const supabase = createClient(
  process.env.SUPABASE_URL,
  // service_role saltea RLS: estas funciones son el backend, no el navegador.
  // Esta clave NUNCA puede terminar en el código del cliente.
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const BUCKETS = {
  fotosPerfil: "fotos-perfil",
  fotosTrabajo: "fotos-trabajo",
  videosTrabajo: "videos-trabajo"
};

export const TIPOS_FOTO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export const TIPOS_VIDEO = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

export const MAX_FOTO = 3 * 1024 * 1024;
export const MAX_VIDEO = 8 * 1024 * 1024;
export const MAX_FOTOS_POR_OFICIO = 4;
export const MAX_VIDEOS_POR_OFICIO = 1;
export const MAX_ARCHIVOS_POR_OFICIO = MAX_FOTOS_POR_OFICIO + MAX_VIDEOS_POR_OFICIO;

/* Lee un formulario multipart directo del stream del pedido.
   Vercel solo parsea req.body cuando alguien lo lee: mientras nadie lo toque
   antes (ver api/[ruta].js), el stream llega entero hasta acá. */
export function parsearFormulario(req, { maxBytes = MAX_VIDEO } = {}) {
  const form = formidable({
    multiples: true,
    maxFileSize: maxBytes,
    maxTotalFileSize: maxBytes * MAX_ARCHIVOS_POR_OFICIO
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, campos, archivos) => {
      if (err) return reject(err);

      // formidable devuelve todo como array; se aplana para que se parezca a $_POST
      const planos = {};
      for (const [k, v] of Object.entries(campos)) {
        planos[k] = Array.isArray(v) ? v[0] : v;
      }
      const archivosPlanos = {};
      for (const [k, v] of Object.entries(archivos)) {
        archivosPlanos[k] = Array.isArray(v) ? v[0] : v;
      }

      resolve({ campos: planos, archivos: archivosPlanos });
    });
  });
}

function nombreAlAzar() {
  return randomBytes(8).toString("hex");
}

/* Sube y devuelve { archivo, url }.
   `archivo` es la ruta dentro del bucket, que es lo que se guarda en la base
   (igual que antes se guardaba el nombre del archivo en disco). */
export async function subir(bucket, archivoTmp, ext, prefijo) {
  const nombre = `${prefijo}-${nombreAlAzar()}.${ext}`;
  const contenido = await readFile(archivoTmp.filepath);

  const { error } = await supabase.storage.from(bucket).upload(nombre, contenido, {
    contentType: archivoTmp.mimetype,
    upsert: false
  });

  // El archivo temporal ya no sirve, tanto si salió bien como si no
  await unlink(archivoTmp.filepath).catch(() => {});

  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(nombre);
  return { archivo: nombre, url: data.publicUrl };
}

/* Equivale a @unlink(): si no está o ya se borró, no pasa nada. */
export async function borrar(bucket, nombre) {
  if (!nombre) return;
  await supabase.storage.from(bucket).remove([nombre]).catch(() => {});
}

export function urlPublica(bucket, nombre) {
  if (!nombre) return null;
  return supabase.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
}

/* URL firmada para que el navegador suba directo a Storage.
   Vercel (Hobby) rechaza con 413 cualquier pedido de más de ~4.5MB, y un
   video de varios MB no pasa por la función. El archivo ni toca el serverless. */
export async function urlSubidaFirmada(bucket, ext, prefijo, contentType) {
  const nombre = `${prefijo}-${nombreAlAzar()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(nombre);

  if (error) throw new Error(`No se pudo preparar la subida: ${error.message}`);

  return {
    archivo: nombre,
    signedUrl: data.signedUrl,
    contentType
  };
}
