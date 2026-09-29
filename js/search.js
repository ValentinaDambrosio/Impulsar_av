/* Buscador del navbar */

function obtenerOrigenBusqueda() {
  const archivo = location.pathname.split("/").pop() || "index.html";
  const nombres = {
    "index.html": "Inicio",
    "certificaciones.html": "Certificaciones",
    "tutorial.html": "Tutoriales"
  };
  return nombres[archivo] || archivo;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("buscadorServicios");
  if (!input) return;

  let timeoutBusqueda = null;

  input.addEventListener("input", () => {
    const texto = input.value.trim().toLowerCase();

    // index.html
    document.querySelectorAll(".directory-card").forEach((card) => {
      const nombre = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const oficio = card.querySelector(".oficio")?.textContent.toLowerCase() || "";
      const coincide = nombre.includes(texto) || oficio.includes(texto);
      card.style.display = coincide ? "" : "none";
    });

    // certificaciones.html
    document.querySelectorAll(".certif-card").forEach((card) => {
      const institucion = card.querySelector(".certif-card-header h3")?.textContent.toLowerCase() || "";
      const cursos = Array.from(card.querySelectorAll(".curso-chip"))
        .map((chip) => chip.textContent.toLowerCase());
      const coincide = institucion.includes(texto) || cursos.some((curso) => curso.includes(texto));
      card.style.display = coincide ? "" : "none";
    });

    clearTimeout(timeoutBusqueda);
    if (texto.length < 2) return;

    timeoutBusqueda = setTimeout(() => {
      fetch("api/log_busqueda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termino: texto, origen: obtenerOrigenBusqueda() })
      }).catch(() => {});
    }, 600);
  });
});