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
import { db } from "./firebase-init.js?v=68";
import { fechaISO } from "./db.js?v=68";
import { perfilVisto, esGaby } from "./vida-perfil.js?v=68";

// ---------- Las reglas del sistema, una por perfil ----------
//
// Desde que la app es de los dos, cada perfil tiene SU rutina: sus
// innegociables, su semana tipo, su horario y sus metas. Las constantes
// exportadas de siempre (INNEGOCIABLES, SEMANA_TIPO…) siguen existiendo
// con el mismo nombre — se les asigna la versión del perfil que se está
// viendo al cargar (cambiar de perfil recarga la app), así que ninguna
// vista ha tenido que cambiar.

const INNEGOCIABLES_JERRY = [
  { id: "sin_comida_fuera", nombre: "Sin comida fuera sin planificar", icono: "fork-knife" },
  { id: "estudio", nombre: "Estudio", icono: "graduation-cap" },
  { id: "entreno", nombre: "El entreno que toque", icono: "barbell" },
  { id: "sueno", nombre: "En la cama antes de las 23:15", icono: "moon-stars" },
];

const BONUS_JERRY = [
  { id: "fruta_4", nombre: "4 piezas de fruta", icono: "orange-slice" },
  { id: "dientes_3", nombre: "Dientes 3 veces", icono: "tooth" },
  { id: "cena_preparada", nombre: "Cena dejada preparada", icono: "cooking-pot" },
  { id: "verdura", nombre: "Algo de verdura", icono: "carrot" },
];

// Los de Gaby: levantarse a la primera (su jefe final es el posponer),
// los dientes (el hábito que quiere interiorizar, empezando por una vez),
// la casa y dormir a la hora. Son un borrador para revisar juntos.
const INNEGOCIABLES_GABY = [
  { id: "levantarse", nombre: "Levantarse a la primera (máx. 1 posponer)", icono: "alarm" },
  { id: "dientes", nombre: "Lavarse los dientes", icono: "tooth" },
  { id: "casa", nombre: "La tarea de casa del día", icono: "broom" },
  { id: "sueno", nombre: "A dormir a la hora (los dos)", icono: "moon-stars" },
];

const BONUS_GABY = [
  { id: "yoga", nombre: "Yoga o un paseo", icono: "flower-lotus" },
  { id: "sin_comida_fuera", nombre: "Sin comida fuera sin planificar", icono: "fork-knife" },
  { id: "proyecto", nombre: "Avanzar el ciclo o su videojuego", icono: "rocket" },
  { id: "agua", nombre: "Beber agua de verdad", icono: "drop" },
];

export const PUNTOS_INNEGOCIABLE = 25;
export const PUNTOS_BONUS = 5;

// La semana tipo: qué toca cada día (getDay(): 0 = domingo).
const SEMANA_TIPO_JERRY = {
  1: { tipo: "fuerza_A", nombre: "Fuerza A — Empuje + cuádriceps" },
  2: { tipo: "caminata", nombre: "Caminata con elevación, 35 min" },
  3: { tipo: "fuerza_B", nombre: "Fuerza B — Tirón + femoral" },
  4: { tipo: "piscina", nombre: "Piscina con tu hermano" },
  5: { tipo: "fuerza_C", nombre: "Fuerza C — Full body" },
  6: { tipo: "libre", nombre: "Libre o caminata suave" },
  0: { tipo: "descanso", nombre: "Descanso · batch cooking" },
};

const SEMANA_TIPO_GABY = {
  1: { tipo: "caminata", nombre: "Paseo o descanso activo" },
  2: { tipo: "yoga", nombre: "Yoga con la abuela (09:30)" },
  3: { tipo: "caminata", nombre: "Paseo o descanso activo" },
  4: { tipo: "yoga", nombre: "Yoga con la abuela (09:30)" },
  5: { tipo: "caminata", nombre: "Paseo o lo que apetezca" },
  6: { tipo: "libre", nombre: "Libre — hoy la tienda es hasta las 23:00" },
  0: { tipo: "descanso", nombre: "Descanso · familia" },
};

export const NOMBRE_TIPO_ENTRENO = {
  fuerza_A: "Fuerza A",
  fuerza_B: "Fuerza B",
  fuerza_C: "Fuerza C",
  piscina: "Piscina",
  caminata: "Caminata",
  yoga: "Yoga",
  libre: "Libre",
};

// Los chips de la pantalla Entreno, por perfil: Gaby no levanta pesas
// (por ahora), registra yoga y paseos.
const TIPOS_ENTRENO_JERRY = ["fuerza_A", "fuerza_B", "fuerza_C", "piscina", "caminata"];
const TIPOS_ENTRENO_GABY = ["yoga", "caminata"];

// Los planes de fuerza, con el rango de la doble progresión y el peso de
// arranque pactado. repsPorPierna/segundos solo cambian la etiqueta.
// Gaby no tiene planes de fuerza: su entreno son el yoga y los paseos.
const PLANES_GABY = {};
const PLANES_JERRY = {
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
const ROTACION_COMIDAS_JERRY = [
  "Pollo al horno + arroz + sofrito",
  "Lentejas con chorizo",
  "Albóndigas en salsa + patata",
  "Pasta boloñesa (verdura en la salsa)",
  "Arroz a la cubana",
  "Merluza o salmón al horno + patata",
];

const ROTACION_CENAS_JERRY = [
  "Tortilla de patata",
  "Pechuga a la plancha + huevo",
  "Crema de calabacín + jamón",
  "Sándwich integral de pollo",
  "Revuelto de huevos con jamón",
  "Yogur griego + fruta + frutos secos",
];

const ROTACION_COMIDAS_GABY = [
  "Pasta con lo que haya",
  "Cuscús con pollo",
  "Ensalada de pollo con queso (sin tomate)",
  "Arroz con huevo",
  "Patatas con salchichas",
  "Hamburguesas caseras",
];

const ROTACION_CENAS_GABY = [
  "Sándwich caliente",
  "Sopa de caldo de pollo",
  "Crepes salados",
  "Salchichas con huevo",
  "Yogur con frutos secos",
  "Sándwich de atún",
];

export function sugerenciaDelDia(lista, fecha = new Date()) {
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  const diaDelAno = Math.floor((fecha - inicio) / 86400000);
  return lista[diaDelAno % lista.length];
}

// Las metas fijas que se marcan a mano en Progreso.
const METAS_MANUALES_JERRY = [
  { id: "az900", nombre: "AZ-900 aprobado", grupo: "Estudio" },
  { id: "fisio", nombre: "Consulta de fisio por la ingle", grupo: "Salud" },
  { id: "a2_psicotecnico", nombre: "Psicotécnico", grupo: "Carnet A2" },
  { id: "a2_tasa", nombre: "Tasa DGT pagada", grupo: "Carnet A2" },
  { id: "a2_teorico", nombre: "Teórico de moto aprobado", grupo: "Carnet A2" },
  { id: "a2_circuito", nombre: "Práctico de circuito", grupo: "Carnet A2" },
  { id: "a2_circulacion", nombre: "Práctico de circulación", grupo: "Carnet A2" },
];

const METAS_MANUALES_GABY = [
  { id: "mk_matricula", nombre: "Matrícula hecha", grupo: "Ciclo de Marketing" },
  { id: "mk_empezar", nombre: "Empezar las clases (septiembre)", grupo: "Ciclo de Marketing" },
  { id: "mk_primero", nombre: "Primer curso aprobado", grupo: "Ciclo de Marketing" },
  { id: "mk_segundo", nombre: "Segundo curso aprobado", grupo: "Ciclo de Marketing" },
  { id: "mk_titulo", nombre: "¡Titulación de Marketing!", grupo: "Ciclo de Marketing" },
  { id: "vj_diseno", nombre: "El videojuego: idea y diseño en papel", grupo: "Sus proyectos" },
  { id: "vj_demo", nombre: "El videojuego: primera demo jugable", grupo: "Sus proyectos" },
  { id: "vj_publicado", nombre: "El videojuego: ¡publicado!", grupo: "Sus proyectos" },
  { id: "negocio_plan", nombre: "El plan del negocio propio, escrito", grupo: "Sus proyectos" },
];

export const FASES_ESTUDIO = { 1: 30, 2: 40, 3: 50, 4: 60 };

// El objetivo de peso es cosa de Jerry (84 kg). Gaby no tiene uno: su
// pantalla de Progreso no enseña esa parte salvo que algún día lo quiera.
const PESO_OBJETIVO_JERRY = 84;
const PESO_OBJETIVO_GABY = null;

// ---------- La asignación por perfil ----------
// Se decide una vez por carga (cambiar de perfil recarga la app), y las
// vistas siguen importando los nombres de siempre.

export let INNEGOCIABLES = INNEGOCIABLES_JERRY;
export let BONUS = BONUS_JERRY;
export let SEMANA_TIPO = SEMANA_TIPO_JERRY;
export let PLANES = PLANES_JERRY;
export let TIPOS_ENTRENO = TIPOS_ENTRENO_JERRY;
export let ROTACION_COMIDAS = ROTACION_COMIDAS_JERRY;
export let ROTACION_CENAS = ROTACION_CENAS_JERRY;
export let METAS_MANUALES = METAS_MANUALES_JERRY;
export let PESO_OBJETIVO_KG = PESO_OBJETIVO_JERRY;

if (esGaby()) {
  INNEGOCIABLES = INNEGOCIABLES_GABY;
  BONUS = BONUS_GABY;
  SEMANA_TIPO = SEMANA_TIPO_GABY;
  PLANES = PLANES_GABY;
  TIPOS_ENTRENO = TIPOS_ENTRENO_GABY;
  ROTACION_COMIDAS = ROTACION_COMIDAS_GABY;
  ROTACION_CENAS = ROTACION_CENAS_GABY;
  METAS_MANUALES = METAS_MANUALES_GABY;
  PESO_OBJETIVO_KG = PESO_OBJETIVO_GABY;
}

// ---------- Rutinas propias ----------
//
// Cada uno puede crearse sus rutinas desde la pantalla Entreno (calistenia,
// máquinas, estiramientos, lo que sea) sin pedirle nada a nadie: viven en
// SU configuración (sistema.rutinas) y aquí se suman a las de serie cada
// vez que llega el documento. Una rutina con ejercicios funciona como los
// planes de fuerza (series, rango de reps y doble progresión incluida);
// una sin ejercicios es una sesión simple, como la caminata.
const BASE_PLANES = PLANES;
const BASE_TIPOS = TIPOS_ENTRENO;

export const esRutinaPropia = (tipo) => typeof tipo === "string" && tipo.startsWith("rut_");

export function rutinaPorTipo(tipo) {
  if (!esRutinaPropia(tipo)) return null;
  const id = tipo.slice(4);
  return (vida.sistema.rutinas || []).find((r) => String(r.id) === id) || null;
}

function aplicarRutinasPropias() {
  const rutinas = Array.isArray(vida.sistema.rutinas) ? vida.sistema.rutinas : [];
  PLANES = { ...BASE_PLANES };
  TIPOS_ENTRENO = [...BASE_TIPOS];
  for (const r of rutinas) {
    const tipo = "rut_" + r.id;
    TIPOS_ENTRENO.push(tipo);
    NOMBRE_TIPO_ENTRENO[tipo] = r.nombre || "Rutina";
    if (Array.isArray(r.ejercicios) && r.ejercicios.length) PLANES[tipo] = r.ejercicios;
  }
}

// ---------- Estado y listeners propios ----------

export const vida = {
  dias: [],          // documentos de dias/, uno por fecha cerrada — DEL PERFIL VISTO
  entrenos: [],
  recompensas: [],
  inversiones: [],   // posiciones de la cartera (Trade Republic, apuntadas a mano)
  sistema: {},       // configuracion/sistema (o sistema_gaby): el del perfil visto
  menu: {},          // configuracion/menu: el menú DE CASA, común a los dos
  sinPermisos: false, // true si las reglas nuevas aún no están publicadas
  listo: false,
};

const col = (n) => collection(db, n);
let iniciado = false;
let onChange = null;

// Los días de los DOS viven en la misma colección `dias` (así no hay que
// republicar reglas): los de Jerry con la fecha como id, como siempre, y
// los de Gaby con el prefijo "g-" para que dos cierres del mismo día no
// choquen. Al filtrar por perfil el id se normaliza a la fecha otra vez,
// que es lo que espera todo el cálculo de rachas y semanas.
const docIdDia = (fechaId) => (esGaby() ? "g-" + fechaId : fechaId);

// Copias sin filtrar y la configuración de los dos perfiles: hacen falta
// para la comparativa cara a cara de rachas.
const crudosVida = { dias: [], entrenos: [], recompensas: [], inversiones: [] };
const sistemas = { jerry: {}, gaby: {} };

const esDelPerfil = (d, perfil = perfilVisto()) => (d.perfil || "jerry") === perfil;

function diasDePerfil(perfil) {
  const inicio = sistemas[perfil].fecha_inicio;
  return crudosVida.dias
    .filter((d) => esDelPerfil(d, perfil))
    .map((d) => ({ ...d, id: d.fecha || d.id }))
    .filter((d) => !inicio || d.id >= inicio)
    .sort((a, b) => a.id.localeCompare(b.id));
}

// La rutina no empieza sola: empieza el día que se pulsa START en la
// pantalla Hoy, y esa fecha queda en el `fecha_inicio` del sistema DE ESE
// PERFIL. Cualquier día cerrado antes (pruebas, trasteos) se aparta aquí,
// en un único sitio, junto con el filtro por perfil.
function aplicarFiltros() {
  vida.dias = diasDePerfil(perfilVisto());
  vida.entrenos = crudosVida.entrenos.filter((e) => esDelPerfil(e)).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  vida.recompensas = crudosVida.recompensas.filter((r) => esDelPerfil(r));
  vida.inversiones = crudosVida.inversiones.filter((p) => esDelPerfil(p)).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  vida.sistema = sistemas[perfilVisto()];
  aplicarRutinasPropias();
}

export const rutinaEmpezada = () => Boolean(vida.sistema.fecha_inicio);

// Qué día de la rutina es una fecha: 1 el día del Start, 2 el siguiente...
// null si aún no se ha empezado o la fecha es anterior.
export function diaDeRutina(fechaId = fechaISO()) {
  const inicio = vida.sistema.fecha_inicio;
  if (!inicio || fechaId < inicio) return null;
  const ms = new Date(fechaId + "T12:00:00") - new Date(inicio + "T12:00:00");
  return Math.round(ms / 86400000) + 1;
}

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

  escucha("dias", (docs) => {
    crudosVida.dias = docs;
    aplicarFiltros();
  });
  escucha("entrenos", (docs) => {
    crudosVida.entrenos = docs;
    aplicarFiltros();
  });
  escucha("recompensas", (docs) => {
    crudosVida.recompensas = docs;
    aplicarFiltros();
  });
  escucha("inversiones", (docs) => {
    crudosVida.inversiones = docs;
    aplicarFiltros();
  });
  // El menú es DE CASA: un solo documento para los dos perfiles, porque
  // desayunan, comen y cenan lo mismo y así nadie cocina dos veces.
  onSnapshot(
    doc(db, "configuracion", "menu"),
    (snap) => {
      vida.menu = snap.exists() ? snap.data() : {};
      onChange?.();
    },
    () => onChange?.()
  );
  // La configuración de los DOS perfiles, siempre: la del visto manda en
  // vida.sistema, y la del otro hace falta para el cara a cara de rachas.
  // El filtro depende de fecha_inicio y estos documentos pueden llegar
  // después de los días: se reaplica con cada cambio.
  const escuchaSistema = (perfil, docId) =>
    onSnapshot(
      doc(db, "configuracion", docId),
      (snap) => {
        sistemas[perfil] = snap.exists() ? snap.data() : {};
        aplicarFiltros();
        onChange?.();
      },
      () => onChange?.()
    );
  escuchaSistema("jerry", "sistema");
  escuchaSistema("gaby", "sistema_gaby");
}

// Todo lo que se crea queda sellado con el perfil que se está viendo, y
// el sistema/menú de cada uno vive en su propio documento.
const sellar = (data) => ({ ...data, perfil: perfilVisto() });
export const guardarDia = (fechaId, data) => setDoc(doc(db, "dias", docIdDia(fechaId)), sellar({ ...data, fecha: fechaId }), { merge: true });
export const addEntreno = (data) => addDoc(col("entrenos"), sellar(data));
export const updateEntreno = (id, data) => updateDoc(doc(db, "entrenos", id), data);
export const deleteEntreno = (id) => deleteDoc(doc(db, "entrenos", id));
export const addRecompensa = (data) => addDoc(col("recompensas"), sellar(data));
export const updateRecompensa = (id, data) => updateDoc(doc(db, "recompensas", id), data);
export const deleteRecompensa = (id) => deleteDoc(doc(db, "recompensas", id));
export const guardarSistema = (data) => setDoc(doc(db, "configuracion", esGaby() ? "sistema_gaby" : "sistema"), data, { merge: true });
export const guardarMenu = (data) => setDoc(doc(db, "configuracion", "menu"), data, { merge: true });
export const addInversion = (data) => addDoc(col("inversiones"), sellar(data));
export const updateInversion = (id, data) => updateDoc(doc(db, "inversiones", id), data);
export const deleteInversion = (id) => deleteDoc(doc(db, "inversiones", id));

// ---------- Cara a cara ----------

// Las rachas de los dos, para la comparativa sana. Solo cuenta un perfil
// que ya ha pulsado su START; hasta entonces sale null.
export function rachasCaraACara() {
  const de = (perfil) => {
    if (!sistemas[perfil].fecha_inicio) return null;
    return calcularRachaEn(diasDePerfil(perfil));
  };
  return { jerry: de("jerry"), gaby: de("gaby") };
}

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
  if (esGaby()) return fecha.getDay() === 6 ? "Sábado: máximo las 00:00" : "A dormir a la hora (los dos)";
  return fecha.getDay() === 6 ? "No pasar de las 00:00 (sábado)" : "En la cama antes de las 23:15";
}

// ---------- Racha y semanas ----------

// Días consecutivos cumplidos. Un día fallado suelto no la rompe (no suma,
// pero se perdona); DOS fallados seguidos la reinician. Un día pasado sin
// cerrar cuenta como fallado: si no se apuntó, no se cumplió.
export function calcularRacha(hastaHoy = fechaISO()) {
  return calcularRachaEn(vida.dias, hastaHoy);
}

function calcularRachaEn(dias, hastaHoy = fechaISO()) {
  if (dias.length === 0) return { actual: 0, mejor: 0 };
  const porFecha = new Map(dias.map((d) => [d.id, d]));
  const primera = dias[0].id;
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

// ---------- El día, hora a hora ----------
//
// El horario de cada tipo de día, con las tareas de casa metidas en los
// huecos del trabajo (que es donde de verdad se hacen). La pantalla Hoy lo
// pinta y marca en qué bloque estás ahora mismo.

function horarioLaborable(nombreEntreno) {
  return [
    { h: "07:45", titulo: "Levantarse", detalle: "Cara y dientes (1)" },
    { h: "08:00", titulo: "Trabajo", detalle: "Desayuno en la primera hora: proteína + fruta" },
    { h: "09:30", titulo: "Hueco de casa", detalle: "Hacer la cama · barrer u ordenar un poco" },
    { h: "11:00", titulo: "Fruta 1", detalle: "Y la lavadora: poner, tender o recoger la ropa" },
    { h: "13:30", titulo: "Hueco de cocina", detalle: "Dejar la CENA preparada · lavar los platos" },
    { h: "15:00", titulo: "Comer", detalle: "Dientes (2) · fruta 2 de postre" },
    { h: "15:40", titulo: "Estudio", detalle: "El bloque de verdad, en la mesa" },
    { h: "16:10", titulo: "Siesta corta o libre", detalle: "Alarma: nunca más allá de las 17:00" },
    { h: "17:30", titulo: "Salir al gimnasio", detalle: "Mochila hecha · fruta 3 por el camino" },
    { h: "17:55", titulo: nombreEntreno, detalle: "Ducha allí" },
    { h: "20:00", titulo: "Tienda", detalle: "" },
    { h: "22:40", titulo: "En casa · cenar", detalle: "La cena ya estaba hecha: solo calentar" },
    { h: "23:15", titulo: "Dormir", detalle: "Dientes (3) · móvil fuera de la cama" },
  ];
}

function horarioTardeLibre(queToca) {
  return [
    { h: "07:45", titulo: "Levantarse", detalle: "Cara y dientes (1)" },
    { h: "08:00", titulo: "Trabajo", detalle: "Desayuno en la primera hora: proteína + fruta" },
    { h: "09:30", titulo: "Hueco de casa", detalle: "Hacer la cama · barrer u ordenar un poco" },
    { h: "11:00", titulo: "Fruta 1", detalle: "Y la lavadora: poner, tender o recoger la ropa" },
    { h: "13:30", titulo: "Hueco de cocina", detalle: "Dejar la CENA preparada · lavar los platos" },
    { h: "15:00", titulo: "Comer", detalle: "Dientes (2) · fruta 2 de postre" },
    { h: "15:40", titulo: "Estudio", detalle: "El bloque de verdad, en la mesa" },
    { h: "16:10", titulo: "Tarde libre", detalle: queToca },
    { h: "20:45", titulo: "Salir hacia la tienda", detalle: "Como muy tarde" },
    { h: "22:40", titulo: "En casa · cenar", detalle: "La cena ya estaba hecha" },
    { h: "23:15", titulo: "Dormir", detalle: "Dientes (3) · móvil fuera de la cama" },
  ];
}

// El día de Gaby, según lo contado: le cuesta levantarse (posponer es el
// jefe final), martes y jueves yoga con la abuela y todo lo que arrastra
// (ducha y desayuno allí, compra, vuelta a las 13:00 y pico), comida
// juntos sobre las 14:00-14:30, tarde de casa/ratito libre/siesta, tienda
// de 19:00 a 22:00 (sábado hasta las 23:00), dejar el dinero y a casa.
// En septiembre cambiará (ciclo + quizá mañanas): esto se reescribe entero
// cuando toque.
function bloquesGaby(fecha) {
  const dia = fecha.getDay();
  const tarde = [
    { h: "18:15", titulo: "Prepararse para la tienda", detalle: "" },
    { h: "19:00", titulo: "Trabajo en la tienda", detalle: dia === 6 ? "Hasta las 23:00" : "Hasta las 22:00" },
    { h: dia === 6 ? "23:10" : "22:15", titulo: "Dejar el dinero", detalle: "En casa de la madre de Jerry" },
    { h: dia === 6 ? "23:40" : "22:45", titulo: "En casa: ducha o pies + cena", detalle: "" },
    { h: dia === 6 ? "00:00" : "23:15", titulo: "Dormir", detalle: "Dientes 🦷 · móvil fuera de la cama" },
  ];
  if (dia === 2 || dia === 4)
    return [
      { h: "08:00", titulo: "Levantarse", detalle: "A la primera: posponer es el jefe final 😴" },
      { h: "08:45", titulo: "Prepararse", detalle: "Ropa de yoga y a casa de la abuela" },
      { h: "09:30", titulo: "Yoga con la abuela", detalle: "Hasta las 10:30" },
      { h: "10:35", titulo: "Ducha y desayuno", detalle: "En casa de la abuela, con calma · dientes 🦷" },
      { h: "12:15", titulo: "Compra para comer", detalle: "Lo del menú de hoy" },
      { h: "13:15", titulo: "Vuelta a casa", detalle: "" },
      { h: "14:00", titulo: "Comer juntos", detalle: "" },
      { h: "15:00", titulo: "Casa y ratito libre", detalle: "Arreglar un poco · TikTok/iPad con final" },
      { h: "16:30", titulo: "Siesta", detalle: "Alarma: no más allá de las 17:45" },
      ...tarde,
    ];
  if (dia === 6)
    return [
      { h: "09:00", titulo: "Levantarse con calma", detalle: "" },
      { h: "11:00", titulo: "Casa o visita", detalle: "Madre, abuela… o día de chicas 💅" },
      { h: "14:00", titulo: "Comer", detalle: "" },
      { h: "16:00", titulo: "Tarde libre", detalle: "Siesta si apetece" },
      ...tarde,
    ];
  if (dia === 0)
    return [
      { h: "09:30", titulo: "Levantarse con calma", detalle: "" },
      { h: "11:00", titulo: "Familia o plan juntos", detalle: "Abuela, madre, día de chicas" },
      { h: "14:00", titulo: "Comer", detalle: "" },
      { h: "16:00", titulo: "Descanso de verdad", detalle: "" },
      { h: "21:00", titulo: "Preparar la semana", detalle: "Menú a la vista · ropa lista" },
      { h: "23:15", titulo: "Dormir", detalle: "Dientes 🦷" },
    ];
  return [
    { h: "08:00", titulo: "Levantarse", detalle: "A la primera (máx. 1 posponer)" },
    { h: "08:30", titulo: "Desayuno", detalle: "Del menú de la semana · dientes 🦷" },
    { h: "09:30", titulo: "Compra o recados", detalle: "Si toca" },
    { h: "10:30", titulo: "Arreglar la casa", detalle: "La tarea del día" },
    { h: "11:30", titulo: "Ratito libre", detalle: "TikTok, juegos, iPad — con final" },
    { h: "14:00", titulo: "Comer juntos", detalle: "" },
    { h: "15:00", titulo: "Tarde tranquila", detalle: "Proyecto, ciclo o descanso" },
    { h: "16:30", titulo: "Siesta", detalle: "Alarma puesta" },
    ...tarde,
  ];
}

// El horario de serie de cada perfil (lo que había hasta ahora).
function bloquesDeSerie(fecha = new Date()) {
  if (esGaby()) return bloquesGaby(fecha);
  const dia = fecha.getDay();
  if (dia === 1 || dia === 3) return horarioLaborable(SEMANA_TIPO[dia].nombre);
  if (dia === 2) return horarioTardeLibre("Caminata con elevación (35 min) cuando mejor te venga");
  if (dia === 4) return horarioTardeLibre("Piscina con tu hermano");
  if (dia === 5)
    return [
      { h: "07:45", titulo: "Levantarse", detalle: "Cara y dientes (1)" },
      { h: "08:00", titulo: "Trabajo (hasta las 14:30)", detalle: "Desayuno en la primera hora" },
      { h: "09:30", titulo: "Hueco de casa", detalle: "Hacer la cama · barrer u ordenar un poco" },
      { h: "11:00", titulo: "Fruta 1", detalle: "Y la lavadora: poner, tender o recoger" },
      { h: "13:30", titulo: "Hueco de cocina", detalle: "Cena preparada · platos" },
      { h: "14:45", titulo: "Comer", detalle: "Dientes (2) · fruta de postre" },
      { h: "15:30", titulo: "Estudio", detalle: "" },
      { h: "16:15", titulo: "Compra de fruta", detalle: "Para media semana — se compra dos veces, no una" },
      { h: "17:30", titulo: "Salir al gimnasio", detalle: "Fruta por el camino" },
      { h: "17:55", titulo: SEMANA_TIPO[5].nombre, detalle: "Ducha allí" },
      { h: "20:00", titulo: "Tienda", detalle: "" },
      { h: "22:40", titulo: "En casa · cenar", detalle: "" },
      { h: "23:15", titulo: "Dormir", detalle: "Dientes (3)" },
    ];
  if (dia === 6)
    return [
      { h: "09:30", titulo: "Levantarte con calma", detalle: "Hoy se recupera sueño" },
      { h: "11:00", titulo: "Tareas de casa", detalle: "Doblar la ropa · ordenar la casa" },
      { h: "13:00", titulo: "Libre", detalle: "Caminata suave si apetece" },
      { h: "15:00", titulo: "Comer", detalle: "" },
      { h: "16:00", titulo: "Tarde libre", detalle: "" },
      { h: "23:20", titulo: "Llegáis a casa", detalle: "Tu pareja sale a las 23:00" },
      { h: "00:00", titulo: "Tope para dormir", detalle: "El sábado el innegociable es no pasar de las 00:00" },
    ];
  return [
    { h: "09:30", titulo: "Levantarte con calma", detalle: "" },
    { h: "11:00", titulo: "Batch cooking (hasta las 13:00)", detalle: "Las comidas de la semana, del menú" },
    { h: "13:30", titulo: "Platos y cocina recogida", detalle: "" },
    { h: "15:00", titulo: "Comer", detalle: "" },
    { h: "16:00", titulo: "Descanso de verdad", detalle: "Es el día que sostiene la semana" },
    { h: "21:00", titulo: "Preparar la semana", detalle: "Mochila del gimnasio hecha · menú a la vista" },
    { h: "23:15", titulo: "Dormir", detalle: "" },
  ];
}

// Minutos de un bloque para ordenar y comparar. El "00:00" que no es el
// primer bloque del día es el final (medianoche de cierre), no el
// principio: cuenta como las 24:00.
function minutosDeBloque(h, esPrimero) {
  const [hh, mm] = String(h || "0:0").split(":").map(Number);
  let min = (hh || 0) * 60 + (mm || 0);
  if (!esPrimero && min === 0) min = 24 * 60;
  return min;
}

// El día, hora a hora, con las tres capas por orden:
// 1. El horario PROPIO de ese día de la semana, si se ha editado desde Hoy
//    (vive en sistema.horario, por perfil). Si no, el de serie.
// 2. Las citas e imprevistos SOLO de esa fecha (agenda del documento del
//    día), intercalados donde les toca por hora y marcados como cita.
export function bloquesDelDia(fecha = new Date()) {
  const propios = vida.sistema.horario?.[fecha.getDay()];
  const base = Array.isArray(propios) && propios.length ? propios : bloquesDeSerie(fecha);
  const agenda = diaPorFecha(fechaISO(fecha))?.agenda;
  if (!Array.isArray(agenda) || !agenda.length) return base;
  const todos = [
    ...base.map((b, i) => ({ b, min: minutosDeBloque(b.h, i === 0) })),
    ...agenda.map((a) => ({ b: { ...a, cita: true }, min: minutosDeBloque(a.h, false) })),
  ];
  todos.sort((x, y) => x.min - y.min);
  return todos.map((x) => x.b);
}

// ¿El horario de hoy es personalizado (editado o con citas)? Para saber
// cuándo tiene sentido avisar de que el entreno se quedó sin hueco.
export function horarioPersonalizado(fecha = new Date()) {
  const propios = vida.sistema.horario?.[fecha.getDay()];
  const agenda = diaPorFecha(fechaISO(fecha))?.agenda;
  return (Array.isArray(propios) && propios.length > 0) || (Array.isArray(agenda) && agenda.length > 0);
}

// Aviso suave: si el día está personalizado, hoy tocaba moverse y ningún
// bloque deja hueco para ello, se dice — porque un hueco que desaparece
// del horario es una meta que se resiente sin darse cuenta.
export function avisoDeEntrenoSinHueco(fecha = new Date()) {
  if (!horarioPersonalizado(fecha)) return null;
  const toca = SEMANA_TIPO[fecha.getDay()];
  if (!toca || toca.tipo === "descanso" || toca.tipo === "libre") return null;
  const MOVERSE = /entren|gim|fuerza|piscina|yoga|caminat|pase[oa]|calisten|estir/i;
  const hayHueco = bloquesDelDia(fecha).some((b) => MOVERSE.test(`${b.titulo || ""} ${b.detalle || ""}`));
  if (hayHueco) return null;
  return `Hoy tocaba ${toca.nombre} y el horario de hoy no le deja hueco. Si puedes, muévelo a otro rato — que un imprevisto no se lleve la meta por delante.`;
}

// En qué bloque estás ahora: el último cuya hora ya ha pasado. Antes del
// primero (madrugada) no hay bloque activo.
export function bloqueActual(fecha = new Date()) {
  const bloques = bloquesDelDia(fecha);
  const ahora = fecha.getHours() * 60 + fecha.getMinutes();
  let indice = -1;
  bloques.forEach((b, i) => {
    const [hh, mm] = b.h.split(":").map(Number);
    let min = hh * 60 + mm;
    // El "00:00" del sábado es el final del día, no el principio.
    if (i > 0 && min === 0) min = 24 * 60;
    if (ahora >= min) indice = i;
  });
  return indice;
}

// ---------- Ingredientes y menú semanal ----------
//
// Jerry marca qué ingredientes comería esta semana y el menú se genera solo
// con recetas cuyas piezas estén todas marcadas. Sin garbanzos ni atún de
// serie (no le gustan) y la verdura solo camuflada. Vive en
// configuracion/menu, así que no necesita reglas nuevas.

export const GRUPOS_INGREDIENTES = ["Proteína", "Hidratos", "Legumbres", "Verdura", "Lácteos y básicos"];

export const INGREDIENTES = [
  { id: "pollo", nombre: "Pollo", grupo: "Proteína" },
  { id: "ternera", nombre: "Ternera picada", grupo: "Proteína" },
  { id: "lomo", nombre: "Lomo de cerdo", grupo: "Proteína" },
  { id: "salmon", nombre: "Salmón", grupo: "Proteína" },
  { id: "merluza", nombre: "Merluza", grupo: "Proteína" },
  { id: "huevos", nombre: "Huevos", grupo: "Proteína" },
  { id: "jamon", nombre: "Jamón / fiambre de pavo", grupo: "Proteína" },
  { id: "chorizo", nombre: "Chorizo", grupo: "Proteína" },
  { id: "atun", nombre: "Atún en lata", grupo: "Proteína" },
  { id: "salchichas", nombre: "Salchichas", grupo: "Proteína" },
  { id: "bacon", nombre: "Bacon", grupo: "Proteína" },
  { id: "arroz", nombre: "Arroz", grupo: "Hidratos" },
  { id: "pasta", nombre: "Pasta", grupo: "Hidratos" },
  { id: "patata", nombre: "Patatas", grupo: "Hidratos" },
  { id: "pan", nombre: "Pan", grupo: "Hidratos" },
  { id: "avena", nombre: "Avena", grupo: "Hidratos" },
  { id: "wraps", nombre: "Tortillas de trigo (wraps)", grupo: "Hidratos" },
  { id: "cuscus", nombre: "Cuscús", grupo: "Hidratos" },
  { id: "harina", nombre: "Harina (crepes y pancakes)", grupo: "Hidratos" },
  { id: "masa_pizza", nombre: "Base de pizza", grupo: "Hidratos" },
  { id: "lentejas", nombre: "Lentejas", grupo: "Legumbres" },
  { id: "alubias", nombre: "Alubias", grupo: "Legumbres" },
  { id: "garbanzos", nombre: "Garbanzos", grupo: "Legumbres" },
  { id: "tomate", nombre: "Tomate frito / triturado", grupo: "Verdura" },
  { id: "cebolla", nombre: "Cebolla (en la salsa)", grupo: "Verdura" },
  { id: "zanahoria", nombre: "Zanahoria (triturada)", grupo: "Verdura" },
  { id: "calabacin", nombre: "Calabacín (en crema)", grupo: "Verdura" },
  { id: "espinacas", nombre: "Espinacas (trituradas)", grupo: "Verdura" },
  { id: "lechuga", nombre: "Lechuga (ensalada)", grupo: "Verdura" },
  { id: "brocoli", nombre: "Brócoli (con queso)", grupo: "Verdura" },
  { id: "yogur", nombre: "Yogur griego", grupo: "Lácteos y básicos" },
  { id: "queso", nombre: "Queso", grupo: "Lácteos y básicos" },
  { id: "leche", nombre: "Leche", grupo: "Lácteos y básicos" },
  { id: "fruta", nombre: "Fruta (todas)", grupo: "Lácteos y básicos" },
  { id: "frutossecos", nombre: "Frutos secos", grupo: "Lácteos y básicos" },
  { id: "mantequilla", nombre: "Mantequilla", grupo: "Lácteos y básicos" },
  { id: "cacao", nombre: "ColaCao / Cacaolat", grupo: "Lácteos y básicos" },
  { id: "caldo", nombre: "Caldo de pollo", grupo: "Lácteos y básicos" },
];

// Lo que arranca marcado: solo lo que les gusta A LOS DOS, porque el menú
// es de casa (el mismo para ambos, para no cocinar dos veces). Lo que uno
// no come, fuera de serie — y luego marcan y desmarcan juntos lo que sea.
const OFF_JERRY = new Set(["atun", "garbanzos", "calabacin", "espinacas"]);
const OFF_GABY = new Set([
  "fruta", "calabacin", "espinacas", "zanahoria", "cebolla",
  "garbanzos", "lentejas", "alubias", "salmon", "merluza", "lomo", "chorizo",
]);
const off = new Set([...OFF_JERRY, ...OFF_GABY]);
export const INGREDIENTES_POR_DEFECTO = INGREDIENTES.filter((i) => !off.has(i.id)).map((i) => i.id);

// Las recetas: req = lo que tiene que estar marcado; opc = mejora el plato
// si está, pero no bloquea. Cada una con su guía rápida.
export const RECETAS = [
  { id: "pollo_arroz", nombre: "Pollo al horno con arroz", momento: "comida", req: ["pollo", "arroz"], opc: ["tomate"], proteina: 34,
    pasos: ["Salpimienta el pollo y al horno: 200 °C, 35–40 min, vuelta a mitad.", "Hierve el arroz 12 min y escúrrelo.", "Si hay tomate frito, una cucharada sobre el arroz.", "Ración: 150 g de pollo ≈ 34 g de proteína."] },
  { id: "arroz_cubana", nombre: "Arroz a la cubana", momento: "comida", req: ["arroz", "huevos", "tomate"], opc: [], proteina: 16,
    pasos: ["Hierve el arroz 12 min.", "Fríe 2 huevos.", "Monta: arroz + tomate frito caliente + huevos encima.", "2 huevos ≈ 14 g de proteína; añade jamón si quieres más."] },
  { id: "macarrones", nombre: "Macarrones con carne", momento: "comida", req: ["pasta", "ternera", "tomate"], opc: ["cebolla", "zanahoria", "queso"], proteina: 32,
    pasos: ["Sofríe la ternera (150 g) hasta que pierda el rosa.", "Si hay cebolla o zanahoria: triturada dentro del tomate, ni la notas.", "Añade el tomate y deja 5 min a fuego bajo.", "Mezcla con la pasta cocida (10-11 min). Queso por encima si hay."] },
  { id: "albondigas", nombre: "Albóndigas en salsa con patatas", momento: "comida", req: ["ternera", "huevos", "patata", "tomate"], opc: ["cebolla", "zanahoria"], proteina: 35,
    pasos: ["Mezcla la ternera con 1 huevo y forma bolas.", "Dóralas en la sartén 5 min.", "Tritura tomate (+ zanahoria/cebolla si hay) y cuécelas 15 min dentro.", "Patatas cocidas o al microondas (8 min pinchadas) de guarnición."] },
  { id: "lentejas_chorizo", nombre: "Lentejas con chorizo", momento: "comida", req: ["lentejas", "chorizo"], opc: ["cebolla", "zanahoria", "patata"], proteina: 25,
    pasos: ["De bote: enjuaga las lentejas y calienta con el chorizo en rodajas 10 min.", "Si hay zanahoria/cebolla, triturada en el caldo.", "De domingo (batch): olla 30-35 min con todo dentro.", "Un plato grande ≈ 25 g de proteína entre lentejas y chorizo."] },
  { id: "salmon_patatas", nombre: "Salmón al horno con patatas", momento: "comida", req: ["salmon", "patata"], opc: [], proteina: 30,
    pasos: ["Patatas en rodajas finas, 20 min al horno a 200 °C.", "Pon el salmón encima y 12-15 min más.", "Sal, pimienta y un chorrito de aceite. Listo.", "150 g de salmón ≈ 30 g de proteína."] },
  { id: "merluza_arroz", nombre: "Merluza a la plancha con arroz", momento: "comida", req: ["merluza", "arroz"], opc: [], proteina: 28,
    pasos: ["Plancha fuerte: 3-4 min por cada lado de la merluza.", "Arroz hervido 12 min de guarnición.", "150 g de merluza ≈ 28 g de proteína, y casi nada de grasa."] },
  { id: "lomo_patatas", nombre: "Lomo a la plancha con patatas", momento: "comida", req: ["lomo", "patata"], opc: [], proteina: 33,
    pasos: ["Filetes de lomo a la plancha: 2-3 min por lado.", "Patatas al microondas 8 min (pinchadas) y un golpe de sartén.", "150 g de lomo ≈ 33 g de proteína."] },
  { id: "alubias_arroz", nombre: "Alubias con arroz", momento: "comida", req: ["alubias", "arroz"], opc: ["chorizo"], proteina: 20,
    pasos: ["De bote: enjuaga las alubias, calienta con un poco de tomate o chorizo.", "Arroz hervido aparte y todo junto al plato.", "Legumbre + arroz = proteína completa, ≈ 20 g el plato."] },
  { id: "pollo_pasta", nombre: "Pasta con pollo", momento: "comida", req: ["pasta", "pollo"], opc: ["tomate", "queso"], proteina: 38,
    pasos: ["Pollo en tiras a la sartén hasta dorar.", "Pasta cocida 10-11 min.", "Junta todo con tomate frito; queso por encima si hay.", "150 g de pollo ≈ 34 g de proteína + la de la pasta."] },
  { id: "tortilla", nombre: "Tortilla de patata", momento: "cena", req: ["huevos", "patata"], opc: ["cebolla"], proteina: 21,
    pasos: ["Patata en láminas finas: microondas 6-7 min o sartén.", "Bate 3 huevos, mezcla y cuaja a fuego medio 3 min por lado.", "Hecha por la mañana aguanta perfecta hasta la noche.", "3 huevos ≈ 21 g de proteína."] },
  { id: "pechuga_huevo", nombre: "Pechuga a la plancha + huevo", momento: "cena", req: ["pollo", "huevos"], opc: [], proteina: 41,
    pasos: ["Pechuga a la plancha 4 min por lado.", "Huevo frito o a la plancha encima.", "150 g + 1 huevo ≈ 41 g de proteína: la cena más rápida que existe."] },
  { id: "sandwich_pollo", nombre: "Sándwich de pollo", momento: "cena", req: ["pan", "pollo"], opc: ["queso"], proteina: 30,
    pasos: ["Sirve el pollo que sobró de la comida (o plancha rápida).", "Monta con queso y tuesta el sándwich 2 min por lado.", "Con 100 g de pollo ≈ 30 g de proteína."] },
  { id: "revuelto_jamon", nombre: "Revuelto de huevos con jamón", momento: "cena", req: ["huevos", "jamon"], opc: [], proteina: 24,
    pasos: ["Bate 3 huevos y al fuego suave, removiendo.", "Jamón en tiras al final, medio minuto.", "Con pan si toca. ≈ 24 g de proteína."] },
  { id: "wrap_pollo", nombre: "Wrap de pollo", momento: "cena", req: ["wraps", "pollo"], opc: ["queso"], proteina: 32,
    pasos: ["Pollo en tiras a la plancha.", "Rellena el wrap, queso si hay, y 1 min por lado en la sartén.", "≈ 32 g de proteína por wrap generoso."] },
  { id: "yogur_avena", nombre: "Bol de yogur griego con avena y fruta", momento: "cena", req: ["yogur", "avena"], opc: ["frutossecos"], proteina: 20,
    pasos: ["Yogur griego (200 g) + 3 cucharadas de avena.", "Fruta troceada encima (la 4 del día) y frutos secos si hay.", "Para los días que llegáis tardísimo. ≈ 20 g de proteína."] },
  { id: "huevos_rotos", nombre: "Huevos rotos con lomo", momento: "cena", req: ["huevos", "patata", "lomo"], opc: [], proteina: 35,
    pasos: ["Patatas en dados: microondas 7 min y sartén para dorar.", "Lomo en tiras a fuego fuerte 2 min.", "Dos huevos fritos encima y a romperlos. ≈ 35 g de proteína."] },
  { id: "crema_calabacin", nombre: "Crema de calabacín con jamón", momento: "cena", req: ["calabacin", "jamon"], opc: ["queso"], proteina: 15,
    pasos: ["Cuece calabacín troceado 15 min y tritura con un quesito.", "Jamón en tiras por encima.", "La verdura camuflada que mejor entra: es crema, no 'verdura'."] },
  { id: "tostas_huevo", nombre: "Tostas con huevo y queso", momento: "cena", req: ["pan", "huevos", "queso"], opc: ["jamon"], proteina: 22,
    pasos: ["Tuesta el pan.", "Huevos a la plancha encima y queso para que funda.", "Jamón si hay. ≈ 22 g de proteína."] },
];


// Desayunos y más platos. `aire: true` = se hace (o tiene versión) en la
// AirFryer. Lo "más sano" entra poco a poco: platos normales con mejores
// piezas, no lechuga por sorpresa.
RECETAS.push(
  { id: "d_yogur_fruta", nombre: "Yogur griego con fruta y avena", momento: "desayuno", req: ["yogur", "avena", "fruta"], opc: ["frutossecos"], proteina: 20,
    pasos: ["Yogur griego (200 g) en un bol.", "3 cucharadas de avena y la fruta troceada encima.", "Frutos secos si hay. Dos minutos y ≈ 20 g de proteína."] },
  { id: "d_porridge", nombre: "Porridge de avena con plátano", momento: "desayuno", req: ["avena", "leche", "fruta"], opc: [], proteina: 14,
    pasos: ["Avena (50 g) + leche (250 ml): microondas 2 min, remueve, 1 min más.", "Plátano en rodajas encima.", "Sacia muchísimo y aguanta hasta la comida."] },
  { id: "d_revuelto_pan", nombre: "Huevos revueltos con pan", momento: "desayuno", req: ["huevos", "pan"], opc: ["jamon"], proteina: 18,
    pasos: ["Bate 2-3 huevos y cuájalos a fuego suave removiendo.", "Pan tostado debajo o al lado.", "Con jamón, ≈ 24 g de proteína."] },
  { id: "d_sandwich", nombre: "Sándwich de jamón y queso", momento: "desayuno", req: ["pan", "jamon", "queso"], opc: [], proteina: 16,
    pasos: ["Monta y tuesta 2 min por lado (o 4 min en AirFryer a 180 °C).", "Con una pieza de fruta al lado, desayuno completo."], aire: true },
  { id: "d_tortitas", nombre: "Tortitas de avena y plátano", momento: "desayuno", req: ["avena", "huevos", "fruta"], opc: [], proteina: 17,
    pasos: ["Tritura 1 plátano + 2 huevos + 4 cucharadas de avena.", "Cucharones a la sartén: 2 min por lado.", "Sin azúcar y saben a dulce: el truco es el plátano."] },
  { id: "d_batido", nombre: "Batido de yogur, leche y fruta", momento: "desayuno", req: ["yogur", "leche", "fruta"], opc: ["avena"], proteina: 18,
    pasos: ["Todo a la batidora 30 segundos.", "Para los días con prisa: se bebe de camino.", "Con avena dentro llena como un desayuno entero."] },
  { id: "d_tostas_tomate", nombre: "Tostadas con tomate y jamón", momento: "desayuno", req: ["pan", "tomate", "jamon"], opc: [], proteina: 14,
    pasos: ["Pan tostado, tomate por encima y el jamón.", "Un chorrito de aceite. El desayuno de bar, en casa."] },
  { id: "d_bol_queso", nombre: "Bol de queso batido con fruta", momento: "desayuno", req: ["queso", "fruta"], opc: ["frutossecos", "avena"], proteina: 24,
    pasos: ["Queso batido (200 g) + fruta troceada + lo que haya.", "La opción con MÁS proteína por minuto de esfuerzo: ≈ 24 g."] },
  { id: "d_wrap", nombre: "Wrap de desayuno (huevo y queso)", momento: "desayuno", req: ["wraps", "huevos", "queso"], opc: ["jamon"], proteina: 20,
    pasos: ["Huevo revuelto, al wrap con el queso.", "1 min por lado en la sartén para sellar.", "≈ 20 g de proteína."] },

  { id: "c_pollo_aire", nombre: "Pollo crujiente en AirFryer con patatas", momento: "comida", req: ["pollo", "patata"], opc: [], proteina: 36, aire: true,
    pasos: ["Patatas en gajos: AirFryer 200 °C, 18 min, sacude a mitad.", "Pollo salpimentado: añádelo a los 8 min (contramuslos 20 min, pechuga 12).", "Crujiente sin freír: mismo sabor, mucho menos aceite."] },
  { id: "c_salmon_aire", nombre: "Salmón en AirFryer con arroz", momento: "comida", req: ["salmon", "arroz"], opc: [], proteina: 30, aire: true,
    pasos: ["Salmón a la AirFryer: 190 °C, 8-10 min. No se pasa: se seca rápido.", "Arroz hervido 12 min.", "≈ 30 g de proteína y omega-3, que a tus articulaciones les viene bien."] },
  { id: "c_burger", nombre: "Hamburguesas caseras con patatas gajo", momento: "comida", req: ["ternera", "patata"], opc: ["pan", "queso"], proteina: 32, aire: true,
    pasos: ["Forma hamburguesas con la ternera (sal y pimienta, nada más).", "Patatas gajo en AirFryer 200 °C 18 min; las burgers a la plancha 3 min por lado.", "Con pan y queso si toca antojo: sigue siendo comida de verdad."] },
  { id: "c_arroz_chino", nombre: "Arroz salteado con pollo y huevo", momento: "comida", req: ["arroz", "pollo", "huevos"], opc: ["cebolla", "zanahoria"], proteina: 38,
    pasos: ["Arroz cocido (mejor del día anterior).", "Pollo en dados a fuego fuerte; aparta y cuaja el huevo.", "Junta todo y saltea 2 min con un chorrito de soja si hay.", "El 'chino' de casa: ≈ 38 g de proteína."] },
  { id: "c_lomo_aire", nombre: "Lomo en AirFryer con arroz", momento: "comida", req: ["lomo", "arroz"], opc: [], proteina: 33, aire: true,
    pasos: ["Filetes de lomo: AirFryer 200 °C, 8 min con vuelta a mitad.", "Arroz de guarnición.", "≈ 33 g de proteína."] },
  { id: "c_pasta_salmon", nombre: "Pasta con salmón", momento: "comida", req: ["pasta", "salmon"], opc: ["queso", "leche"], proteina: 30,
    pasos: ["Salmón en dados a la sartén 4 min.", "Mezcla con la pasta y un chorrito de leche o queso para la cremita.", "≈ 30 g de proteína."] },
  { id: "c_lentejas_patata", nombre: "Lentejas guisadas con patata", momento: "comida", req: ["lentejas", "patata"], opc: ["zanahoria", "cebolla", "chorizo"], proteina: 20,
    pasos: ["De bote: calienta con patata cocida en dados 10 min.", "La versión sin chorizo es la 'más sana poco a poco': mismo plato, menos grasa.", "≈ 20 g de proteína."] },
  { id: "c_pollo_curry", nombre: "Pollo al curry suave con arroz", momento: "comida", req: ["pollo", "arroz", "leche"], opc: ["cebolla"], proteina: 36,
    pasos: ["Pollo en dados dorado en sartén.", "Cucharadita de curry + leche (150 ml): 5 min a fuego bajo.", "Sobre arroz. Suave, nada picante, y sabe a restaurante."] },

  { id: "n_muslos_aire", nombre: "Muslos de pollo en AirFryer con patatas", momento: "cena", req: ["pollo", "patata"], opc: [], proteina: 34, aire: true,
    pasos: ["Muslos: AirFryer 190 °C, 20-22 min, vuelta a mitad.", "Patatas en la misma cesta desde el minuto 0.", "Piel crujiente sin aceite: ≈ 34 g de proteína."] },
  { id: "n_francesa", nombre: "Tortilla francesa con jamón y pan", momento: "cena", req: ["huevos", "jamon", "pan"], opc: ["queso"], proteina: 25,
    pasos: ["3 huevos batidos, jamón dentro, y dobla en la sartén.", "Pan al lado. Cena de 6 minutos, ≈ 25 g de proteína."] },
  { id: "n_merluza_aire", nombre: "Merluza en AirFryer con patatas", momento: "cena", req: ["merluza", "patata"], opc: [], proteina: 28, aire: true,
    pasos: ["Patatas panadera: AirFryer 200 °C 15 min.", "La merluza encima: 8 min más a 180 °C.", "Ligera de verdad y sin olor a fritanga en casa."] },
  { id: "n_wrap_jamon", nombre: "Wrap de jamón y queso", momento: "cena", req: ["wraps", "jamon", "queso"], opc: [], proteina: 18,
    pasos: ["Monta, dobla y 1 min por lado en sartén (o 3 min en AirFryer).", "Con una fruta de postre: la 4 del día."], aire: true },
  { id: "n_huevos_plato", nombre: "Huevos al plato con tomate", momento: "cena", req: ["huevos", "tomate"], opc: ["jamon", "pan"], proteina: 20,
    pasos: ["Tomate frito caliente en una cazuelita, 2 huevos encima.", "Horno o AirFryer 180 °C hasta que cuaje la clara (8 min).", "Pan para mojar. ≈ 20 g de proteína."], aire: true },
  { id: "n_salmon_ligero", nombre: "Salmón a la plancha (cena ligera)", momento: "cena", req: ["salmon"], opc: ["patata"], proteina: 30,
    pasos: ["Plancha fuerte, 3 min por el lado de la piel, 2 por el otro.", "Solo o con patata cocida.", "Para los días que la comida fue grande."] }
);

// La tanda de cuando la app pasó a ser de los dos: los platos que le
// gustan a Gaby (y varios que comparten). Cada uno sale solo en el menú
// de quien tenga marcadas sus piezas, así que no se mezclan los gustos.
RECETAS.push(
  { id: "d_tostadas_cacao", nombre: "Tostadas con mantequilla y ColaCao", momento: "desayuno", req: ["pan", "mantequilla", "cacao", "leche"], opc: [], proteina: 9,
    pasos: ["Pan tostado con su mantequilla por encima.", "Leche con ColaCao o Cacaolat.", "El desayuno de siempre de Gaby, sin más ciencia."] },
  { id: "d_crepes", nombre: "Crepes caseros", momento: "desayuno", req: ["harina", "huevos", "leche"], opc: ["cacao", "mantequilla"], proteina: 12,
    pasos: ["Bate 1 huevo + 200 ml de leche + 6 cucharadas de harina (sin grumos).", "Sartén con una gota de mantequilla: capa fina, 1 min y vuelta.", "Rellena de lo que toque: cacao, queso, jamón…", "Salen 4-5 crepes; ≈ 12 g de proteína la tanda."] },
  { id: "d_pancakes", nombre: "Pancakes esponjosos", momento: "desayuno", req: ["harina", "huevos", "leche"], opc: ["mantequilla", "fruta"], proteina: 13,
    pasos: ["Como los crepes pero con la mitad de leche: masa espesa.", "Montoncitos a fuego medio: burbujas arriba = vuelta.", "Con mantequilla por encima o fruta si eres Jerry."] },
  { id: "d_salchichas_huevos", nombre: "Salchichas con huevos revueltos", momento: "desayuno", req: ["salchichas", "huevos"], opc: ["pan", "bacon"], proteina: 22,
    pasos: ["Salchichas a la sartén (o AirFryer 8 min a 190 °C).", "Huevos revueltos a fuego suave al lado.", "Desayuno de domingo de película. ≈ 22 g de proteína."], aire: true },

  { id: "c_ensalada_pollo", nombre: "Ensalada de pollo con queso y frutos secos", momento: "comida", req: ["lechuga", "pollo", "queso"], opc: ["frutossecos", "pan"], proteina: 32,
    pasos: ["Lechuga lavada y troceada de base — SIN tomate, como manda Gaby.", "Pollo a la plancha en tiras, queso en dados y frutos secos por encima.", "Aliño simple: aceite, sal y algo de zumo de limón si hay.", "≈ 32 g de proteína y fresquita para el verano."] },
  { id: "c_cuscus_pollo", nombre: "Cuscús con pollo", momento: "comida", req: ["cuscus", "pollo"], opc: ["cebolla", "zanahoria"], proteina: 34,
    pasos: ["Cuscús: mismo volumen de agua hirviendo que de cuscús, tapa y 5 min. Suelta con un tenedor.", "Pollo en dados dorado en la sartén.", "Mezcla y listo: el plato favorito nuevo más fácil del mundo.", "≈ 34 g de proteína."] },
  { id: "c_pizza", nombre: "Pizza casera", momento: "comida", req: ["masa_pizza", "queso", "tomate"], opc: ["bacon", "jamon", "salchichas"], proteina: 25,
    pasos: ["Base + tomate frito en capa fina + queso.", "Encima lo que haya: bacon, jamón, salchichas…", "Horno 220 °C unos 10-12 min (o AirFryer en trozos, 8 min a 200 °C).", "Casera y al gusto de cada uno: mitad y mitad, como los tratos justos."], aire: true },
  { id: "c_pasta_bacon", nombre: "Pasta cremosa con bacon", momento: "comida", req: ["pasta", "bacon", "leche"], opc: ["queso", "huevos"], proteina: 24,
    pasos: ["Bacon en tiras dorado en la sartén.", "Baja el fuego, añade un chorro de leche y queso: crema en 2 min.", "Mezcla con la pasta cocida. ≈ 24 g de proteína."] },
  { id: "c_caldo_arroz", nombre: "Caldo de pollo con arroz", momento: "comida", req: ["caldo", "arroz"], opc: ["pollo", "zanahoria"], proteina: 18,
    pasos: ["Calienta el caldo y añade el arroz: 12-14 min a fuego medio.", "Si hay pollo del día anterior, desmigado dentro.", "El plato de cuchara que gusta a los dos."] },

  { id: "n_salchichas_aire", nombre: "Salchichas con patatas gajo (AirFryer)", momento: "cena", req: ["salchichas", "patata"], opc: [], proteina: 20,
    pasos: ["Patatas gajo: AirFryer 200 °C, 15 min.", "Salchichas dentro los últimos 8 min.", "Cena de una cesta y cero sartenes. ≈ 20 g de proteína."], aire: true },
  { id: "n_brocoli_queso", nombre: "Brócoli gratinado con queso", momento: "cena", req: ["brocoli", "queso"], opc: ["bacon", "huevos"], proteina: 16,
    pasos: ["Brócoli en arbolitos: microondas 4 min con un dedo de agua.", "A una fuente con queso por encima (y bacon si hay).", "Gratina en horno o AirFryer 6-8 min hasta que burbujee.", "La verdura que Gaby tolera — el queso hace el resto."], aire: true },
  { id: "n_sandwich_atun", nombre: "Sándwich de atún", momento: "cena", req: ["pan", "atun"], opc: ["queso", "lechuga"], proteina: 22,
    pasos: ["Atún escurrido, mezclado con un poco de queso o mayonesa.", "Al pan, tostado 2 min por lado si apetece caliente.", "≈ 22 g de proteína. (Este es de Gaby: Jerry ni lo verá en su menú.)"] },
  { id: "n_crepes_salados", nombre: "Crepes salados de jamón y queso", momento: "cena", req: ["harina", "huevos", "leche", "queso"], opc: ["jamon", "bacon"], proteina: 20,
    pasos: ["Masa de crepes fina (huevo + leche + harina).", "Rellena en caliente con queso y jamón: se funde solo.", "Dobla en triángulo y medio minuto más por lado."] },
  { id: "n_caldo_fideos", nombre: "Sopa de caldo con fideos", momento: "cena", req: ["caldo", "pasta"], opc: ["pollo", "huevos"], proteina: 12,
    pasos: ["Caldo hirviendo + un puñado de fideos: 5-7 min.", "Con pollo desmigado o un huevo batido en hilo, sube a cena completa.", "Para las noches de llegar cansados de la tienda."] }
);

// Los días que no se cocina también son un "plato": el domingo en casa de
// la madre de Jerry, o un día de comer fuera. Se eligen editando el día.
export const PLATOS_ESPECIALES = [
  { id: "esp_casa_mama", nombre: "En casa de mamá", especial: true, pasos: ["Hoy cocina la mamá de Jerry: no hay nada que preparar.", "Solo llegar con hambre (y de buen humor)."] },
  { id: "esp_fuera", nombre: "Comer fuera", especial: true, pasos: ["Día de no cocinar: restaurante, pedido o lo que surja."] },
];

// Los platos que añadís vosotros ("Plato vuestro" en la pantalla Menú):
// viven en el documento del menú de casa y entran en el generador como
// cualquier receta, sin depender de ingredientes marcados.
export function platosPropios() {
  return (vida.menu?.platos || []).map((p) => ({
    proteina: null,
    ...p,
    req: [],
    opc: [],
    pasos: p.pasos?.length ? p.pasos : ["Plato vuestro: lo hacéis como os gusta en casa."],
    propio: true,
  }));
}

export const recetaPorId = (id) =>
  RECETAS.find((r) => r.id === id) ||
  platosPropios().find((r) => r.id === id) ||
  PLATOS_ESPECIALES.find((r) => r.id === id) ||
  null;

export function recetasDisponibles(marcados) {
  const set = new Set(marcados);
  return [...RECETAS.filter((r) => r.req.every((i) => set.has(i))), ...platosPropios()];
}

// Un plato cuenta como rápido si se hace en la AirFryer/horno o en tres
// pasos como mucho: la comida de diario no puede ser un proyecto.
const esRapida = (r) => Boolean(r.aire) || (r.pasos?.length ?? 9) <= 3 || r.propio;

// El menú de la semana: un plato de comida y uno de cena por día, solo con
// recetas cuyas piezas están marcadas. La semilla es el lunes de la semana,
// así el mismo lunes siempre da el mismo menú, pero cada semana varía.
// Los platos rápidos van primero: si hay bastantes, la semana sale de ahí.
export function generarMenuSemana(lunesISO, marcados) {
  const disponibles = recetasDisponibles(marcados);
  const pool = (momento) => {
    const todas = disponibles.filter((r) => r.momento === momento);
    const rapidas = todas.filter(esRapida);
    return rapidas.length >= 5 ? rapidas : todas;
  };
  const desayunos = pool("desayuno");
  const comidas = pool("comida");
  const cenas = pool("cena");
  if (comidas.length < 3 || cenas.length < 3) return null;
  let semilla = 0;
  for (const c of lunesISO) semilla = (semilla * 31 + c.charCodeAt(0)) % 9973;
  const menu = { lunes: lunesISO, desayunos: {}, comidas: {}, cenas: {} };
  for (let d = 1; d <= 7; d++) {
    if (desayunos.length >= 3) menu.desayunos[d] = desayunos[(semilla + d) % desayunos.length].id;
    menu.comidas[d] = comidas[(semilla + d) % comidas.length].id;
    menu.cenas[d] = cenas[(semilla + d) % cenas.length].id;
  }
  return menu;
}

// La comida y la cena de HOY según el menú guardado, si es de esta semana.
export function menuDeHoy(fecha = new Date()) {
  const menu = vida.menu;
  if (!menu?.lunes || menu.lunes !== lunesDe(fecha)) return null;
  const dia = ((fecha.getDay() + 6) % 7) + 1; // lunes = 1 … domingo = 7
  return {
    desayuno: recetaPorId(menu.desayunos?.[dia]),
    comida: recetaPorId(menu.comidas?.[dia]),
    cena: recetaPorId(menu.cenas?.[dia]),
  };
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
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`);
      if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
      const precios = await r.json();
      for (const p of criptos) {
        const dato = precios[p.simbolo.toLowerCase().trim()];
        const eur = dato?.eur;
        if (eur > 0) {
          await updateInversion(p.id, {
            precio_actual: eur,
            precio_actualizado: hoy,
            dia_pct: typeof dato.eur_24h_change === "number" ? Math.round(dato.eur_24h_change * 100) / 100 : null,
          });
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
          await updateInversion(p.id, {
            precio_actual: Math.round(precio * 10000) / 10000,
            precio_actualizado: hoy,
            dia_pct: typeof q.dp === "number" ? Math.round(q.dp * 100) / 100 : null,
          });
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
