import {
  listenCuentas,
  listenCategorias,
  listenMovimientos,
  listenSuscripciones,
  listenPrestamos,
  listenPagosPrestamos,
  listenConfig,
} from "./db.js?v=36";

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
// Se agrupan las actualizaciones que llegan juntas, pero con dos límites en
// vez de uno:
//
// AGRUPAR_MS es la pausa corta que se espera por si viene otra detrás (una
// misma acción suele generar dos avisos: el de la caché local y el del
// servidor). Antes era de 500 ms fijos, y eso se notaba: al borrar algo la
// fila tardaba medio segundo largo en desaparecer.
//
// ESPERA_MAX_MS es el tope desde el PRIMER aviso pendiente. Sin él esto era
// un "debounce" puro: si los avisos seguían llegando más rápido que la
// pausa, el repintado se posponía una y otra vez y la pantalla se quedaba
// congelada con datos viejos mientras algo siguiera moviéndose.
const AGRUPAR_MS = 120;
const ESPERA_MAX_MS = 500;

let notifyTimeout = null;
let primerPendiente = 0;

function emitir() {
  notifyTimeout = null;
  primerPendiente = 0;
  listeners.forEach((fn) => fn(state));
}

function notify(key) {
  loaded.add(key);
  if (!state.ready && REQUIRED.every((k) => loaded.has(k))) state.ready = true;

  const ahora = Date.now();
  if (!notifyTimeout) primerPendiente = ahora;
  clearTimeout(notifyTimeout);
  const margenRestante = Math.max(0, primerPendiente + ESPERA_MAX_MS - ahora);
  notifyTimeout = setTimeout(emitir, Math.min(AGRUPAR_MS, margenRestante));
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
