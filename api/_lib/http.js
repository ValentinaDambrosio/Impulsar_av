/* Helpers de request/response, para que los endpoints queden parecidos al PHP. */

/* Equivale a: http_response_code($n); echo json_encode($datos); exit; */
export function json(res, status, datos) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(datos));
}

export function error(res, status, mensaje) {
  json(res, status, { error: mensaje });
}

/* Las funciones de Vercel ya parsean el JSON del body, pero llega string
   cuando el Content-Type no viene o viene raro. */
export function cuerpo(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function soloMetodo(req, res, metodo) {
  if (req.method !== metodo) {
    error(res, 405, "Método no permitido");
    return false;
  }
  return true;
}

/* La IP real de quien pide.
 *
 * El PHP usaba $_SERVER["REMOTE_ADDR"]. En Vercel (y detrás de cualquier CDN)
 * eso es la IP del proxy, igual para todo el mundo — con el UNIQUE de ratings,
 * el primer voto bloqueaba a todos los demás. La IP real viene en el header.
 *
 * x-forwarded-for puede traer una cadena "cliente, proxy1, proxy2": el primero
 * es el cliente. x-real-ip lo pone Vercel y ya viene limpio. */
export function ipDelCliente(req) {
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();

  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();

  return req.socket?.remoteAddress || "0.0.0.0";
}
