/* Registro — Parte 2: oficio/servicio */

document.addEventListener("DOMContentLoaded", () => {
  const providerId = obtenerProviderId();

  if (!providerId) {
    document.getElementById("avisoSinId").hidden = false;
    document.getElementById("formularioOficios").hidden = true;
    return;
  }

  const selectRubro = document.getElementById("selectRubro");
  const grupoOficio = document.getElementById("grupoOficio");
  const checksOficios = document.getElementById("checksOficios");
  const grupoOficioOtro = document.getElementById("grupoOficioOtro");
  const inputOficioOtro = document.getElementById("inputOficioOtro");
  const grupoCertificaciones = document.getElementById("grupoCertificaciones");
  const checksCertificaciones = document.getElementById("checksCertificaciones");
  const inputCertOtra = document.getElementById("inputCertOtra");
  const inputDescripcion = document.getElementById("inputDescripcion");
  const inputMediaTrabajo = document.getElementById("inputMediaTrabajo");
  const previewMediaTrabajo = document.getElementById("previewMediaTrabajo");
  const btnAgregarOficio = document.getElementById("btnAgregarOficio");
  const oficiosCargados = document.getElementById("oficiosCargados");
  const btnFinalizar = document.getElementById("btnFinalizar");
  const mensaje = document.getElementById("formMensajeOficios");

  const MAX_FOTOS = 4;
  const MAX_VIDEOS = 1;
  const MAX_FOTO_BYTES = 3 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

  const oficiosAgregados = []; 
  let archivosSeleccionados = []; 



  inputMediaTrabajo.addEventListener("change", () => {
    const nuevos = Array.from(inputMediaTrabajo.files);
    let mensajeError = "";

    const fotosYa = archivosSeleccionados.filter((a) => a.type.startsWith("image/")).length;
    const videosYa = archivosSeleccionados.filter((a) => a.type.startsWith("video/")).length;
    let fotosNuevas = 0;
    let videosNuevos = 0;

    for (const archivo of nuevos) {
      const esVideo = archivo.type.startsWith("video/");
      if (esVideo) {
        if (videosYa + videosNuevos >= MAX_VIDEOS) {
          mensajeError = "Podés subir 1 video por oficio.";
          continue;
        }
      } else if (fotosYa + fotosNuevas >= MAX_FOTOS) {
        mensajeError = `Podés subir hasta ${MAX_FOTOS} fotos por oficio.`;
        continue;
      }

      const limite = esVideo ? MAX_VIDEO_BYTES : MAX_FOTO_BYTES;
      if (archivo.size > limite) {
        mensajeError = esVideo
          ? `"${archivo.name}" pesa demasiado (máximo 8MB para videos).`
          : `"${archivo.name}" pesa demasiado (máximo 3MB para fotos).`;
        continue;
      }
      archivosSeleccionados.push(archivo);
      if (esVideo) videosNuevos++;
      else fotosNuevas++;
    }

    inputMediaTrabajo.value = "";
    renderPreviewMedia();
    if (mensajeError) alert(mensajeError);
  });

  function renderPreviewMedia() {
    previewMediaTrabajo.innerHTML = archivosSeleccionados
      .map((archivo, i) => {
        const esVideo = archivo.type.startsWith("video/");
        const url = URL.createObjectURL(archivo);
        return `
          <div class="preview-media-item">
            ${esVideo
              ? `<video src="${url}" muted></video><i class="fas fa-play preview-media-play"></i>`
              : `<img src="${url}" alt="Vista previa">`
            }
            <button type="button" class="preview-media-quitar" data-index="${i}" aria-label="Quitar archivo">
              <i class="fas fa-times"></i>
            </button>
          </div>`;
      })
      .join("");

    previewMediaTrabajo.querySelectorAll(".preview-media-quitar").forEach((btn) => {
      btn.addEventListener("click", () => {
        archivosSeleccionados.splice(parseInt(btn.dataset.index, 10), 1);
        renderPreviewMedia();
      });
    });
  }


  function obtenerProviderId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || sessionStorage.getItem("provider_id");
  }

  // Si el id vino desde el panel
  const vieneDelPanel = new URLSearchParams(window.location.search).has("id");
  if (vieneDelPanel) {
    document.getElementById("btnFinalizar").textContent = "Guardar y volver a mi panel";
  }


  Object.keys(TAXONOMIA).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = TAXONOMIA[key].label;
    selectRubro.appendChild(opt);
  });


  selectRubro.addEventListener("change", () => {
    const rubro = TAXONOMIA[selectRubro.value];

    checksOficios.innerHTML = "";
    grupoCertificaciones.hidden = true;
    checksCertificaciones.innerHTML = "";
    inputCertOtra.value = "";
    inputOficioOtro.value = "";
    btnAgregarOficio.disabled = true;

    if (!rubro) return;

    if (rubro.oficios === null) {
      grupoOficio.hidden = true;
      grupoOficioOtro.hidden = false;
      grupoCertificaciones.hidden = false;
      renderCertificaciones(["Sin certificación", "Tengo un certificado o curso relacionado"]);
    } else {
      grupoOficio.hidden = false;
      grupoOficioOtro.hidden = true;

      checksOficios.innerHTML = Object.keys(rubro.oficios)
        .map(
          (key) => `
          <label class="check-item">
            <input type="checkbox" value="${key}" data-oficio>
            ${rubro.oficios[key].label}
          </label>`
        )
        .join("");

      checksOficios.querySelectorAll("[data-oficio]").forEach((chk) => {
        chk.addEventListener("change", actualizarCertificacionesCombinadas);
      });
    }

    revisarHabilitarAgregar();
  });


  function actualizarCertificacionesCombinadas() {
    const rubro = TAXONOMIA[selectRubro.value];
    const oficiosElegidos = Array.from(checksOficios.querySelectorAll("[data-oficio]:checked")).map(
      (chk) => chk.value
    );

    if (oficiosElegidos.length === 0) {
      grupoCertificaciones.hidden = true;
      checksCertificaciones.innerHTML = "";
      revisarHabilitarAgregar();
      return;
    }

    const certsUnicas = [
      ...new Set(
        oficiosElegidos.flatMap((key) => rubro.oficios[key].certificaciones || rubro.certificaciones || [])
      )
    ];

    grupoCertificaciones.hidden = false;
    renderCertificaciones(certsUnicas);
    revisarHabilitarAgregar();
  }

  inputOficioOtro.addEventListener("input", revisarHabilitarAgregar);


  function renderCertificaciones(lista) {
    checksCertificaciones.innerHTML = lista
      .map(
        (texto) => `
        <label class="check-item">
          <input type="checkbox" value="${texto}" data-cert>
          ${texto}
        </label>`
      )
      .join("");

    checksCertificaciones.querySelectorAll("[data-cert]").forEach((chk) => {
      chk.addEventListener("change", revisarHabilitarAgregar);
    });
  }


  function revisarHabilitarAgregar() {
    const rubroElegido = selectRubro.value !== "";
    const esOtro = rubroElegido && TAXONOMIA[selectRubro.value].oficios === null;

    let oficioOk;
    if (esOtro) {
      oficioOk = inputOficioOtro.value.trim().length >= 3;
    } else {
      oficioOk = checksOficios.querySelectorAll("[data-oficio]:checked").length > 0;
    }

    btnAgregarOficio.disabled = !(rubroElegido && oficioOk);
  }


  btnAgregarOficio.addEventListener("click", () => {
    const rubroKey = selectRubro.value;
    const rubro = TAXONOMIA[rubroKey];
    const esOtro = rubro.oficios === null;

    const certificaciones = Array.from(
      checksCertificaciones.querySelectorAll("[data-cert]:checked")
    ).map((chk) => chk.value);

    const certOtra = inputCertOtra.value.trim();
    if (certOtra !== "") certificaciones.push(certOtra);

    if (esOtro) {
      oficiosAgregados.push({
        rubro: rubro.label,
        oficios: [inputOficioOtro.value.trim()],
        certificaciones,
        descripcion: inputDescripcion.value.trim(),
        mediaFiles: archivosSeleccionados
      });
    } else {
      const oficiosElegidos = Array.from(checksOficios.querySelectorAll("[data-oficio]:checked")).map(
        (chk) => rubro.oficios[chk.value].label
      );

      oficiosAgregados.push({
        rubro: rubro.label,
        oficios: oficiosElegidos,
        certificaciones,
        descripcion: inputDescripcion.value.trim(),
        mediaFiles: archivosSeleccionados
      });
    }

    renderTarjetas();
    resetearSelectores();
  });


  function resetearSelectores() {
    selectRubro.value = "";
    checksOficios.innerHTML = "";
    grupoOficio.hidden = true;
    grupoOficioOtro.hidden = true;
    grupoCertificaciones.hidden = true;
    inputOficioOtro.value = "";
    checksCertificaciones.innerHTML = "";
    inputCertOtra.value = "";
    inputDescripcion.value = "";
    archivosSeleccionados = [];
    renderPreviewMedia();
    btnAgregarOficio.disabled = true;
  }


  function renderTarjetas() {
    oficiosCargados.innerHTML = oficiosAgregados
      .map(
        (o, i) => `
        <div class="oficio-card">
          <div class="oficio-card-info">
            <strong>${o.oficios.join(", ")}</strong>
            <span class="oficio-card-rubro">${o.rubro}</span>
            ${
              o.certificaciones.length > 0
                ? `<span class="oficio-card-certs">${o.certificaciones.join(", ")}</span>`
                : ""
            }
            ${o.descripcion ? `<span class="oficio-card-descripcion">${o.descripcion}</span>` : ""}
            ${
              o.mediaFiles.length > 0
                ? `<div class="oficio-card-media">${o.mediaFiles
                    .map((archivo) => {
                      const esVideo = archivo.type.startsWith("video/");
                      const url = URL.createObjectURL(archivo);
                      return esVideo
                        ? `<video class="oficio-card-foto" src="${url}" muted></video>`
                        : `<img class="oficio-card-foto" src="${url}" alt="Archivo del trabajo">`;
                    })
                    .join("")}</div>`
                : ""
            }
          </div>
          <button type="button" class="oficio-card-quitar" data-index="${i}" aria-label="Quitar">
            <i class="fas fa-times"></i>
          </button>
        </div>`
      )
      .join("");

    oficiosCargados.querySelectorAll(".oficio-card-quitar").forEach((btn) => {
      btn.addEventListener("click", () => {
        oficiosAgregados.splice(parseInt(btn.dataset.index, 10), 1);
        renderTarjetas();
      });
    });

    btnFinalizar.disabled = oficiosAgregados.length === 0;
  }


  const textoBotonFinalizar = vieneDelPanel ? "Guardar y volver a mi panel" : "Finalizar registro";

  async function leerJson(res) {
    const texto = await res.text();
    let data = {};
    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      if (res.status === 413) {
        throw new Error("Los archivos pesan demasiado. Probá con un video más liviano o menos fotos.");
      }
      throw new Error("No se pudo completar el pedido. Probá de nuevo.");
    }
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    return data;
  }

  async function subirArchivoAStorage(archivo) {
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

  btnFinalizar.addEventListener("click", () => {
    mensaje.textContent = "";
    mensaje.className = "form-mensaje";
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Guardando...";

    (async () => {
      const oficios = [];

      for (const o of oficiosAgregados) {
        const media = [];
        for (let i = 0; i < o.mediaFiles.length; i++) {
          btnFinalizar.textContent = `Subiendo archivo ${i + 1} de ${o.mediaFiles.length}...`;
          media.push(await subirArchivoAStorage(o.mediaFiles[i]));
        }
        oficios.push({
          rubro: o.rubro,
          oficios: o.oficios,
          certificaciones: o.certificaciones,
          descripcion: o.descripcion,
          media
        });
      }

      btnFinalizar.textContent = "Guardando...";

      await fetch("api/guardar_oficios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, oficios })
      }).then(leerJson);

      const destino = vieneDelPanel ? "panel.html" : "index.html";
      mensaje.textContent = vieneDelPanel
        ? "¡Listo! Se agregó a tu perfil. Te llevamos de vuelta a tu panel..."
        : "¡Listo! Tu registro se completó con éxito. Te llevamos al inicio...";
      mensaje.className = "form-mensaje exito";
      sessionStorage.removeItem("provider_id");
      setTimeout(() => {
        window.location.href = destino;
      }, 2000);
    })().catch((err) => {
      mensaje.textContent = err.message;
      mensaje.className = "form-mensaje error";
      btnFinalizar.disabled = false;
      btnFinalizar.textContent = textoBotonFinalizar;
    });
  });
});