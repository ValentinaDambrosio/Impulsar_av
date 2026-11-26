/* Antes: api/registro.php — alta de trabajador, parte 1 */

import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { crearCookie, leerSesion } from "../_lib/sesion.js";
import { validarTrabajador, generarSlug } from "../_lib/validar.js";
import {
  parsearFormulario, subir, borrar, BUCKETS, TIPOS_FOTO, MAX_FOTO
} from "../_lib/archivos.js";
import { avisarAMake } from "../_lib/make.js";
import { aceptoTerminos, registrarAceptacion } from "../_lib/terminos.js";

/* Llegan archivos (multipart): el body se lee crudo con formidable.
   Ver el comentario de api/[ruta].js sobre no tocar req.body antes. */

export default async function handler(req, res) {
  if (req.method !== "POST") return error(res, 405, "Método no permitido");

  let campos, archivos;
  try {
    ({ campos, archivos } = await parsearFormulario(req, { maxBytes: MAX_FOTO }));
  } catch (e) {
    if (e.code === "LIMIT_FILE_SIZE" || /maxFileSize/i.test(e.message || "")) {
      return error(res, 400, "La foto no puede pesar más de 3MB");
    }
    return error(res, 400, "No se pudo leer el formulario");
  }

  /* ¿Ya tiene sesión? Se resuelve acá y no en el navegador, que se puede alterar.
   *  - Trabajador: ya tiene su cuenta; lo único que le falta es cargar oficios.
   *  - Usuario: se "promueve" su cuenta a trabajador. Nombre, apellido, correo y
   *    contraseña se toman de la cuenta que ya tiene (lo que venga en el formulario
   *    para esos campos se ignora) y solo se piden los datos que le faltan. */
  const sesion = leerSesion(req);

  if (sesion?.tipo === "trabajador") {
    return error(res, 409, "Ya tenés una cuenta de trabajador. Podés cargar tus oficios desde la Parte 2.");
  }

  let usuario = null;
  if (sesion?.tipo === "usuario") {
    [usuario] = await sql`
      SELECT id, nombre, apellido, email, password_hash, seguimientos_habilitados
      FROM usuarios
      WHERE id = ${sesion.id}
    `;
    if (!usuario) return error(res, 401, "Tu sesión ya no es válida. Volvé a iniciar sesión.");
  }

  const datos = {
    nombre: usuario ? usuario.nombre : (campos.nombre || "").trim(),
    apellido: usuario ? usuario.apellido : (campos.apellido || "").trim(),
    edad: parseInt(campos.edad || "0", 10),
    celular: (campos.celular || "").trim(),
    email: usuario ? usuario.email : (campos.email || "").trim(),
    barrio: (campos.barrio || "").trim(),
    instagram: (campos.instagram || "").trim(),
    estudios: (campos.estudios || "").trim(),
    password: campos.password || ""
  };

  const errores = validarTrabajador(datos, { conPassword: !usuario, conDominio: !usuario });
  if (!aceptoTerminos(campos.acepta_terminos)) errores.push("Tenés que aceptar los Términos y Condiciones");
  if (errores.length) return error(res, 400, errores.join(". "));

  const [[yaTrabajador], [yaUsuario]] = await Promise.all([
    sql`SELECT 1 FROM trabajadores WHERE email = ${datos.email}`,
    sql`SELECT 1 FROM usuarios WHERE email = ${datos.email}`
  ]);

  if (yaTrabajador || (yaUsuario && !usuario)) {
    return error(res, 409, "Ese email ya está registrado. Iniciá sesión o usá otro email.");
  }

  const foto = archivos.foto;
  if (!foto || !foto.size) return error(res, 400, "Falta la foto de perfil");

  const ext = TIPOS_FOTO[foto.mimetype];
  if (!ext) return error(res, 400, "La foto tiene que ser JPG, PNG o WEBP");
  if (foto.size > MAX_FOTO) return error(res, 400, "La foto no puede pesar más de 3MB");

  /* Slug único.
   *
   * El PHP consultaba si existía y después insertaba: entre esas dos cosas, dos
   * registros simultáneos con el mismo nombre podían quedarse con el mismo slug.
   * Acá el INSERT es el que decide — provider_id es UNIQUE — y si choca (23505)
   * se reintenta con el sufijo siguiente. La base no deja que se pisen. */
  const base = generarSlug(`${datos.nombre}-${datos.apellido}`) || "trabajador";
  const passwordHash = usuario
    ? usuario.password_hash // misma contraseña que ya tenía
    : await bcrypt.hash(datos.password, 10);

  let subida = null;
  try {
    subida = await subir(BUCKETS.fotosPerfil, foto, ext, base);
  } catch (e) {
    console.error("registro (foto):", e);
    return error(res, 500, "No se pudo guardar la foto");
  }

  let slug = base;
  let guardado = false;

  for (let intento = 1; intento <= 50 && !guardado; intento++) {
    try {
      await sql`
        INSERT INTO trabajadores
          (provider_id, nombre, apellido, edad, celular, email, barrio, instagram,
           estudios, foto, password_hash)
        VALUES
          (${slug}, ${datos.nombre}, ${datos.apellido}, ${datos.edad},
           ${datos.celular}, ${datos.email}, ${datos.barrio}, ${datos.instagram || null},
           ${datos.estudios}, ${subida.archivo}, ${passwordHash})
      `;
      guardado = true;
    } catch (e) {
      if (e.code !== "23505") {
        console.error("registro:", e);
        await borrar(BUCKETS.fotosPerfil, subida.archivo);
        return error(res, 500, "No se pudo completar el registro");
      }
      if (e.constraint_name?.includes("email") || e.detail?.includes("email")) {
        await borrar(BUCKETS.fotosPerfil, subida.archivo);
        return error(res, 409, "Ese email ya está registrado");
      }
      slug = `${base}-${intento + 1}`;
    }
  }

  if (!guardado) {
    await borrar(BUCKETS.fotosPerfil, subida.archivo);
    return error(res, 500, "No se pudo generar un identificador para tu perfil");
  }

  try {
    await registrarAceptacion(sql, req, "trabajador", slug);
  } catch (e) {
    console.error("registro (constancia de términos):", slug, e);
  }

  if (usuario) {
    try {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE trabajadores
          SET seguimientos_habilitados = ${usuario.seguimientos_habilitados}
          WHERE provider_id = ${slug}
        `;
        await tx`
          UPDATE seguimientos
          SET contactante_tipo = 'trabajador', contactante_id = ${slug}
          WHERE contactante_tipo = 'usuario' AND contactante_id = ${String(usuario.id)}
        `;
        await tx`DELETE FROM usuarios WHERE id = ${usuario.id}`;
      });
    } catch (e) {
      console.error("registro (promoción de usuario a trabajador):", e);
    }
  }

  crearCookie(res, {
    tipo: "trabajador",
    id: slug,
    nombre: `${datos.nombre} ${datos.apellido}`
  });

  // Antes de responder: en Vercel la función se congela al cerrar la respuesta
  // y lo que quede después no tiene garantía de correr (ver solicitar_reset.js)
  await avisarAMake({
    tipo: "bienvenida",
    cuenta: "trabajador",
    email: datos.email,
    nombre: datos.nombre,
    apellido: datos.apellido
  });

  json(res, 200, { ok: true, provider_id: slug });
}