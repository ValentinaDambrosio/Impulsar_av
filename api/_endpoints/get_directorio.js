/* Antes: api/get_directorio.php
 *
 * El PHP hacía tres consultas y armaba el resultado en memoria. Acá es una sola
 * con JOINs y agregados: es lo que Postgres hace bien y el motivo de quedarse
 * en una base relacional en vez de pasar a documentos.
 */

import { sql, decodificarOficios } from "../_lib/db.js";
import { json } from "../_lib/http.js";
import { BUCKETS, urlPublica } from "../_lib/archivos.js";

export default async function handler(req, res) {
  const filas = await sql`
    SELECT
      t.provider_id, t.nombre, t.apellido, t.celular, t.email, t.instagram, t.foto,
      COALESCE(o.oficios, ARRAY[]::text[]) AS oficios_raw,
      COALESCE(r.promedio, 0)              AS promedio,
      COALESCE(r.cantidad, 0)              AS cantidad
    FROM trabajadores t
    -- INNER JOIN, no LEFT: el PHP descartaba a los que no tenían ningún oficio
    JOIN (
      SELECT provider_id, array_agg(oficio ORDER BY id) AS oficios
      FROM oficios GROUP BY provider_id
    ) o ON o.provider_id = t.provider_id
    LEFT JOIN (
      SELECT provider_id,
             ROUND(AVG(stars)::numeric, 1) AS promedio,
             COUNT(*)                      AS cantidad
      FROM ratings GROUP BY provider_id
    ) r ON r.provider_id = t.provider_id
    ORDER BY t.created_at DESC
  `;

  const resultado = filas.map((f) => ({
    provider_id: f.provider_id,
    nombre: f.nombre,
    apellido: f.apellido,
    celular: f.celular,
    email: f.email,
    instagram: f.instagram,
    foto: urlPublica(BUCKETS.fotosPerfil, f.foto),
    // cada fila de `oficios` puede traer un JSON con varios nombres adentro
    oficios: f.oficios_raw.flatMap(decodificarOficios),
    promedio: Number(f.promedio),
    cantidad: Number(f.cantidad)
  }));

  json(res, 200, resultado);
}
