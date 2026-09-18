/* Antes: api/login.php */

import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { crearCookie } from "../_lib/sesion.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const body = cuerpo(req);
  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!email || !password) {
    return error(res, 400, "Completá email y contraseña");
  }

  const [trabajador] = await sql`
    SELECT provider_id, nombre, apellido, password_hash
    FROM trabajadores WHERE email = ${email}
  `;

  if (trabajador && await bcrypt.compare(password, trabajador.password_hash)) {
    const nombre = `${trabajador.nombre} ${trabajador.apellido}`;
    crearCookie(res, { tipo: "trabajador", id: trabajador.provider_id, nombre });
    return json(res, 200, { ok: true, tipo: "trabajador", nombre });
  }

  const [usuario] = await sql`
    SELECT id, nombre, apellido, password_hash
    FROM usuarios WHERE email = ${email}
  `;

  if (usuario && await bcrypt.compare(password, usuario.password_hash)) {
    const nombre = `${usuario.nombre} ${usuario.apellido}`;
    crearCookie(res, { tipo: "usuario", id: usuario.id, nombre });
    return json(res, 200, { ok: true, tipo: "usuario", nombre });
  }

  // Un solo mensaje para los dos casos: decir cuál falló le confirmaría a
  // cualquiera qué emails están registrados.
  return error(res, 401, "Email o contraseña incorrectos");
}
