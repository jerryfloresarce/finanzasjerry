import "./auth.js";
import { onAuthReady } from "./auth.js";
import { state, subscribe, initStore } from "./store.js";

import { mountDashboard, renderDashboard } from "./views/dashboard.js";
import { mountMovimientos, renderMovimientos } from "./views/movimientos.js";
import { mountCuentas, renderCuentas } from "./views/cuentas.js";
import { mountCategorias, renderCategorias } from "./views/categorias.js";
import { mountPrestamos, renderPrestamos } from "./views/prestamos.js";
import { mountSuscripciones, renderSuscripciones } from "./views/suscripciones.js";
import { mountGraficos, renderGraficos } from "./views/graficos.js";
import { mountCuenta, renderCuenta } from "./views/cuenta.js";
import { refreshAnimations } from "./animations.js";

const ROUTES = {
  dashboard: renderDashboard,
  graficos: renderGraficos,
  movimientos: renderMovimientos,
  cuentas: renderCuentas,
  categorias: renderCategorias,
  prestamos: renderPrestamos,
  suscripciones: renderSuscripciones,
  cuenta: renderCuenta,
};

const DEFAULT_ROUTE = "dashboard";
let currentRoute = DEFAULT_ROUTE;

function currentRouteFromHash() {
  const hash = window.location.hash.replace("#/", "");
  return ROUTES[hash] ? hash : DEFAULT_ROUTE;
}

function setActiveNav(route) {
  document.querySelectorAll(".nav__link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.route === route);
  });
}

function showView(route) {
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-hidden", section.dataset.view !== route);
  });
}

function renderCurrentView() {
  const renderFn = ROUTES[currentRoute];
  if (renderFn) renderFn(state);
  refreshAnimations();
}

function navigate() {
  currentRoute = currentRouteFromHash();
  setActiveNav(currentRoute);
  showView(currentRoute);
  closeMobileNav();
  renderCurrentView();
  document.getElementById("view-container")?.scrollTo({ top: 0 });
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

function openMobileNav() {
  clearTimeout(closeNavTimeout);
  mobileNav.classList.remove("is-hidden");
  mobileNavScrim.classList.remove("is-hidden");
  requestAnimationFrame(() => mobileNav.classList.add("is-open"));
}

// navigate() llama a esto en cada cambio de ruta, incluso cuando el menú no
// está abierto — si no está abierto, no hace nada (evita que un cierre
// "fantasma" programado por una navegación anterior vuelva a ocultar el
// menú justo después de haberlo abierto).
function closeMobileNav() {
  if (!mobileNav.classList.contains("is-open")) return;
  mobileNav.classList.remove("is-open");
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

// ---------- Init ----------

let mounted = false;

onAuthReady(() => {
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
    mountCuenta();
  }

  if (!window.location.hash) history.replaceState(null, "", "#/dashboard");
  navigate();
});
