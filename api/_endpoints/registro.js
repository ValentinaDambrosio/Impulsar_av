/* Antes: api/registro.php — alta de trabajador, parte 1 */

import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { crearCookie } from "../_lib/sesion.js";
import { validarTrabajador, generarSlug } from "../_lib/validar.js";
import {
  parsearFormulario, subir, borrar, BUCKETS, TIPOS_FOTO, MAX_FOTO
} from "../_lib/archivos.js";
import { avisarAMake } from "../_lib/make.js";

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

  const datos = {
    nombre: (campos.nombre || "").trim(),
    apellido: (campos.apellido || "").trim(),
    edad: parseInt(campos.edad || "0", 10),
    celular: (campos.celular || "").trim(),
    email: (campos.email || "").trim(),
    instagram: (campos.instagram || "").trim(),
    estudios: (campos.estudios || "").trim(),
    password: campos.password || ""
  };

  const errores = validarTrabajador(datos, { conPassword: true });
  if (errores.length) return error(res, 400, errores.join(". "));

  // El email no puede estar en ninguna de las dos tablas
  const [[yaTrabajador], [yaUsuario]] = await Promise.all([
    sql`SELECT 1 FROM trabajadores WHERE email = ${datos.email}`,
    sql`SELECT 1 FROM usuarios WHERE email = ${datos.email}`
  ]);

  if (yaTrabajador || yaUsuario) {
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
  const passwordHash = await bcrypt.hash(datos.password, 10);

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
          (provider_id, nombre, apellido, edad, celular, email, instagram,
           estudios, foto, password_hash)
        VALUES
          (${slug}, ${datos.nombre}, ${datos.apellido}, ${datos.edad},
           ${datos.celular}, ${datos.email}, ${datos.instagram || null},
           ${datos.estudios}, ${subida.archivo}, ${passwordHash})
      `;
      guardado = true;
    } catch (e) {
      if (e.code !== "23505") {
        console.error("registro:", e);
        await borrar(BUCKETS.fotosPerfil, subida.archivo);
        return error(res, 500, "No se pudo completar el registro");
      }
      // Puede chocar el provider_id (probamos el siguiente) o el email
      // (alguien se registró en el medio: eso no se reintenta).
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

  crearCookie(res, {
    tipo: "trabajador",
    id: slug,
    nombre: `${datos.nombre} ${datos.apellido}`
  });

  // Antes de responder: en Vercel la función se congela al cerrar la respuesta
  // y lo que quede después no tiene garantía de correr (ver solicitar_reset.js)
  await avisarAMake({
    tipo: "bienvenida",
    email: datos.email,
    nombre: datos.nombre,
    apellido: datos.apellido
  });

  json(res, 200, { ok: true, provider_id: slug });
}
