/* Antes: api/solicitar_reset.php */

import { randomBytes } from "node:crypto";
import { sql } from "../_lib/db.js";
import { json, cuerpo, soloMetodo } from "../_lib/http.js";
import { esEmail } from "../_lib/validar.js";
import { avisarAMake } from "../_lib/make.js";

export default async function handler(req, res) {
  if (!soloMetodo(req, res, "POST")) return;

  const email = (cuerpo(req).email || "").trim();

  /* Siempre la misma respuesta, exista o no el email. Si contestáramos distinto,
     cualquiera podría averiguar quién está registrado probando direcciones. */
  const generica = {
    ok: true,
    mensaje: "Si el email está registrado, te llegó un correo con instrucciones."
  };

  if (!esEmail(email)) return json(res, 200, generica);

  const [trabajador] = await sql`
    SELECT provider_id, nombre FROM trabajadores WHERE email = ${email}
  `;

  let tipo = null;
  let identificador = null;
  let nombre = null;

  if (trabajador) {
    tipo = "trabajador";
    identificador = trabajador.provider_id;
    nombre = trabajador.nombre;
  } else {
    const [usuario] = await sql`SELECT id, nombre FROM usuarios WHERE email = ${email}`;
    if (usuario) {
      tipo = "usuario";
      identificador = String(usuario.id);
      nombre = usuario.nombre;
    }
  }

  if (!tipo) return json(res, 200, generica);

  const token = randomBytes(32).toString("hex");

  await sql`
    INSERT INTO password_resets (tipo, identificador, email, token, expira)
    VALUES (${tipo}, ${identificador}, ${email}, ${token}, now() + INTERVAL '1 hour')
  `;

  /* El aviso va ANTES de responder, no después.
     En PHP el script seguía corriendo después del echo; en Vercel la función se
     congela apenas se cierra la respuesta, así que un await posterior no tiene
     garantía de ejecutarse — y este mail es justamente para lo que existe el
     endpoint. avisarAMake ya corta a los 8 segundos. */
  /* El dominio del link NUNCA sale del pedido (header Host / X-Forwarded-Host):
     quien pide el reset puede mandar cualquier valor ahí, y el mail le llega a la
     persona real con un link a un dominio ajeno — si lo abre, el token se filtra.
     Se usa SITE_URL o, si falta, el dominio de producción que informa Vercel. */
  const base = sitioConfiable();
  if (!base) {
    console.error("solicitar_reset: falta SITE_URL, no se manda el mail");
    return json(res, 200, generica);
  }

  await avisarAMake({
    tipo: "recuperar_password",
    email,
    nombre,
    link: `${base}/restablecer.html?token=${token}`
  });

  json(res, 200, generica);
}

function sitioConfiable() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  // Variable de sistema de Vercel: la pone la plataforma, no el pedido
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return null;
}
