// Animaciones cinemáticas — GSAP + ScrollTrigger.
// Solo se aplican dentro del dashboard; los formularios y listados
// del resto de vistas son instantáneos a propósito.

let heroTriggers = [];
let revealTriggers = [];
let mouseParallaxBound = false;

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

  // Todo lo de aquí abajo (el parallax del scroll ligado a scrub, el fundido
  // de entrada del hero, la aparición en cascada de las tarjetas) se monta
  // UNA sola vez. Antes se recreaba en cada actualización de Firestore
  // (matar y volver a crear el ScrollTrigger con scrub reinicia su
  // transform de golpe), lo que se veía como un salto repetido cada vez
  // que llegaba cualquier dato nuevo. Las siguientes veces no se toca nada.
  if (!dashboardEnterPlayed) {
    dashboardEnterPlayed = true;

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

      initHeroMouseParallax();
    }

    document.querySelectorAll("#view-dashboard .reveal").forEach((el, i) => {
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
  }

  // El refresh se hace fuera de aquí (ver refreshAnimations más abajo): esta
  // función se llama en CADA renderizado del Dashboard —varias veces
  // seguidas nada más abrir la app, una por cada colección de Firestore que
  // llega—, y un refresh() sin más recalcula ahora mismo la posición de
  // TODOS los ScrollTrigger contra un layout que todavía se está asentando
  // (el spinner desaparece, entran las tarjetas, cambian alturas...). Con el
  // parallax del hero ligado a scroll (scrub), cada recálculo lo reajustaba
  // de golpe a la posición "correcta" del momento — eso era el salto rápido
  // y repetido que se veía como si la web tuviera un ataque.
  refreshAnimations();
}

let refreshTimeout = null;

// Agrupa varias llamadas seguidas en un único ScrollTrigger.refresh() tras
// una breve pausa, en vez de recalcular en cada una — así una ráfaga de
// actualizaciones de Firestore (varias en el primer segundo tras abrir la
// app) no dispara ni de lejos tantos recálculos, y el parallax del hero deja
// de "saltar" repetidamente mientras los datos todavía están llegando.
export function refreshAnimations() {
  if (typeof ScrollTrigger === "undefined") return;
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => ScrollTrigger.refresh(), 250);
}

// Cuenta un número desde su valor anterior hasta el nuevo, formateando con
// `format`. Firestore puede disparar varias actualizaciones seguidas nada
// más abrir la app (primero desde caché local, luego confirmadas por el
// servidor, una vez por cada colección) — matar el tween anterior antes de
// lanzar uno nuevo (ver abajo) ya evita que compitan entre sí, pero en un
// móvil real esas actualizaciones pueden seguir llegando sueltas durante
// más de un segundo, y aunque no compitan, cada una relanza una animación
// de un segundo entera — así que el número se sigue viendo "correr" de
// valor en valor. Por eso, además, durante los primeros segundos tras
// cargar la página (mientras los datos todavía se están asentando) el
// número se pone directamente sin animar; solo una vez asentado, los
// cambios futuros (reales, hechos por el usuario) sí se animan.
const ARRANQUE = Date.now();
const VENTANA_ASENTAMIENTO_MS = 2500;

// Compartido con otras animaciones (ej. el redibujado del gráfico de
// categorías en dashboard.js) que tienen el mismo problema: mientras los
// datos de Firestore todavía se están asentando, cualquier transición
// animada se ve "competir" contra la siguiente actualización que llega.
export function estaAsentando() {
  return Date.now() - ARRANQUE < VENTANA_ASENTAMIENTO_MS;
}

const countState = new WeakMap();

export function countUpTo(el, targetValue, format) {
  if (!el) return;
  const prev = countState.get(el);
  const from = prev?.value ?? 0;
  if (prev?.tween) prev.tween.kill();

  if (estaAsentando() || typeof gsap === "undefined") {
    el.textContent = format(targetValue);
    countState.set(el, { value: targetValue, tween: null });
    return;
  }

  const obj = { value: from };
  // `let` en vez de `const` porque onUpdate puede dispararse en el mismo
  // "tick" (según cómo se comporte el ticker de GSAP), antes de que
  // gsap.to() termine de devolver el tween — con `const` eso lanzaría un
  // ReferenceError por leer la variable antes de su inicialización.
  let tween;
  tween = gsap.to(obj, {
    value: targetValue,
    duration: 1,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = format(obj.value);
      countState.set(el, { value: obj.value, tween });
    },
    onComplete: () => {
      countState.set(el, { value: targetValue, tween: null });
    },
  });
  countState.set(el, { value: from, tween });
}

// Anima las barras .progress-fill de 0 al ancho final la primera vez que se
// pintan; en las siguientes llamadas (el Dashboard se vuelve a renderizar
// con cada actualización de Firestore, y #limites-list se regenera entero
// cada vez, así que no hay forma de "recordar" qué barra ya animó por
// identidad de nodo) se deja el ancho final directamente, sin volver a
// forzar 0% — eso era lo que hacía que las barras "parpadearan" a 0 y
// crecieran de nuevo en cada actualización.
let barrasAnimadasUnaVez = false;

export function animateProgressBars(container) {
  const bars = container.querySelectorAll(".progress-fill[data-target-width]");
  if (barrasAnimadasUnaVez) {
    bars.forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
    return;
  }
  barrasAnimadasUnaVez = true;
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
