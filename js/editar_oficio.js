/* Edición de un servicio ya publicado.*/

async function iniciarEdicionOficio(oficioId) {
  const $ = (id) => document.getElementById(id);

  const MAX_FOTOS = 4;
  const MAX_VIDEOS = 1;
  const MAX_FOTO_BYTES = 3 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

  const formulario = $("formularioOficios");
  const mensaje = $("formMensajeOficios");
  const btnGuardar = $("btnFinalizar");
  const inputMedia = $("inputMediaTrabajo");
  const previewMedia = $("previewMediaTrabajo");
  const checksCert = $("checksCertificaciones");

  function avisoYSalida(texto) {
    formulario.innerHTML = `
      <p class="text-center">${texto}</p>
      <a class="btn btn-primary btn-block" href="panel.html" style="margin-top:16px;">Volver a mi panel</a>`;
  }


  let oficio;
  try {
    const res = await fetch("api/get_panel_datos");
    if (res.status === 401 || res.status === 403) {
      return avisoYSalida("Necesitás iniciar sesión como trabajador para editar un servicio.");
    }
    const data = await res.json();
    oficio = (data.oficios || []).find((o) => String(o.id) === String(oficioId));
  } catch {
    return avisoYSalida("No se pudo cargar el servicio. Probá de nuevo en un momento.");
  }
  if (!oficio) return avisoYSalida("No encontramos ese servicio en tu perfil.");


  $("tituloOficio").textContent = "Editar tu servicio";
  $("textoOficio").textContent =
    "Podés cambiar las certificaciones, la descripción y las fotos o videos. El rubro y el oficio no se pueden cambiar: si querés otro, cargá un servicio nuevo.";


  $("selectRubro").closest(".form-group").hidden = true;
  $("grupoOficio").hidden = true;
  $("grupoOficioOtro").hidden = true;
  $("btnAgregarOficio").hidden = true;
  $("oficiosCargados").hidden = true;

  const bloque = document.createElement("div");
  bloque.className = "form-group";
  const etiqueta = document.createElement("label");
  etiqueta.innerHTML = 'Rubro y oficio <span class="opcional">(no se pueden cambiar)</span>';
  const caja = document.createElement("div");
  caja.style.cssText = "background:#f0f0f2;border-radius:12px;padding:12px 16px;color:#555;";
  const candado = document.createElement("i");
  candado.className = "fas fa-lock";
  candado.style.cssText = "margin-right:8px;color:#999;";
  const nombres = document.createElement("strong");
  nombres.textContent = (oficio.oficios || []).join(", ");
  const rubroTxt = document.createElement("div");
  rubroTxt.style.cssText = "font-size:0.82rem;color:#888;margin-top:2px;";
  rubroTxt.textContent = oficio.rubro;
  caja.append(candado, nombres, rubroTxt);
  bloque.append(etiqueta, caja);
  $("grupoCertificaciones").before(bloque);


  const rubroKey = Object.keys(TAXONOMIA).find((k) => TAXONOMIA[k].label === oficio.rubro);
  const rubro = rubroKey ? TAXONOMIA[rubroKey] : null;

  let opciones = [];
  if (rubro && rubro.oficios) {
    const claves = Object.keys(rubro.oficios).filter((k) => oficio.oficios.includes(rubro.oficios[k].label));
    opciones = [
      ...new Set(claves.flatMap((k) => rubro.oficios[k].certificaciones || rubro.certificaciones || []))
    ];
  } else {
    opciones = ["Sin certificación", "Tengo un certificado o curso relacionado"];
  }

  const guardadas = oficio.certificaciones || [];
  guardadas.forEach((c) => {
    if (!opciones.includes(c)) opciones.push(c);
  });

  checksCert.innerHTML = "";
  opciones.forEach((texto) => {
    const label = document.createElement("label");
    label.className = "check-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = texto;
    input.checked = guardadas.includes(texto);
    label.append(input, document.createTextNode(" " + texto));
    checksCert.appendChild(label);
  });
  $("grupoCertificaciones").hidden = false;

  $("inputDescripcion").value = oficio.descripcion || "";


  const existentes = (oficio.media || []).map((m) => ({ ...m }));
  const quitar = new Set();
  let nuevos = [];

  const esVideo = (m) => m.tipo === "video";
  const conservados = () => existentes.filter((m) => !quitar.has(m.archivo));

  function crearMiniatura(src, video, alQuitar) {
    const item = document.createElement("div");
    item.className = "preview-media-item";
    if (video) {
      const v = document.createElement("video");
      v.src = src;
      v.muted = true;
      const play = document.createElement("i");
      play.className = "fas fa-play preview-media-play";
      item.append(v, play);
    } else {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "Vista previa";
      item.appendChild(img);
    }
    const x = document.createElement("button");
    x.type = "button";
    x.className = "preview-media-quitar";
    x.setAttribute("aria-label", "Quitar archivo");
    x.innerHTML = '<i class="fas fa-times"></i>';
    x.addEventListener("click", alQuitar);
    item.appendChild(x);
    return item;
  }

  function dibujarMedia() {
    previewMedia.innerHTML = "";
    conservados().forEach((m) => {
      previewMedia.appendChild(
        crearMiniatura(m.url, esVideo(m), () => {
          quitar.add(m.archivo);
          dibujarMedia();
        })
      );
    });
    nuevos.forEach((f, i) => {
      previewMedia.appendChild(
        crearMiniatura(URL.createObjectURL(f), f.type.startsWith("video/"), () => {
          nuevos.splice(i, 1);
          dibujarMedia();
        })
      );
    });
  }
  dibujarMedia();

  inputMedia.addEventListener("change", () => {
    let mensajeError = "";
    for (const archivo of Array.from(inputMedia.files)) {
      const video = archivo.type.startsWith("video/");
      const fotosYa =
        conservados().filter((m) => !esVideo(m)).length + nuevos.filter((f) => !f.type.startsWith("video/")).length;
      const videosYa =
        conservados().filter(esVideo).length + nuevos.filter((f) => f.type.startsWith("video/")).length;

      if (video && videosYa >= MAX_VIDEOS) {
        mensajeError = "Solo se puede tener 1 video por servicio. Quitá el actual para subir otro.";
        continue;
      }
      if (!video && fotosYa >= MAX_FOTOS) {
        mensajeError = `Podés tener hasta ${MAX_FOTOS} fotos por servicio. Quitá alguna para subir otra.`;
        continue;
      }
      if (archivo.size > (video ? MAX_VIDEO_BYTES : MAX_FOTO_BYTES)) {
        mensajeError = video
          ? `"${archivo.name}" pesa demasiado (máximo 8 MB para el video).`
          : `"${archivo.name}" pesa demasiado (máximo 3 MB por foto).`;
        continue;
      }
      nuevos.push(archivo);
    }
    inputMedia.value = "";
    dibujarMedia();
    if (mensajeError) alert(mensajeError);
  });


  async function leerJson(res) {
    const texto = await res.text();
    let data = {};
    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      if (res.status === 413) throw new Error("Los archivos pesan demasiado. Probá con menos archivos.");
      throw new Error("No se pudo completar el pedido. Probá de nuevo.");
    }
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    return data;
  }

  async function subirArchivo(archivo) {
    const prep = await fetch("api/url_subida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: archivo.type, size: archivo.size })
    }).then(leerJson);

    const put = await fetch(prep.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": prep.contentType || archivo.type },
      body: archivo
    });
    if (!put.ok) throw new Error(`No se pudo subir "${archivo.name}"`);
    return { tipo: prep.tipo, archivo: prep.archivo };
  }

  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar cambios";

  const cancelar = document.createElement("a");
  cancelar.href = "panel.html";
  cancelar.className = "btn btn-block";
  cancelar.style.cssText = "margin-top:12px;text-align:center;";
  cancelar.textContent = "Cancelar";
  btnGuardar.after(cancelar);

  btnGuardar.addEventListener("click", async () => {
    mensaje.textContent = "";
    mensaje.className = "form-mensaje";
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try {
      const subidos = [];
      for (const f of nuevos) subidos.push(await subirArchivo(f));

      const certificaciones = Array.from(checksCert.querySelectorAll("input:checked")).map((c) => c.value);
      const otra = $("inputCertOtra").value.trim();
      if (otra) certificaciones.push(otra);

      await fetch("api/actualizar_oficio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oficio_id: oficio.id,
          certificaciones,
          descripcion: $("inputDescripcion").value.trim(),
          media_nuevos: subidos,
          media_quitar: [...quitar]
        })
      }).then(leerJson);

      mensaje.textContent = "¡Listo! Guardamos los cambios. Te llevamos a tu panel...";
      mensaje.className = "form-mensaje exito";
      setTimeout(() => {
        window.location.href = "panel.html";
      }, 1500);
    } catch (e) {
      mensaje.textContent = e.message;
      mensaje.className = "form-mensaje error";
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar cambios";
    }
  });
}