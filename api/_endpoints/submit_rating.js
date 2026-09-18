/* Antes: api/submit_rating.php
 *
 * Arreglo de paso: el PHP usaba $_SERVER["REMOTE_ADDR"] con un
 * UNIQUE (provider_id, ip_address). En Vercel (y detrás de cualquier CDN) eso
 * es la IP del proxy, la misma para todo el mundo, así que el primer voto
 * bloqueaba a todos los demás. ipDelCliente() lee la IP real del header.
 */

import { sql } from "../_lib/db.js";
import { json, error, cuerpo, soloMetodo, ipDelCliente } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const body = cuerpo(req);
  const providerId = (body.provider_id || "").trim();
  const stars = parseInt(body.stars, 10) || 0;

  if (!providerId || stars < 1 || stars > 5) {
    return error(res, 400, "Datos inválidos");
  }

  try {
    await sql`
      INSERT INTO ratings (provider_id, stars, ip_address)
      VALUES (${providerId}, ${stars}, ${ipDelCliente(req)})
    `;
  } catch (e) {
    if (e.code === "23505") {
      return error(res, 409, "Ya calificaste a esta persona antes");
    }
    if (e.code === "23503") {
      // foreign_key_violation: el provider_id no existe
      return error(res, 404, "No encontramos ese perfil");
    }
    console.error("submit_rating:", e);
    return error(res, 500, "No se pudo guardar la reseña");
  }

  const [fila] = await sql`
    SELECT AVG(stars) AS promedio, COUNT(*) AS cantidad
    FROM ratings WHERE provider_id = ${providerId}
  `;

  json(res, 200, {
    promedio: Math.round(Number(fila.promedio) * 10) / 10,
    cantidad: Number(fila.cantidad)
  });
}
