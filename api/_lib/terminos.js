/* Constancia de aceptación de los Términos y Condiciones.
 *
 * Cada vez que alguien crea una cuenta se guarda: quién (tipo + ID), cuándo
 * (la base pone la fecha y hora del servidor, no la del navegador), desde qué IP
 * y qué versión del texto aceptó. Es el respaldo ante cualquier reclamo.
 *
 * Cuando se modifique terminos.html de fondo, subir VERSION_TERMINOS para poder
 * saber qué texto aceptó cada persona. */

import { ipDelCliente } from "./http.js";

export const VERSION_TERMINOS = "2.1";

// El formulario con archivos (multipart) manda texto; el JSON manda booleano
export function aceptoTerminos(valor) {
  return valor === true || valor === "true" || valor === "on";
}

/* `db` es `sql` o la transacción `tx` de sql.begin */
export async function registrarAceptacion(db, req, cuentaTipo, cuentaId) {
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 300);
  await db`
    INSERT INTO aceptaciones_terminos
      (cuenta_tipo, cuenta_id, version, ip_address, user_agent)
    VALUES
      (${cuentaTipo}, ${String(cuentaId)}, ${VERSION_TERMINOS}, ${ipDelCliente(req)}, ${userAgent})
  `;
}