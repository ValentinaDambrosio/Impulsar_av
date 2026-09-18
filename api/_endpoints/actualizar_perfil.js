/* Antes: api/actualizar_perfil.php */

import { sql } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { exigirTrabajador, crearCookie } from "../_lib/sesion.js";
import { validarTrabajador } from "../_lib/validar.js";
import {
  parsearFormulario, subir, borrar, BUCKETS, TIPOS_FOTO, MAX_FOTO
} from "../_lib/archivos.js";

/* Llegan archivos (multipart): el body se lee crudo con formidable.
   Ver el comentario de api/[ruta].js sobre no tocar req.body antes. */

export default async function handler(req, res) {
  const sesion = exigirTrabajador(req, res);
  if (!sesion) return;

  const providerId = sesion.id;

  let campos, archivos;
  try {
    ({ campos, archivos } = await parsearFormulario(req, { maxBytes: MAX_FOTO }));
  } catch (e) {
    if (/maxFileSize/i.test(e.message || "")) {
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
    estudios: (campos.estudios || "").trim()
  };

  const errores = validarTrabajador(datos, { conPassword: false });
  if (errores.length) return error(res, 400, errores.join(". "));

  // El email no puede estar en uso por otra cuenta (ni trabajador ni usuario)
  const [[otroTrabajador], [otroUsuario]] = await Promise.all([
    sql`SELECT 1 FROM trabajadores WHERE email = ${datos.email} AND provider_id <> ${providerId}`,
    sql`SELECT 1 FROM usuarios WHERE email = ${datos.email}`
  ]);

  if (otroTrabajador || otroUsuario) {
    return error(res, 409, "Ese email ya está en uso por otra cuenta");
  }

  let subida = null;
  const foto = archivos.foto;

  if (foto && foto.size) {
    const ext = TIPOS_FOTO[foto.mimetype];
    if (!ext) return error(res, 400, "La foto tiene que ser JPG, PNG o WEBP");
    if (foto.size > MAX_FOTO) return error(res, 400, "La foto no puede pesar más de 3MB");

    try {
      subida = await subir(BUCKETS.fotosPerfil, foto, ext, providerId);
    } catch (e) {
      console.error("actualizar_perfil (foto):", e);
      return error(res, 500, "No se pudo guardar la foto");
    }
  }

  let fotoAnterior = null;
  try {
    if (subida) {
      const [actual] = await sql`
        SELECT foto FROM trabajadores WHERE provider_id = ${providerId}
      `;
      fotoAnterior = actual?.foto || null;
    }

    await sql`
      UPDATE trabajadores SET
        nombre    = ${datos.nombre},
        apellido  = ${datos.apellido},
        edad      = ${datos.edad},
        celular   = ${datos.celular},
        email     = ${datos.email},
        instagram = ${datos.instagram || null},
        estudios  = ${datos.estudios}
        ${subida ? sql`, foto = ${subida.archivo}` : sql``}
      WHERE provider_id = ${providerId}
    `;
  } catch (e) {
    if (subida) await borrar(BUCKETS.fotosPerfil, subida.archivo);
    if (e.code === "23505") {
      return error(res, 409, "Ese email ya está en uso por otra cuenta");
    }
    console.error("actualizar_perfil:", e);
    return error(res, 500, "No se pudieron guardar los cambios");
  }

  // Recién ahora se borra la foto vieja, con la nueva ya guardada en la base
  if (fotoAnterior) await borrar(BUCKETS.fotosPerfil, fotoAnterior);

  const nombreCompleto = `${datos.nombre} ${datos.apellido}`;
  crearCookie(res, { tipo: "trabajador", id: providerId, nombre: nombreCompleto });

  json(res, 200, {
    ok: true,
    nombre: nombreCompleto,
    foto: subida ? subida.url : null
  });
}
