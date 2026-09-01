// vida:inicio
// Ciclo — el apartado de Gaby para su regla, como una app profesional:
// calendario del ciclo por meses, la regla de cada mes con su sangrado y
// su dolor, cómo se sintió cada día, la duración típica de sus ciclos, la
// previsión de la siguiente y los días fértiles estimados (siempre con su
// advertencia al lado). Viene del módulo "ciclo" del kit, adaptado a la
// app: escucha sus propias colecciones (ciclos y ciclo_notas) sin pasar
// por el store de finanzas.
//
// Tres decisiones que conviene entender:
//
// La previsión se calcula con la MEDIANA de los últimos ciclos, no con la
// media: un mes raro desplaza mucho una media y casi nada una mediana.
//
// Hasta que no hay tres ciclos apuntados no se enseña ninguna previsión.
// Con uno o dos, el número saldría de la nada. Mejor decir "todavía no
// tengo suficiente" que inventar.
//
// Y la ventana fértil se dibuja SIEMPRE con la advertencia al lado: es una
// estimación calculada desde otra estimación. No sirve como método
// anticonceptivo y la app lo dice en su propia pantalla.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "../firebase-init.js?v=108";
import { vida, guardarSistema } from "../vida.js?v=108";
import { openModal, closeModal, esc } from "../modal.js?v=108";
import { icon } from "../icons.js?v=108";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=108";

// ---- Datos: colecciones propias, escuchadas aquí mismo.
const addCiclos = (data) => addDoc(collection(db, "ciclos"), data);
const updateCiclos = (id, data) => updateDoc(doc(db, "ciclos", id), data);
const deleteCiclos = (id) => deleteDoc(doc(db, "ciclos", id));
const addCicloNotas = (data) => addDoc(collection(db, "ciclo_notas"), data);
const updateCicloNotas = (id, data) => updateDoc(doc(db, "ciclo_notas", id), data);
const deleteCicloNotas = (id) => deleteDoc(doc(db, "ciclo_notas", id));

const datos = { ciclos: [], cicloNotas: [], listo: false, sinPermisos: false };
let escuchando = false;

function escuchar() {
  if (escuchando) return;
  escuchando = true;
  const oye = (nombre, aplicar) =>
    onSnapshot(
      collection(db, nombre),
      (snap) => {
        aplicar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        datos.listo = true;
        repintarSiSeVe();
      },
      () => {
        // Las reglas de Firestore aún no permiten estas colecciones: se
        // avisa en pantalla con el paso exacto, y el resto de la app sigue.
        datos.sinPermisos = true;
        datos.listo = true;
        repintarSiSeVe();
      }
    );
  oye("ciclos", (docs) => (datos.ciclos = docs));
  oye("ciclo_notas", (docs) => (datos.cicloNotas = docs));
}

function repintarSiSeVe() {
  if (window.location.hash.startsWith("#/ciclo")) renderVidaCiclo();
}

// Que no quede nada sin poder apuntar: el ánimo y los síntomas van en
// listas separadas (como las apps profesionales) y el flujo del día tiene
// sus tipos — útil para conocerse: el "clara de huevo" suele acompañar a
// los días fértiles.
const ANIMOS = ["En calma", "Feliz", "Con energía", "Cambios de humor", "Triste", "Irritable", "Ansiosa", "Sensible", "Sin ganas de nada"];

const SINTOMAS = [
  "Me encuentro bien",
  "Cólicos",
  "Pecho sensible",
  "Cansada",
  "Dolor de espalda",
  "Dolor de cabeza",
  "Hinchazón",
  "Antojos",
  "Náuseas",
  "Acné",
  "Mareo",
  "Estreñimiento",
  "Diarrea",
  "He dormido mal",
  "Insomnio",
  "Más apetito sexual",
];

const FLUJO_TIPOS = [
  { id: "nada", texto: "Nada de flujo" },
  { id: "pegajoso", texto: "Pegajoso" },
  { id: "cremoso", texto: "Cremoso" },
  { id: "acuoso", texto: "Acuoso" },
  { id: "clara", texto: "Clara de huevo" },
  { id: "manchado_inter", texto: "Manchado entre reglas" },
  { id: "inusual", texto: "Inusual (color u olor)" },
];

const FLUJOS = [
  { id: "manchado", texto: "Manchado" },
  { id: "ligero", texto: "Ligero" },
  { id: "medio", texto: "Medio" },
  { id: "abundante", texto: "Abundante" },
];

const DOLORES = [
  { id: 0, texto: "Nada" },
  { id: 1, texto: "Poco" },
  { id: 2, texto: "Bastante" },
  { id: 3, texto: "Mucho" },
];

const PROTECCIONES = [
  { id: "con", texto: "Con protección" },
  { id: "sin", texto: "Sin protección" },
  { id: "nolodigo", texto: "Prefiero no ponerlo" },
];

// El anticonceptivo que usa (se guarda en su configuración): con uno
// hormonal el ciclo no ovula igual y la "ventana fértil" deja de aplicar,
// así que la pantalla cambia lo que enseña según lo que ella apunte aquí.
const ANTICONCEPTIVOS = [
  { id: "ninguno", texto: "Ninguno" },
  { id: "preservativo", texto: "Preservativo" },
  { id: "pildora", texto: "Píldora" },
  { id: "diu_hormonal", texto: "DIU hormonal" },
  { id: "diu_cobre", texto: "DIU de cobre" },
  { id: "implante", texto: "Implante" },
  { id: "inyeccion", texto: "Inyección" },
  { id: "anillo", texto: "Anillo vaginal" },
  { id: "parche", texto: "Parche" },
];
const HORMONALES = ["pildora", "diu_hormonal", "implante", "inyeccion", "anillo", "parche"];
const anticonceptivoActual = () => vida.sistema?.ciclo_anticonceptivo || null;
const nombreAnticonceptivo = (id) => ANTICONCEPTIVOS.find((a) => a.id === id)?.texto || null;

// Probabilidad de embarazo por tener relaciones ESE día. Con anticonceptivo
// eficaz, muy baja siempre. Sin él, la ventana fértil de los estudios
// clásicos (Wilcox): el pico son los 2 días ANTES de ovular. Orientativa de
// verdad — sale de una estimación sobre otra estimación y JAMÁS sirve como
// método anticonceptivo; la pantalla lo repite donde haga falta.
function probabilidadEmbarazo(iso, ovulacion, anticonceptivo) {
  if (HORMONALES.includes(anticonceptivo) || anticonceptivo === "diu_cobre") {
    return { texto: "muy baja — menos del 1 % con el método bien usado", hormonal: HORMONALES.includes(anticonceptivo) };
  }
  if (!ovulacion) return null;
  const d = diasEntre(iso, ovulacion); // días que faltan para la ovulación estimada
  const tabla = { 5: "baja (≈ 4 %)", 4: "media (≈ 10 %)", 3: "media (≈ 14 %)", 2: "ALTA (≈ 27 %)", 1: "ALTA (≈ 31 %)", 0: "ALTA (≈ 33 %)", "-1": "baja (≈ 5 %)" };
  let texto = tabla[d] || "muy baja (≈ 1–3 %)";
  if (anticonceptivo === "preservativo") texto += " — y con preservativo bien usado, mínima";
  return { texto, hormonal: false };
}

// Los últimos cálculos del render, para que la ficha de un día concreto
// pueda enseñar su fase y su probabilidad sin recalcular nada.
let calculosCiclo = null;

const MINIMO_PARA_PREVER = 3;
// La ovulación cae, de media, unos 14 días ANTES de la siguiente regla. Se
// cuenta hacia atrás desde la previsión y no hacia adelante desde la
// última, porque la segunda mitad del ciclo es la que menos varía.
const DIAS_ANTES_DE_OVULAR = 14;

const aFecha = (iso) => new Date(iso + "T12:00:00");
const aISO = (d) => {
  const c = new Date(d);
  c.setHours(12, 0, 0, 0);
  return c.toISOString().slice(0, 10);
};
const hoyISO = () => aISO(new Date());
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const sumarDias = (iso, n) => {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};
// "Agosto de 2026" con la primera en mayúscula (text-transform: capitalize
// pondría "Agosto De 2026", y ese "De" canta).
const mesEnLetra = (fecha) => {
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(fecha);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const bonito = (iso) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long" }).format(aFecha(iso));

function mediana(numeros) {
  if (!numeros.length) return null;
  const orden = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

// Qué mes se está mirando: 0 es el actual, -1 el anterior, 1 el siguiente.
// Vive fuera del render para no volver al mes de hoy con cada dato nuevo.
let desplazamientoMes = 0;

export function mountVidaCiclo() {
  document.getElementById("btn-add-ciclo").addEventListener("click", () => abrirFormulario());
  escuchar();
}

export function renderVidaCiclo() {
  escuchar();
  const elResumen = document.getElementById("ciclo-resumen");
  if (!elResumen) return;

  if (datos.sinPermisos) {
    elResumen.innerHTML = `
      <h2 class="card__title">Falta un paso en Firebase</h2>
      <p class="entity-card__meta">
        Este apartado guarda en dos colecciones nuevas (<code>ciclos</code> y
        <code>ciclo_notas</code>) y tus reglas de Firestore aún no las
        permiten. Entra en <strong>Firebase Console → Firestore Database →
        Reglas</strong>, pega el archivo <code>firestore.rules</code>
        actualizado y pulsa <strong>Publicar</strong>. Al recargar, listo.
      </p>`;
    document.getElementById("ciclo-calendario").innerHTML = "";
    document.getElementById("ciclo-historial").innerHTML = "";
    return;
  }

  const ciclos = [...datos.ciclos].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  const notas = datos.cicloNotas;
  const hoy = hoyISO();

  if (ciclos.length === 0) {
    elResumen.innerHTML = `
      <h2 class="card__title">Todavía no hay nada apuntado</h2>
      <p class="entity-card__meta" style="margin-bottom:14px">
        Apunta el primer día de tu última regla y a partir de ahí esto se va llenando solo.
        Con tres ciclos ya puede darte una previsión; con menos, prefiere no inventarse nada.
      </p>
      <button type="button" class="btn btn--primary ciclo-accion" id="ciclo-empezar-hoy">Me ha venido hoy</button>
      <p class="entity-card__meta" style="margin-top:14px">Todo lo que apuntes aquí es tuyo y está en tu base de datos privada.</p>`;
    elResumen.querySelector("#ciclo-empezar-hoy").addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      await addCiclos({ inicio: hoy, fin: null }).catch(() => {});
    });
    pintarCalendario(ciclos, notas, null, null, null);
    document.getElementById("ciclo-historial").innerHTML = "";
    return;
  }

  // Duración de cada ciclo: del primer día de uno al primer día del
  // siguiente. Menos de 15 o más de 60 días casi siempre es una fecha mal
  // apuntada, y colarla estropearía la previsión de todo lo demás.
  const duraciones = [];
  for (let i = 0; i < ciclos.length - 1; i++) {
    const d = diasEntre(ciclos[i + 1].inicio, ciclos[i].inicio);
    if (d >= 15 && d <= 60) duraciones.push(d);
  }
  const duracionTipica = duraciones.length >= MINIMO_PARA_PREVER - 1 ? mediana(duraciones) : null;

  const ultimo = ciclos[0];
  const diasDesde = diasEntre(ultimo.inicio, hoy);
  const enRegla = hoy >= ultimo.inicio && (!ultimo.fin || hoy <= ultimo.fin);
  const sinCerrar = !ultimo.fin;
  const proxima = duracionTipica ? sumarDias(ultimo.inicio, duracionTipica) : null;
  const faltan = proxima ? diasEntre(hoy, proxima) : null;

  const sangrados = ciclos.filter((c) => c.fin).map((c) => diasEntre(c.inicio, c.fin) + 1);
  const sangradoTipico = sangrados.length ? mediana(sangrados) : null;

  // Ventana fértil: hacia atrás desde la próxima regla prevista. Los
  // espermatozoides aguantan unos días, así que la ventana empieza antes
  // del día estimado de ovulación y acaba justo después.
  const ovulacion = proxima ? sumarDias(proxima, -DIAS_ANTES_DE_OVULAR) : null;
  const fertilDesde = ovulacion ? sumarDias(ovulacion, -5) : null;
  const fertilHasta = ovulacion ? sumarDias(ovulacion, 1) : null;

  // Los cálculos del día: anticonceptivo, fase y probabilidad de embarazo.
  const anticonceptivo = anticonceptivoActual();
  const hormonal = HORMONALES.includes(anticonceptivo);
  const probHoy = probabilidadEmbarazo(hoy, ovulacion, anticonceptivo);
  const faseHoy = enRegla
    ? "regla"
    : hormonal
      ? null // con hormonal no hay fases naturales que valgan
      : fertilDesde && hoy >= fertilDesde && hoy <= fertilHasta
        ? "ventana fértil"
        : fertilHasta && hoy > fertilHasta
          ? "fase lútea (premenstrual)"
          : duracionTipica
            ? "fase folicular"
            : null;
  calculosCiclo = { ovulacion, fertilDesde, fertilHasta, anticonceptivo, ultimoInicio: ultimo.inicio };

  // El botón grande de arriba cambia según dónde esté del ciclo: es lo que
  // se pulsa el 90 % de las veces, así que va primero y grande.
  let accion = null;
  if (enRegla && sinCerrar) accion = { id: "cerrar", texto: "Ya se me ha ido" };
  else if (!enRegla) accion = { id: "empezar", texto: "Me ha venido hoy" };

  elResumen.innerHTML = `
    <div class="card__header">
      <h2 class="card__title">${enRegla ? "Estás con la regla" : "Día " + (diasDesde + 1) + " del ciclo"}</h2>
      <span class="entity-card__tag">${ciclos.length} ${ciclos.length === 1 ? "ciclo" : "ciclos"}</span>
    </div>
    <div class="ciclo-datos">
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${duracionTipica ?? "—"}</p>
        <p class="ciclo-dato__etiqueta">días de ciclo${duracionTipica ? "" : " (aún sin datos)"}</p>
      </div>
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${sangradoTipico ?? "—"}</p>
        <p class="ciclo-dato__etiqueta">días de regla</p>
      </div>
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${faltan === null ? "—" : Math.abs(faltan)}</p>
        <p class="ciclo-dato__etiqueta">${faltan === null ? "sin previsión" : faltan >= 0 ? "días para la próxima" : "días de retraso"}</p>
      </div>
    </div>
    ${
      faseHoy || probHoy
        ? `<p class="entity-card__meta ciclo-fase" style="margin-top:-4px">
            ${faseHoy ? `Hoy: <strong>${faseHoy}</strong>` : "Hoy"}${probHoy ? ` · probabilidad de embarazo <strong>${probHoy.texto}</strong>` : ""}
          </p>`
        : ""
    }
    ${accion ? `<button type="button" class="btn btn--primary ciclo-accion" data-accion="${accion.id}">${accion.texto}</button>` : ""}
    <button type="button" class="btn btn--ghost ciclo-accion ciclo-accion--suave" data-apuntar-hoy="1">Apuntar cómo estoy hoy</button>
    <p class="entity-card__meta" style="margin-top:14px">
      ${
        proxima
          ? `Según tus últimos ciclos, la próxima le tocaría alrededor del <strong>${bonito(proxima)}</strong>. Es una estimación a partir de lo que has apuntado, no una certeza: los ciclos cambian, y eso es normal.`
          : `Con ${ciclos.length} ${ciclos.length === 1 ? "ciclo apuntado" : "ciclos apuntados"} todavía no hay suficiente para una previsión honesta. A partir de ${MINIMO_PARA_PREVER} empieza a salir.`
      }
      ${proxima && faltan !== null && faltan < -7 ? ` Con <strong>${-faltan} días de retraso</strong> sobre la estimación, un test lo aclara antes que cualquier app.` : ""}
    </p>
    ${
      hormonal
        ? `<p class="entity-card__meta" style="margin-top:8px">
             Con ${nombreAnticonceptivo(anticonceptivo).toLowerCase()} el ciclo no ovula como un ciclo natural: por eso aquí no se pintan "días fértiles" — no aplicarían y serían mentira bonita.
           </p>`
        : ovulacion
          ? `<p class="entity-card__meta" style="margin-top:8px">
             Los días con más probabilidad de embarazo estarían entre el <strong>${bonito(fertilDesde)}</strong> y el <strong>${bonito(fertilHasta)}</strong>, con la ovulación alrededor del ${bonito(ovulacion)}.
           </p>`
          : ""
    }
    ${
      duraciones.length >= 2
        ? `<p class="entity-card__meta" style="margin-top:8px">
            Tus últimos ciclos han ido de <strong>${Math.min(...duraciones)}</strong> a <strong>${Math.max(...duraciones)}</strong> días${
              Math.max(...duraciones) - Math.min(...duraciones) <= 7
                ? " — bastante regulares."
                : " — con algún baile, que es normal; si se hace costumbre, coméntalo en consulta."
            }
          </p>`
        : ""
    }
    <p class="entity-card__meta" style="margin-top:8px">
      Anticonceptivo: <strong>${nombreAnticonceptivo(anticonceptivo) || "sin apuntar"}</strong>
      · <button type="button" class="btn btn--ghost btn--sm" id="btn-anticonceptivo">${anticonceptivo ? "Cambiar" : "Apuntarlo"}</button>
    </p>
    <p class="ciclo-aviso">
      Esto no es un consejo médico ni sirve como método anticonceptivo: la previsión sale de tus propios apuntes y los ciclos cambian.
      Si algo te preocupa, díselo a tu médica o médico.
    </p>`;

  const botonAccion = elResumen.querySelector("[data-accion]");
  if (botonAccion) {
    botonAccion.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        if (botonAccion.dataset.accion === "cerrar") await updateCiclos(ultimo.id, { fin: hoy });
        // Si el último ciclo quedó sin cerrar y ya empieza otro, se cierra
        // solo el día antes: si no, el ciclo abierto se comería el nuevo.
        else {
          if (sinCerrar && hoy > ultimo.inicio) await updateCiclos(ultimo.id, { fin: sumarDias(hoy, -1) });
          await addCiclos({ inicio: hoy, fin: null });
        }
      } finally {
        e.currentTarget.disabled = false;
      }
    });
  }
  elResumen
    .querySelector("[data-apuntar-hoy]")
    .addEventListener("click", () => abrirNota(hoy, notas.find((n) => n.fecha === hoy)));
  elResumen.querySelector("#btn-anticonceptivo").addEventListener("click", abrirAnticonceptivo);

  // Con anticonceptivo hormonal no se pintan días fértiles: no aplican.
  pintarCalendario(ciclos, notas, proxima, sangradoTipico, hormonal ? {} : { fertilDesde, fertilHasta, ovulacion });

  // ---- Historial
  document.getElementById("ciclo-historial").innerHTML = `
    <h2 class="card__title">Historial</h2>
    <div id="ciclo-lista">
      ${ciclos
        .map((c, i) => {
          const dias = c.fin ? diasEntre(c.inicio, c.fin) + 1 : null;
          const siguiente = ciclos[i - 1];
          const duracion = siguiente ? diasEntre(c.inicio, siguiente.inicio) : null;
          // Un ciclo se marca irregular si se sale del rango típico (21–35
          // días) o se aleja más de 7 días de SU mediana. Informativo, sin
          // drama: un irregular suelto es normal.
          const irregular = duracion && (duracion < 21 || duracion > 35 || (duracionTipica && Math.abs(duracion - duracionTipica) > 7));
          return wrapSwipe(
            `
            <div class="entity-row">
              <div class="entity-row__body">
                <p class="entity-row__name">${bonito(c.inicio)}${c.fin ? " – " + bonito(c.fin) : " · sin fecha de fin"}${irregular ? ` <span class="ciclo-tag-irregular">Irregular</span>` : ""}</p>
                <p class="entity-row__meta">
                  ${dias ? `${dias} ${dias === 1 ? "día" : "días"} de regla` : "Todavía sin cerrar"}${
                    duracion ? ` · ciclo de ${duracion} días` : ""
                  }
                </p>
              </div>
              <button type="button" class="row-edit-btn" data-edit="${c.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>`,
            c.id
          );
        })
        .join("")}
    </div>`;

  const elHistorial = document.getElementById("ciclo-historial");
  elHistorial
    .querySelectorAll("[data-edit]")
    .forEach((btn) => btn.addEventListener("click", () => abrirFormulario(ciclos.find((c) => c.id === btn.dataset.edit))));
  // La lista, no la tarjeta: attachSwipe solo mira los HIJOS DIRECTOS.
  attachSwipe(document.getElementById("ciclo-lista"), (id) => deleteCiclos(id), {
    confirmar: "¿Borrar este ciclo del historial?",
  });
}

// ---- Calendario del mes: regla, previsión, días fértiles y lo apuntado
function pintarCalendario(ciclos, notas, proxima, sangradoTipico, fertil) {
  const hoy = hoyISO();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + desplazamientoMes);
  const anio = base.getFullYear();
  const mes = base.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const huecoInicial = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const notasPorFecha = new Map(notas.map((n) => [n.fecha, n]));

  const esDeRegla = (iso) => ciclos.some((c) => iso >= c.inicio && iso <= (c.fin || c.inicio));
  const esPrevista = (iso) =>
    proxima && sangradoTipico && iso >= proxima && iso <= sumarDias(proxima, sangradoTipico - 1);
  const esFertil = (iso) => fertil?.fertilDesde && iso >= fertil.fertilDesde && iso <= fertil.fertilHasta;

  const celdas = [];
  for (let i = 0; i < huecoInicial; i++) celdas.push(`<span class="rutina-celda is-vacia"></span>`);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const nota = notasPorFecha.get(iso);
    const clases = ["rutina-celda", "ciclo-celda"];
    if (esDeRegla(iso)) clases.push("is-regla");
    else if (esPrevista(iso)) clases.push("is-prevista");
    else if (esFertil(iso)) clases.push("is-fertil");
    if (iso === hoy) clases.push("is-hoy");
    if (nota) clases.push("tiene-nota");

    // Los puntitos de debajo del número: uno por cada cosa apuntada.
    const marcas = [];
    if (nota?.flujo) marcas.push(`<i class="ciclo-marca is-flujo is-${nota.flujo}"></i>`);
    if (nota?.dolor > 0) marcas.push(`<i class="ciclo-marca is-dolor"></i>`);
    if (nota?.relaciones) marcas.push(`<i class="ciclo-marca is-relaciones"></i>`);

    celdas.push(
      `<button type="button" class="${clases.join(" ")}" data-dia="${iso}" title="${bonito(iso)}">
         <span class="ciclo-celda__num">${d}</span>
         ${marcas.length ? `<span class="ciclo-marcas">${marcas.join("")}</span>` : ""}
       </button>`
    );
  }

  const el = document.getElementById("ciclo-calendario");
  el.innerHTML = `
    <div class="ciclo-mes__barra">
      <button type="button" class="ciclo-mes__flecha" data-mes="-1" aria-label="Mes anterior">‹</button>
      <h2 class="card__title ciclo-mes__titulo">${mesEnLetra(base)}</h2>
      <button type="button" class="ciclo-mes__flecha" data-mes="1" aria-label="Mes siguiente">›</button>
    </div>
    ${desplazamientoMes !== 0 ? `<button type="button" class="ciclo-mes__hoy" data-mes="0">Volver a este mes</button>` : ""}
    <div class="rutina-rejilla" style="margin-top:10px">
      ${["L", "M", "X", "J", "V", "S", "D"].map((x) => `<span class="rutina-celda is-titulo">${x}</span>`).join("")}
      ${celdas.join("")}
    </div>
    <div class="ciclo-leyenda">
      <span><i class="ciclo-punto is-regla"></i> Regla</span>
      <span><i class="ciclo-punto is-prevista"></i> Previsión</span>
      ${fertil?.fertilDesde ? `<span><i class="ciclo-punto is-fertil"></i> Días fértiles</span>` : ""}
      <span><i class="ciclo-marca is-dolor"></i> Dolor</span>
      <span><i class="ciclo-marca is-relaciones"></i> Relaciones</span>
    </div>
    <p class="entity-card__meta" style="margin-top:10px">Toca cualquier día para apuntar lo que pasó.</p>`;

  el.querySelectorAll("[data-mes]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const paso = Number(btn.dataset.mes);
      desplazamientoMes = paso === 0 ? 0 : desplazamientoMes + paso;
      renderVidaCiclo();
    })
  );
  el.querySelectorAll("[data-dia]").forEach((btn) =>
    btn.addEventListener("click", () => abrirNota(btn.dataset.dia, notasPorFecha.get(btn.dataset.dia)))
  );
}

// El anticonceptivo se guarda en SU configuración (el documento de sistema
// de Gaby) y cambia lo que enseña toda la pantalla: probabilidad, fases y
// si se pintan o no los días fértiles.
function abrirAnticonceptivo() {
  const actual = anticonceptivoActual();
  openModal(
    `
    <h2 class="modal__title">¿Llevas anticonceptivo?</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Con esto la app ajusta sus cálculos: con uno hormonal, la ventana
      fértil no aplica y la probabilidad de embarazo baja muchísimo.
    </p>
    <form id="form-anticonceptivo" class="form-grid">
      <div class="field field--full">
        <div class="ciclo-opciones">
          ${ANTICONCEPTIVOS.map(
            (a) => `
            <label class="ciclo-opcion">
              <input type="radio" name="anticonceptivo" value="${a.id}" ${(actual || "ninguno") === a.id ? "checked" : ""} />
              <span>${a.texto}</span>
            </label>`
          ).join("")}
        </div>
      </div>
      <p class="field-error" id="anticonceptivo-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-anticonceptivo").addEventListener("submit", async (e) => {
          e.preventDefault();
          try {
            await guardarSistema({ ciclo_anticonceptivo: e.target.anticonceptivo.value });
            closeModal();
            renderVidaCiclo();
          } catch (err) {
            root.querySelector("#anticonceptivo-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirFormulario(ciclo) {
  const editando = Boolean(ciclo);
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar ciclo" : "Apuntar regla"}</h2>
    <form id="form-ciclo" class="form-grid">
      <label class="field">
        <span class="field__label">Primer día</span>
        <input type="date" name="inicio" required value="${ciclo?.inicio ?? hoyISO()}" />
      </label>
      <label class="field">
        <span class="field__label">Último día (si ya acabó)</span>
        <input type="date" name="fin" value="${ciclo?.fin ?? ""}" />
      </label>
      <p class="field-error" id="form-ciclo-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${editando ? "Guardar" : "Apuntar"}</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-ciclo").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const error = root.querySelector("#form-ciclo-error");
          const datosCiclo = { inicio: f.inicio.value, fin: f.fin.value || null };
          // Un fin anterior al inicio pondría duraciones negativas en todos
          // los cálculos: se para aquí y se dice por qué.
          if (datosCiclo.fin && datosCiclo.fin < datosCiclo.inicio) {
            error.textContent = "El último día no puede ser anterior al primero.";
            return;
          }
          try {
            if (editando) await updateCiclos(ciclo.id, datosCiclo);
            else await addCiclos(datosCiclo);
            closeModal();
          } catch (err) {
            error.textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirNota(fecha, nota) {
  // Las notas viejas guardaban todo junto en "sensaciones": se siguen
  // leyendo para precargar, y al guardar quedan ya separadas.
  const marcadas = new Set([...(nota?.animos || []), ...(nota?.sintomas || []), ...(nota?.sensaciones || [])]);
  const dolor = nota?.dolor ?? 0;
  const probDia = calculosCiclo ? probabilidadEmbarazo(fecha, calculosCiclo.ovulacion, calculosCiclo.anticonceptivo) : null;

  openModal(
    `
    <h2 class="modal__title">${bonito(fecha)}</h2>
    ${probDia ? `<p class="entity-card__meta" style="margin:-8px 0 10px;">Probabilidad de embarazo ese día: <strong>${probDia.texto}</strong>. Estimación, no certeza.</p>` : ""}
    <form id="form-nota" class="form-grid">

      <div class="field field--full">
        <span class="field__label">Sangrado</span>
        <div class="ciclo-opciones">
          ${FLUJOS.map(
            (f) => `
            <label class="ciclo-opcion">
              <input type="radio" name="flujo" value="${f.id}" ${nota?.flujo === f.id ? "checked" : ""} />
              <span>${f.texto}</span>
            </label>`
          ).join("")}
          <label class="ciclo-opcion">
            <input type="radio" name="flujo" value="" ${!nota?.flujo ? "checked" : ""} />
            <span>Nada</span>
          </label>
        </div>
      </div>

      <div class="field field--full">
        <span class="field__label">Dolor</span>
        <div class="ciclo-opciones">
          ${DOLORES.map(
            (d) => `
            <label class="ciclo-opcion">
              <input type="radio" name="dolor" value="${d.id}" ${dolor === d.id ? "checked" : ""} />
              <span>${d.texto}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <div class="field field--full">
        <span class="field__label">Salud del día (opcional)</span>
        <div class="ciclo-salud">
          <label class="field"><span class="field__label">Temperatura (°C)</span>
            <input type="number" name="temperatura" step="0.05" min="34" max="42" inputmode="decimal" placeholder="36,6" value="${nota?.temperatura ?? ""}" /></label>
          <label class="field"><span class="field__label">Sueño (horas)</span>
            <input type="number" name="sueno_h" step="0.5" min="0" max="24" inputmode="decimal" placeholder="8" value="${nota?.sueno_h ?? ""}" /></label>
          <label class="field"><span class="field__label">Peso (kg)</span>
            <input type="number" name="peso_kg" step="0.1" min="0" inputmode="decimal" placeholder="—" value="${nota?.peso_kg ?? ""}" /></label>
          <label class="field"><span class="field__label">Agua (vasos)</span>
            <input type="number" name="agua_vasos" step="1" min="0" max="20" inputmode="numeric" placeholder="6" value="${nota?.agua_vasos ?? ""}" /></label>
        </div>
        <p class="entity-card__meta" style="margin:6px 0 0;">
          La temperatura basal (recién despierta, antes de levantarte) sube
          ~0,3 °C tras ovular: apuntada a diario dibuja tu ciclo de verdad.
        </p>
      </div>

      <div class="field field--full">
        <span class="field__label">Estado de ánimo</span>
        <div class="ciclo-sensaciones">
          ${ANIMOS.map(
            (s) => `
            <label class="ciclo-sensacion">
              <input type="checkbox" name="animo" value="${s}" ${marcadas.has(s) ? "checked" : ""} />
              <span>${s}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <div class="field field--full">
        <span class="field__label">Síntomas</span>
        <div class="ciclo-sensaciones">
          ${SINTOMAS.map(
            (s) => `
            <label class="ciclo-sensacion">
              <input type="checkbox" name="sintoma" value="${s}" ${marcadas.has(s) ? "checked" : ""} />
              <span>${s}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <div class="field field--full">
        <span class="field__label">Flujo del día (fuera de la regla)</span>
        <div class="ciclo-opciones">
          ${FLUJO_TIPOS.map(
            (t) => `
            <label class="ciclo-opcion">
              <input type="radio" name="flujo_tipo" value="${t.id}" ${nota?.flujo_tipo === t.id ? "checked" : ""} />
              <span>${t.texto}</span>
            </label>`
          ).join("")}
          <label class="ciclo-opcion">
            <input type="radio" name="flujo_tipo" value="" ${!nota?.flujo_tipo ? "checked" : ""} />
            <span>Sin apuntar</span>
          </label>
        </div>
      </div>

      <div class="field field--full">
        <label class="ciclo-sensacion ciclo-sensacion--sola">
          <input type="checkbox" name="relaciones" id="ciclo-relaciones" ${nota?.relaciones ? "checked" : ""} />
          <span>Tuve relaciones</span>
        </label>
        <div class="ciclo-opciones ${nota?.relaciones ? "" : "is-hidden"}" id="ciclo-proteccion">
          ${PROTECCIONES.map(
            (p) => `
            <label class="ciclo-opcion">
              <input type="radio" name="proteccion" value="${p.id}" ${nota?.proteccion === p.id ? "checked" : ""} />
              <span>${p.texto}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="texto" value="${esc(nota?.texto ?? "")}" placeholder="Lo que quieras recordar de este día" />
      </label>

      <p class="field-error" id="form-nota-error"></p>
      <div class="modal__actions field--full">
        ${nota ? `<button type="button" class="btn btn--ghost btn--danger" id="btn-borrar">Borrar el día</button>` : ""}
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);

        // Lo de la protección solo aparece si marcó que hubo relaciones.
        const check = root.querySelector("#ciclo-relaciones");
        const proteccion = root.querySelector("#ciclo-proteccion");
        check.addEventListener("change", () => proteccion.classList.toggle("is-hidden", !check.checked));

        const borrar = root.querySelector("#btn-borrar");
        if (borrar) {
          borrar.addEventListener("click", async () => {
            if (!confirm("¿Borrar lo apuntado de este día?")) return;
            try {
              await deleteCicloNotas(nota.id);
              closeModal();
            } catch (err) {
              root.querySelector("#form-nota-error").textContent = "No se pudo borrar. Inténtalo de nuevo.";
            }
          });
        }

        root.querySelector("#form-nota").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const hubo = f.relaciones.checked;
          const nuevo = {
            fecha,
            flujo: f.flujo.value || null,
            flujo_tipo: f.flujo_tipo.value || null,
            dolor: Number(f.dolor.value || 0),
            temperatura: f.temperatura.value !== "" ? Number(f.temperatura.value) : null,
            sueno_h: f.sueno_h.value !== "" ? Number(f.sueno_h.value) : null,
            peso_kg: f.peso_kg.value !== "" ? Number(f.peso_kg.value) : null,
            agua_vasos: f.agua_vasos.value !== "" ? Number(f.agua_vasos.value) : null,
            animos: [...f.querySelectorAll('[name="animo"]:checked')].map((c) => c.value),
            sintomas: [...f.querySelectorAll('[name="sintoma"]:checked')].map((c) => c.value),
            // El campo viejo se vacía: lo apuntado queda ya separado.
            sensaciones: [],
            relaciones: hubo,
            proteccion: hubo ? f.proteccion.value || null : null,
            texto: f.texto.value.trim(),
          };
          try {
            if (nota) await updateCicloNotas(nota.id, nuevo);
            else await addCicloNotas(nuevo);
            closeModal();
          } catch (err) {
            root.querySelector("#form-nota-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
// vida:fin
