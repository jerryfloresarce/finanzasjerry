import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

// ---------- Helpers genéricos ----------

function col(name) {
  return collection(db, name);
}

function listen(name, orderField, cb) {
  const q = orderField ? query(col(name), orderBy(orderField, "desc")) : col(name);
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(items);
  });
}

export function toTimestamp(dateString) {
  return Timestamp.fromDate(new Date(dateString));
}

export function fromTimestamp(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

// ---------- Cuentas ----------
// saldo_inicial: el saldo real en fecha_inicio. El saldo mostrado se calcula
// sumando los movimientos de esa cuenta a partir de fecha_inicio, para que
// nunca se pueda descuadrar entre la web y el Shortcut.

export const listenCuentas = (cb) => listen("cuentas", null, cb);
export const addCuenta = (data) => addDoc(col("cuentas"), data);
export const updateCuenta = (id, data) => updateDoc(doc(db, "cuentas", id), data);
export const deleteCuenta = (id) => deleteDoc(doc(db, "cuentas", id));

// ---------- Categorías ----------

export const listenCategorias = (cb) => listen("categorias", null, cb);
export const addCategoria = (data) => addDoc(col("categorias"), data);
export const updateCategoria = (id, data) => updateDoc(doc(db, "categorias", id), data);
export const deleteCategoria = (id) => deleteDoc(doc(db, "categorias", id));

// ---------- Movimientos ----------

export const listenMovimientos = (cb) => listen("movimientos", "fecha", cb);
export const addMovimiento = (data) => addDoc(col("movimientos"), data);
export const updateMovimiento = (id, data) => updateDoc(doc(db, "movimientos", id), data);
export const deleteMovimiento = (id) => deleteDoc(doc(db, "movimientos", id));

// ---------- Suscripciones ----------

export const listenSuscripciones = (cb) => listen("suscripciones", null, cb);
export const addSuscripcion = (data) => addDoc(col("suscripciones"), data);
export const updateSuscripcion = (id, data) => updateDoc(doc(db, "suscripciones", id), data);
export const deleteSuscripcion = (id) => deleteDoc(doc(db, "suscripciones", id));

// ---------- Préstamos ----------

export const listenPrestamos = (cb) => listen("prestamos", null, cb);
export const addPrestamo = (data) => addDoc(col("prestamos"), data);
export const updatePrestamo = (id, data) => updateDoc(doc(db, "prestamos", id), data);
export const deletePrestamo = (id) => deleteDoc(doc(db, "prestamos", id));

// ---------- Pagos de préstamos ----------

export const listenPagosPrestamos = (cb) => listen("pagos_prestamos", "fecha", cb);
export const addPagoPrestamo = (data) => addDoc(col("pagos_prestamos"), data);
export const updatePagoPrestamo = (id, data) => updateDoc(doc(db, "pagos_prestamos", id), data);
export const deletePagoPrestamo = (id) => deleteDoc(doc(db, "pagos_prestamos", id));

// ---------- Cálculos derivados ----------

export function calcularSaldoCuenta(cuenta, movimientos) {
  const inicial = Number(cuenta.saldo_inicial ?? 0);
  const delta = movimientos
    .filter((m) => m.cuenta_id === cuenta.id)
    .reduce((acc, m) => {
      const importe = Number(m.importe ?? 0);
      return acc + (m.tipo === "Ingreso" ? importe : -importe);
    }, 0);
  return inicial + delta;
}

export function calcularSaldoTotal(cuentas, movimientos) {
  return cuentas
    .filter((c) => c.activa !== false)
    .reduce((acc, c) => acc + calcularSaldoCuenta(c, movimientos), 0);
}

export function gastosPorCategoriaDelMes(movimientos, categorias, fecha = new Date()) {
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  const totales = new Map();
  movimientos
    .filter((m) => m.tipo === "Gasto")
    .filter((m) => {
      const d = fromTimestamp(m.fecha);
      return d && d.getMonth() === mes && d.getFullYear() === anio;
    })
    .forEach((m) => {
      const actual = totales.get(m.categoria_id) || 0;
      totales.set(m.categoria_id, actual + Number(m.importe ?? 0));
    });
  return categorias.map((c) => ({
    categoria: c,
    total: totales.get(c.id) || 0,
  }));
}

export function gastosPorSubcategoriaDelMes(movimientos, fecha = new Date(), limit = 6) {
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  const totales = new Map();
  movimientos
    .filter((m) => m.tipo === "Gasto" && m.subcategoria)
    .filter((m) => {
      const d = fromTimestamp(m.fecha);
      return d && d.getMonth() === mes && d.getFullYear() === anio;
    })
    .forEach((m) => {
      const actual = totales.get(m.subcategoria) || 0;
      totales.set(m.subcategoria, actual + Number(m.importe ?? 0));
    });
  return [...totales.entries()]
    .map(([subcategoria, total]) => ({ subcategoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function formatEUR(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value ?? 0);
}

export function formatFecha(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
