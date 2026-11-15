/* Formulario de registro Parte 1: datos personales*/

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formRegistro");
  const mensaje = document.getElementById("formMensaje");
  const btn = document.getElementById("btnRegistrar");
  const inputFoto = document.getElementById("foto");
  const previewFoto = document.getElementById("previewFoto");

  // true cuando la persona ya tiene una cuenta de usuario
  let modoUsuario = false;

  /* Validaciones */

  const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/;
  const DOMINIOS_PERMITIDOS = [
    "gmail.com",
    "hotmail.com",
    "hotmail.com.ar",
    "outlook.com",
    "outlook.com.ar",
    "outlook.es",
    "yahoo.com",
    "yahoo.com.ar"
  ];

  function validarNombreApellido(valor) {
    if (valor.trim() === "") return "Este campo es obligatorio";
    if (!SOLO_LETRAS.test(valor)) return "Solo se permiten letras, sin números ni símbolos";
    if (valor.trim().length < 2) return "Muy corto";
    return "";
  }

  function validarEmail(valor) {
    if (valor.trim() === "") return "Este campo es obligatorio";
    const formatoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
    if (!formatoOk) return "El formato del email no es válido";
    const dominio = valor.split("@")[1]?.toLowerCase();
    if (!DOMINIOS_PERMITIDOS.includes(dominio)) {
      return "Usá un email de Gmail, Hotmail, Outlook o Yahoo";
    }
    return "";
  }

  function validarBarrio(valor) {
    if (valor.trim() === "") return "Este campo es obligatorio";
    if (valor.trim().length > 100) return "Muy largo";
    return "";
  }

  function validarCelular(valor) {
    if (valor.trim() === "") return "Este campo es obligatorio";
    if (!/^[0-9\s-]+$/.test(valor)) return "Solo se permiten números y guiones, sin letras ni símbolos";
    const soloDigitos = valor.replace(/[\s-]/g, "");
    if (soloDigitos.length < 8 || soloDigitos.length > 15) return "Ingresá un número de celular válido";
    return "";
  }

  function conectarValidacion(inputId, errorId, validador) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);

    input.addEventListener("input", () => {
      const mensajeError = validador(input.value);
      error.textContent = mensajeError;
      input.classList.toggle("invalido", mensajeError !== "");
    });

    return () => {
      const mensajeError = validador(input.value);
      error.textContent = mensajeError;
      input.classList.toggle("invalido", mensajeError !== "");
      return mensajeError === "";
    };
  }

  const revisarNombre = conectarValidacion("nombre", "errorNombre", validarNombreApellido);
  const revisarApellido = conectarValidacion("apellido", "errorApellido", validarNombreApellido);
  const revisarEmail = conectarValidacion("email", "errorEmail", validarEmail);
  const revisarCelular = conectarValidacion("celular", "errorCelular", validarCelular);
  const revisarBarrio = conectarValidacion("barrio", "errorBarrio", validarBarrio);

  /* Vista previa de la foto */
  inputFoto.addEventListener("change", () => {
    const archivo = inputFoto.files[0];
    if (!archivo) {
      previewFoto.hidden = true;
      return;
    }
    const url = URL.createObjectURL(archivo);
    previewFoto.src = url;
    previewFoto.hidden = false;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    mensaje.textContent = "";
    mensaje.className = "form-mensaje";

    const nombreOk = revisarNombre();
    const apellidoOk = revisarApellido();
    const emailOk = modoUsuario ? true : revisarEmail();
    const celularOk = revisarCelular();
    const barrioOk = revisarBarrio();

    if (!nombreOk || !apellidoOk || !emailOk || !celularOk || !barrioOk) {
      mostrarError("Revisá los campos marcados en rojo antes de continuar.");
      return;
    }

    if (!modoUsuario) {
      const password = document.getElementById("password").value;
      const password2 = document.getElementById("password2").value;

      if (password !== password2) {
        mostrarError("Las contraseñas no coinciden.");
        return;
      }

      if (password.length < 6) {
        mostrarError("La contraseña tiene que tener al menos 6 caracteres.");
        return;
      }
    }

    const archivo = inputFoto.files[0];
    if (archivo && archivo.size > 3 * 1024 * 1024) {
      mostrarError("La foto no puede pesar más de 3MB.");
      return;
    }

    const datos = new FormData(form);

    btn.disabled = true;
    btn.textContent = "Enviando...";

    fetch("api/registro", {
      method: "POST",
      body: datos
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        return data;
      })
      .then((data) => {
        mensaje.textContent = "¡Listo! Ya podés seguir a la Parte 2 para cargar tu oficio.";
        mensaje.className = "form-mensaje exito";
        sessionStorage.setItem("provider_id", data.provider_id);
        mensaje.textContent = "¡Listo! Ahora vamos a cargar tu oficio o servicio...";
        btn.textContent = "Registrado ✓";
        setTimeout(() => {
          window.location.href = `registro_oficio.html?id=${data.provider_id}`;
        }, 1200);
      })
      .catch((err) => {
        mostrarError(err.message);
      });
  });

  function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.className = "form-mensaje error";
    btn.disabled = false;
    btn.textContent = "Continuar a la Parte 2";
  }


  const puerta = document.getElementById("puertaRegistro");
  const tarjetaFormulario = document.getElementById("tarjetaFormulario");

  function mostrarPuerta() {
    tarjetaFormulario.hidden = true;
    puerta.hidden = false;
  }

  function mostrarFormulario() {
    puerta.hidden = true;
    tarjetaFormulario.hidden = false;
  }

  // Completa y bloquea los datos que ya están en la cuenta de usuario
  async function prepararFormularioParaUsuario() {
    const res = await fetch("api/mi_cuenta");
    const cuenta = await res.json();
    if (!res.ok || cuenta.tipo !== "usuario") throw new Error("Sin cuenta de usuario");

    [["nombre", cuenta.nombre], ["apellido", cuenta.apellido], ["email", cuenta.email]].forEach(
      ([id, valor]) => {
        const input = document.getElementById(id);
        input.value = valor;
        input.readOnly = true;
        input.style.background = "#f0f0f2";
        input.style.color = "#666";
        input.style.cursor = "not-allowed";
      }
    );

    document.getElementById("filaPassword").hidden = true;
    ["password", "password2"].forEach((id) => {
      const input = document.getElementById(id);
      input.required = false;
      input.disabled = true;
    });

    document.getElementById("tituloRegistro").textContent = "Completá tus datos para publicar tu servicio";
    document.getElementById("textoRegistro").textContent =
      "Ya tenés una cuenta en Impulsar, así que usamos tu nombre, apellido y correo. Completá el resto y seguí a la Parte 2. La información que cargues aparecerá en tu perfil público.";

    modoUsuario = true;
  }

  async function decidirPaso() {
    try {
      await verificarSesion();
    } catch {
    }

    if (Auth.logueado && Auth.tipo === "trabajador") {
      window.location.replace(`registro_oficio.html?id=${encodeURIComponent(Auth.id)}`);
      return;
    }

    if (Auth.logueado && Auth.tipo === "usuario") {
      try {
        await prepararFormularioParaUsuario();
        mostrarFormulario();
      } catch {
        mostrarPuerta();
      }
      return;
    }

    mostrarPuerta();
  }

  document.getElementById("btnNoTengoCuenta").addEventListener("click", mostrarFormulario);

  document.getElementById("btnYaTengoCuenta").addEventListener("click", () => {
    mostrarModalLogin(
      decidirPaso,
      "Iniciá sesión con tu cuenta para continuar con el registro de tu servicio."
    );
  });

  decidirPaso();
});