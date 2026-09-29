/* Antes: api/log_busqueda.php */

import { sql } from "../_lib/db.js";
import { json, cuerpo } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";

export default async function handler(req, res) {
  const body = cuerpo(req);
  const termino = (body.termino || "").trim();
  const origen = (body.origen || "").trim().slice(0, 50) || null;

  if (!termino || termino.length > 150) return json(res, 200, { ok: true });

  try {
    const s = leerSesion(req);
    await sql`
      INSERT INTO busquedas (termino, usuario_nombre, origen)
      VALUES (${termino}, ${s ? s.nombre : null}, ${origen})
    `;
  } catch {
    /* idem */
  }

  json(res, 200, { ok: true });
}