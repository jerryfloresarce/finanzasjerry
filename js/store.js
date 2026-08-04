import {
  listenCuentas,
  listenCategorias,
  listenMovimientos,
  listenSuscripciones,
  listenPrestamos,
  listenPagosPrestamos,
  listenConfig,
} from "./db.js?v=23";

export const state = {
  cuentas: [],
  categorias: [],
  movimientos: [],
  suscripciones: [],
  prestamos: [],
  pagosPrestamos: [],
  config: {},
  ready: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const loaded = new Set();
const REQUIRED = ["cuentas", "categorias", "movimientos", "suscripciones", "prestamos", "pagosPrestamos", "config"];

// Firestore no entrega los datos de golpe: nada más iniciar sesión llegan
// varias actualizaciones seguidas (primero desde caché local, luego
// confirmadas desde el servidor — una vez por cada colección), y cada una
// disparaba un renderizado completo del Dashboard con su propia animación
// de entrada (el saldo total, por ejemplo, se veía saltar entre varios
// valores reales pero intermedios — 2301€, luego 5365€, luego 3384€... —
// antes de asentarse). Agrupando esa ráfaga en un único render tras una
// pausa breve, solo se anima una vez, hacia el valor ya definitivo.
let notifyTimeout = null;

function notify(key) {
  loaded.add(key);
  if (!state.ready && REQUIRED.every((k) => loaded.has(k))) state.ready = true;
  clearTimeout(notifyTimeout);
  notifyTimeout = setTimeout(() => {
    listeners.forEach((fn) => fn(state));
  }, 500);
}

let started = false;

export function initStore() {
  if (started) return;
  started = true;
  listenCuentas((items) => { state.cuentas = items; notify("cuentas"); });
  listenCategorias((items) => { state.categorias = items; notify("categorias"); });
  listenMovimientos((items) => { state.movimientos = items; notify("movimientos"); });
  listenSuscripciones((items) => { state.suscripciones = items; notify("suscripciones"); });
  listenPrestamos((items) => { state.prestamos = items; notify("prestamos"); });
  listenPagosPrestamos((items) => { state.pagosPrestamos = items; notify("pagosPrestamos"); });
  listenConfig((data) => { state.config = data; notify("config"); });
}
