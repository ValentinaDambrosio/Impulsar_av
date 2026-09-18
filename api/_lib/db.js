/* Conexión a Postgres. Reemplaza al $pdo de api/db.php. */

import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable de entorno DATABASE_URL");
}

/* prepare:false es obligatorio, no una preferencia.
 *
 * Supabase da dos puertos: 5432 (sesión) y 6543 (transacción, vía pooler).
 * En serverless hay que usar el 6543, porque cada invocación abre y cierra
 * conexiones y el modo sesión las retiene. Pero el pooler en modo transacción
 * NO soporta prepared statements: sin esto, anda en las pruebas y empieza a
 * tirar errores recién cuando hay varias peticiones a la vez. */
export const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

/* La columna `certificaciones` guarda un JSON, pero puede venir mal formada en
   filas viejas. El PHP hacía json_decode(...) ?: [] — nunca reventaba. Con un
   JSON.parse pelado, una sola fila rota tira abajo el perfil entero. */
export function decodificarCertificaciones(valor) {
  try {
    const d = JSON.parse(valor || "[]");
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

/* La columna `oficio` guarda a veces un JSON y a veces un string suelto.
   Misma función que tenía db.php. */
export function decodificarOficios(valor) {
  try {
    const d = JSON.parse(valor);
    return Array.isArray(d) ? d : [valor];
  } catch {
    return [valor];
  }
}
