/* Calificación por estrellas */

const API_BASE = "api";

function renderStars(promedio) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (promedio >= i) {
      html += '<i class="fas fa-star"></i>';
    } else if (promedio >= i - 0.5) {
      html += '<i class="fas fa-star-half-alt"></i>';
    } else {
      html += '<i class="far fa-star"></i>';
    }
  }
  return html;
}

function pintarCalificacion(card, data) {
  const cantidad = data ? data.cantidad : 0;
  const promedio = data ? data.promedio : 0;

  const contenedor = card.querySelector(".card-rating");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <span class="stars-avg">${renderStars(promedio)}</span>
    <span class="rating-count">${cantidad > 0 ? promedio.toFixed(1) + " (" + cantidad + ")" : "Sin calificar"}</span>
  `;
}

function cargarCalificaciones() {
  fetch(`${API_BASE}/get_ratings`)
    .then((res) => res.json())
    .then((data) => {
      document.querySelectorAll(".directory-card").forEach((card) => {
        const id = card.dataset.id;
        pintarCalificacion(card, data[id] || null);
      });
    })
    .catch((err) => {
      console.error("No se pudieron cargar las calificaciones", err);
      document.querySelectorAll(".directory-card").forEach((card) => pintarCalificacion(card, null));
    });
}

document.addEventListener("DOMContentLoaded", cargarCalificaciones);