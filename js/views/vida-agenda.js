// vida:inicio
// Calendario personal: un calendario de verdad, como el del iPhone, con
// tres vistas — MES (todos los días, con sus puntitos de citas y tareas),
// SEMANA (las tarjetas de cada día) y DÍA (la línea hora a hora de "Hoy",
// con el AHORA marcando en qué momento estás). Tocar un día del mes lleva
// a su vista de día. Todo editable: ✎ cambia la plantilla de ese día de
// la semana, ＋ apunta citas con sus minutos aprox, ☑ abre la to-do list
// del día, y tocar una cita apunta cuánto tardaste al final.

import {
  vida,
  bloquesDelDia,
  bloqueActual,
  avisoDeEntrenoSinHueco,
  diaPorFecha,
  guardarDia,
  SEMANA_TIPO,
  conChecklistDeDia,
  claveDeBloque,
  bloqueHecho,
  alternarBloqueHecho,
  extrasDelDia,
  alternarExtraDelDia,
} from "../vida.js?v=97";
import { abrirEditorHorario, abrirAgendaDia, abrirTareasDia } from "./vida-hoy.js?v=97";
import { openModal, closeModal, esc } from "../modal.js?v=97";
import { fechaISO } from "../db.js?v=97";

// Qué vista está puesta y qué fecha tiene el foco. La fecha del foco es la
// que mandan las flechas: en mes salta de mes en mes, en semana de semana
// en semana y en día de día en día.
let vista = "mes"; // "mes" | "semana" | "dia"

// Las pastillas de "Hoy" piden aquí la vista antes de navegar: así Hoy y
// el calendario son la misma cosa con tres pestañas.
export function pedirVista(v) {
  vista = v === "semana" || v === "dia" ? v : "mes";
}
let fechaFoco = alMediodia(new Date());

function alMediodia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

function sumarDias(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
}

function lunesDe(d) {
  return sumarDias(d, -((d.getDay() + 6) % 7));
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Un bloque del día no es solo texto: el del entreno lleva a Entreno, los
// de comer llevan al Menú. Se reconoce por el título, así también funciona
// con horarios editados a mano.
function rutaDeBloque(b) {
  if (b.cita) return null;
  const t = `${b.titulo || ""} ${b.detalle || ""}`;
  if (/entren|gym|gim|fuerza|piscina|yoga|calisten|pierna|tir[oó]n|empuje|core|caminat|estir/i.test(t)) return { href: "#/entreno", icono: "ph-barbell" };
  if (/desayun|comida|cena|batch|cocin|comer/i.test(t)) return { href: "#/menu", icono: "ph-fork-knife" };
  if (/oficina/i.test(t)) return { href: "#/oficina", icono: "ph-briefcase" };
  return null;
}

export function mountVidaAgenda() {
  const root = document.getElementById("view-agenda");
  root.addEventListener("click", async (e) => {
    const cambioVista = e.target.closest("[data-vista]");
    if (cambioVista) {
      vista = cambioVista.dataset.vista;
      renderVidaAgenda(null);
      return;
    }
    if (e.target.closest("#agenda-prev") || e.target.closest("#agenda-next")) {
      const dir = e.target.closest("#agenda-next") ? 1 : -1;
      if (vista === "mes") fechaFoco = new Date(fechaFoco.getFullYear(), fechaFoco.getMonth() + dir, 1, 12);
      else if (vista === "semana") fechaFoco = sumarDias(fechaFoco, dir * 7);
      else {
        fechaFoco = sumarDias(fechaFoco, dir);
        // El día de hoy no se mira en el calendario: ES la pantalla Hoy.
        if (fechaISO(fechaFoco) === fechaISO()) {
          location.hash = "#/hoy";
          return;
        }
      }
      renderVidaAgenda(null);
      return;
    }
    if (e.target.closest("#agenda-hoy")) {
      fechaFoco = alMediodia(new Date());
      if (vista === "dia") {
        location.hash = "#/hoy";
        return;
      }
      renderVidaAgenda(null);
      return;
    }
    // Tocar un día del mes (o el nombre de un día de la semana) abre su día.
    const diaMes = e.target.closest("[data-ver-dia]");
    if (diaMes) {
      if (diaMes.dataset.verDia === fechaISO()) {
        location.hash = "#/hoy";
        return;
      }
      fechaFoco = alMediodia(new Date(diaMes.dataset.verDia + "T12:00:00"));
      vista = "dia";
      renderVidaAgenda(null);
      return;
    }
    const editar = e.target.closest("[data-editar-dia-semana]");
    if (editar) {
      abrirEditorHorario(new Date(editar.dataset.editarDiaSemana + "T12:00:00"));
      return;
    }
    const cita = e.target.closest("[data-cita-fecha]");
    if (cita) {
      abrirAgendaDia(cita.dataset.citaFecha);
      return;
    }
    const tareasBtn = e.target.closest("[data-tareas-fecha]");
    if (tareasBtn) {
      abrirTareasDia(tareasBtn.dataset.tareasFecha);
      return;
    }
    // Los extras del día (frutas, rasurado) y los bloques tachables.
    const extra = e.target.closest("[data-extra-toggle]");
    if (extra) {
      const [fechaId, id] = extra.dataset.extraToggle.split("|");
      await alternarExtraDelDia(fechaId, id).catch(() => {});
      return;
    }
    const checkBloque = e.target.closest("[data-check-bloque]");
    if (checkBloque) {
      // El check puede vivir dentro de un bloque-enlace (entreno, menú):
      // marcar hecho no debe navegar — se para aquí y también se corta el
      // camino hacia el listener global de <a href="#/...">.
      e.preventDefault();
      e.stopPropagation();
      const [fechaId, ...resto] = checkBloque.dataset.checkBloque.split("|");
      await alternarBloqueHecho(fechaId, resto.join("|")).catch(() => {});
      return;
    }
    // Marcar una tarea directamente desde la tarjeta del día.
    const tarea = e.target.closest("[data-tarea-toggle]");
    if (tarea) {
      const [fechaId, i] = tarea.dataset.tareaToggle.split("|");
      const tareas = [...(diaPorFecha(fechaId)?.tareas || [])];
      if (!tareas[Number(i)]) return;
      tareas[Number(i)] = { ...tareas[Number(i)], hecho: !tareas[Number(i)].hecho };
      await guardarDia(fechaId, { tareas }).catch(() => {});
      return;
    }
    // Tocar una cita apunta cuánto tardó al final (o lo corrige).
    const real = e.target.closest("[data-cita-real]");
    if (real) {
      const [fechaId, indice] = real.dataset.citaReal.split("|");
      const agenda = [...(diaPorFecha(fechaId)?.agenda || [])];
      const item = agenda[Number(indice)];
      if (!item) return;
      const respuesta = prompt(`"${item.titulo}"${item.duracion ? ` (creías que ~${item.duracion} min)` : ""} — ¿cuánto tardaste al final, en minutos?`, item.duracion_real || item.duracion || "");
      if (respuesta === null) return;
      const minutos = Number(respuesta);
      agenda[Number(indice)] = { ...item, duracion_real: minutos > 0 ? minutos : null };
      await guardarDia(fechaId, { agenda }).catch(() => {});
      return;
    }
  });
}

// ---------- Las tres vistas ----------

// MES: la cuadrícula entera, con un puntito por lo que tenga cada día
// (citas en color, tareas pendientes en gris). Tocar un día abre su día.
function vistaMes() {
  const year = fechaFoco.getFullYear();
  const month = fechaFoco.getMonth();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const hoyId = fechaISO();

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(`<div class="cal-cell cal-cell--vacia"></div>`);
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaId = fechaISO(new Date(year, month, dia, 12));
    const doc = diaPorFecha(fechaId);
    const citas = doc?.agenda?.length || 0;
    const pendientes = (doc?.tareas || []).filter((t) => !t.hecho).length;
    celdas.push(`
      <button type="button" class="cal-cell ${fechaId === hoyId ? "cal-cell--hoy" : ""}" data-ver-dia="${fechaId}">
        <span class="cal-cell__num">${dia}</span>
        <span class="agenda-puntos">
          ${citas ? `<span class="agenda-punto agenda-punto--cita" title="${citas} cita(s)"></span>` : ""}
          ${pendientes ? `<span class="agenda-punto agenda-punto--tarea" title="${pendientes} por hacer"></span>` : ""}
        </span>
      </button>`);
  }

  return `
    <article class="card">
      <div class="cal-weekdays">
        <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
      </div>
      <div class="cal-days">${celdas.join("")}</div>
    </article>`;
}

// SEMANA: las siete tarjetas, cada una con su horario, citas y tareas.
function vistaSemana() {
  const lunes = lunesDe(fechaFoco);
  const hoyId = fechaISO();
  const fmtDia = new Intl.DateTimeFormat("es-ES", { weekday: "long" });
  const fmtCorto = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    const fechaId = fechaISO(fecha);
    const bloques = bloquesDelDia(fecha);
    const tareas = diaPorFecha(fechaId)?.tareas || [];
    const aviso = avisoDeEntrenoSinHueco(fecha);
    const toca = SEMANA_TIPO[fecha.getDay()];
    let nCita = -1;
    return `
      <article class="card agenda-dia ${fechaId === hoyId ? "agenda-dia--hoy" : ""}">
        <div class="agenda-dia__cabecera">
          <button type="button" class="agenda-dia__nombre" data-ver-dia="${fechaId}" title="Ver este día entero">${fmtDia.format(fecha)} <span>${fmtCorto.format(fecha).replace(".", "")}</span>${fechaId === hoyId ? " · hoy" : ""}</button>
          <div class="agenda-dia__acciones">
            <button type="button" class="menu-dia__editar" data-editar-dia-semana="${fechaId}" title="Cambiar la plantilla de este día de la semana">✎</button>
            <button type="button" class="menu-dia__editar" data-cita-fecha="${fechaId}" title="Cita o imprevisto solo de este día">＋</button>
            <button type="button" class="menu-dia__editar" data-tareas-fecha="${fechaId}" title="La to-do list de este día">☑</button>
          </div>
        </div>
        ${toca ? `<p class="agenda-dia__toca">${toca.nombre}</p>` : ""}
        ${
          tareas.length
            ? `<div class="agenda-tareas" style="border-top:none; padding-top:0; margin:2px 0 6px;">
          ${tareas
            .map(
              (t, i) => `
            <button type="button" class="agenda-tarea ${t.hecho ? "agenda-tarea--hecha" : ""}" data-tarea-toggle="${fechaId}|${i}">
              <span class="agenda-tarea__circulo">${t.hecho ? "✓" : ""}</span>${esc(t.texto)}
            </button>`
            )
            .join("")}
        </div>`
            : ""
        }
        <div class="agenda-dia__bloques">
          ${bloques
            .map((b) => {
              if (b.cita) {
                nCita += 1;
                return `
              <button type="button" class="agenda-bloque agenda-bloque--cita" data-cita-real="${fechaId}|${nCita}" title="Toca para apuntar cuánto tardaste">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo">📌 ${esc(b.titulo)}${b.detalle ? ` <span class="agenda-bloque__detalle">· ${esc(b.detalle)}</span>` : ""}</span>
              </button>`;
              }
              const ruta = rutaDeBloque(b);
              const tapado = b.tapado ? " agenda-bloque--tapado" : "";
              if (ruta) {
                return `
              <a class="agenda-bloque agenda-bloque--link${tapado}" href="${ruta.href}">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo"><i class="ph ${ruta.icono}" aria-hidden="true"></i> ${esc(b.titulo)} <span class="agenda-bloque__ir">›</span></span>
              </a>`;
              }
              return `
              <div class="agenda-bloque${tapado}">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo">${esc(b.titulo)}</span>
              </div>`;
            })
            .join("")}
        </div>
        ${aviso ? `<p class="agenda-dia__aviso">⚠️ ${aviso}</p>` : ""}
      </article>`;
  }).join("");

  return `
    <div class="agenda-grid">${dias}</div>`;
}

// DÍA: el día entero como lo enseña "Hoy" — la línea hora a hora con el
// AHORA marcando dónde estás (si es hoy), las citas 📌 tocables, las
// tareas del día y su aviso si el entreno se quedó sin hueco.
function vistaDia() {
  const fecha = fechaFoco;
  const fechaId = fechaISO(fecha);
  const esHoy = fechaId === fechaISO();
  const ahora = new Date();
  const bloques = bloquesDelDia(fecha);
  const indiceAhora = esHoy ? bloqueActual(ahora) : -1;
  const horaTxt = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const tareas = diaPorFecha(fechaId)?.tareas || [];
  const aviso = avisoDeEntrenoSinHueco(fecha);
  const toca = SEMANA_TIPO[fecha.getDay()];
  const conChecks = conChecklistDeDia();
  const extras = extrasDelDia(fechaId);
  let nCita = -1;

  return `
    <article class="card">
      <div class="agenda-dia__cabecera">
        ${toca ? `<p class="agenda-dia__toca" style="margin:0;">${toca.nombre}</p>` : "<span></span>"}
        <div class="agenda-dia__acciones">
          <button type="button" class="menu-dia__editar" data-editar-dia-semana="${fechaId}" title="Cambiar la plantilla de este día de la semana">✎</button>
          <button type="button" class="menu-dia__editar" data-cita-fecha="${fechaId}" title="Cita o imprevisto solo de este día">＋</button>
          <button type="button" class="menu-dia__editar" data-tareas-fecha="${fechaId}" title="La to-do list de este día">☑</button>
        </div>
      </div>
      ${
        tareas.length
          ? `<div class="agenda-tareas" style="border-top:none; padding-top:0; margin:8px 0 4px;">
        ${tareas
          .map(
            (t, i) => `
          <button type="button" class="agenda-tarea ${t.hecho ? "agenda-tarea--hecha" : ""}" data-tarea-toggle="${fechaId}|${i}">
            <span class="agenda-tarea__circulo">${t.hecho ? "✓" : ""}</span>${esc(t.texto)}
          </button>`
          )
          .join("")}
      </div>`
          : ""
      }
      <div class="dia-linea" style="margin-top:10px;">
        ${bloques
          .map((bl, i) => {
            const esAhora = esHoy && i === indiceAhora;
            const ruta = rutaDeBloque(bl);
            const etiqueta = ruta ? "a" : "div";
            const attrs = ruta
              ? ` href="${ruta.href}"`
              : bl.cita
                ? ` data-cita-real="${fechaId}|${(nCita += 1)}" role="button" title="Toca para apuntar cuánto tardaste"`
                : "";
            const hecho = bl.extra ? bl.hecho : conChecks && bloqueHecho(fechaId, bl);
            return `
          <${etiqueta} class="dia-bloque ${bl.cita ? "dia-bloque--cita" : ""} ${bl.tapado ? "dia-bloque--tapado" : ""} ${esAhora ? "dia-bloque--ahora" : ""} ${esHoy && i < indiceAhora ? "dia-bloque--pasado" : ""} ${hecho ? "dia-bloque--hecho" : ""}"${attrs}>
            <span class="dia-bloque__hora">${bl.h}</span>
            <span class="dia-bloque__punto" aria-hidden="true"></span>
            <span class="dia-bloque__cuerpo">
              <span class="dia-bloque__titulo">${bl.cita ? "📌 " : ""}${ruta ? `<i class="ph ${ruta.icono}" aria-hidden="true"></i> ` : ""}${esc(bl.titulo)}${ruta ? ` <span class="agenda-bloque__ir">›</span>` : ""}${esAhora ? ` <span class="dia-ahora">AHORA · ${horaTxt}</span>` : ""}</span>
              ${bl.detalle ? `<span class="dia-bloque__detalle">${esc(bl.detalle)}</span>` : ""}
            </span>
            ${
              bl.extra
                ? `<button type="button" class="bloque-check ${hecho ? "bloque-check--on" : ""}" data-extra-toggle="${fechaId}|${bl.extra}" title="Marcar como hecho">✓</button>`
                : conChecks
                  ? `<button type="button" class="bloque-check ${hecho ? "bloque-check--on" : ""}" data-check-bloque="${fechaId}|${esc(claveDeBloque(bl))}" title="Marcar como hecho">✓</button>`
                  : ""
            }
          </${etiqueta}>`;
          })
          .join("")}
      </div>
      ${aviso ? `<p class="agenda-dia__aviso">⚠️ ${aviso}</p>` : ""}
    </article>`;
}

export function renderVidaAgenda(_state) {
  const el = document.getElementById("agenda-content");
  if (!el) return;

  const fmtMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
  const fmtCorto = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  const fmtLargo = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const esHoyFoco = fechaISO(fechaFoco) === fechaISO();

  let titulo;
  if (vista === "mes") titulo = cap(fmtMes.format(fechaFoco));
  else if (vista === "semana") {
    const lunes = lunesDe(fechaFoco);
    titulo = `Semana del ${fmtCorto.format(lunes).replace(".", "")} al ${fmtCorto.format(sumarDias(lunes, 6)).replace(".", "")}`;
  } else titulo = cap(fmtLargo.format(fechaFoco)) + (esHoyFoco ? " · hoy" : "");

  el.innerHTML = `
    <div class="agenda-nav">
      <button type="button" class="btn btn--ghost btn--sm" id="agenda-prev">‹</button>
      <p class="agenda-nav__titulo">${titulo}${esHoyFoco ? "" : ` · <button type="button" class="btn btn--ghost btn--sm" id="agenda-hoy">hoy</button>`}</p>
      <button type="button" class="btn btn--ghost btn--sm" id="agenda-next">›</button>
    </div>
    <div class="chips agenda-vistas">
      <button type="button" class="chip ${vista === "mes" ? "chip--on" : ""}" data-vista="mes">Mes</button>
      <button type="button" class="chip ${vista === "semana" ? "chip--on" : ""}" data-vista="semana">Semana</button>
      ${vista === "dia" ? `<span class="chip chip--on">Día</span>` : ""}
    </div>
    ${vista === "mes" ? vistaMes() : vista === "semana" ? vistaSemana() : vistaDia()}
  `;
}
// vida:fin
