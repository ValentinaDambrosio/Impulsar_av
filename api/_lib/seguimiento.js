/* Lógica compartida del seguimiento post-contacto.
 * Antes: api/seguimiento_logica.php + firmarRespuestaEmail() de db.php */

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "./db.js";

export function armarPreguntaSeguimiento(seguimiento, nombreTrabajador) {
  switch (seguimiento.estado) {
    case "pendiente_contacto":
      return {
        pregunta: `¿Pudiste hablar y concretar con ${nombreTrabajador}?`,
        opciones: [
          { valor: "si", texto: "Sí" },
          { valor: "no", texto: "No" }
        ]
      };
    case "pendiente_trabajo":
      return {
        pregunta: `¿Ya se realizó el trabajo con ${nombreTrabajador}?`,
        opciones: [
          { valor: "si", texto: "Sí" },
          { valor: "no", texto: "Todavía no" }
        ]
      };
    case "pendiente_calificacion":
      return {
        pregunta: `¡No te olvides de calificar a ${nombreTrabajador}!`,
        opciones: [
          { valor: "calificado", texto: "Ya lo califiqué" },
          { valor: "todavia_no", texto: "Todavía no" },
          { valor: "no_molestar", texto: "No quiero recibir más estos mensajes" }
        ]
      };
    default:
      return null;
  }
}

export async function aplicarRespuestaSeguimiento(seguimiento, respuesta) {
  const estado = seguimiento.estado;

  if (estado === "pendiente_contacto") {
    if (respuesta === "si") {
      await actualizarSeguimiento(seguimiento.id, "pendiente_trabajo", 12);
      return { ok: true, mensaje: "¡Genial! En unos días te preguntamos cómo salió el trabajo." };
    }
    if (respuesta === "no") {
      await finalizarSeguimiento(seguimiento.id);
      return { ok: true, mensaje: "Gracias por avisarnos. No te vamos a molestar más por este contacto." };
    }
  }

  if (estado === "pendiente_trabajo") {
    if (respuesta === "si") {
      await actualizarSeguimiento(seguimiento.id, "pendiente_calificacion", 0);
      return { ok: true, mensaje: "¡Buenísimo! Te dejamos el link para que lo califiques." };
    }
    if (respuesta === "no") {
      await actualizarSeguimiento(seguimiento.id, "pendiente_trabajo", 10);
      return { ok: true, mensaje: "Bueno, te preguntamos de nuevo en unos días." };
    }
  }

  if (estado === "pendiente_calificacion") {
    if (respuesta === "calificado") {
      await finalizarSeguimiento(seguimiento.id);
      return { ok: true, mensaje: "¡Gracias por calificar! No te vamos a molestar más por este contacto." };
    }
    if (respuesta === "todavia_no") {
      await actualizarSeguimiento(seguimiento.id, "pendiente_calificacion", 10);
      return { ok: true, mensaje: "Sin problema, te lo recordamos en unos días." };
    }
    if (respuesta === "no_molestar") {
      await desactivarSeguimientosDelUsuario(seguimiento.contactante_tipo, seguimiento.contactante_id);
      await finalizarSeguimiento(seguimiento.id);
      return { ok: true, mensaje: "Listo, no te vamos a mandar más este tipo de mensajes." };
    }
  }

  return { ok: false, mensaje: "Esa respuesta no es válida para el estado actual." };
}

async function actualizarSeguimiento(id, nuevoEstado, dias) {
  if (dias === 0) {
    await sql`
      UPDATE seguimientos
      SET estado = ${nuevoEstado}, proxima_fecha = now(), email_enviado = false, updated_at = now()
      WHERE id = ${id}
    `;
    return;
  }

  await sql`
    UPDATE seguimientos
    SET estado = ${nuevoEstado},
        proxima_fecha = now() + (${dias}::int * interval '1 day'),
        email_enviado = false,
        updated_at = now()
    WHERE id = ${id}
  `;
}

async function finalizarSeguimiento(id) {
  await sql`
    UPDATE seguimientos
    SET estado = 'finalizado', updated_at = now()
    WHERE id = ${id}
  `;
}

async function desactivarSeguimientosDelUsuario(tipo, id) {
  if (tipo === "trabajador") {
    await sql`UPDATE trabajadores SET seguimientos_habilitados = false WHERE provider_id = ${id}`;
    return;
  }
  await sql`UPDATE usuarios SET seguimientos_habilitados = false WHERE id = ${Number(id)}`;
}

export function firmarRespuestaEmail(seguimientoId, respuesta) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) throw new Error("CRON_SECRET falta");
  return createHmac("sha256", secreto).update(`${seguimientoId}:${respuesta}`).digest("hex");
}

export function tokenRespuestaValido(seguimientoId, respuesta, token) {
  if (!process.env.CRON_SECRET || !token) return false;
  const esperada = Buffer.from(firmarRespuestaEmail(seguimientoId, respuesta));
  const recibida = Buffer.from(String(token));
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

export function cronAutorizado(clave) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || clave == null) return false;
  const a = Buffer.from(String(secreto));
  const b = Buffer.from(String(clave));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function urlDelSitio() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return null;
}

export function nombreCompleto(fila) {
  return `${fila.trabajador_nombre} ${fila.trabajador_apellido}`;
}
