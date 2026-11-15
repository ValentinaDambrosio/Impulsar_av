/* Datos de la cuenta de quien tiene la sesión iniciada.
  Lo usa registro.html: si una persona con cuenta de usuario toca "Registrar servicio", el formulario se completa solo con su nombre, apellido y correo.
  Devuelve únicamente datos de la propia sesión, nunca de otra persona. */

import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return error(res, 405, "Método no permitido");

  const s = leerSesion(req);
  if (!s) return error(res, 401, "No hay sesión activa");

  if (s.tipo === "trabajador") {
    return json(res, 200, { tipo: "trabajador", provider_id: s.id });
  }

  const [u] = await sql`
    SELECT nombre, apellido, email
    FROM usuarios
    WHERE id = ${s.id}
  `;
  if (!u) return error(res, 401, "Tu sesión ya no es válida");

  json(res, 200, { tipo: "usuario", nombre: u.nombre, apellido: u.apellido, email: u.email });
}