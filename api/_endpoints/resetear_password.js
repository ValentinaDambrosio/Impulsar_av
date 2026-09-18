/* Antes: api/resetear_password.php */

import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo } from "../_lib/http.js";
import { crearCookie } from "../_lib/sesion.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const body = cuerpo(req);
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token || password.length < 6) {
    return error(res, 400, "Completá una contraseña de al menos 6 caracteres");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let datos;

  try {
    datos = await sql.begin(async (tx) => {
      /* FOR UPDATE bloquea la fila hasta que termine la transacción: si llegan
         dos peticiones con el mismo token a la vez, la segunda espera y después
         lo ve como usado. Sin esto, un link se podría usar dos veces. */
      const [reset] = await tx`
        SELECT * FROM password_resets
        WHERE token = ${token} AND usado = false AND expira > now()
        FOR UPDATE
      `;

      if (!reset) return null;

      let persona;
      if (reset.tipo === "trabajador") {
        [persona] = await tx`
          UPDATE trabajadores SET password_hash = ${passwordHash}
          WHERE provider_id = ${reset.identificador}
          RETURNING nombre, apellido
        `;
      } else {
        [persona] = await tx`
          UPDATE usuarios SET password_hash = ${passwordHash}
          WHERE id = ${parseInt(reset.identificador, 10)}
          RETURNING nombre, apellido
        `;
      }

      await tx`UPDATE password_resets SET usado = true WHERE id = ${reset.id}`;

      return { tipo: reset.tipo, identificador: reset.identificador, persona };
    });
  } catch (e) {
    console.error("resetear_password:", e);
    return error(res, 500, "No se pudo actualizar la contraseña");
  }

  if (!datos) {
    return error(res, 400, "El link no es válido o ya venció. Pedí uno nuevo.");
  }

  const id = datos.tipo === "trabajador"
    ? datos.identificador
    : parseInt(datos.identificador, 10);

  crearCookie(res, {
    tipo: datos.tipo,
    id,
    nombre: `${datos.persona.nombre} ${datos.persona.apellido}`
  });

  json(res, 200, { ok: true });
}
