/* Antes: api/log_busqueda.php */

import { sql } from "../_lib/db.js";
import { json, cuerpo } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";

export default async function handler(req, res) {
  const termino = (cuerpo(req).termino || "").trim();

  if (!termino || termino.length > 150) return json(res, 200, { ok: true });

  try {
    const s = leerSesion(req);
    await sql`
      INSERT INTO busquedas (termino, usuario_nombre)
      VALUES (${termino}, ${s ? s.nombre : null})
    `;
  } catch {
    /* idem */
  }

  json(res, 200, { ok: true });
}
