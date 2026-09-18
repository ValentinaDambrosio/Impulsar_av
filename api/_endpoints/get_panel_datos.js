/* Antes: api/get_panel_datos.php */

import { sql, decodificarOficios, decodificarCertificaciones } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { exigirTrabajador } from "../_lib/sesion.js";
import { BUCKETS, urlPublica } from "../_lib/archivos.js";

export default async function handler(req, res) {
  const sesion = exigirTrabajador(req, res);
  if (!sesion) return;

  const providerId = sesion.id;

  const [trabajador] = await sql`
    SELECT provider_id, nombre, apellido, edad, celular, email, instagram, estudios, foto
    FROM trabajadores WHERE provider_id = ${providerId}
  `;

  if (!trabajador) return error(res, 404, "No encontramos tu perfil");

  // Oficios + su media en una sola consulta (el PHP hacía una por oficio)
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

  /* Las vistas de los últimos 30 días, con los días sin visitas en 0.
     generate_series arma la serie completa de fechas y el LEFT JOIN le pega los
     conteos: en el PHP esto era un GROUP BY más un for() rellenando huecos. */
  const vistasPorDia = await sql`
    SELECT
      to_char(d.dia, 'YYYY-MM-DD') AS fecha,
      COALESCE(v.cantidad, 0)      AS cantidad
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(dia)
    LEFT JOIN (
      SELECT created_at::date AS dia, COUNT(*) AS cantidad
      FROM vistas_perfil
      WHERE provider_id = ${providerId}
        AND created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY created_at::date
    ) v ON v.dia = d.dia
    ORDER BY d.dia ASC
  `;

  const [{ total: vistasTotal }] = await sql`
    SELECT COUNT(*) AS total FROM vistas_perfil WHERE provider_id = ${providerId}
  `;

  const [{ total: contactosTotal }] = await sql`
    SELECT COUNT(*) AS total FROM contactos WHERE provider_id = ${providerId}
  `;

  const porTipo = await sql`
    SELECT tipo, COUNT(*) AS cantidad
    FROM contactos WHERE provider_id = ${providerId}
    GROUP BY tipo
  `;

  const contactosPorTipo = { llamada: 0, whatsapp: 0, email: 0, instagram: 0 };
  for (const f of porTipo) contactosPorTipo[f.tipo] = Number(f.cantidad);

  const vistas = Number(vistasTotal);
  const contactos = Number(contactosTotal);

  json(res, 200, {
    trabajador: {
      ...trabajador,
      foto: urlPublica(BUCKETS.fotosPerfil, trabajador.foto)
    },
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
    estadisticas: {
      vistas_total: vistas,
      vistas_ultimos_30_dias: vistasPorDia.reduce((a, d) => a + Number(d.cantidad), 0),
      vistas_por_dia: vistasPorDia.map((d) => ({ fecha: d.fecha, cantidad: Number(d.cantidad) })),
      contactos_total: contactos,
      contactos_por_tipo: contactosPorTipo,
      cantidad_oficios: oficios.length,
      tasa_contacto: vistas > 0 ? Math.round((contactos / vistas) * 1000) / 10 : 0
    }
  });
}
