/* Firma una URL de subida a Storage. El archivo va del navegador a Supabase,
   sin pasar por Vercel (el 413 de 4.5MB). */

import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { exigirTrabajador } from "../_lib/sesion.js";
import {
  urlSubidaFirmada, BUCKETS, TIPOS_FOTO, TIPOS_VIDEO, MAX_FOTO, MAX_VIDEO
} from "../_lib/archivos.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const sesion = exigirTrabajador(req, res);
  if (!sesion) return;

  const body = cuerpo(req);
  const contentType = String(body.contentType || "").toLowerCase().trim();
  const size = Number(body.size || 0);

  let tipo;
  let ext;
  let bucket;
  let tope;

  if (TIPOS_FOTO[contentType]) {
    tipo = "foto";
    ext = TIPOS_FOTO[contentType];
    bucket = BUCKETS.fotosTrabajo;
    tope = MAX_FOTO;
  } else if (TIPOS_VIDEO[contentType]) {
    tipo = "video";
    ext = TIPOS_VIDEO[contentType];
    bucket = BUCKETS.videosTrabajo;
    tope = MAX_VIDEO;
  } else {
    return error(res, 400, "El archivo tiene que ser JPG, PNG, WEBP, MP4, WEBM o MOV");
  }

  if (!Number.isFinite(size) || size <= 0) {
    return error(res, 400, "No se pudo leer el tamaño del archivo");
  }
  if (size > tope) {
    return error(res, 400, tipo === "video"
      ? "Uno de los videos pesa más de 8MB"
      : "Una de las fotos pesa más de 3MB");
  }

  try {
    const subida = await urlSubidaFirmada(bucket, ext, sesion.id, contentType);
    json(res, 200, {
      ok: true,
      tipo,
      archivo: subida.archivo,
      signedUrl: subida.signedUrl,
      contentType: subida.contentType
    });
  } catch (e) {
    console.error("url_subida:", e);
    error(res, 500, "No se pudo preparar la subida del archivo");
  }
}
