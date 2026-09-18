/* Antes: api/eliminar_oficio.php */

import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { exigirTrabajador } from "../_lib/sesion.js";
import { borrar, BUCKETS } from "../_lib/archivos.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const sesion = exigirTrabajador(req, res);
  if (!sesion) return;

  const oficioId = parseInt(cuerpo(req).oficio_id, 10) || 0;
  if (oficioId <= 0) return error(res, 400, "Falta indicar qué oficio borrar");

  // El WHERE lleva el provider_id de la sesión: nadie puede borrar el oficio de otro
  const [oficio] = await sql`
    SELECT id FROM oficios WHERE id = ${oficioId} AND provider_id = ${sesion.id}
  `;

  if (!oficio) return error(res, 404, "No encontramos ese oficio en tu perfil");

  // Se leen antes de borrar: el ON DELETE CASCADE se lleva las filas de media
  const media = await sql`
    SELECT tipo, archivo FROM oficios_media WHERE oficio_id = ${oficioId}
  `;

  await sql`DELETE FROM oficios WHERE id = ${oficioId}`;

  for (const m of media) {
    await borrar(m.tipo === "video" ? BUCKETS.videosTrabajo : BUCKETS.fotosTrabajo, m.archivo);
  }

  json(res, 200, { ok: true });
}
