import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  disableNetwork,
  enableNetwork,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js?v=92";

// Cuando el iPhone deja la app en segundo plano (o la pantalla se apaga),
// Safari congela la conexión abierta de Firestore. Al volver, esa conexión
// suele estar muerta pero el navegador no lo sabe: los listeners siguen
// "vivos" sin recibir nada, así que lo que se haya añadido por fuera —desde
// un Atajo, por ejemplo— no aparecía hasta cerrar la app del todo y volver
// a abrirla. Cortando y volviendo a levantar la red se fuerza a Firestore a
// abrir una conexión nueva y a reenviar todo lo que se perdió.
let reconectando = false;

export async function reconectarFirestore() {
  if (reconectando) return;
  reconectando = true;
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch (err) {
    console.error("No se pudo reconectar con Firestore:", err);
  } finally {
    reconectando = false;
  }
}

// ---------- Helpers genéricos ----------

function col(name) {
  return collection(db, name);
}

// Ganchos opcionales para módulos externos: uno transforma los datos justo
// antes de crearlos y otro filtra lo que llega de cada colección. Si nadie
// los registra no hacen nada, y la app funciona exactamente igual que
// siempre — son un punto de extensión, no una dependencia.
let alCrear = (coleccion, data) => data;
let alLeer = (coleccion, items) => items;
let alNombrarCuenta = (id) => null;
export function registrarGanchosDeDatos({ crear, leer, nombrarCuenta } = {}) {
  if (crear) alCrear = crear;
  if (leer) alLeer = leer;
  if (nombrarCuenta) alNombrarCuenta = nombrarCuenta;
}

// El nombre de una cuenta para pintar en pantalla. Normalmente sale del
// mapa de cuentas de la vista; si no está ahí, el gancho puede resolverlo
// (una cuenta que existe pero la vista no la lista) antes de rendirse.
export function nombreDeCuenta(cuentaMap, id) {
  if (!id) return "—";
  return cuentaMap.get(id) || alNombrarCuenta(id) || "—";
}

// Lo último que llegó de cada colección, tal cual vino, junto con a quién
// avisar. Permite volver a pasar el filtro de lectura sin esperar a otra
// entrega de Firestore: hace falta cuando el criterio del filtro depende de
// OTRA colección que puede llegar después (a qué perfil pertenece cada
// cuenta, por ejemplo).
const ultimaLectura = new Map();

export function refiltrarColeccion(name) {
  const u = ultimaLectura.get(name);
  if (u) u.cb(alLeer(name, u.items));
}

function entregar(name, items, cb) {
  ultimaLectura.set(name, { items, cb });
  cb(alLeer(name, items));
}

function listen(name, orderField, cb) {
  const q = orderField ? query(col(name), orderBy(orderField, "desc")) : col(name);
  return onSnapshot(q, (snap) => {
    entregar(name, snap.docs.map((d) => ({ id: d.id, ...d.data() })), cb);
  });
}

const crear = (name, data) => addDoc(col(name), alCrear(name, data));

// ---------- Fechas ----------
//
// Aquí una fecha es un DÍA DEL CALENDARIO ("el 15 de agosto"), no un
// instante. Y eso, con las fechas de JavaScript, tiene trampa.
//
// Se guardan como la medianoche UTC de ese día. El problema es leerlas: si
// se leen con la hora local, en España (UTC+2) esa medianoche son las 02:00
// del mismo día y todo cuadra por casualidad — pero en Bolivia (UTC-4) son
// las 20:00 del día ANTERIOR, y entonces cada movimiento aparecería un día
// antes en el calendario, en los totales del mes y en los gráficos.
//
// La solución es una sola: al leer, se devuelve el MEDIODÍA LOCAL de ese
// mismo día del calendario. Desde ahí, cualquier .getDate(), .getMonth() o
// texto con la fecha da el día correcto en cualquier país, porque el
// mediodía está a doce horas de distancia de los dos bordes del día.

export function toTimestamp(dateString) {
  return Timestamp.fromDate(new Date(dateString));
}

export function fromTimestamp(ts) {
  if (!ts) return null;
  const bruto = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(bruto.getTime())) return null;
  // El día se lee en UTC, que es como se guardó, y se reconstruye a mediodía
  // en hora local.
  return new Date(bruto.getUTCFullYear(), bruto.getUTCMonth(), bruto.getUTCDate(), 12, 0, 0, 0);
}

// El día del calendario de una fecha LOCAL, en texto "2026-08-15".
//
// No vale .toISOString().slice(0, 10): eso pasa por UTC, y una fecha creada
// como new Date(2026, 7, 15) es la medianoche LOCAL — que en España son las
// 22:00 del día 14 en UTC. De ahí salía el "pulso el 15 y me pone el 14".
export function fechaISO(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ---------- Cuentas ----------
// saldo_inicial: el saldo real en fecha_inicio. El saldo mostrado se calcula
// sumando los movimientos de esa cuenta a partir de fecha_inicio, para que
// nunca se pueda descuadrar entre la web y el Shortcut.

export const listenCuentas = (cb) => listen("cuentas", null, cb);
export const addCuenta = (data) => crear("cuentas", data);
export const updateCuenta = (id, data) => updateDoc(doc(db, "cuentas", id), data);
export const deleteCuenta = (id) => deleteDoc(doc(db, "cuentas", id));

// ---------- Categorías ----------

export const listenCategorias = (cb) => listen("categorias", null, cb);
export const addCategoria = (data) => crear("categorias", data);
export const updateCategoria = (id, data) => updateDoc(doc(db, "categorias", id), data);
export const deleteCategoria = (id) => deleteDoc(doc(db, "categorias", id));

// ---------- Movimientos ----------

export const listenMovimientos = (cb) => listen("movimientos", "fecha", cb);
export const addMovimiento = (data) => crear("movimientos", data);
export const updateMovimiento = (id, data) => updateDoc(doc(db, "movimientos", id), data);
export const deleteMovimiento = (id) => deleteDoc(doc(db, "movimientos", id));

// ---------- Suscripciones ----------

export const listenSuscripciones = (cb) => listen("suscripciones", null, cb);
export const addSuscripcion = (data) => crear("suscripciones", data);
export const updateSuscripcion = (id, data) => updateDoc(doc(db, "suscripciones", id), data);
export const deleteSuscripcion = (id) => deleteDoc(doc(db, "suscripciones", id));

// ---------- Préstamos ----------

export const listenPrestamos = (cb) => listen("prestamos", null, cb);
export const addPrestamo = (data) => crear("prestamos", data);
export const updatePrestamo = (id, data) => updateDoc(doc(db, "prestamos", id), data);
export const deletePrestamo = (id) => deleteDoc(doc(db, "prestamos", id));

// ---------- Pagos de préstamos ----------

export const listenPagosPrestamos = (cb) => listen("pagos_prestamos", "fecha", cb);
export const addPagoPrestamo = (data) => crear("pagos_prestamos", data);
export const updatePagoPrestamo = (id, data) => updateDoc(doc(db, "pagos_prestamos", id), data);
export const deletePagoPrestamo = (id) => deleteDoc(doc(db, "pagos_prestamos", id));

// ---------- Préstamos con plan de pagos diario ----------
// Algunos préstamos no funcionan como "capital + un interés mensual": se
// devuelven en cuotas diarias iguales (capital + interés ya repartidos entre
// todos los días) hasta saldar la deuda entera. Para esos, `pagos_prestamos`
// guarda un documento por día (fecha + importe esperado + si ya se cobró),
// en vez de usar el bloque de "interés mensual" del resto de préstamos.

export function esPlanDePagos(prestamo) {
  return Boolean(prestamo?.plan_pagos);
}

// Lo que falta por cobrar de un préstamo con plan de pagos diario: la suma
// de los días todavía no marcados como pagados. Se suma día a día (no un
// simple "días restantes × cuota") porque el importe de un día concreto se
// puede editar a mano si un día se paga de más o de menos.
export function restantePlanDePagos(prestamo, pagosPrestamos) {
  return pagosPrestamos
    .filter((pg) => pg.prestamo_id === prestamo.id && !pg.pagado)
    .reduce((acc, pg) => acc + Number(pg.importe ?? 0), 0);
}

// Genera "cantidad" fechas ISO consecutivas a partir de inicioISO, saltando
// los domingos.
export function generarFechasPlanDePagos(inicioISO, cantidad) {
  const fechas = [];
  const d = new Date(inicioISO + "T00:00:00");
  while (fechas.length < cantidad) {
    if (d.getDay() !== 0) fechas.push(fechaISO(d));
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

// ---------- Metas de ahorro ----------
// Huchas: dinero apartado para algo concreto — un viaje, una reparación,
// un capricho grande. Cada meta guarda sus aportaciones dentro del propio
// documento. El listener tolera que las reglas de Firestore aún no
// permitan la colección (instalación vieja sin republicar): devuelve la
// lista vacía en vez de dejar la app colgada esperando.

export const listenMetasAhorro = (cb) =>
  onSnapshot(
    col("metas_ahorro"),
    (snap) => entregar("metas_ahorro", snap.docs.map((d) => ({ id: d.id, ...d.data() })), cb),
    () => cb([])
  );
export const addMetaAhorro = (data) => crear("metas_ahorro", data);
export const updateMetaAhorro = (id, data) => updateDoc(doc(db, "metas_ahorro", id), data);
export const deleteMetaAhorro = (id) => deleteDoc(doc(db, "metas_ahorro", id));

// ---------- Configuración de la app (un solo documento) ----------
// Guarda cosas como "¿ya se descartó tal banner?" en Firestore en vez de
// localStorage, para que el estado sea el mismo en todos los dispositivos
// (móvil, escritorio, cualquier navegador) en vez de por-navegador.

// El segundo argumento de onSnapshot cubre el caso de que las reglas de
// Firestore aún no se hayan vuelto a publicar con el permiso para esta
// colección nueva: en vez de dejar la app colgada esperando este dato para
// siempre, seguimos adelante como si no hubiera nada guardado todavía.
export const listenConfig = (cb) =>
  onSnapshot(
    doc(db, "configuracion", "app"),
    (snap) => cb(snap.exists() ? snap.data() : {}),
    () => cb({})
  );
export const updateConfig = (data) => setDoc(doc(db, "configuracion", "app"), data, { merge: true });

// ---------- Cálculos derivados ----------

export function calcularSaldoCuenta(cuenta, movimientos) {
  const inicial = Number(cuenta.saldo_inicial ?? 0);
  const delta = movimientos.reduce((acc, m) => {
    // Un movimiento marcado "no afecta saldo" (ej. un gasto fijo que ya
    // estaba pagado y descontado antes de usar la app) sigue contando en
    // gráficos e historial, pero no se resta/suma aquí para no descuadrar
    // un saldo que ya es correcto.
    if (m.afecta_saldo === false) return acc;
    const importe = Number(m.importe ?? 0);
    // Una transferencia mueve dinero entre dos cuentas propias (o un
    // retiro a "Efectivo") — no es gasto ni ingreso, así que resta en la
    // cuenta de origen y suma en la de destino, sin pasar por el resto de
    // cálculos (gráficos, totales de gasto/ingreso, etc.).
    if (m.tipo === "Transferencia") {
      if (m.cuenta_id === cuenta.id) return acc - importe;
      if (m.cuenta_destino_id === cuenta.id) return acc + importe;
      return acc;
    }
    if (m.cuenta_id !== cuenta.id) return acc;
    return acc + (m.tipo === "Ingreso" ? importe : -importe);
  }, 0);
  return inicial + delta;
}

// El periodo que cubre una factura, en corto: "1 jul – 31 jul".
//
// La luz, el agua o el gas se pagan un mes y cubren otro, así que el día
// del pago no dice de qué factura es. Estos dos campos guardan el rango
// que viene impreso en el recibo, y son opcionales: si no hay nada, no se
// enseña nada.
export function textoPeriodo(movimiento) {
  const desde = movimiento?.periodo_desde;
  const hasta = movimiento?.periodo_hasta;
  if (!desde && !hasta) return "";
  const corto = (iso) => {
    // Mediodía y no medianoche, por lo mismo de siempre: que el día no se
    // vaya al anterior según el país.
    const d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d).replace(".", "");
  };
  if (desde && hasta) return `${corto(desde)} – ${corto(hasta)}`;
  return corto(desde || hasta);
}

// Cómo se llama el destino de una transferencia al enseñarla en pantalla.
// Una transferencia normal va de una cuenta propia a otra. Pero el dinero
// que sale al dar un préstamo también es una transferencia (sale de la
// cuenta y no es un gasto, porque vuelve) y ahí no hay cuenta de destino:
// se lo lleva la persona. En ese caso el destino es el texto guardado en
// `subcategoria` ("Préstamo a Ana"), no el nombre de una cuenta.
export function destinoTransferencia(movimiento, cuentaMap) {
  if (movimiento.cuenta_destino_id) return nombreDeCuenta(cuentaMap, movimiento.cuenta_destino_id);
  return movimiento.subcategoria || "—";
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

// ---------- Gráficos: helpers de rango libre (mes / año / todo) ----------

export function movimientosEnRango(movimientos, rango, fecha = new Date()) {
  if (rango === "todo") return movimientos;
  return movimientos.filter((m) => {
    const d = fromTimestamp(m.fecha);
    if (!d) return false;
    if (rango === "mes") return d.getMonth() === fecha.getMonth() && d.getFullYear() === fecha.getFullYear();
    if (rango === "anio") return d.getFullYear() === fecha.getFullYear();
    return true;
  });
}

export function totalPorTipo(movimientos, tipo) {
  return movimientos.filter((m) => m.tipo === tipo).reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
}

export function desglosePorCategoria(movimientos, categorias, tipo) {
  const totales = new Map();
  movimientos
    .filter((m) => m.tipo === tipo)
    .forEach((m) => totales.set(m.categoria_id, (totales.get(m.categoria_id) || 0) + Number(m.importe ?? 0)));
  return categorias
    .map((c) => ({ categoria: c, total: totales.get(c.id) || 0 }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function desglosePorSubcategoria(movimientos, tipo, filtroTexto = "") {
  const texto = filtroTexto.trim().toLowerCase();
  const totales = new Map();
  movimientos
    .filter((m) => m.tipo === tipo && m.subcategoria)
    .filter((m) => !texto || m.subcategoria.toLowerCase().includes(texto))
    .forEach((m) => totales.set(m.subcategoria, (totales.get(m.subcategoria) || 0) + Number(m.importe ?? 0)));
  return [...totales.entries()]
    .map(([subcategoria, total]) => ({ subcategoria, total }))
    .sort((a, b) => b.total - a.total);
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
