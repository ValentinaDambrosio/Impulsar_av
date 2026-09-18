/* Antes: api/guardar_oficios.php — alta de trabajador, parte 2 */

import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { leerSesion, crearCookie } from "../_lib/sesion.js";
import {
  parsearFormulario, subir, borrar,
  BUCKETS, TIPOS_FOTO, TIPOS_VIDEO,
  MAX_FOTO, MAX_VIDEO, MAX_ARCHIVOS_POR_OFICIO
} from "../_lib/archivos.js";

/* Llegan archivos (multipart): el body se lee crudo con formidable.
   Ver el comentario de api/[ruta].js sobre no tocar req.body antes. */

export default async function handler(req, res) {
  if (req.method !== "POST") return error(res, 405, "Método no permitido");

  let campos, archivos;
  try {
    ({ campos, archivos } = await parsearFormulario(req, { maxBytes: MAX_VIDEO }));
  } catch (e) {
    if (/maxFileSize|maxTotalFileSize/i.test(e.message || "")) {
      return error(res, 400, "Uno de los videos pesa más de 15MB");
    }
    return error(res, 400, "No se pudo leer el formulario");
  }

  const providerId = (campos.provider_id || "").trim();

  let oficios;
  try {
    oficios = JSON.parse(campos.oficios || "[]");
  } catch {
    oficios = [];
  }
  if (!Array.isArray(oficios)) oficios = [];

  if (!providerId || oficios.length === 0) {
    return error(res, 400, "Faltan datos para completar el registro");
  }

  /* El PHP solo verificaba que el trabajador existiera: cualquiera que supiera
     un provider_id podía cargarle oficios al perfil de otro. Acá además tiene
     que ser el dueño de la sesión. */
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

  /* 1. Validar todo antes de subir un solo byte (igual que el PHP) */
  const limpios = [];
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

    limpios.push({ rubro, oficios: nombres, certificaciones: certs, descripcion: descripcion || null });
  }

  /* 2. Juntar y validar los archivos (media_{i}_{j}, igual que el PHP) */
  const archivosPorOficio = [];
  for (let i = 0; i < limpios.length; i++) {
    const lista = [];
    let j = 0;

    while (archivos[`media_${i}_${j}`]) {
      const a = archivos[`media_${i}_${j}`];
      j++;
      if (!a.size) continue;

      if (lista.length >= MAX_ARCHIVOS_POR_OFICIO) {
        return error(res, 400,
          `Como máximo se pueden subir ${MAX_ARCHIVOS_POR_OFICIO} archivos por oficio`);
      }

      if (TIPOS_FOTO[a.mimetype]) {
        if (a.size > MAX_FOTO) return error(res, 400, "Una de las fotos pesa más de 3MB");
        lista.push({ tipo: "foto", archivo: a, ext: TIPOS_FOTO[a.mimetype], bucket: BUCKETS.fotosTrabajo });
      } else if (TIPOS_VIDEO[a.mimetype]) {
        if (a.size > MAX_VIDEO) return error(res, 400, "Uno de los videos pesa más de 15MB");
        lista.push({ tipo: "video", archivo: a, ext: TIPOS_VIDEO[a.mimetype], bucket: BUCKETS.videosTrabajo });
      } else {
        return error(res, 400, "Uno de los archivos no es un formato de foto o video permitido");
      }
    }

    archivosPorOficio.push(lista);
  }

  /* 3. Subir y escribir.
   *
   * Las filas van en una transacción, igual que el beginTransaction/commit del
   * PHP. Los archivos no pueden entrar en la transacción — viven en Storage —
   * así que si algo falla se borran a mano, como hacía el @unlink del rollback. */
  const subidos = [];
  try {
    await sql.begin(async (tx) => {
      for (let i = 0; i < limpios.length; i++) {
        const o = limpios[i];

        const [fila] = await tx`
          INSERT INTO oficios (provider_id, rubro, oficio, certificaciones, descripcion)
          VALUES (
            ${providerId}, ${o.rubro},
            ${JSON.stringify(o.oficios)}, ${JSON.stringify(o.certificaciones)},
            ${o.descripcion}
          )
          RETURNING id
        `;

        for (const a of archivosPorOficio[i]) {
          const sub = await subir(a.bucket, a.archivo, a.ext, providerId);
          subidos.push({ bucket: a.bucket, nombre: sub.archivo });

          await tx`
            INSERT INTO oficios_media (oficio_id, tipo, archivo)
            VALUES (${fila.id}, ${a.tipo}, ${sub.archivo})
          `;
        }
      }
    });
  } catch (e) {
    console.error("guardar_oficios:", e);
    for (const s of subidos) await borrar(s.bucket, s.nombre);
    return error(res, 500, "No se pudo guardar el registro");
  }

  // El PHP refrescaba la sesión acá (quien venía de la Parte 1 ya queda logueado)
  crearCookie(res, {
    tipo: "trabajador",
    id: providerId,
    nombre: `${trabajador.nombre} ${trabajador.apellido}`
  });

  json(res, 200, { ok: true, cantidad: limpios.length });
}
