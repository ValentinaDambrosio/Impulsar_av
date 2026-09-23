/* Antes: api/log_contacto.php */

import { sql } from "../_lib/db.js";
import { json, cuerpo } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";

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

  try {
    await crearSeguimientoSiCorresponde(req, providerId);
  } catch (e) {
    console.error("[log_contacto] seguimiento", e);
  }

  json(res, 200, { ok: true });
}

async function crearSeguimientoSiCorresponde(req, providerId) {
  const sesion = leerSesion(req);
  if (!sesion) return;

  if (sesion.tipo === "trabajador" && String(sesion.id) === providerId) return;

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM seguimientos
    WHERE provider_id = ${providerId}
      AND contactante_tipo = ${sesion.tipo}
      AND contactante_id = ${String(sesion.id)}
      AND estado != 'finalizado'
  `;
  if (count > 0) return;

  let datos;
  if (sesion.tipo === "trabajador") {
    [datos] = await sql`
      SELECT email, nombre, apellido FROM trabajadores WHERE provider_id = ${sesion.id}
    `;
  } else {
    [datos] = await sql`
      SELECT email, nombre, apellido FROM usuarios WHERE id = ${Number(sesion.id)}
    `;
  }
  if (!datos) return;

  await sql`
    INSERT INTO seguimientos
      (provider_id, contactante_tipo, contactante_id, contactante_email, contactante_nombre, proxima_fecha)
    VALUES
      (${providerId}, ${sesion.tipo}, ${String(sesion.id)}, ${datos.email},
       ${`${datos.nombre} ${datos.apellido}`}, now() + interval '5 days')
  `;
}
