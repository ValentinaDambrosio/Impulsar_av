/* Antes: api/seguimiento_responder_email.php — página HTML para los links del mail */

import { sql } from "../_lib/db.js";
import { aplicarRespuestaSeguimiento, tokenRespuestaValido, urlDelSitio } from "../_lib/seguimiento.js";

export default async function handler(req, res) {
  const id = Number(req.query?.id || 0);
  const respuesta = String(req.query?.respuesta || "").trim();
  const token = String(req.query?.token || "").trim();
  const sitio = urlDelSitio() || "";

  if (!tokenRespuestaValido(id, respuesta, token)) {
    return paginaSimple(res, sitio, "Link inválido", "Este link no es válido o fue alterado.");
  }

  const [seguimiento] = await sql`SELECT * FROM seguimientos WHERE id = ${id}`;
  if (!seguimiento) {
    return paginaSimple(res, sitio, "No encontrado", "Este seguimiento ya no existe.");
  }

  if (seguimiento.estado === "finalizado") {
    return paginaSimple(res, sitio, "Ya respondido", "Esta pregunta ya fue respondida antes, ¡gracias!");
  }

  const resultado = await aplicarRespuestaSeguimiento(seguimiento, respuesta);
  paginaSimple(res, sitio, resultado.ok ? "¡Listo!" : "Ups", resultado.mensaje);
}

function paginaSimple(res, sitio, titulo, mensaje) {
  const css = sitio ? `${sitio}/css/style.css` : "/css/style.css";
  const home = sitio ? `${sitio}/index.html` : "/index.html";
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapar(titulo)}</title>
    <link rel="stylesheet" href="${css}"></head>
    <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;">
    <div class="form-card" style="max-width:420px;">
        <h1 class="text-lg">${escapar(titulo)}</h1>
        <p>${escapar(mensaje)}</p>
        <a class="btn btn-primary btn-block" style="margin-top:20px;" href="${home}">Volver al sitio</a>
    </div>
    </body></html>`;

  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
