import "./auth.js";
import { onAuthReady } from "./auth.js?v=64";
import { state, subscribe, initStore } from "./store.js?v=64";

import { mountDashboard, renderDashboard } from "./views/dashboard.js?v=64";
import { mountMovimientos, renderMovimientos } from "./views/movimientos.js?v=64";
import { mountCuentas, renderCuentas } from "./views/cuentas.js?v=64";
import { mountCategorias, renderCategorias } from "./views/categorias.js?v=64";
import { mountPrestamos, renderPrestamos } from "./views/prestamos.js?v=64";
import { mountSuscripciones, renderSuscripciones } from "./views/suscripciones.js?v=64";
import { mountGraficos, renderGraficos } from "./views/graficos.js?v=64";
import { mountMetas, renderMetas } from "./views/metas.js?v=64";
import { mountCuentaPanel } from "./views/cuenta.js?v=64";
import { refreshAnimations } from "./animations.js?v=64";
import { bloquearScrollFondo, desbloquearScrollFondo } from "./scroll-lock.js?v=64";
import { sincronizarTemaDesdeConfig } from "./tema.js?v=64";
import { efectoDeEntrada } from "./efectos.js?v=64";
// vida:inicio
import { initPerfil } from "./vida-perfil.js?v=64";
import { initVida } from "./vida.js?v=64";
import { mountVidaHoy, renderVidaHoy } from "./views/vida-hoy.js?v=64";
import { mountVidaEntreno, renderVidaEntreno } from "./views/vida-entreno.js?v=64";
import { mountVidaProgreso, renderVidaProgreso } from "./views/vida-progreso.js?v=64";
import { mountVidaCartera, renderVidaCartera } from "./views/vida-cartera.js?v=64";
import { mountVidaMenu, renderVidaMenu } from "./views/vida-menu.js?v=64";
// vida:fin

const ROUTES = {
  // vida:inicio
  hoy: renderVidaHoy,
  entreno: renderVidaEntreno,
  progreso: renderVidaProgreso,
  cartera: renderVidaCartera,
  menu: renderVidaMenu,
  // vida:fin
  dashboard: renderDashboard,
  graficos: renderGraficos,
  movimientos: renderMovimientos,
  cuentas: renderCuentas,
  categorias: renderCategorias,
  prestamos: renderPrestamos,
  suscripciones: renderSuscripciones,
  metas: renderMetas,
};

let DEFAULT_ROUTE = "dashboard";
// vida:inicio
DEFAULT_ROUTE = "hoy";
// vida:fin
let currentRoute = DEFAULT_ROUTE;

function currentRouteFromHash() {
  const hash = window.location.hash.replace("#/", "");
  return ROUTES[hash] ? hash : DEFAULT_ROUTE;
}

const MORE_ROUTES = ["categorias", "graficos"];

function setActiveNav(route) {
  document.querySelectorAll(".nav__link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.route === route);
  });
  // Si entras directamente a Categorías/Suscripciones (o vuelves atrás),
  // el grupo "Más" se abre solo para que se vea el enlace activo.
  if (MORE_ROUTES.includes(route)) {
    document.querySelectorAll(".nav__more").forEach((el) => el.classList.add("is-open"));
    document.querySelectorAll(".nav__more-toggle").forEach((btn) => btn.setAttribute("aria-expanded", "true"));
  }
}

document.querySelectorAll(".nav__more-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const more = btn.nextElementSibling;
    const isOpen = more.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });
});

function showView(route) {
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-hidden", section.dataset.view !== route);
  });
}

// La entrada es grande (ocupa toda la pantalla), así que se ve UNA vez por
// apertura de la app, no cada vez que se vuelve al Dashboard: a la quinta
// visita del día cansaría. Se espera a que haya datos porque hasta entonces
// el hero ni siquiera está pintado y no habría nada que iluminar.
let entradaYaMostrada = false;

function renderCurrentView() {
  // El tema viaja en el documento de configuración, así que llega por el
  // mismo camino que el resto de los datos: si se cambió desde el otro
  // dispositivo, aquí se pone al día.
  sincronizarTemaDesdeConfig(state.config);
  const renderFn = ROUTES[currentRoute];
  if (renderFn) renderFn(state);
  refreshAnimations();

  if (!entradaYaMostrada && state.ready && currentRoute === "dashboard") {
    entradaYaMostrada = true;
    efectoDeEntrada();
  }
}

// Chart.js recibe los colores ya resueltos al dibujar, así que no se entera
// solo de que han cambiado las variables CSS: hay que volver a pintar. Y de
// paso se ve el destello del tema nuevo, que sirve de confirmación.
document.addEventListener("tema-cambiado", () => {
  renderCurrentView();
  efectoDeEntrada();
});

function navigate() {
  currentRoute = currentRouteFromHash();
  setActiveNav(currentRoute);
  showView(currentRoute);
  closeMobileNav();
  renderCurrentView();
  // Quien hace scroll es la página entera, no #view-container (que solo
  // pone márgenes), así que al cambiar de apartado hay que subir la ventana.
  window.scrollTo(0, 0);
}

// Navegamos con history.replaceState en vez de dejar que los <a href="#/...">
// empujen una entrada nueva al historial. En el iPhone, cada entrada extra
// hacía que el gesto de "volver atrás" (deslizar desde el borde) mostrara
// una vista intermedia rota — con una sola entrada de historial ese gesto
// ya no tiene ningún "atrás" al que ir dentro de la app.
document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#/"]');
  if (!link) return;
  e.preventDefault();
  const route = link.getAttribute("href").slice(2);
  if (!ROUTES[route]) return;
  history.replaceState(null, "", `#/${route}`);
  navigate();
});

window.addEventListener("hashchange", navigate);

// ---------- Mobile nav ----------

const mobileNav = document.getElementById("mobile-nav");
const mobileNavScrim = document.getElementById("mobile-nav-scrim");
const topbarMenuBtn = document.getElementById("topbar-menu-btn");

let closeNavTimeout = null;

// El arrastre (más abajo) deja transform/opacity puestos como estilo en
// línea mientras sigue al dedo; hay que limpiarlos antes de abrir/cerrar
// por botón para que la transición de la clase no compita con un valor en
// línea que se quedó de un gesto anterior.
function clearDragStyles() {
  mobileNav.style.transform = "";
  mobileNavScrim.style.opacity = "";
}

function openMobileNav() {
  clearTimeout(closeNavTimeout);
  clearDragStyles();
  mobileNav.classList.remove("is-hidden");
  mobileNavScrim.classList.remove("is-hidden");
  requestAnimationFrame(() => {
    mobileNav.classList.add("is-open");
    mobileNavScrim.classList.add("is-open");
  });
  bloquearScrollFondo("nav");
}

// navigate() llama a esto en cada cambio de ruta, incluso cuando el menú no
// está abierto — si no está abierto, no hace nada (evita que un cierre
// "fantasma" programado por una navegación anterior vuelva a ocultar el
// menú justo después de haberlo abierto).
function closeMobileNav() {
  if (!mobileNav.classList.contains("is-open")) return;
  desbloquearScrollFondo("nav");
  clearDragStyles();
  mobileNav.classList.remove("is-open");
  mobileNavScrim.classList.remove("is-open");
  closeNavTimeout = setTimeout(() => {
    mobileNav.classList.add("is-hidden");
    mobileNavScrim.classList.add("is-hidden");
  }, 300);
}

topbarMenuBtn?.addEventListener("click", openMobileNav);
mobileNavScrim?.addEventListener("click", closeMobileNav);
document.getElementById("mobile-logout-btn")?.addEventListener("click", () => {
  document.getElementById("logout-btn")?.click();
});

// Gesto táctil: el menú sigue al dedo en tiempo real mientras arrastras
// (como un cajón nativo), en vez de solo decidir abrir/cerrar de golpe al
// soltar — así se siente suave y natural en vez de "saltar" al final.
// Deslizar hacia la derecha abre, hacia la izquierda cierra. Solo cuenta
// si el gesto es sobre todo horizontal (si no, es scroll vertical normal).
const SWIPE_LOCK_THRESHOLD = 10;
let touchStartX = null;
let touchStartY = null;
let swipeIsHorizontal = null;
let navWasOpenAtStart = false;
let dragNavWidth = 0;

function dragProgressFrom(deltaX) {
  const raw = navWasOpenAtStart ? 1 + deltaX / dragNavWidth : deltaX / dragNavWidth;
  return Math.max(0, Math.min(1, raw));
}

function beginDrag() {
  navWasOpenAtStart = mobileNav.classList.contains("is-open");
  dragNavWidth = mobileNav.getBoundingClientRect().width || 300;
  clearTimeout(closeNavTimeout);
  mobileNav.classList.remove("is-hidden");
  mobileNavScrim.classList.remove("is-hidden");
  mobileNav.classList.add("is-dragging");
  mobileNavScrim.classList.add("is-dragging");
}

function applyDragProgress(progress) {
  mobileNav.style.transform = `translateX(${(progress - 1) * 100}%)`;
  mobileNavScrim.style.opacity = String(progress);
}

// Al soltar, en vez de delegar en openMobileNav/closeMobileNav (que usan un
// requestAnimationFrame pensado para abrir desde cero), fijamos aquí mismo
// el transform final con la transición ya reactivada — así continúa
// suavemente desde donde iba el dedo hasta el final, sin el salto que
// daría pasar primero por el valor base de la clase antes del rAF.
function endDrag(progress) {
  mobileNav.classList.remove("is-dragging");
  mobileNavScrim.classList.remove("is-dragging");
  clearTimeout(closeNavTimeout);

  const opening = progress > 0.5;
  mobileNav.style.transform = opening ? "translateX(0)" : "translateX(-100%)";
  mobileNavScrim.style.opacity = opening ? "1" : "0";
  mobileNav.classList.toggle("is-open", opening);
  mobileNavScrim.classList.toggle("is-open", opening);
  if (opening) bloquearScrollFondo("nav");
  else desbloquearScrollFondo("nav");

  if (opening) {
    closeNavTimeout = setTimeout(clearDragStyles, 320);
  } else {
    closeNavTimeout = setTimeout(() => {
      mobileNav.classList.add("is-hidden");
      mobileNavScrim.classList.add("is-hidden");
      clearDragStyles();
    }, 320);
  }
}

document.addEventListener(
  "touchstart",
  (e) => {
    if (window.innerWidth > 860) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipeIsHorizontal = null;
  },
  { passive: true }
);

// Sin esto, el propio Safari intenta hacer scroll/rebote vertical de la
// página de fondo a la vez que arrastras el dedo para abrir el menú
// (cualquier swipe real tiene algo de componente vertical). En cuanto
// detectamos que el gesto es sobre todo horizontal, bloqueamos ese scroll
// con preventDefault; si es sobre todo vertical, no tocamos nada y el
// scroll normal de la página sigue funcionando igual que siempre.
document.addEventListener(
  "touchmove",
  (e) => {
    if (touchStartX === null) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (swipeIsHorizontal === null && (Math.abs(deltaX) > SWIPE_LOCK_THRESHOLD || Math.abs(deltaY) > SWIPE_LOCK_THRESHOLD)) {
      swipeIsHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      if (swipeIsHorizontal) beginDrag();
    }
    if (!swipeIsHorizontal) return;
    e.preventDefault();
    applyDragProgress(dragProgressFrom(deltaX));
  },
  { passive: false }
);

document.addEventListener(
  "touchend",
  (e) => {
    if (touchStartX === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const wasHorizontal = swipeIsHorizontal;
    touchStartX = null;
    touchStartY = null;
    swipeIsHorizontal = null;
    if (!wasHorizontal) return;
    endDrag(dragProgressFrom(deltaX));
  },
  { passive: true }
);

// ---------- Init ----------

let mounted = false;

onAuthReady((user) => {
  // vida:inicio
  // El email del login dice qué perfil es el propio (Jerry o Gaby). Va
  // ANTES que el store para que los listeners ya filtren por el perfil
  // correcto desde el primer dato.
  initPerfil(user);
  // vida:fin
  initStore();
  subscribe(renderCurrentView);

  if (!mounted) {
    mounted = true;
    mountDashboard();
    mountGraficos();
    mountMovimientos();
    mountCuentas();
    mountCategorias();
    mountPrestamos();
    mountSuscripciones();
    mountMetas();
    mountCuentaPanel();
    // vida:inicio
    mountVidaHoy();
    mountVidaEntreno();
    mountVidaProgreso();
    mountVidaCartera();
    mountVidaMenu();
    // Sus colecciones llegan por listeners propios (no pasan por el store):
    // cuando cambian, se repinta la vista de vida que esté abierta.
    initVida(() => {
      if (["hoy", "entreno", "progreso", "cartera", "menu"].includes(currentRoute)) renderCurrentView();
    });
    // vida:fin
  }

  if (!window.location.hash) history.replaceState(null, "", `#/${DEFAULT_ROUTE}`);
  navigate();
});
