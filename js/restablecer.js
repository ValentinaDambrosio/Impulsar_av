/* Restablecer contraseña */

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const form = document.getElementById("formRestablecer");
  const mensaje = document.getElementById("formMensaje");
  const btn = document.getElementById("btnConfirmar");

  if (!token) {
    document.getElementById("avisoSinToken").hidden = false;
    form.hidden = true;
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    mensaje.textContent = "";
    mensaje.className = "form-mensaje";

    const p1 = document.getElementById("passwordNueva").value;
    const p2 = document.getElementById("passwordNueva2").value;

    if (p1 !== p2) {
      mensaje.textContent = "Las contraseñas no coinciden.";
      mensaje.className = "form-mensaje error";
      return;
    }
    if (p1.length < 6) {
      mensaje.textContent = "La contraseña tiene que tener al menos 6 caracteres.";
      mensaje.className = "form-mensaje error";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";

    fetch("api/resetear_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: p1 })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        return data;
      })
      .then(() => {
        mensaje.textContent = "¡Contraseña actualizada correctamente! Te llevamos al inicio...";
        mensaje.className = "form-mensaje exito";
        form.querySelector("button").disabled = true;
        setTimeout(() => {
          window.location.href = "index.html";
        }, 2000);
      })
      .catch((err) => {
        mensaje.textContent = err.message;
        mensaje.className = "form-mensaje error";
        btn.disabled = false;
        btn.textContent = "Confirmar";
      });
  });
});