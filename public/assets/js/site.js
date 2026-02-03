const setYear = () => {
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(year);
  });
};

const setupReveal = () => {
  const items = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  const reveal = (el) => el.classList.add("is-visible");

  if (!("IntersectionObserver" in window)) {
    items.forEach(reveal);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  items.forEach((item) => observer.observe(item));
};

document.addEventListener("DOMContentLoaded", () => {
  setYear();
  setupReveal();
});
