/* Antes: api/registro_usuario.php */

import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { crearCookie } from "../_lib/sesion.js";
import { esEmail, validarNombreApellido } from "../_lib/validar.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const body = cuerpo(req);
  const nombre = (body.nombre || "").trim();
  const apellido = (body.apellido || "").trim();
  const email = (body.email || "").trim();
  const password = body.password || "";

  const errores = [];
  validarNombreApellido(errores, nombre, apellido);
  if (!esEmail(email)) errores.push("Email inválido");
  if (password.length < 6) errores.push("La contraseña tiene que tener al menos 6 caracteres");

  if (errores.length) return error(res, 400, errores.join(". "));

  // Un email no puede estar en las dos tablas
  const [[yaTrabajador], [yaUsuario]] = await Promise.all([
    sql`SELECT 1 FROM trabajadores WHERE email = ${email}`,
    sql`SELECT 1 FROM usuarios WHERE email = ${email}`
  ]);

  if (yaTrabajador || yaUsuario) {
    return error(res, 409, "Ese email ya está registrado. Iniciá sesión o usá otro email.");
  }

  let usuario;
  try {
    [usuario] = await sql`
      INSERT INTO usuarios (nombre, apellido, email, password_hash)
      VALUES (${nombre}, ${apellido}, ${email}, ${await bcrypt.hash(password, 10)})
      RETURNING id
    `;
  } catch (e) {
    // 23505 = unique_violation (el 23000 de MySQL). Puede pasar si dos registros
    // con el mismo email entran a la vez y pasan la consulta de arriba juntos.
    if (e.code === "23505") {
      return error(res, 409, "Ese email ya está registrado");
    }
    console.error("registro_usuario:", e);
    return error(res, 500, "No se pudo crear la cuenta");
  }

  const nombreCompleto = `${nombre} ${apellido}`;
  crearCookie(res, { tipo: "usuario", id: usuario.id, nombre: nombreCompleto });

  json(res, 200, { ok: true, tipo: "usuario", nombre: nombreCompleto });
}
