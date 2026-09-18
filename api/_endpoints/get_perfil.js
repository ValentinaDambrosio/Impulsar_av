/* Antes: api/get_perfil.php */

import { sql, decodificarOficios, decodificarCertificaciones } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { BUCKETS, urlPublica } from "../_lib/archivos.js";

export default async function handler(req, res) {
  const providerId = (req.query.id || "").trim();

  if (!providerId) return error(res, 400, "Falta indicar qué perfil buscar");

  const [trabajador] = await sql`
    SELECT provider_id, nombre, apellido, celular, email, instagram, foto
    FROM trabajadores WHERE provider_id = ${providerId}
  `;

  if (!trabajador) return error(res, 404, "No encontramos ese perfil");

  // El PHP hacía una consulta de media por cada oficio (N+1). Acá van juntas.
  const oficios = await sql`
    SELECT
      o.id, o.rubro, o.oficio, o.certificaciones, o.descripcion,
      COALESCE(
        json_agg(json_build_object('tipo', m.tipo, 'archivo', m.archivo)
                 ORDER BY m.id) FILTER (WHERE m.id IS NOT NULL),
        '[]'
      ) AS media
    FROM oficios o
    LEFT JOIN oficios_media m ON m.oficio_id = o.id
    WHERE o.provider_id = ${providerId}
    GROUP BY o.id
    ORDER BY o.id ASC
  `;

  const [rating] = await sql`
    SELECT AVG(stars) AS promedio, COUNT(*) AS cantidad
    FROM ratings WHERE provider_id = ${providerId}
  `;

  json(res, 200, {
    provider_id: trabajador.provider_id,
    nombre: trabajador.nombre,
    apellido: trabajador.apellido,
    celular: trabajador.celular,
    email: trabajador.email,
    instagram: trabajador.instagram,
    foto: urlPublica(BUCKETS.fotosPerfil, trabajador.foto),
    oficios: oficios.map((o) => ({
      id: o.id,
      rubro: o.rubro,
      oficios: decodificarOficios(o.oficio),
      certificaciones: decodificarCertificaciones(o.certificaciones),
      descripcion: o.descripcion,
      media: o.media.map((m) => ({
        tipo: m.tipo,
        archivo: m.archivo,
        url: urlPublica(
          m.tipo === "video" ? BUCKETS.videosTrabajo : BUCKETS.fotosTrabajo,
          m.archivo
        )
      }))
    })),
    promedio: Math.round(Number(rating?.promedio || 0) * 10) / 10,
    cantidad: Number(rating?.cantidad || 0)
  });
}
