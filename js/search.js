/* Buscador del navbar */

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("buscadorServicios");
  if (!input) return;

  let timeoutBusqueda = null;

  input.addEventListener("input", () => {
    const texto = input.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".directory-card");

    cards.forEach((card) => {
      const nombre = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const oficio = card.querySelector(".oficio")?.textContent.toLowerCase() || "";
      const coincide = nombre.includes(texto) || oficio.includes(texto);
      card.style.display = coincide ? "" : "none";
    });

    clearTimeout(timeoutBusqueda);
    if (texto.length < 2) return;

    timeoutBusqueda = setTimeout(() => {
      fetch("api/log_busqueda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termino: texto })
      }).catch(() => {});
    }, 600);
  });
});