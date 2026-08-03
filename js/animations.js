// Animaciones cinemáticas — GSAP + ScrollTrigger.
// Solo se aplican dentro del dashboard; los formularios y listados
// del resto de vistas son instantáneos a propósito.

let heroTriggers = [];
let revealTriggers = [];
let mouseParallaxBound = false;

function killTriggers(list) {
  list.forEach((t) => t.kill());
  list.length = 0;
}

function initHeroMouseParallax() {
  if (mouseParallaxBound || typeof gsap === "undefined") return;
  mouseParallaxBound = true;

  const hero = document.getElementById("hero-parallax");
  const heroBg = document.getElementById("hero-bg");
  if (!hero || !heroBg) return;

  const moveX = gsap.quickTo(heroBg, "x", { duration: 0.9, ease: "power3.out" });
  const moveY = gsap.quickTo(heroBg, "y", { duration: 0.9, ease: "power3.out" });

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    moveX(relX * -18);
    moveY(relY * -12);
  });

  hero.addEventListener("mouseleave", () => {
    moveX(0);
    moveY(0);
  });
}

// El Dashboard se vuelve a renderizar cada vez que llega cualquier
// actualización de Firestore (cuentas, movimientos, préstamos...), no solo
// al entrar en la vista. Sin esta bandera, cada una de esas actualizaciones
// relanzaba las animaciones de entrada (fundido del hero, aparición en
// cascada de las tarjetas) desde cero, dando el efecto de "salto" repetido
// y rapidísimo. Ahora esas animaciones de entrada solo se reproducen una
// vez por carga de página; las siguientes veces el contenido se deja
// directamente en su estado final, sin volver a animar.
let dashboardEnterPlayed = false;

export function initDashboardAnimations() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  killTriggers(heroTriggers);
  killTriggers(revealTriggers);

  const heroBg = document.getElementById("hero-bg");
  const heroContent = document.querySelector("#hero-parallax .hero__content");
  const hero = document.getElementById("hero-parallax");

  if (hero && heroBg) {
    const parallax = gsap.to(heroBg, {
      yPercent: 14,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
    heroTriggers.push(parallax.scrollTrigger);

    if (!dashboardEnterPlayed) {
      gsap.fromTo(
        heroBg,
        { scale: 1.12, opacity: 0.6 },
        { scale: 1.05, opacity: 1, duration: 1.4, ease: "power2.out" }
      );
      if (heroContent) {
        gsap.fromTo(
          heroContent,
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", delay: 0.15 }
        );
      }
    } else {
      gsap.set(heroBg, { scale: 1.05, opacity: 1 });
      if (heroContent) gsap.set(heroContent, { y: 0, opacity: 1 });
    }

    initHeroMouseParallax();
  }

  document.querySelectorAll("#view-dashboard .reveal").forEach((el, i) => {
    if (dashboardEnterPlayed) {
      el.classList.add("is-visible");
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    el.classList.remove("is-visible");
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: (i % 3) * 0.06,
          ease: "power3.out",
        });
      },
    });
    revealTriggers.push(trigger);
  });

  dashboardEnterPlayed = true;
  ScrollTrigger.refresh();
}

export function refreshAnimations() {
  if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
}

// Cuenta un número desde su valor anterior hasta el nuevo, formateando con `format`.
const countState = new WeakMap();

export function countUpTo(el, targetValue, format) {
  if (!el) return;
  const from = countState.get(el) ?? 0;
  countState.set(el, targetValue);

  if (typeof gsap === "undefined") {
    el.textContent = format(targetValue);
    return;
  }

  const obj = { value: from };
  gsap.to(obj, {
    value: targetValue,
    duration: 1,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = format(obj.value);
    },
  });
}

// Anima las barras .progress-fill de 0 al ancho final (ya tienen transition en CSS).
export function animateProgressBars(container) {
  const bars = container.querySelectorAll(".progress-fill[data-target-width]");
  bars.forEach((bar) => {
    bar.style.width = "0%";
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bars.forEach((bar) => {
        bar.style.width = bar.dataset.targetWidth;
      });
    });
  });
}
