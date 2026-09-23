/* Única función serverless del proyecto: reparte cada /api/<ruta> a su endpoint.
 *
 * Por qué una sola: el plan Hobby de Vercel no deja más de 12 funciones por
 * deploy, y los endpoints son más de 12. Vercel ignora las carpetas que empiezan con
 * guion bajo, así que api/_endpoints/ y api/_lib/ son código común y no
 * funciones. Las URLs no cambian: /api/login sigue siendo /api/login.
 *
 * Los imports son estáticos a propósito. Con un import() armado con la ruta,
 * Vercel no sabría qué archivos incluir en el paquete y fallaría recién en
 * producción.
 *
 * Los endpoints que reciben archivos (multipart) leen el stream crudo con
 * formidable. Funciona porque Vercel solo parsea req.body cuando alguien lo lee,
 * y este archivo no lo toca: no agregar acá nada que lea req.body.
 */

import { error } from "./_lib/http.js";

import actualizar_perfil from "./_endpoints/actualizar_perfil.js";
import eliminar_oficio from "./_endpoints/eliminar_oficio.js";
import get_directorio from "./_endpoints/get_directorio.js";
import get_panel_datos from "./_endpoints/get_panel_datos.js";
import get_perfil from "./_endpoints/get_perfil.js";
import get_ratings from "./_endpoints/get_ratings.js";
import guardar_oficios from "./_endpoints/guardar_oficios.js";
import log_busqueda from "./_endpoints/log_busqueda.js";
import log_contacto from "./_endpoints/log_contacto.js";
import log_vista_perfil from "./_endpoints/log_vista_perfil.js";
import login from "./_endpoints/login.js";
import logout from "./_endpoints/logout.js";
import registro from "./_endpoints/registro.js";
import registro_usuario from "./_endpoints/registro_usuario.js";
import resetear_password from "./_endpoints/resetear_password.js";
import session_check from "./_endpoints/session_check.js";
import seguimiento_responder from "./_endpoints/seguimiento_responder.js";
import seguimiento_responder_email from "./_endpoints/seguimiento_responder_email.js";
import seguimientos_para_email from "./_endpoints/seguimientos_para_email.js";
import seguimientos_pendientes from "./_endpoints/seguimientos_pendientes.js";
import solicitar_reset from "./_endpoints/solicitar_reset.js";
import submit_rating from "./_endpoints/submit_rating.js";
import url_subida from "./_endpoints/url_subida.js";

const RUTAS = {
  actualizar_perfil,
  eliminar_oficio,
  get_directorio,
  get_panel_datos,
  get_perfil,
  get_ratings,
  guardar_oficios,
  log_busqueda,
  log_contacto,
  log_vista_perfil,
  login,
  logout,
  registro,
  registro_usuario,
  resetear_password,
  session_check,
  seguimiento_responder,
  seguimiento_responder_email,
  seguimientos_para_email,
  seguimientos_pendientes,
  solicitar_reset,
  submit_rating,
  url_subida
};

export default async function handler(req, res) {
  const ruta = String(req.query.ruta || "");

  // hasOwn y no RUTAS[ruta] a secas: si no, /api/constructor o /api/toString
  // encontrarían algo heredado de Object.prototype
  if (!Object.hasOwn(RUTAS, ruta)) {
    return error(res, 404, "Recurso no encontrado");
  }

  try {
    await RUTAS[ruta](req, res);
  } catch (e) {
    // Lo mismo que hacía PHP con un error no atrapado, pero sin mostrar detalles
    console.error(`[api/${ruta}]`, e);
    if (!res.headersSent) {
      error(res, 500, "Hubo un problema. Probá de nuevo en un momento.");
    }
  }
}
