/* Directorio de los servicios disponibles */

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function armarUrlInstagram(valor) {
  if (!valor) return null;
  let handle = valor.trim();
  if (handle.startsWith("http")) return handle;
  if (handle.startsWith("@")) handle = handle.slice(1);
  return `https://instagram.com/${handle}`;
}

function armarTarjetaPersona(p) {
  const nombreCompleto = escapeHtml(`${p.nombre} ${p.apellido}`);
  const oficioTexto = escapeHtml(p.oficios.join(" · "));
  const telDigitos = (p.celular || "").replace(/[^0-9]/g, "");

  const fotoUrl = p.foto
    ? p.foto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre + " " + p.apellido)}&background=4891ff&color=fff&size=128`;

  const urlInstagram = armarUrlInstagram(p.instagram);
  const botonInstagram = urlInstagram
    ? `<a class="contact-btn contact-instagram" href="${urlInstagram}" target="_blank" rel="noopener" aria-label="Instagram de ${nombreCompleto}"><i class="fab fa-instagram"></i></a>`
    : "";

  return `
    <div class="directory-card" data-id="${p.provider_id}">
        <div class="card-header">
            <img class="card-avatar" src="${fotoUrl}" alt="${nombreCompleto}">
            <div class="card-header-info">
                <h3>${nombreCompleto}</h3>
                <p class="oficio">${oficioTexto}</p>
                <div class="card-rating"></div>
            </div>
        </div>
        <div class="card-contact">
            <a class="contact-btn contact-call" href="tel:${telDigitos}" aria-label="Llamar a ${nombreCompleto}"><i class="fas fa-phone"></i></a>
            <a class="contact-btn contact-whatsapp" href="https://wa.me/549${telDigitos}" target="_blank" rel="noopener" aria-label="WhatsApp de ${nombreCompleto}"><i class="fab fa-whatsapp"></i></a>
            ${botonInstagram}
            <a class="contact-btn contact-email" href="mailto:${encodeURIComponent(p.email)}" aria-label="Email"><i class="fas fa-envelope"></i></a>
        </div>
        <p class="card-perfil-texto">Para más información sobre el trabajador hace click <a class="card-perfil-link" href="perfil.html?id=${p.provider_id}">acá</a></p>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("directoryGrid");
  if (!grid) return;

  fetch("api/get_directorio")
    .then((res) => res.json())
    .then((personas) => {
      if (!Array.isArray(personas) || personas.length === 0) return;

      personas.forEach((p) => {
        grid.insertAdjacentHTML("beforeend", armarTarjetaPersona(p));
      });

      if (typeof cargarCalificaciones === "function") {
        cargarCalificaciones();
      }
    })
    .catch((err) => {
      console.error("No se pudo cargar el directorio real", err);
    });
});