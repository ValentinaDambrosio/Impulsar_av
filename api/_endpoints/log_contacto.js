/* Antes: api/log_contacto.php
 *
 * El PHP además creaba una fila en `seguimientos`. Esa tabla no existe en
 * schema_completo.sql, el endpoint que la leía (seguimientos_pendientes.php)
 * no está en el repo, y firmarRespuestaEmail() de db.php no la usa nadie.
 * Es una feature a medio hacer: no se portó. Ver README_SUPABASE.md
 */

import { sql } from "../_lib/db.js";
import { json, cuerpo } from "../_lib/http.js";

const TIPOS_VALIDOS = ["llamada", "whatsapp", "email", "instagram"];

export default async function handler(req, res) {
  const body = cuerpo(req);
  const providerId = (body.provider_id || "").trim();
  const tipo = (body.tipo || "").trim();

  if (!providerId || !TIPOS_VALIDOS.includes(tipo)) return json(res, 200, { ok: true });

  try {
    await sql`INSERT INTO contactos (provider_id, tipo) VALUES (${providerId}, ${tipo})`;
  } catch {
    /* idem */
  }

  json(res, 200, { ok: true });
}
