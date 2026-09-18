/* Antes: api/logout.php */

import { json } from "../_lib/http.js";
import { borrarCookie } from "../_lib/sesion.js";

export default async function handler(req, res) {
  borrarCookie(res);
  json(res, 200, { ok: true });
}
