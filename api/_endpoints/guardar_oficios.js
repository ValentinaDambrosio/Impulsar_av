/* Antes: api/guardar_oficios.php — alta de trabajador, parte 2
 *
 * Los archivos ya están en Storage (el navegador los subió con /api/url_subida).
 * Acá solo llegan metadatos en JSON: Vercel no vuelve a ver los archivos. */

import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { leerSesion, crearCookie } from "../_lib/sesion.js";
import {
  borrar, BUCKETS, MAX_FOTOS_POR_OFICIO, MAX_VIDEOS_POR_OFICIO
} from "../_lib/archivos.js";

const EXT_FOTO = { jpg: "foto", jpeg: "foto", png: "foto", webp: "foto" };
const EXT_VIDEO = { mp4: "video", webm: "video", mov: "video" };

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const body = cuerpo(req);
  const providerId = String(body.provider_id || "").trim();

  let oficios = body.oficios;
  if (typeof oficios === "string") {
    try { oficios = JSON.parse(oficios); } catch { oficios = []; }
  }
  if (!Array.isArray(oficios)) oficios = [];

  if (!providerId || oficios.length === 0) {
    return error(res, 400, "Faltan datos para completar el registro");
  }

  const sesion = leerSesion(req);
  if (!sesion || sesion.tipo !== "trabajador" || sesion.id !== providerId) {
    return error(res, 403, "No encontramos tu registro de la Parte 1");
  }

  const [trabajador] = await sql`
    SELECT nombre, apellido FROM trabajadores WHERE provider_id = ${providerId}
  `;
  if (!trabajador) {
    return error(res, 404, "No encontramos tu registro de la Parte 1");
  }

  const limpios = [];
  const nombreOk = new RegExp(
    `^${escapeRegex(providerId)}-[a-f0-9]+\\.(jpg|jpeg|png|webp|mp4|webm|mov)$`,
    "i"
  );

  for (const o of oficios) {
    const rubro = (o?.rubro || "").trim();
    const descripcion = (o?.descripcion || "").trim();

    const nombres = (Array.isArray(o?.oficios) ? o.oficios : [])
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0 && n.length <= 150);

    if (!rubro || rubro.length > 100 || nombres.length === 0) {
      return error(res, 400, "Uno de los rubros cargados tiene datos inválidos");
    }
    if (descripcion.length > 1000) {
      return error(res, 400, "La descripción de experiencia es demasiado larga");
    }

    const certs = (Array.isArray(o?.certificaciones) ? o.certificaciones : [])
      .map((c) => String(c).trim())
      .filter((c) => c.length > 0 && c.length <= 150);

    const media = [];
    let fotos = 0;
    let videos = 0;
    for (const m of Array.isArray(o?.media) ? o.media : []) {
      const archivo = String(m?.archivo || "").trim();
      if (!archivo) continue;
      if (!nombreOk.test(archivo)) {
        return error(res, 400, "Uno de los archivos no es válido");
      }
      const ext = archivo.split(".").pop().toLowerCase();
      const tipo = EXT_FOTO[ext] || EXT_VIDEO[ext];
      if (!tipo) return error(res, 400, "Uno de los archivos no es un formato permitido");
      if (tipo === "foto") {
        fotos++;
        if (fotos > MAX_FOTOS_POR_OFICIO) {
          return error(res, 400, `Como máximo se pueden subir ${MAX_FOTOS_POR_OFICIO} fotos por oficio`);
        }
      } else {
        videos++;
        if (videos > MAX_VIDEOS_POR_OFICIO) {
          return error(res, 400, "Como máximo se puede subir 1 video por oficio");
        }
      }
      media.push({
        tipo,
        archivo,
        bucket: tipo === "video" ? BUCKETS.videosTrabajo : BUCKETS.fotosTrabajo
      });
    }

    limpios.push({
      rubro,
      oficios: nombres,
      certificaciones: certs,
      descripcion: descripcion || null,
      media
    });
  }

  try {
    await sql.begin(async (tx) => {
      for (const o of limpios) {
        const [fila] = await tx`
          INSERT INTO oficios (provider_id, rubro, oficio, certificaciones, descripcion)
          VALUES (
            ${providerId}, ${o.rubro},
            ${JSON.stringify(o.oficios)}, ${JSON.stringify(o.certificaciones)},
            ${o.descripcion}
          )
          RETURNING id
        `;

        for (const m of o.media) {
          await tx`
            INSERT INTO oficios_media (oficio_id, tipo, archivo)
            VALUES (${fila.id}, ${m.tipo}, ${m.archivo})
          `;
        }
      }
    });
  } catch (e) {
    console.error("guardar_oficios:", e);
    for (const o of limpios) {
      for (const m of o.media) await borrar(m.bucket, m.archivo);
    }
    return error(res, 500, "No se pudo guardar el registro");
  }

  crearCookie(res, {
    tipo: "trabajador",
    id: providerId,
    nombre: `${trabajador.nombre} ${trabajador.apellido}`
  });

  json(res, 200, { ok: true, cantidad: limpios.length });
}

function escapeRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
