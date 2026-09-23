/* Antes: api/seguimientos_pendientes.php */

import { sql } from "../_lib/db.js";
import { json } from "../_lib/http.js";
import { leerSesion } from "../_lib/sesion.js";
import { armarPreguntaSeguimiento, nombreCompleto } from "../_lib/seguimiento.js";

export default async function handler(req, res) {
  const sesion = leerSesion(req);
  if (!sesion) return json(res, 200, { pendiente: null });

  const habilitados = await seguimientosHabilitados(sesion);
  if (!habilitados) return json(res, 200, { pendiente: null });

  const [seguimiento] = await sql`
    SELECT s.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
    FROM seguimientos s
    JOIN trabajadores t ON t.provider_id = s.provider_id
    WHERE s.contactante_tipo = ${sesion.tipo}
      AND s.contactante_id = ${String(sesion.id)}
      AND s.estado != 'finalizado'
      AND s.proxima_fecha <= now()
    ORDER BY s.proxima_fecha ASC
    LIMIT 1
  `;

  if (!seguimiento) return json(res, 200, { pendiente: null });

  const pregunta = armarPreguntaSeguimiento(seguimiento, nombreCompleto(seguimiento));
  if (!pregunta) return json(res, 200, { pendiente: null });

  json(res, 200, {
    pendiente: {
      seguimiento_id: Number(seguimiento.id),
      provider_id: seguimiento.provider_id,
      pregunta: pregunta.pregunta,
      opciones: pregunta.opciones,
      mostrar_link_perfil: seguimiento.estado === "pendiente_calificacion"
    }
  });
}

async function seguimientosHabilitados(sesion) {
  if (sesion.tipo === "trabajador") {
    const [fila] = await sql`
      SELECT seguimientos_habilitados FROM trabajadores WHERE provider_id = ${sesion.id}
    `;
    return fila?.seguimientos_habilitados !== false;
  }

  const [fila] = await sql`
    SELECT seguimientos_habilitados FROM usuarios WHERE id = ${Number(sesion.id)}
  `;
  return fila?.seguimientos_habilitados !== false;
}
