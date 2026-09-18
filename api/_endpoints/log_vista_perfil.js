/* Antes: api/log_vista_perfil.php */

import { sql } from "../_lib/db.js";
import { json, cuerpo } from "../_lib/http.js";

export default async function handler(req, res) {
  const providerId = (cuerpo(req).provider_id || "").trim();
  if (!providerId) return json(res, 200, { ok: true });

  try {
    await sql`INSERT INTO vistas_perfil (provider_id) VALUES (${providerId})`;
  } catch {
    /* Es analítica: que falle no puede romper la página del perfil */
  }

  json(res, 200, { ok: true });
}
