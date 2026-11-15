/* Edición de un servicio ya publicado.
 * Solo se pueden cambiar las certificaciones, la descripción y las fotos ovideos. El rubro y los oficios quedan fijos a propósito: si la persona quiere
 * otro rubro u otro oficio, tiene que cargar un servicio nuevo.
 * Igual que en guardar_oficios, los archivos nuevos ya están en Storage (el navegador los subió con /api/url_subida): acá solo llegan sus nombres. */

import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { exigirTrabajador } from "../_lib/sesion.js";
import {
  borrar, BUCKETS, MAX_FOTOS_POR_OFICIO, MAX_VIDEOS_POR_OFICIO
} from "../_lib/archivos.js";

const EXT_FOTO = { jpg: "foto", jpeg: "foto", png: "foto", webp: "foto" };
const EXT_VIDEO = { mp4: "video", webm: "video", mov: "video" };

const bucketDe = (tipo) => (tipo === "video" ? BUCKETS.videosTrabajo : BUCKETS.fotosTrabajo);

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const sesion = exigirTrabajador(req, res);
  if (!sesion) return;

  const body = cuerpo(req);
  const oficioId = parseInt(body.oficio_id, 10) || 0;
  if (oficioId <= 0) return error(res, 400, "Falta indicar qué servicio editar");

  const [oficio] = await sql`
    SELECT id FROM oficios WHERE id = ${oficioId} AND provider_id = ${sesion.id}
  `;
  if (!oficio) return error(res, 404, "No encontramos ese servicio en tu perfil");

  const descripcion = String(body.descripcion || "").trim();
  if (descripcion.length > 1000) {
    return error(res, 400, "La descripción de experiencia es demasiado larga");
  }

  const certificaciones = (Array.isArray(body.certificaciones) ? body.certificaciones : [])
    .map((c) => String(c).trim())
    .filter((c) => c.length > 0 && c.length <= 150);


  const actuales = await sql`
    SELECT tipo, archivo FROM oficios_media WHERE oficio_id = ${oficioId}
  `;

  const pedidosQuitar = new Set((Array.isArray(body.media_quitar) ? body.media_quitar : []).map(String));
  const quitar = actuales.filter((m) => pedidosQuitar.has(m.archivo));
  const quedan = actuales.filter((m) => !pedidosQuitar.has(m.archivo));

  const nombreOk = new RegExp(
    `^${escapeRegex(sesion.id)}-[a-f0-9]+\\.(jpg|jpeg|png|webp|mp4|webm|mov)$`,
    "i"
  );

  const nuevos = [];
  for (const m of Array.isArray(body.media_nuevos) ? body.media_nuevos : []) {
    const archivo = String(m?.archivo || "").trim();
    if (!archivo) continue;
    if (!nombreOk.test(archivo)) return error(res, 400, "Uno de los archivos no es válido");

    const ext = archivo.split(".").pop().toLowerCase();
    const tipo = EXT_FOTO[ext] || EXT_VIDEO[ext];
    if (!tipo) return error(res, 400, "Uno de los archivos no es un formato permitido");

    if (actuales.some((a) => a.archivo === archivo)) continue;
    nuevos.push({ tipo, archivo });
  }

  const finales = [...quedan, ...nuevos];
  const fotos = finales.filter((m) => m.tipo === "foto").length;
  const videos = finales.filter((m) => m.tipo === "video").length;
  if (fotos > MAX_FOTOS_POR_OFICIO) {
    return error(res, 400, `Como máximo se pueden tener ${MAX_FOTOS_POR_OFICIO} fotos por servicio`);
  }
  if (videos > MAX_VIDEOS_POR_OFICIO) {
    return error(res, 400, "Como máximo se puede tener 1 video por servicio");
  }


  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE oficios
        SET certificaciones = ${JSON.stringify(certificaciones)},
            descripcion = ${descripcion || null}
        WHERE id = ${oficioId}
      `;

      if (quitar.length > 0) {
        await tx`
          DELETE FROM oficios_media
          WHERE oficio_id = ${oficioId} AND archivo IN ${sql(quitar.map((m) => m.archivo))}
        `;
      }

      for (const m of nuevos) {
        await tx`
          INSERT INTO oficios_media (oficio_id, tipo, archivo)
          VALUES (${oficioId}, ${m.tipo}, ${m.archivo})
        `;
      }
    });
  } catch (e) {
    console.error("actualizar_oficio:", e);
    for (const m of nuevos) await borrar(bucketDe(m.tipo), m.archivo);
    return error(res, 500, "No se pudieron guardar los cambios");
  }

  for (const m of quitar) await borrar(bucketDe(m.tipo), m.archivo);

  json(res, 200, { ok: true });
}

function escapeRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}