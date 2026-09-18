/* Las mismas validaciones que hacían registro.php, actualizar_perfil.php y
   registro_usuario.php, en el mismo orden y con los mismos mensajes. */

export const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/;

export const ESTUDIOS_VALIDOS = ["primario", "secundario", "terciario", "universitario"];

export const DOMINIOS_PERMITIDOS = [
  "gmail.com", "hotmail.com", "hotmail.com.ar",
  "outlook.com", "outlook.com.ar", "outlook.es",
  "yahoo.com", "yahoo.com.ar"
];

/* Equivalente a filter_var($email, FILTER_VALIDATE_EMAIL) */
export function esEmail(valor) {
  return typeof valor === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

export function validarNombreApellido(errores, nombre, apellido) {
  if (!nombre || !SOLO_LETRAS.test(nombre) || nombre.length > 100) {
    errores.push("Nombre inválido");
  }
  if (!apellido || !SOLO_LETRAS.test(apellido) || apellido.length > 100) {
    errores.push("Apellido inválido");
  }
}

/* El bloque de validación que compartían registro.php y actualizar_perfil.php */
export function validarTrabajador(d, { conPassword }) {
  const errores = [];

  validarNombreApellido(errores, d.nombre, d.apellido);

  if (d.edad < 16 || d.edad > 99) {
    errores.push("La edad tiene que estar entre 16 y 99 años");
  }

  if (!d.celular || !/^[0-9\s-]+$/.test(d.celular)) {
    errores.push("Número de celular inválido");
  } else {
    const digitos = d.celular.replace(/[\s-]/g, "");
    if (digitos.length < 8 || digitos.length > 15) {
      errores.push("Número de celular inválido");
    }
  }

  if (!esEmail(d.email)) {
    errores.push("Email inválido");
  } else {
    const dominio = d.email.slice(d.email.lastIndexOf("@") + 1).toLowerCase();
    if (!DOMINIOS_PERMITIDOS.includes(dominio)) {
      errores.push("Usá un email de Gmail, Hotmail, Outlook o Yahoo");
    }
  }

  if (!ESTUDIOS_VALIDOS.includes(d.estudios)) errores.push("Estudios inválidos");

  if (conPassword && (!d.password || d.password.length < 6)) {
    errores.push("La contraseña tiene que tener al menos 6 caracteres");
  }

  return errores;
}

/* Misma lógica que generarSlug() de registro.php */
export function generarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
