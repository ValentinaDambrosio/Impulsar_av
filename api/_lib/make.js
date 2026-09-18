/* Avisos a Make (mails de bienvenida y de recuperación de contraseña).
   Es lo mismo que hacía el bloque de curl al final de registro.php y
   solicitar_reset.php, pero la URL ahora es una variable de entorno en vez de
   estar escrita en el código. */

export async function avisarAMake(payload) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;

  try {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 8000); // el CURLOPT_TIMEOUT de antes

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: control.signal
    });

    clearTimeout(corte);
  } catch {
    /* Que no salga el mail no puede romper el registro, que ya quedó guardado.
       El PHP tampoco miraba el resultado del curl. */
  }
}
