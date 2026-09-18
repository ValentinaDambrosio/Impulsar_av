/* Antes: api/get_ratings.php */

import { sql } from "../_lib/db.js";
import { json } from "../_lib/http.js";

export default async function handler(req, res) {
  const filas = await sql`
    SELECT provider_id, AVG(stars) AS promedio, COUNT(*) AS cantidad
    FROM ratings
    GROUP BY provider_id
  `;

  const resultado = {};
  for (const f of filas) {
    resultado[f.provider_id] = {
      promedio: Math.round(Number(f.promedio) * 10) / 10,
      cantidad: Number(f.cantidad)
    };
  }

  json(res, 200, resultado);
}
