/* Antes: api/session_check.php */

import { json } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";

export default async function handler(req, res) {
  const s = leerSesion(req);

  if (!s) return json(res, 200, { logueado: false });

  json(res, 200, { logueado: true, tipo: s.tipo, id: s.id, nombre: s.nombre });
}
