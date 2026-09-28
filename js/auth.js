/* Autenticaciones */

const Auth = {
  logueado: false,
  tipo: null,
  nombre: null,
  id: null,
  accionPendiente: null,
  listo: null

};


function inyectarModalLogin() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");
  modal.id = "authModal";
  modal.className = "auth-modal-overlay";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="auth-modal">
      <button type="button" class="auth-modal-cerrar" id="authModalCerrar" aria-label="Cerrar">
        <i class="fas fa-times"></i>
      </button>

      <div class="auth-tabs">
        <button type="button" class="auth-tab activo" data-tab="login">Iniciar sesión</button>
        <button type="button" class="auth-tab" data-tab="registro">Crear cuenta</button>
      </div>

      <p class="auth-modal-aviso" id="authAviso">Para calificar o contactar a un trabajador, primero tenés que iniciar sesión.</p>

      <form id="authFormLogin" class="auth-form">
        <div class="form-group">
          <label for="authLoginEmail">Email</label>
          <input type="email" id="authLoginEmail" required>
        </div>
        <div class="form-group">
          <label for="authLoginPassword">Contraseña</label>
          <input type="password" id="authLoginPassword" required>
        </div>
        <div class="form-mensaje" id="authLoginMensaje"></div>
        <button type="submit" class="btn btn-primary btn-block">Iniciar sesión</button>
        <button type="button" class="auth-link-olvide" id="btnMostrarOlvide">¿Olvidaste tu contraseña?</button>
      </form>

      <form id="authFormRegistro" class="auth-form" hidden>
        <div class="form-row">
          <div class="form-group">
            <label for="authRegNombre">Nombre</label>
            <input type="text" id="authRegNombre" required>
          </div>
          <div class="form-group">
            <label for="authRegApellido">Apellido</label>
            <input type="text" id="authRegApellido" required>
          </div>
        </div>
        <div class="form-group">
          <label for="authRegEmail">Email</label>
          <input type="email" id="authRegEmail" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="authRegPassword">Contraseña</label>
            <input type="password" id="authRegPassword" minlength="6" required>
          </div>
          <div class="form-group">
            <label for="authRegPassword2">Repetir contraseña</label>
            <input type="password" id="authRegPassword2" minlength="6" required>
          </div>
        </div>
        <div class="form-mensaje" id="authRegMensaje"></div>
        <button type="submit" class="btn btn-primary btn-block">Crear cuenta</button>
      </form>

      <form id="authFormOlvide" class="auth-form" hidden>
        <p class="auth-modal-aviso">Ingresá tu email y te mandamos un link para elegir una contraseña nueva.</p>
        <div class="form-group">
          <label for="authOlvideEmail">Email</label>
          <input type="email" id="authOlvideEmail" required>
        </div>
        <div class="form-mensaje" id="authOlvideMensaje"></div>
        <button type="submit" class="btn btn-primary btn-block">Enviar link de recuperación</button>
        <button type="button" class="auth-link-olvide" id="btnVolverLogin">Volver a iniciar sesión</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("authModalCerrar").addEventListener("click", ocultarModalLogin);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) ocultarModalLogin();
  });

  // Cambia de pestaña login a crear cuenta
  modal.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      modal.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("activo"));
      tab.classList.add("activo");
      const esLogin = tab.dataset.tab === "login";
      document.getElementById("authFormLogin").hidden = !esLogin;
      document.getElementById("authFormRegistro").hidden = esLogin;
      document.getElementById("authFormOlvide").hidden = true;
      document.getElementById("authAviso").hidden = false;
    });
  });

  document.getElementById("btnMostrarOlvide").addEventListener("click", () => {
    document.getElementById("authFormLogin").hidden = true;
    document.getElementById("authFormOlvide").hidden = false;
    document.getElementById("authAviso").hidden = true;
    modal.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("activo"));
  });

  document.getElementById("btnVolverLogin").addEventListener("click", () => {
    document.getElementById("authFormOlvide").hidden = true;
    document.getElementById("authFormLogin").hidden = false;
    document.getElementById("authAviso").hidden = false;
    modal.querySelector('[data-tab="login"]').classList.add("activo");
  });

  document.getElementById("authFormOlvide").addEventListener("submit", (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("authOlvideMensaje");
    const boton = e.target.querySelector('button[type="submit"]');
    mensaje.textContent = "";
    boton.disabled = true;
    boton.textContent = "Enviando...";

    fetch("api/solicitar_reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("authOlvideEmail").value.trim() })
    })
      .then((res) => res.json())
      .then((data) => {
        mensaje.textContent = data.mensaje;
        mensaje.className = "form-mensaje exito";
        boton.textContent = "Enviado ✓";
      })
      .catch(() => {
        mensaje.textContent = "No se pudo enviar. Probá de nuevo en un momento.";
        mensaje.className = "form-mensaje error";
        boton.disabled = false;
        boton.textContent = "Enviar link de recuperación";
      });
  });

  document.getElementById("authFormLogin").addEventListener("submit", (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("authLoginMensaje");
    mensaje.textContent = "";

    fetch("api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("authLoginEmail").value.trim(),
        password: document.getElementById("authLoginPassword").value
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        return data;
      })
      .then((data) => {
        aplicarSesion(true, data.tipo, data.nombre, data.id);
        ocultarModalLogin();
        ejecutarAccionPendiente();
      })
      .catch((err) => {
        mensaje.textContent = err.message;
        mensaje.className = "form-mensaje error";
      });
  });

  document.getElementById("authFormRegistro").addEventListener("submit", (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("authRegMensaje");
    mensaje.textContent = "";

    const password = document.getElementById("authRegPassword").value;
    const password2 = document.getElementById("authRegPassword2").value;

    if (password !== password2) {
      mensaje.textContent = "Las contraseñas no coinciden.";
      mensaje.className = "form-mensaje error";
      return;
    }

    fetch("api/registro_usuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: document.getElementById("authRegNombre").value.trim(),
        apellido: document.getElementById("authRegApellido").value.trim(),
        email: document.getElementById("authRegEmail").value.trim(),
        password: document.getElementById("authRegPassword").value
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        return data;
      })
      .then((data) => {
        aplicarSesion(true, data.tipo, data.nombre, data.id);
        ocultarModalLogin();
        ejecutarAccionPendiente();
      })
      .catch((err) => {
        mensaje.textContent = err.message;
        mensaje.className = "form-mensaje error";
      });
  });
}

function mostrarModalLogin(accionPendiente) {
  inyectarModalLogin();
  Auth.accionPendiente = accionPendiente || null;
  document.getElementById("authModal").hidden = false;
}

function ocultarModalLogin() {
  const modal = document.getElementById("authModal");
  if (modal) modal.hidden = true;
}

function ejecutarAccionPendiente() {
  if (typeof Auth.accionPendiente === "function") {
    Auth.accionPendiente();
  }
  Auth.accionPendiente = null;
}


function aplicarSesion(logueado, tipo, nombre, id) {
  Auth.logueado = logueado;
  Auth.tipo = tipo || null;
  Auth.nombre = nombre || null;
  Auth.id = id || null;
  actualizarNavbar();
}

function actualizarNavbar() {
  const boton = document.getElementById("navLoginBtn");
  if (!boton) return;

  let wrapper = boton.closest(".nav-user-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "nav-user-wrapper";
    boton.parentNode.insertBefore(wrapper, boton);
    wrapper.appendChild(boton);

    const dropdown = document.createElement("div");
    dropdown.className = "nav-user-dropdown";
    dropdown.id = "navUserDropdown";
    dropdown.innerHTML = `
      ${Auth.tipo === "trabajador" ? '<a href="panel.html"><i class="fas fa-chart-line"></i> Mi panel</a>' : ""}
      <button type="button" id="btnCerrarSesion"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</button>
    `;
    wrapper.appendChild(dropdown);

    dropdown.querySelector("#btnCerrarSesion").addEventListener("click", () => {
      dropdown.classList.remove("activo");
      cerrarSesion();
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) dropdown.classList.remove("activo");
    });
  }

  const dropdown = document.getElementById("navUserDropdown");

  if (Auth.logueado) {
    boton.innerHTML = `<i class="fas fa-user"></i> ${Auth.nombre.split(" ")[0]} <i class="fas fa-chevron-down nav-user-caret"></i>`;
    boton.href = "#";
    boton.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle("activo");
    };
  } else {
    dropdown.classList.remove("activo");
    boton.innerHTML = `<i class="fas fa-user"></i> Iniciar sesión`;
    boton.onclick = (e) => {
      e.preventDefault();
      mostrarModalLogin();
    };
  }
}

function cerrarSesion() {
  fetch("api/logout", { method: "POST" }).then(() => {
    aplicarSesion(false);
    window.location.href = "index.html";
  });
}

function verificarSesion() {
  return fetch("api/session_check")
    .then((res) => res.json())
    .then((data) => {
      aplicarSesion(data.logueado, data.tipo, data.nombre, data.id);
    })
    .catch(() => aplicarSesion(false));
}

/* Bloquea el contactarse con un trabajador para quien no inició sesión */

document.addEventListener("click", (e) => {
  const boton = e.target.closest(".contact-btn");
  if (!boton) return;

  const tarjeta = boton.closest("[data-id]");
  const tipo = ["call", "whatsapp", "instagram", "email"].find((t) => boton.classList.contains(`contact-${t}`));
  if (tarjeta && tipo) {
    fetch("api/log_contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        provider_id: tarjeta.dataset.id,
        tipo: tipo === "call" ? "llamada" : tipo
      })
    }).catch(() => {});
  }

  if (!Auth.logueado) {
    e.preventDefault();
    const destino = boton.href;
    const abrirEnNueva = boton.target === "_blank";
    mostrarModalLogin(() => {
      if (abrirEnNueva) window.open(destino, "_blank");
      else window.location.href = destino;
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  inyectarModalLogin();
  /* Otras páginas (ej. perfil.js) pueden esperar esta promesa para saber
     si el usuario está logueado antes de decidir qué mostrar. */
  Auth.listo = verificarSesion();
});

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    ocultarModalLogin();
  }
});