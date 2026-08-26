// vida:inicio
// El sistema de estilo de vida de Jerry: días cumplidos, entrenos, bote de
// recompensas, fases de estudio y logros. Todo lo que no es dinero.
//
// Este módulo es PERSONAL: el kit lo excluye entero al construir la
// plantilla (busca los marcadores vida:inicio/vida:fin y los archivos
// vida-*). Por eso no toca db.js ni store.js — trae sus propios listeners y
// su propio estado, y las vistas de finanzas ni se enteran de que existe.

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js?v=60";
import { fechaISO } from "./db.js?v=60";

// ---------- Las reglas del sistema ----------

export const INNEGOCIABLES = [
  { id: "sin_comida_fuera", nombre: "Sin comida fuera sin planificar", icono: "fork-knife" },
  { id: "estudio", nombre: "Estudio", icono: "graduation-cap" },
  { id: "entreno", nombre: "El entreno que toque", icono: "barbell" },
  { id: "sueno", nombre: "En la cama antes de las 23:15", icono: "moon-stars" },
];

export const BONUS = [
  { id: "fruta_4", nombre: "4 piezas de fruta", icono: "orange-slice" },
  { id: "dientes_3", nombre: "Dientes 3 veces", icono: "tooth" },
  { id: "cena_preparada", nombre: "Cena dejada preparada", icono: "cooking-pot" },
  { id: "verdura", nombre: "Algo de verdura", icono: "carrot" },
];

export const PUNTOS_INNEGOCIABLE = 25;
export const PUNTOS_BONUS = 5;

// La semana tipo: qué entreno toca cada día (getDay(): 0 = domingo).
export const SEMANA_TIPO = {
  1: { tipo: "fuerza_A", nombre: "Fuerza A — Empuje + cuádriceps" },
  2: { tipo: "caminata", nombre: "Caminata con elevación, 35 min" },
  3: { tipo: "fuerza_B", nombre: "Fuerza B — Tirón + femoral" },
  4: { tipo: "piscina", nombre: "Piscina con tu hermano" },
  5: { tipo: "fuerza_C", nombre: "Fuerza C — Full body" },
  6: { tipo: "libre", nombre: "Libre o caminata suave" },
  0: { tipo: "descanso", nombre: "Descanso · batch cooking" },
};

export const NOMBRE_TIPO_ENTRENO = {
  fuerza_A: "Fuerza A",
  fuerza_B: "Fuerza B",
  fuerza_C: "Fuerza C",
  piscina: "Piscina",
  caminata: "Caminata",
  libre: "Libre",
};

// Los planes de fuerza, con el rango de la doble progresión y el peso de
// arranque pactado. repsPorPierna/segundos solo cambian la etiqueta.
export const PLANES = {
  fuerza_A: [
    { nombre: "Sentadilla a cajón / prensa pies altos", series: 4, repsMin: 6, repsMax: 8, pesoInicial: 20, nota: "Stance ancho, puntas fuera, cajón donde no pinche" },
    { nombre: "Press banca", series: 4, repsMin: 6, repsMax: 8, pesoInicial: 70 },
    { nombre: "Press militar sentado", series: 3, repsMin: 8, repsMax: 10, pesoInicial: 32.5 },
    { nombre: "Zancadas / prensa a una pierna", series: 3, repsMin: 10, repsMax: 10, pesoInicial: 20, etiqueta: "por pierna" },
    { nombre: "Remo en polea", series: 3, repsMin: 10, repsMax: 12, pesoInicial: 50 },
    { nombre: "Extensión de tríceps en polea", series: 3, repsMin: 12, repsMax: 15, pesoInicial: 20 },
    { nombre: "Plancha", series: 3, repsMin: 40, repsMax: 40, pesoInicial: 0, etiqueta: "segundos" },
  ],
  fuerza_B: [
    { nombre: "Peso muerto rumano", series: 4, repsMin: 8, repsMax: 10, pesoInicial: 60, nota: "Si pinza, baja solo hasta media espinilla" },
    { nombre: "Dominadas / jalón al pecho", series: 4, repsMin: 8, repsMax: 10, pesoInicial: 45 },
    { nombre: "Remo con barra o máquina", series: 4, repsMin: 8, repsMax: 10, pesoInicial: 50 },
    { nombre: "Curl femoral", series: 3, repsMin: 12, repsMax: 12, pesoInicial: 30 },
    { nombre: "Curl de bíceps", series: 3, repsMin: 12, repsMax: 12, pesoInicial: 20 },
    { nombre: "Face pull", series: 3, repsMin: 15, repsMax: 15, pesoInicial: 15 },
    { nombre: "Gemelos", series: 4, repsMin: 15, repsMax: 15, pesoInicial: 40 },
  ],
  fuerza_C: [
    { nombre: "Hip thrust / peso muerto", series: 3, repsMin: 8, repsMax: 10, pesoInicial: 60 },
    { nombre: "Press inclinado con mancuernas", series: 3, repsMin: 8, repsMax: 10, pesoInicial: 22.5, etiqueta: "por mancuerna" },
    { nombre: "Remo con mancuerna", series: 3, repsMin: 10, repsMax: 10, pesoInicial: 25, etiqueta: "por brazo" },
    { nombre: "Elevaciones laterales", series: 4, repsMin: 15, repsMax: 15, pesoInicial: 8 },
    { nombre: "Superserie curl + tríceps", series: 3, repsMin: 12, repsMax: 12, pesoInicial: 15 },
    { nombre: "Cinta 10–12 % · 5 km/h", series: 1, repsMin: 20, repsMax: 20, pesoInicial: 0, etiqueta: "minutos" },
  ],
};

// Rotación de comidas del batch cooking y de cenas rápidas. Se elige por
// día del año, así cada día tiene su sugerencia sin guardar nada.
export const ROTACION_COMIDAS = [
  "Pollo al horno + arroz + sofrito",
  "Lentejas con chorizo",
  "Albóndigas en salsa + patata",
  "Pasta boloñesa (verdura en la salsa)",
  "Garbanzos con espinaca triturada",
  "Merluza o salmón al horno + patata",
];

export const ROTACION_CENAS = [
  "Tortilla de patata con atún",
  "Pechuga a la plancha + huevo",
  "Crema de calabacín + jamón",
  "Sándwich integral de pollo",
  "Revuelto de huevo con atún",
  "Yogur griego + fruta + frutos secos",
];

export function sugerenciaDelDia(lista, fecha = new Date()) {
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  const diaDelAno = Math.floor((fecha - inicio) / 86400000);
  return lista[diaDelAno % lista.length];
}

// Las metas fijas que se marcan a mano en Progreso.
export const METAS_MANUALES = [
  { id: "az900", nombre: "AZ-900 aprobado", grupo: "Estudio" },
  { id: "fisio", nombre: "Consulta de fisio por la ingle", grupo: "Salud" },
  { id: "a2_psicotecnico", nombre: "Psicotécnico", grupo: "Carnet A2" },
  { id: "a2_tasa", nombre: "Tasa DGT pagada", grupo: "Carnet A2" },
  { id: "a2_teorico", nombre: "Teórico de moto aprobado", grupo: "Carnet A2" },
  { id: "a2_circuito", nombre: "Práctico de circuito", grupo: "Carnet A2" },
  { id: "a2_circulacion", nombre: "Práctico de circulación", grupo: "Carnet A2" },
];

export const FASES_ESTUDIO = { 1: 30, 2: 40, 3: 50, 4: 60 };

export const PESO_OBJETIVO_KG = 84;

// ---------- Estado y listeners propios ----------

export const vida = {
  dias: [],          // documentos de dias/, uno por fecha cerrada
  entrenos: [],
  recompensas: [],
  inversiones: [],   // posiciones de la cartera (Trade Republic, apuntadas a mano)
  sistema: {},       // configuracion/sistema
  sinPermisos: false, // true si las reglas nuevas aún no están publicadas
  listo: false,
};

const col = (n) => collection(db, n);
let iniciado = false;
let onChange = null;

export function initVida(cb) {
  onChange = cb;
  if (iniciado) return;
  iniciado = true;

  // Si las reglas de Firestore todavía no permiten las colecciones nuevas,
  // el listener falla: se marca sinPermisos para que la pantalla Hoy
  // explique cómo publicarlas, y la app sigue funcionando con lo demás.
  const escucha = (nombre, aplicar) =>
    onSnapshot(
      col(nombre),
      (snap) => {
        aplicar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        vida.listo = true;
        onChange?.();
      },
      () => {
        vida.sinPermisos = true;
        vida.listo = true;
        onChange?.();
      }
    );

  escucha("dias", (docs) => (vida.dias = docs.sort((a, b) => a.id.localeCompare(b.id))));
  escucha("entrenos", (docs) => (vida.entrenos = docs.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))));
  escucha("recompensas", (docs) => (vida.recompensas = docs));
  escucha("inversiones", (docs) => (vida.inversiones = docs.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))));
  onSnapshot(
    doc(db, "configuracion", "sistema"),
    (snap) => {
      vida.sistema = snap.exists() ? snap.data() : {};
      onChange?.();
    },
    () => onChange?.()
  );
}

export const guardarDia = (fechaId, data) => setDoc(doc(db, "dias", fechaId), data, { merge: true });
export const addEntreno = (data) => addDoc(col("entrenos"), data);
export const updateEntreno = (id, data) => updateDoc(doc(db, "entrenos", id), data);
export const deleteEntreno = (id) => deleteDoc(doc(db, "entrenos", id));
export const addRecompensa = (data) => addDoc(col("recompensas"), data);
export const updateRecompensa = (id, data) => updateDoc(doc(db, "recompensas", id), data);
export const deleteRecompensa = (id) => deleteDoc(doc(db, "recompensas", id));
export const guardarSistema = (data) => setDoc(doc(db, "configuracion", "sistema"), data, { merge: true });
export const addInversion = (data) => addDoc(col("inversiones"), data);
export const updateInversion = (id, data) => updateDoc(doc(db, "inversiones", id), data);
export const deleteInversion = (id) => deleteDoc(doc(db, "inversiones", id));

// ---------- El día ----------

export function puntosDeDia(innegociables, bonus) {
  const inn = INNEGOCIABLES.filter((i) => innegociables?.[i.id]).length;
  const bon = BONUS.filter((b) => bonus?.[b.id]).length;
  return inn * PUNTOS_INNEGOCIABLE + bon * PUNTOS_BONUS;
}

export function esCumplido(innegociables) {
  return INNEGOCIABLES.every((i) => Boolean(innegociables?.[i.id]));
}

export function diaPorFecha(fechaId) {
  return vida.dias.find((d) => d.id === fechaId) || null;
}

// El sábado el innegociable de dormir se relaja oficialmente.
export function etiquetaSueno(fecha) {
  return fecha.getDay() === 6 ? "No pasar de las 00:00 (sábado)" : "En la cama antes de las 23:15";
}

// ---------- Racha y semanas ----------

// Días consecutivos cumplidos. Un día fallado suelto no la rompe (no suma,
// pero se perdona); DOS fallados seguidos la reinician. Un día pasado sin
// cerrar cuenta como fallado: si no se apuntó, no se cumplió.
export function calcularRacha(hastaHoy = fechaISO()) {
  if (vida.dias.length === 0) return { actual: 0, mejor: 0 };
  const porFecha = new Map(vida.dias.map((d) => [d.id, d]));
  const primera = vida.dias[0].id;
  let actual = 0;
  let mejor = 0;
  let fallosSeguidos = 0;
  const d = new Date(primera + "T12:00:00");
  const fin = new Date(hastaHoy + "T12:00:00");
  while (d <= fin) {
    const id = fechaISO(d);
    const dia = porFecha.get(id);
    const esHoy = id === hastaHoy;
    if (dia?.cumplido) {
      actual += 1;
      fallosSeguidos = 0;
      if (actual > mejor) mejor = actual;
    } else if (!esHoy) {
      // Hoy sin cerrar todavía no es un fallo: el día no ha acabado.
      fallosSeguidos += 1;
      if (fallosSeguidos >= 2) actual = 0;
    }
    d.setDate(d.getDate() + 1);
  }
  return { actual, mejor };
}

// El lunes de la semana de una fecha, como id "YYYY-MM-DD".
export function lunesDe(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const desplazamiento = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - desplazamiento);
  return fechaISO(d);
}

// Semanas con sus días, de la primera apuntada a la actual.
export function semanas() {
  const porLunes = new Map();
  vida.dias.forEach((dia) => {
    const lunes = lunesDe(new Date(dia.id + "T12:00:00"));
    if (!porLunes.has(lunes)) porLunes.set(lunes, []);
    porLunes.get(lunes).push(dia);
  });
  return [...porLunes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([lunes, dias]) => ({
      lunes,
      dias,
      cumplidos: dias.filter((d) => d.cumplido).length,
      estudioOK: dias.filter((d) => d.innegociables?.estudio).length >= 6,
      cumplida: dias.filter((d) => d.cumplido).length >= 6,
    }));
}

// ---------- Estudio: la fase sube sola ----------

// Fase 1→4 (30→60 min). Sube al encadenar DOS semanas seguidas con estudio
// en 6 de 7 días, y nunca baja. Se calcula del historial entero, siempre
// igual, así no hay estado que se pueda descuadrar: cada par de semanas
// buenas consecutivas consume esas dos semanas y sube un punto.
export function faseEstudio() {
  const lista = semanas().filter((s) => s.lunes < lunesDe(new Date())); // solo semanas terminadas
  let fase = 1;
  let seguidas = 0;
  for (const s of lista) {
    if (s.estudioOK) {
      seguidas += 1;
      if (seguidas === 2 && fase < 4) {
        fase += 1;
        seguidas = 0;
      }
    } else {
      seguidas = 0;
    }
  }
  return fase;
}

// ---------- Bote de recompensas ----------

// Qué gastos cuentan como "comida fuera": por el nombre de su categoría o
// subcategoría. Es lo que alimenta el ahorro del día.
const COMIDA_FUERA = /comer\s*fuera|restauran|domicilio|glovo|pedido|delivery|uber\s*eats|just\s*eat|kebab|burger|pizz/i;

export function esComidaFuera(mov, catMap) {
  if (mov.tipo !== "Gasto") return false;
  const cat = catMap.get(mov.categoria_id);
  return COMIDA_FUERA.test(cat?.nombre || "") || COMIDA_FUERA.test(mov.subcategoria || "");
}

export function gastoComidaFueraPorDia(movimientos, categorias, fromTimestamp) {
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const porDia = new Map();
  movimientos.forEach((m) => {
    if (!esComidaFuera(m, catMap)) return;
    const f = fromTimestamp(m.fecha);
    if (!f) return;
    const id = fechaISO(f);
    porDia.set(id, (porDia.get(id) || 0) + Number(m.importe ?? 0));
  });
  return porDia;
}

// El coste de referencia: la media diaria de comida fuera de los últimos 90
// días ANTES de empezar el sistema. Se calcula una vez y queda guardado.
export function calcularCosteReferencia(movimientos, categorias, fromTimestamp) {
  const porDia = gastoComidaFueraPorDia(movimientos, categorias, fromTimestamp);
  const hoy = new Date();
  let total = 0;
  for (let i = 1; i <= 90; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i, 12);
    total += porDia.get(fechaISO(d)) || 0;
  }
  return Math.round((total / 90) * 100) / 100;
}

// El bote: cada día CUMPLIDO aporta (referencia − lo gastado en comida
// fuera ese día). El día de la comida planificada con tu pareja puede salir
// negativo y resta — es lo justo: ese día se come parte del ahorro.
// Un día fallado ni suma ni resta.
export function calcularBote(movimientos, categorias, fromTimestamp) {
  const ref = Number(vida.sistema.coste_referencia_dia ?? 0);
  const porDia = gastoComidaFueraPorDia(movimientos, categorias, fromTimestamp);
  const ahorroDe = (dia) => ref - (porDia.get(dia.id) || 0);

  let total = 0;
  const porSemana = new Map();
  vida.dias.forEach((dia) => {
    if (!dia.cumplido) return;
    const a = ahorroDe(dia);
    total += a;
    const lunes = lunesDe(new Date(dia.id + "T12:00:00"));
    porSemana.set(lunes, (porSemana.get(lunes) || 0) + a);
  });

  // Desbloqueado: 40 % del ahorro de cada semana cumplida, más un 20 % extra
  // (hasta el 60 %) en los meses con 3 de 4 semanas cumplidas. El resto se
  // queda acumulando para algo grande.
  const listaSemanas = semanas();
  let desbloqueado = 0;
  const semanasPorMes = new Map();
  listaSemanas.forEach((s) => {
    const mes = s.lunes.slice(0, 7);
    if (!semanasPorMes.has(mes)) semanasPorMes.set(mes, []);
    semanasPorMes.get(mes).push(s);
    if (s.cumplida) desbloqueado += 0.4 * Math.max(0, porSemana.get(s.lunes) || 0);
  });
  semanasPorMes.forEach((lista) => {
    const cumplidas = lista.filter((s) => s.cumplida);
    if (lista.length >= 4 && cumplidas.length >= 3) {
      cumplidas.forEach((s) => (desbloqueado += 0.2 * Math.max(0, porSemana.get(s.lunes) || 0)));
    }
  });

  const canjeado = vida.recompensas
    .filter((r) => r.estado === "canjeada")
    .reduce((acc, r) => acc + Number(r.coste ?? 0), 0);

  return {
    total: Math.max(0, total - canjeado),
    disponible: Math.max(0, Math.min(desbloqueado - canjeado, total - canjeado)),
    canjeado,
    referencia: ref,
  };
}

// ---------- Talón de Aquiles ----------

// % de fallo de cada innegociable en los últimos 30 días cerrados: te dice
// POR QUÉ fallas, que vale más que saber cuánto.
export function talonDeAquiles() {
  const ultimos = vida.dias.slice(-30);
  if (ultimos.length === 0) return [];
  return INNEGOCIABLES.map((i) => ({
    ...i,
    fallos: ultimos.filter((d) => !d.innegociables?.[i.id]).length,
    total: ultimos.length,
  })).sort((a, b) => b.fallos - a.fallos);
}

// ---------- Fuerza: progresión y sugerencias ----------

export function ultimoEntrenoDeTipo(tipo) {
  for (let i = vida.entrenos.length - 1; i >= 0; i--) {
    if (vida.entrenos[i].tipo === tipo) return vida.entrenos[i];
  }
  return null;
}

// La mejor serie (más peso; a igual peso, más reps) de cada sesión de un
// ejercicio, ordenada por fecha: la línea de progresión.
export function progresionDe(nombreEjercicio) {
  const puntos = [];
  vida.entrenos.forEach((e) => {
    const ej = (e.ejercicios || []).find((x) => x.nombre === nombreEjercicio);
    if (!ej || !(ej.series || []).length) return;
    const mejor = [...ej.series].sort((a, b) => b.peso - a.peso || b.reps - a.reps)[0];
    puntos.push({ fecha: e.fecha, peso: Number(mejor.peso ?? 0), reps: Number(mejor.reps ?? 0) });
  });
  return puntos;
}

// Doble progresión: si la última sesión completó el rango alto en TODAS las
// series, toca subir el peso mínimo posible y volver al rango bajo.
export function sugerenciaProgresion(plan, ultimaSesion) {
  const ej = (ultimaSesion?.ejercicios || []).find((x) => x.nombre === plan.nombre);
  if (!ej || !(ej.series || []).length) return null;
  const pesoUltimo = Math.max(...ej.series.map((s) => Number(s.peso ?? 0)));
  const completo = ej.series.length >= plan.series && ej.series.every((s) => Number(s.reps ?? 0) >= plan.repsMax);
  if (completo && plan.repsMax > plan.repsMin) {
    const coma = (n) => String(n).replace(".", ",");
    return { peso: pesoUltimo + 2.5, texto: `Completaste ${plan.series}×${plan.repsMax} con ${coma(pesoUltimo)} kg → sube a ${coma(pesoUltimo + 2.5)} kg` };
  }
  return { peso: pesoUltimo, texto: null };
}

// ---------- Logros ----------

// Todos derivados de los datos: no hay nada que marcar a mano, se
// desbloquean solos al cumplirse. Las metas manuales (AZ-900, A2) van
// aparte, en METAS_MANUALES.
export function calcularLogros(pesoInicial) {
  const { actual, mejor } = calcularRacha();
  const listaSemanas = semanas();
  const cumplidas = listaSemanas.filter((s) => s.cumplida).length;
  const totalEntrenos = vida.entrenos.length;
  const pesos = vida.dias.filter((d) => Number(d.peso_kg) > 0).map((d) => Number(d.peso_kg));
  const perdido = pesos.length >= 2 ? (pesoInicial ?? pesos[0]) - Math.min(...pesos) : 0;
  const meses = new Map();
  listaSemanas.forEach((s) => {
    const m = s.lunes.slice(0, 7);
    if (!meses.has(m)) meses.set(m, []);
    meses.get(m).push(s);
  });
  const mesCumplido = [...meses.values()].some((l) => l.length >= 4 && l.filter((s) => s.cumplida).length >= 3);
  const subidasDePeso = new Set();
  Object.values(PLANES).flat().forEach((p) => {
    const prog = progresionDe(p.nombre);
    for (let i = 1; i < prog.length; i++) if (prog[i].peso > prog[i - 1].peso) subidasDePeso.add(p.nombre);
  });

  return [
    { id: "primer_dia", nombre: "Primer día cumplido", icono: "check-circle", ok: vida.dias.some((d) => d.cumplido) },
    { id: "primera_semana", nombre: "Primera semana 6 de 7", icono: "calendar-check", ok: cumplidas >= 1 },
    { id: "racha_7", nombre: "Racha de 7 días", icono: "flame", ok: mejor >= 7 },
    { id: "racha_14", nombre: "Racha de 14 días", icono: "flame", ok: mejor >= 14 },
    { id: "racha_30", nombre: "Racha de 30 días", icono: "flame", ok: mejor >= 30 },
    { id: "mes", nombre: "Primer mes cumplido", icono: "trophy", ok: mesCumplido },
    { id: "entrenos_10", nombre: "10 entrenos", icono: "barbell", ok: totalEntrenos >= 10 },
    { id: "entrenos_25", nombre: "25 entrenos", icono: "barbell", ok: totalEntrenos >= 25 },
    { id: "entrenos_50", nombre: "50 entrenos", icono: "barbell", ok: totalEntrenos >= 50 },
    { id: "piscina_1", nombre: "Primera piscina", icono: "swimming-pool", ok: vida.entrenos.some((e) => e.tipo === "piscina") },
    { id: "progresion_1", nombre: "Primera subida de peso", icono: "trend-up", ok: subidasDePeso.size >= 1 },
    { id: "progresion_5", nombre: "Subida en 5 ejercicios", icono: "trend-up", ok: subidasDePeso.size >= 5 },
    { id: "peso_2", nombre: "−2 kg", icono: "scales", ok: perdido >= 2 },
    { id: "peso_5", nombre: "−5 kg", icono: "scales", ok: perdido >= 5 },
    { id: "peso_10", nombre: "−10 kg", icono: "scales", ok: perdido >= 10 },
    { id: "recompensa_1", nombre: "Primera recompensa canjeada", icono: "gift", ok: vida.recompensas.some((r) => r.estado === "canjeada") },
    { id: "estudio_fase2", nombre: "Fase 2 de estudio", icono: "graduation-cap", ok: faseEstudio() >= 2 },
    { id: "estudio_fase4", nombre: "Fase 4: una hora al día", icono: "graduation-cap", ok: faseEstudio() >= 4 },
  ];
}

// ---------- Cartera de inversiones ----------
//
// Las posiciones se apuntan a mano (Trade Republic no tiene una conexión
// pública que la app pueda usar). Los precios sí se pueden refrescar:
// las criptomonedas desde CoinGecko sin ninguna clave, y las acciones y
// ETF desde Finnhub si hay una clave gratuita guardada en la
// configuración; si no, el precio se pone a mano y la app calcula igual.

export function resumenCartera() {
  let invertido = 0;
  let valor = 0;
  const posiciones = vida.inversiones.map((p) => {
    const unidades = Number(p.unidades ?? 0);
    const inv = unidades * Number(p.precio_compra ?? 0);
    const val = unidades * Number(p.precio_actual ?? p.precio_compra ?? 0);
    invertido += inv;
    valor += val;
    return { ...p, invertido: inv, valor: val, pl: val - inv, plPct: inv > 0 ? ((val - inv) / inv) * 100 : 0 };
  });
  return { posiciones, invertido, valor, pl: valor - invertido, plPct: invertido > 0 ? ((valor - invertido) / invertido) * 100 : 0 };
}

// Señales educativas sobre la cartera. Son reglas fijas y transparentes,
// no consejo financiero: cada una dice qué mira y por qué avisa.
export function senalesCartera() {
  const r = resumenCartera();
  const senales = [];
  if (r.posiciones.length === 0) return senales;

  const mayor = [...r.posiciones].sort((a, b) => b.valor - a.valor)[0];
  if (r.valor > 0 && mayor.valor / r.valor > 0.4 && r.posiciones.length > 1) {
    senales.push(`"${mayor.nombre}" es el ${Math.round((mayor.valor / r.valor) * 100)} % de tu cartera. Mucho peso en una sola cosa: si cae, cae todo contigo.`);
  }
  const cripto = r.posiciones.filter((p) => p.tipo === "cripto").reduce((acc, p) => acc + p.valor, 0);
  if (r.valor > 0 && cripto / r.valor > 0.5) {
    senales.push(`Más de la mitad de la cartera es cripto (${Math.round((cripto / r.valor) * 100)} %). Es lo más volátil que hay: que no sea dinero que puedas necesitar.`);
  }
  r.posiciones
    .filter((p) => p.plPct <= -15)
    .forEach((p) => senales.push(`"${p.nombre}" cae un ${Math.abs(p.plPct).toFixed(0)} %. Antes de vender por miedo, recuerda por qué la compraste: vender abajo convierte una caída en una pérdida.`));
  if (r.posiciones.length > 0 && r.posiciones.length < 3 && !r.posiciones.some((p) => p.tipo === "etf")) {
    senales.push("Pocas posiciones y ningún fondo indexado. Un ETF mundial (tipo MSCI World) es la forma más simple de diversificar sin pensar.");
  }
  const hoy = fechaISO();
  const viejas = r.posiciones.filter((p) => p.precio_actualizado && diasEntre(p.precio_actualizado, hoy) > 7);
  if (viejas.length) senales.push(`Hay precios sin actualizar desde hace más de una semana: la ganancia que ves puede no ser la real.`);
  return senales;
}

function diasEntre(aISO, bISO) {
  return Math.round((new Date(bISO + "T12:00:00") - new Date(aISO.slice(0, 10) + "T12:00:00")) / 86400000);
}

// Interés compuesto, mes a mes: lo que valdría aportar `mensual` cada mes
// partiendo de `inicial`, a un `anualPct` estimado. Devuelve un punto por
// año para pintar la curva junto a lo aportado sin invertir.
export function proyeccion(inicial, mensual, anualPct, anos) {
  const rMes = Math.pow(1 + anualPct / 100, 1 / 12) - 1;
  const puntos = [{ ano: 0, aportado: inicial, valor: inicial }];
  let valor = inicial;
  let aportado = inicial;
  for (let mes = 1; mes <= anos * 12; mes++) {
    valor = valor * (1 + rMes) + mensual;
    aportado += mensual;
    if (mes % 12 === 0) puntos.push({ ano: mes / 12, aportado, valor });
  }
  return puntos;
}

// Refrescar precios. Devuelve { actualizadas, errores } y va escribiendo
// precio_actual y precio_actualizado en cada posición que consigue.
export async function actualizarPrecios() {
  const errores = [];
  let actualizadas = 0;
  const hoy = fechaISO();

  // Criptos: CoinGecko, gratis y sin clave. El "simbolo" es su id
  // (bitcoin, ethereum, solana…), en minúsculas.
  const criptos = vida.inversiones.filter((p) => p.tipo === "cripto" && p.simbolo);
  if (criptos.length) {
    try {
      const ids = [...new Set(criptos.map((p) => p.simbolo.toLowerCase().trim()))].join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`);
      if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
      const precios = await r.json();
      for (const p of criptos) {
        const eur = precios[p.simbolo.toLowerCase().trim()]?.eur;
        if (eur > 0) {
          await updateInversion(p.id, { precio_actual: eur, precio_actualizado: hoy });
          actualizadas++;
        } else errores.push(`No encuentro "${p.simbolo}" en CoinGecko (usa su id: bitcoin, ethereum…)`);
      }
    } catch (e) {
      errores.push("CoinGecko no responde ahora mismo. Prueba en un rato.");
    }
  }

  // Acciones y ETF: Finnhub con clave gratuita. Cotizan en su divisa
  // (las de EE. UU. en dólares): si la posición está marcada en USD se
  // convierte a euros con el cambio del BCE (frankfurter.app, sin clave).
  const bolsa = vida.inversiones.filter((p) => p.tipo !== "cripto" && p.simbolo);
  if (bolsa.length) {
    const clave = vida.sistema.finnhub_key;
    if (!clave) {
      errores.push("Para acciones y ETF hace falta una clave gratuita de finnhub.io (se guarda una sola vez). Mientras, pon el precio a mano con el lápiz.");
    } else {
      let usdEur = null;
      try {
        for (const p of bolsa) {
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(p.simbolo.toUpperCase().trim())}&token=${clave}`);
          if (!r.ok) throw new Error(`Finnhub ${r.status}`);
          const q = await r.json();
          if (!(q.c > 0)) {
            errores.push(`Finnhub no cotiza "${p.simbolo}". Prueba el símbolo de EE. UU. o pon el precio a mano.`);
            continue;
          }
          let precio = q.c;
          if ((p.divisa || "USD") === "USD") {
            if (usdEur === null) {
              const rc = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR");
              usdEur = rc.ok ? (await rc.json()).rates?.EUR ?? null : null;
            }
            if (usdEur) precio = q.c * usdEur;
            else {
              errores.push("No pude traer el cambio dólar-euro; ese precio queda sin actualizar.");
              continue;
            }
          }
          await updateInversion(p.id, { precio_actual: Math.round(precio * 10000) / 10000, precio_actualizado: hoy });
          actualizadas++;
        }
      } catch (e) {
        errores.push("Finnhub no responde (¿la clave es correcta?).");
      }
    }
  }

  return { actualizadas, errores };
}
// vida:fin
