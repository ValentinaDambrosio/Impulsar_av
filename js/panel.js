/* Panel del trabajador*/

const ETIQUETAS_CONTACTO = {
  llamada: { texto: "Llamadas", icono: "fas fa-phone", clase: "contacto-llamada" },
  whatsapp: { texto: "WhatsApp", icono: "fab fa-whatsapp", clase: "contacto-whatsapp" },
  email: { texto: "Email", icono: "fas fa-envelope", clase: "contacto-email" },
  instagram: { texto: "Instagram", icono: "fab fa-instagram", clase: "contacto-instagram" }
};

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function formatearFechaCorta(fechaIso) {
  const [, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}`;
}


function armarGraficoVistas(vistasPorDia) {
  const contenedor = document.getElementById("graficoVistas");
  const maximo = Math.max(1, ...vistasPorDia.map((v) => v.cantidad));

  contenedor.innerHTML = vistasPorDia
    .map((v) => {
      const alturaPorc = Math.max(4, Math.round((v.cantidad / maximo) * 100));
      return `
        <div class="mini-chart-barra" style="height:${alturaPorc}%" title="${formatearFechaCorta(v.fecha)}: ${v.cantidad} ${v.cantidad === 1 ? "visita" : "visitas"}">
          ${v.cantidad > 0 ? `<span class="mini-chart-valor">${v.cantidad}</span>` : ""}
        </div>`;
    })
    .join("");
}


function armarDesgloseContactos(porTipo, total) {
  const contenedor = document.getElementById("contactosDesglose");

  if (total === 0) {
    contenedor.innerHTML = '<p class="text-center panel-sin-datos">Todavía nadie te contactó desde tu perfil.</p>';
    return;
  }

  contenedor.innerHTML = Object.entries(porTipo)
    .map(([tipo, cantidad]) => {
      const info = ETIQUETAS_CONTACTO[tipo];
      const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
      return `
        <div class="contacto-fila">
          <div class="contacto-fila-etiqueta"><i class="${info.icono}"></i> ${info.texto}</div>
          <div class="contacto-fila-barra-fondo">
            <div class="contacto-fila-barra ${info.clase}" style="width:${porcentaje}%"></div>
          </div>
          <div class="contacto-fila-numero">${cantidad}</div>
        </div>`;
    })
    .join("");
}


function armarMediaMiniHtml(item) {
  if (item.tipo === "video") {
    return `<video class="oficio-card-foto" src="${item.url}" muted></video>`;
  }
  return `<img class="oficio-card-foto" src="${item.url}" alt="Foto del trabajo">`;
}

function armarListaOficios(oficios) {
  const contenedor = document.getElementById("misOficiosLista");

  if (oficios.length === 0) {
    contenedor.innerHTML = '<p class="panel-sin-datos">Todavía no cargaste ningún oficio o servicio.</p>';
    return;
  }

  contenedor.innerHTML = oficios
    .map(
      (o) => `
      <div class="oficio-card" data-oficio-id="${o.id}">
        <div class="oficio-card-info">
          <strong>${escapeHtml(o.oficios.join(", "))}</strong>
          <span class="oficio-card-rubro">${escapeHtml(o.rubro)}</span>
          ${
            o.certificaciones.length > 0
              ? `<span class="oficio-card-certs">${o.certificaciones.map(escapeHtml).join(", ")}</span>`
              : ""
          }
          ${o.descripcion ? `<span class="oficio-card-descripcion">${escapeHtml(o.descripcion)}</span>` : ""}
          ${o.media.length > 0 ? `<div class="oficio-card-media">${o.media.map(armarMediaMiniHtml).join("")}</div>` : ""}
        </div>
        <button type="button" class="oficio-card-quitar" data-id="${o.id}" aria-label="Borrar este oficio">
          <i class="fas fa-trash"></i>
        </button>
      </div>`
    )
    .join("");
}

function conectarBorrarOficios() {
  const contenedor = document.getElementById("misOficiosLista");

  contenedor.addEventListener("click", (e) => {
    const boton = e.target.closest(".oficio-card-quitar");
    if (!boton) return;

    const tarjeta = boton.closest("[data-oficio-id]");
    const oficioId = boton.dataset.id;
    const nombreOficio = tarjeta.querySelector("strong").textContent;

    if (!confirm(`¿Borrar "${nombreOficio}" de tu perfil? Esto no se puede deshacer.`)) return;

    boton.disabled = true;

    fetch("api/eliminar_oficio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oficio_id: oficioId })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo borrar el oficio");
        return data;
      })
      .then(() => {
        tarjeta.remove();
        if (!contenedor.querySelector("[data-oficio-id]")) {
          contenedor.innerHTML = '<p class="panel-sin-datos">Todavía no cargaste ningún oficio o servicio.</p>';
        }
      })
      .catch((err) => {
        alert(err.message);
        boton.disabled = false;
      });
  });
}


function llenarFormulario(t) {
  document.getElementById("nombre").value = t.nombre;
  document.getElementById("apellido").value = t.apellido;
  document.getElementById("edad").value = t.edad;
  document.getElementById("celular").value = t.celular;
  document.getElementById("email").value = t.email;
  document.getElementById("instagram").value = t.instagram || "";
  document.getElementById("estudios").value = t.estudios;

  const preview = document.getElementById("previewFotoActual");
  preview.src = t.foto
    ? t.foto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nombre + " " + t.apellido)}&background=4891ff&color=fff&size=200`;
}


function conectarPreviewFoto() {
  document.getElementById("foto").addEventListener("change", (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    document.getElementById("previewFotoActual").src = URL.createObjectURL(archivo);
  });
}


function conectarFormularioEdicion() {
  const form = document.getElementById("formEditarPerfil");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const mensaje = document.getElementById("editarMensaje");
    const boton = document.getElementById("btnGuardarPerfil");

    mensaje.textContent = "";
    mensaje.className = "form-mensaje";
    boton.disabled = true;
    boton.textContent = "Guardando...";

    const datos = new FormData();
    datos.append("nombre", document.getElementById("nombre").value.trim());
    datos.append("apellido", document.getElementById("apellido").value.trim());
    datos.append("edad", document.getElementById("edad").value);
    datos.append("celular", document.getElementById("celular").value.trim());
    datos.append("email", document.getElementById("email").value.trim());
    datos.append("instagram", document.getElementById("instagram").value.trim());
    datos.append("estudios", document.getElementById("estudios").value);

    const archivoFoto = document.getElementById("foto").files[0];
    if (archivoFoto) datos.append("foto", archivoFoto);

    fetch("api/actualizar_perfil", { method: "POST", body: datos })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron guardar los cambios");
        return data;
      })
      .then(() => {
        mensaje.textContent = "¡Tus datos se guardaron correctamente!";
        mensaje.className = "form-mensaje exito";
        document.getElementById("foto").value = "";
        boton.disabled = false;
        boton.textContent = "Guardar cambios";
      })
      .catch((err) => {
        mensaje.textContent = err.message;
        mensaje.className = "form-mensaje error";
        boton.disabled = false;
        boton.textContent = "Guardar cambios";
      });
  });
}


/* Valida la sesión */
document.addEventListener("DOMContentLoaded", () => {
  const estado = document.getElementById("panelEstado");
  const contenido = document.getElementById("panelContenido");

  fetch("api/session_check")
    .then((res) => res.json())
    .then((sesion) => {
      if (!sesion.logueado || sesion.tipo !== "trabajador") {
        estado.innerHTML = '<p>Esta página es solo para trabajadores registrados. Iniciá sesión con una cuenta de trabajador para verla.</p>';
        return;
      }

      fetch("api/get_panel_datos")
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "No se pudo cargar tu panel");
          return data;
        })
        .then((data) => {
          estado.hidden = true;
          contenido.hidden = false;

          const stats = data.estadisticas;

          document.getElementById("statVistasTotal").textContent = stats.vistas_total;
          document.getElementById("statContactosTotal").textContent = stats.contactos_total;
          document.getElementById("statVistas30").textContent = stats.vistas_ultimos_30_dias;
          document.getElementById("statTasaContacto").textContent = stats.tasa_contacto + "%";

          armarGraficoVistas(stats.vistas_por_dia);
          armarDesgloseContactos(stats.contactos_por_tipo, stats.contactos_total);

          armarListaOficios(data.oficios);
          conectarBorrarOficios();

          llenarFormulario(data.trabajador);
          conectarPreviewFoto();
          conectarFormularioEdicion();

          document.getElementById("linkAgregarOficio").href =
            `registro_oficio.html?id=${encodeURIComponent(data.trabajador.provider_id)}`;

          if (window.location.hash === "#editarPerfilSeccion") {
            document.getElementById("editarPerfilSeccion")
              .scrollIntoView({ behavior: "smooth", block: "start" });
          }
        })
        .catch((err) => {
          estado.hidden = false;
          contenido.hidden = true;
          estado.innerHTML = `<p>${err.message}</p>`;
        });
    })
    .catch(() => {
      estado.innerHTML = '<p>No se pudo verificar tu sesión. Probá recargar la página.</p>';
    });
});