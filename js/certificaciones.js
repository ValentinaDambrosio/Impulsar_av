const filtrosCosto = document.querySelectorAll("[data-filtro-costo]");
const tarjetasCertificacion = document.querySelectorAll(".certif-card[data-costo]");
const avisoSinResultados = document.getElementById("certifSinResultados");
const botonFiltros = document.getElementById("certifFiltrosToggle");
const panelFiltros = document.getElementById("certifFiltrosPanel");

function cerrarFiltros() {
  panelFiltros.hidden = true;
  botonFiltros.setAttribute("aria-expanded", "false");
}

botonFiltros.addEventListener("click", () => {
  const abierto = botonFiltros.getAttribute("aria-expanded") === "true";
  panelFiltros.hidden = abierto;
  botonFiltros.setAttribute("aria-expanded", String(!abierto));
});

document.addEventListener("click", (evento) => {
  if (!panelFiltros.contains(evento.target) && !botonFiltros.contains(evento.target)) {
    cerrarFiltros();
  }
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !panelFiltros.hidden) {
    cerrarFiltros();
    botonFiltros.focus();
  }
});

function filtrarCertificaciones() {
  const costosSeleccionados = new Set(
    Array.from(filtrosCosto)
      .filter((filtro) => filtro.checked)
      .map((filtro) => filtro.value)
  );
  let tarjetasVisibles = 0;

  tarjetasCertificacion.forEach((tarjeta) => {
    const visible = costosSeleccionados.has(tarjeta.dataset.costo);
    tarjeta.hidden = !visible;
    if (visible) tarjetasVisibles += 1;
  });

  avisoSinResultados.hidden = tarjetasVisibles > 0;
}

filtrosCosto.forEach((filtro) => {
  filtro.addEventListener("change", filtrarCertificaciones);
});

filtrarCertificaciones();