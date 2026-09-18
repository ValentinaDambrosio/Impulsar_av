/* Página de perfil */

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function renderStarsReadOnly(promedio) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (promedio >= i) html += '<i class="fas fa-star"></i>';
    else if (promedio >= i - 0.5) html += '<i class="fas fa-star-half-alt"></i>';
    else html += '<i class="far fa-star"></i>';
  }
  return html;
}

function armarUrlInstagram(valor) {
  if (!valor) return null;
  let handle = valor.trim();
  if (handle.startsWith("http")) return handle;
  if (handle.startsWith("@")) handle = handle.slice(1);
  return `https://instagram.com/${handle}`;
}

function armarMediaHtml(item) {
  if (item.tipo === "video") {
    return `
      <div class="media-item media-video" data-src="${item.url}">
        <video muted preload="metadata">
          <source src="${item.url}#t=0.1">
        </video>
        <div class="media-play"><i class="fas fa-play"></i></div>
      </div>`;
  }
  return `
    <div class="media-item">
      <img src="${item.url}" alt="Foto del trabajo" loading="lazy">
    </div>`;
}

function armarOficioSeccion(oficio) {
  const certsAMostrar = oficio.certificaciones.filter((c) => c.trim().toLowerCase() !== "sin certificación");
  const certs = certsAMostrar.length
    ? `<div class="oficio-perfil-certs">${certsAMostrar.map((c) => `<span class="cert-chip">${escapeHtml(c)}</span>`).join("")}</div>`
    : "";

  const descripcion = oficio.descripcion
    ? `<p class="oficio-perfil-descripcion">${escapeHtml(oficio.descripcion)}</p>`
    : "";

  const galeria = oficio.media.length
    ? `<div class="media-gallery">${oficio.media.map(armarMediaHtml).join("")}</div>`
    : "";

  return `
    <div class="oficio-perfil-card">
      <h3>${escapeHtml(oficio.oficios.join(", "))}</h3>
      <span class="oficio-perfil-rubro">${escapeHtml(oficio.rubro)}</span>
      ${certs}
      ${descripcion}
      ${galeria}
    </div>`;
}

function armarPagina(p) {
  const nombreCompleto = escapeHtml(`${p.nombre} ${p.apellido}`);
  const telDigitos = (p.celular || "").replace(/[^0-9]/g, "");
  const urlInstagram = armarUrlInstagram(p.instagram);

  const fotoUrl = p.foto
    ? p.foto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre + " " + p.apellido)}&background=4891ff&color=fff&size=200`;

  const oficiosResumen =
    p.oficios.flatMap((o) => o.oficios.map((nombre) => escapeHtml(nombre))).join(" · ") ||
    "Todavía no cargó un oficio";

  return `
    <div class="perfil-header" data-id="${p.provider_id}">
      <img class="perfil-avatar" src="${fotoUrl}" alt="${nombreCompleto}">

      <div class="perfil-info">
        <h1 class="perfil-nombre">${nombreCompleto}</h1>
        <p class="perfil-oficio-resumen">${oficiosResumen}</p>

        <div class="perfil-rating-row">
          <div class="stars-avg">${renderStarsReadOnly(p.promedio)}</div>
          <span class="rating-count">${p.cantidad > 0 ? p.promedio.toFixed(1) + " · " + p.cantidad + (p.cantidad === 1 ? " reseña" : " reseñas") : "Sin calificar"}</span>
        </div>

        <div class="perfil-contacto">
          <a class="contact-btn contact-call" href="tel:${telDigitos}" aria-label="Llamar"><i class="fas fa-phone"></i></a>
          <a class="contact-btn contact-whatsapp" href="https://wa.me/549${telDigitos}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
          ${urlInstagram ? `<a class="contact-btn contact-instagram" href="${urlInstagram}" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>` : ""}
          <a class="contact-btn contact-email" href="mailto:${encodeURIComponent(p.email)}" aria-label="Email"><i class="fas fa-envelope"></i></a>
        </div>

        <div class="perfil-email-texto">
          <span id="perfilEmailValor">${escapeHtml(p.email)}</span>
          <button type="button" id="btnCopiarEmail" aria-label="Copiar email"><i class="fas fa-copy"></i></button>
        </div>
      </div>

      <div class="perfil-calificar">
        <span class="perfil-calificar-titulo">Calificar</span>
        <div class="rate-stars" id="rateStars">
          <i class="far fa-star" data-value="1"></i>
          <i class="far fa-star" data-value="2"></i>
          <i class="far fa-star" data-value="3"></i>
          <i class="far fa-star" data-value="4"></i>
          <i class="far fa-star" data-value="5"></i>
        </div>
        <button class="btn-enviar" id="btnEnviarReseña" type="button" disabled>Enviar reseña</button>
        <div class="rate-mensaje" id="rateMensaje"></div>
      </div>
    </div>

    <div class="perfil-oficios">
      ${p.oficios.length ? p.oficios.map(armarOficioSeccion).join("") : '<p class="text-center">Esta persona todavía no cargó ningún oficio o servicio.</p>'}
    </div>
  `;
}


function conectarCalificar(providerId) {
  const contenedor = document.getElementById("rateStars");
  const btnEnviar = document.getElementById("btnEnviarReseña");
  const mensaje = document.getElementById("rateMensaje");
  let valorElegido = 0;

  contenedor.addEventListener("click", (e) => {
    const estrella = e.target.closest("i");
    if (!estrella) return;

    if (!Auth.logueado) {
      mostrarModalLogin();
      return;
    }

    valorElegido = parseInt(estrella.dataset.value, 10);

    contenedor.querySelectorAll("i").forEach((star, i) => {
      star.className = i < valorElegido ? "fas fa-star" : "far fa-star";
    });

    btnEnviar.disabled = false;
  });

  btnEnviar.addEventListener("click", () => {
    if (!valorElegido) return;
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";

    fetch("api/submit_rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId, stars: valorElegido })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");
        return data;
      })
      .then((data) => {
        mensaje.textContent = "¡Gracias por tu reseña!";
        mensaje.style.color = "#2a8a4a";
        document.querySelector(".stars-avg").innerHTML = renderStarsReadOnly(data.promedio);
        document.querySelector(".rating-count").textContent =
          data.promedio.toFixed(1) + " · " + data.cantidad + (data.cantidad === 1 ? " reseña" : " reseñas");
      })
      .catch((err) => {
        mensaje.textContent = err.message;
        mensaje.style.color = "#d33";
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar reseña";
      });
  });
}


function conectarCopiarEmail() {
  const boton = document.getElementById("btnCopiarEmail");
  const valor = document.getElementById("perfilEmailValor");
  if (!boton || !valor) return;

  boton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(valor.textContent)
      .then(() => {
        const iconoOriginal = boton.innerHTML;
        boton.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          boton.innerHTML = iconoOriginal;
        }, 1500);
      })
      .catch(() => {
        alert("No se pudo copiar. Podés seleccionar el email a mano.");
      });
  });
}


function conectarVideos() {
  document.querySelectorAll(".media-video").forEach((item) => {
    item.addEventListener("click", () => {
      const src = item.dataset.src;
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.className = "media-video-abierto";
      item.replaceWith(video);
    });
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const contenedor = document.getElementById("perfilContenido");

  if (!id) {
    contenedor.innerHTML = '<p class="text-center" style="margin-top:40px;">Falta indicar qué perfil ver.</p>';
    return;
  }

  fetch(`api/get_perfil?id=${encodeURIComponent(id)}`)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No encontramos ese perfil");
      return data;
    })
    .then((data) => {
      contenedor.innerHTML = armarPagina(data);
      conectarCalificar(data.provider_id);
      conectarCopiarEmail();
      conectarVideos();

      fetch("api/log_vista_perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: data.provider_id })
      }).catch(() => {});
    })
    .catch((err) => {
      contenedor.innerHTML = `<p class="text-center" style="margin-top:40px;">${err.message}</p>`;
    });
});