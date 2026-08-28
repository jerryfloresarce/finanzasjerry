// Animaciones cinemáticas — GSAP + ScrollTrigger.
// Solo se aplican dentro del dashboard; los formularios y listados
// del resto de vistas son instantáneos a propósito.

import { destelloEnNumero } from "./efectos.js?v=75";

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

      // Solo se funde la opacidad, sin escalar ni desplazar nada: antes el
      // fondo hacía un zoom (1.12 → 1.05) y el contenido subía 28px justo
      // en el momento en que llegaban los datos, así que se juntaba con el
      // resto de animaciones y daba la sensación de que la pantalla entera
      // se movía. Un fundido no desplaza nada de sitio.
      gsap.fromTo(heroBg, { opacity: 0.6 }, { opacity: 1, duration: 0.9, ease: "power2.out" });
      if (heroContent) {
        gsap.fromTo(heroContent, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" });
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
          // Igual que el hero: solo opacidad, sin desplazamiento vertical ni
          // escalonado. La cascada de tarjetas subiendo de 24px una tras
          // otra era la otra mitad de la sensación de "la página se mueve
          // muchísimo" al terminar de cargar.
          gsap.to(el, { opacity: 1, duration: 0.5, ease: "power2.out" });
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
// `format`. Firestore puede disparar varias actualizaciones seguidas para
// un mismo cambio (primero desde caché local, luego confirmada por el
// servidor) — matar el tween anterior antes de lanzar uno nuevo (ver abajo)
// evita que compitan entre sí, pero en un móvil real esas actualizaciones
// pueden llegar separadas por más de medio segundo (justo el margen que
// agrupa notify() en store.js), así que a veces igual llegan como DOS
// renderizados sueltos y cada uno relanza su propia animación de un
// segundo — eso es lo que se seguía viendo como "epilepsia" bastante
// después de abrir la app, no solo al arrancar: cualquier modificación
// (editar/borrar/marcar algo) dispara la misma ráfaga.
//
// En vez de solo proteger los primeros segundos tras cargar la página, se
// detecta una ráfaga por RECENCIA: si este renderizado del Dashboard llega
// a menos de VENTANA_RAFAGA_MS del anterior, se trata como parte de la
// misma ráfaga y se aplica sin animar (da igual si es el primero, el
// segundo o el enésimo de esa ráfaga). Solo cuando un renderizado llega
// aislado — de verdad separado en el tiempo del anterior, como una acción
// suelta del usuario mucho después — se anima.
const VENTANA_RAFAGA_MS = 1200;
let ultimoPase = 0;
let esteEsRafaga = true;

// Debe llamarse UNA vez al principio de cada renderizado (antes de
// countUpTo/renderChart), para fijar si este pase concreto cuenta como parte
// de una ráfaga reciente. estaAsentando() solo lee ese resultado ya
// calculado durante el resto del mismo pase.
export function iniciarPaseDeRender() {
  const ahora = Date.now();
  esteEsRafaga = ahora - ultimoPase < VENTANA_RAFAGA_MS;
  ultimoPase = ahora;
}

// Compartido con otras animaciones (ej. el redibujado del gráfico de
// categorías en dashboard.js) que tienen el mismo problema.
export function estaAsentando() {
  return esteEsRafaga;
}

const countState = new WeakMap();

// Escribe un número dejando que cada CIFRA ocupe siempre lo mismo.
//
// Fraunces —como casi toda tipografía de titular— dibuja el 1 mucho más
// estrecho que el 0: medido en el propio archivo de la fuente, 1024 frente a
// 1461 unidades. Con un número quieto da igual. Pero el saldo se ANIMA al
// cambiar, y durante ese segundo pasa por sesenta cifras distintas: el ancho
// del texto cambia en cada fotograma y el número entero tiembla de lado a
// lado. Medido antes de esto: 55 saltos en 63 fotogramas, de hasta 13 px.
//
// Lo normal sería pedirle a la fuente sus dígitos de ancho fijo con
// "font-variant-numeric: tabular-nums" (está puesto en el CSS y ayuda a
// quien use otra fuente), pero Fraunces NO los trae: no hay nada a lo que
// cambiar. Así que la caja se la ponemos nosotros: cada cifra dentro de un
// hueco del ancho de un "0". Los separadores y el símbolo de la moneda se
// quedan como están, que no cambian nunca.
//
// Se usa también cuando NO se anima, a propósito: si solo se usara durante
// la animación, al terminar el número se recolocaría de golpe y se vería un
// último salto, que es justo lo que se quería quitar.
function pintarNumero(el, texto) {
  const cifras = [...texto];
  const trozos = el.__trozosNumero;

  // Si ya está pintado con esta misma forma, solo se cambian las cifras que
  // cambian. Rehacer diez nodos sesenta veces por segundo es tirar trabajo.
  if (trozos && trozos.length === cifras.length) {
    let sirve = true;
    for (let i = 0; i < cifras.length; i++) {
      const esDigito = cifras[i] >= "0" && cifras[i] <= "9";
      if (esDigito !== trozos[i].esDigito) { sirve = false; break; }
    }
    if (sirve) {
      for (let i = 0; i < cifras.length; i++) {
        if (trozos[i].nodo.textContent !== cifras[i]) trozos[i].nodo.textContent = cifras[i];
      }
      return;
    }
  }

  el.textContent = "";
  const nuevos = [];
  for (const c of cifras) {
    const esDigito = c >= "0" && c <= "9";
    const nodo = document.createElement("span");
    if (esDigito) nodo.className = "cifra";
    nodo.textContent = c;
    el.appendChild(nodo);
    nuevos.push({ nodo, esDigito });
  }
  el.__trozosNumero = nuevos;
}


export function countUpTo(el, targetValue, format) {
  if (!el) return;
  const prev = countState.get(el);

  // Si ya hay una animación en marcha hacia EXACTAMENTE este mismo valor, se
  // deja correr. Firestore entrega un mismo cambio dos veces (primero desde
  // la caché local, luego confirmado por el servidor); sin esto, la segunda
  // notificación cortaba la animación a medias y el número pegaba un salto
  // seco hasta el final.
  if (prev?.tween && prev.target === targetValue) return;

  const from = prev?.value ?? 0;
  if (prev?.tween) prev.tween.kill();

  // La PRIMERA vez que este elemento recibe un valor no hay nada que
  // "contar": no existe un valor anterior del que salir, así que animar
  // aquí es inventarse un recorrido desde 0 hasta la cifra real. Eso es
  // justo lo que se veía al abrir la app (el saldo subiendo 2428 → 2812 →
  // 2985 → 3032 mientras el resto de la pantalla también entraba animada).
  // Un contador anima un CAMBIO; en el primer pintado no hay cambio, así
  // que se pone el número directamente.
  //
  // Nota: esta comprobación es independiente del tiempo transcurrido — la
  // detección por ráfaga de abajo no cubría este caso porque los datos de
  // Firestore tardan varios segundos en llegar (mientras se ve "Cargando
  // tus datos…"), así que el primer renderizado real siempre parecía un
  // pase "aislado" y por tanto animable.
  const esPrimerValor = prev === undefined;

  if (esPrimerValor || estaAsentando() || typeof gsap === "undefined") {
    pintarNumero(el, format(targetValue));
    countState.set(el, { value: targetValue, tween: null, target: targetValue });
    return;
  }

  // Llegados aquí hay un cambio real que contar (no es el primer pintado ni
  // una ráfaga), así que además del recuento la cifra se enciende un
  // momento con el color del tema.
  destelloEnNumero(el);

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
      pintarNumero(el, format(obj.value));
      countState.set(el, { value: obj.value, tween, target: targetValue });
    },
    onComplete: () => {
      countState.set(el, { value: targetValue, tween: null, target: targetValue });
    },
  });
  countState.set(el, { value: from, tween, target: targetValue });
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
