/* Sesiones. Reemplaza a session_start() y $_SESSION.
 *
 * PHP guardaba la sesión en un archivo del servidor y mandaba una cookie con el
 * ID. En serverless no hay servidor fijo donde guardar ese archivo, así que la
 * sesión viaja entera dentro de la cookie, firmada para que no se pueda falsificar.
 *
 * Se mantienen las tablas y las columnas `password_hash` tal como estaban: las
 * contraseñas que ya existen siguen funcionando sin migrar nada.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const NOMBRE_COOKIE = "impulsar_sesion";
const DURACION_DIAS = 30;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET falta o es muy corto (mínimo 32 caracteres)");
  }
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function firmar(texto) {
  return createHmac("sha256", secreto()).update(texto).digest("base64url");
}

/* Compara en tiempo constante: comparar con === deja filtrar, por el tiempo que
   tarda, cuántos caracteres del principio acertó quien esté probando firmas. */
function firmaValida(texto, firma) {
  const esperada = Buffer.from(firmar(texto));
  const recibida = Buffer.from(String(firma));
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

/* ─────────────── crear y leer la sesión ─────────────── */

export function crearCookie(res, sesion) {
  const datos = { ...sesion, exp: Date.now() + DURACION_DIAS * 24 * 60 * 60 * 1000 };
  const cuerpo = b64url(JSON.stringify(datos));
  const valor = `${cuerpo}.${firmar(cuerpo)}`;

  res.setHeader("Set-Cookie", [
    `${NOMBRE_COOKIE}=${valor}`,
    "Path=/",
    // HttpOnly: que el JavaScript de la página no pueda leerla (XSS)
    "HttpOnly",
    // Secure: que solo viaje por HTTPS
    "Secure",
    // Lax: no se manda en peticiones que vengan de otro sitio (CSRF)
    "SameSite=Lax",
    `Max-Age=${DURACION_DIAS * 24 * 60 * 60}`
  ].join("; "));
}

export function borrarCookie(res) {
  res.setHeader("Set-Cookie",
    `${NOMBRE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

/* Devuelve { tipo, id, nombre } o null. Equivale a leer $_SESSION. */
export function leerSesion(req) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  const par = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NOMBRE_COOKIE}=`));
  if (!par) return null;

  const valor = par.slice(NOMBRE_COOKIE.length + 1);
  const corte = valor.lastIndexOf(".");
  if (corte === -1) return null;

  const cuerpo = valor.slice(0, corte);
  const firma = valor.slice(corte + 1);

  if (!firmaValida(cuerpo, firma)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (!datos.exp || datos.exp < Date.now()) return null;
    return { tipo: datos.tipo, id: datos.id, nombre: datos.nombre };
  } catch {
    return null;
  }
}

/* Equivale al bloque que repetían actualizar_perfil.php, get_panel_datos.php
   y eliminar_oficio.php al principio. Devuelve la sesión o null (y ya respondió). */
export function exigirTrabajador(req, res) {
  const s = leerSesion(req);
  if (!s || s.tipo !== "trabajador") {
    res.status(403).setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Necesitás iniciar sesión como trabajador" }));
    return null;
  }
  return s;
}
