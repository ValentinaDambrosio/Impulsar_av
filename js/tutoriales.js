document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".yt-lite[data-id]").forEach((el) => {
    const id = el.dataset.id.trim();
    if (!id) return;

    el.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;

    const reproducir = () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = el.dataset.titulo || "Tutorial de Impulsar";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      el.replaceChildren(iframe);
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
    };

    el.addEventListener("click", reproducir, { once: true });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        reproducir();
      }
    });
  });
});