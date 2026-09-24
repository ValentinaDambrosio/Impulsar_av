/* Antes: api/seguimientos_para_email.php
 * Lo llama Make todos los días, con ?clave=CRON_SECRET */

import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import {
  armarPreguntaSeguimiento,
  cronAutorizado,
  firmarRespuestaEmail,
  nombreCompleto,
  urlDelSitio
} from "../_lib/seguimiento.js";

export default async function handler(req, res) {
  const clave = req.query?.clave;
  if (!cronAutorizado(clave)) return error(res, 403, "No autorizado");

  const base = urlDelSitio();
  if (!base) return error(res, 500, "Falta SITE_URL");

  const pendientes = await sql`
    SELECT s.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
    FROM seguimientos s
    JOIN trabajadores t ON t.provider_id = s.provider_id
    WHERE s.estado != 'finalizado'
      AND s.proxima_fecha <= now()
      AND s.email_enviado = false
  `;

  const resultado = [];
  const idsAMarcar = [];

  for (const seguimiento of pendientes) {
    const nombreTrabajador = nombreCompleto(seguimiento);
    const pregunta = armarPreguntaSeguimiento(seguimiento, nombreTrabajador);
    if (!pregunta) continue;

    const opciones = pregunta.opciones.map((op) => {
      const token = firmarRespuestaEmail(seguimiento.id, op.valor);
      const link =
        `${base}/api/seguimiento_responder_email` +
        `?id=${seguimiento.id}&respuesta=${encodeURIComponent(op.valor)}&token=${token}`;
      return { texto: op.texto, link };
    });

    resultado.push({
      email: seguimiento.contactante_email,
      nombre: seguimiento.contactante_nombre,
      trabajador: nombreTrabajador,
      pregunta: pregunta.pregunta,
      opciones,
      link_perfil: seguimiento.estado === "pendiente_calificacion"
        ? `${base}/perfil.html?id=${seguimiento.provider_id}`
        : null
    });

    idsAMarcar.push(seguimiento.id);
  }

  if (idsAMarcar.length) {
    await sql`
      UPDATE seguimientos SET email_enviado = true, updated_at = now()
      WHERE id IN ${sql(idsAMarcar)}
    `;
  }

  json(res, 200, resultado);
}
