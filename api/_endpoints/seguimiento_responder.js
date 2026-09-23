/* Antes: api/seguimiento_responder.php */

import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";
import { aplicarRespuestaSeguimiento } from "../_lib/seguimiento.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const sesion = leerSesion(req);
  if (!sesion) return error(res, 401, "No hay sesión activa");

  const body = cuerpo(req);
  const seguimientoId = Number(body.seguimiento_id || 0);
  const respuesta = String(body.respuesta || "").trim();

  const [seguimiento] = await sql`SELECT * FROM seguimientos WHERE id = ${seguimientoId}`;

  if (
    !seguimiento ||
    seguimiento.contactante_tipo !== sesion.tipo ||
    String(seguimiento.contactante_id) !== String(sesion.id)
  ) {
    return error(res, 404, "No encontramos ese seguimiento");
  }

  const resultado = await aplicarRespuestaSeguimiento(seguimiento, respuesta);
  json(res, resultado.ok ? 200 : 400, resultado);
}
