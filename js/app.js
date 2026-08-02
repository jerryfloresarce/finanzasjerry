import "./auth.js";
import { onAuthReady } from "./auth.js";
import { state, subscribe, initStore } from "./store.js";

import { mountDashboard, renderDashboard } from "./views/dashboard.js";
import { mountMovimientos, renderMovimientos } from "./views/movimientos.js";
import { mountCuentas, renderCuentas } from "./views/cuentas.js";
import { mountCategorias, renderCategorias } from "./views/categorias.js";
import { mountPrestamos, renderPrestamos } from "./views/prestamos.js";
import { mountSuscripciones, renderSuscripciones } from "./views/suscripciones.js";
import { refreshAnimations } from "./animations.js";

const ROUTES = {
  dashboard: renderDashboard,
  movimientos: renderMovimientos,
  cuentas: renderCuentas,
  categorias: renderCategorias,
  prestamos: renderPrestamos,
  suscripciones: renderSuscripciones,
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

window.addEventListener("hashchange", navigate);

// ---------- Mobile nav ----------

const mobileNav = document.getElementById("mobile-nav");
const mobileNavScrim = document.getElementById("mobile-nav-scrim");
const topbarMenuBtn = document.getElementById("topbar-menu-btn");

function openMobileNav() {
  mobileNav.classList.remove("is-hidden");
  mobileNavScrim.classList.remove("is-hidden");
  requestAnimationFrame(() => mobileNav.classList.add("is-open"));
}

function closeMobileNav() {
  mobileNav.classList.remove("is-open");
  setTimeout(() => {
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
    mountMovimientos();
    mountCuentas();
    mountCategorias();
    mountPrestamos();
    mountSuscripciones();
  }

  if (!window.location.hash) window.location.hash = "#/dashboard";
  navigate();
});
