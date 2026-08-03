import {
  listenCuentas,
  listenCategorias,
  listenMovimientos,
  listenSuscripciones,
  listenPrestamos,
  listenPagosPrestamos,
  listenConfig,
} from "./db.js?v=13";

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

function notify(key) {
  loaded.add(key);
  if (!state.ready && REQUIRED.every((k) => loaded.has(k))) state.ready = true;
  listeners.forEach((fn) => fn(state));
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
