/* Agrega un ícono de "ojo" a cualquier <input type="password"> de la página
   para mostrar/ocultar lo que se está escribiendo. Funciona solo: no hace
   falta tocar el HTML de cada formulario.

   Si un formulario se inyecta dinámicamente después de que la página ya
   cargó (por ejemplo el modal de login de auth.js), llamar de nuevo a
   window.activarTogglePassword(contenedor) una vez que ese HTML ya esté
   en el DOM. */

function activarTogglePassword(raiz) {
  const alcance = raiz || document;

  alcance.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.toggleListo) return;
    input.dataset.toggleListo = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "password-field-wrapper";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "password-toggle-btn";
    boton.setAttribute("aria-label", "Mostrar contraseña");
    boton.innerHTML = '<i class="fas fa-eye"></i>';
    wrapper.appendChild(boton);

    boton.addEventListener("click", () => {
      const seVaAMostrar = input.type === "password";
      input.type = seVaAMostrar ? "text" : "password";
      boton.innerHTML = seVaAMostrar
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>';
      boton.setAttribute("aria-label", seVaAMostrar ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  });
}

window.activarTogglePassword = activarTogglePassword;

document.addEventListener("DOMContentLoaded", () => activarTogglePassword());
