// vida:inicio
// Calendario personal: un calendario de verdad, como el del iPhone, con
// tres vistas — MES (todos los días, con sus puntitos de citas y tareas),
// SEMANA (las tarjetas de cada día) y DÍA (la línea hora a hora de "Hoy",
// con el AHORA marcando en qué momento estás). Tocar un día del mes lleva
// a su vista de día. Todo editable: ✎ cambia la plantilla de ese día de
// la semana, ＋ apunta citas con sus minutos aprox, ☑ abre la to-do list
// del día, y tocar una cita apunta cuánto tardaste al final.

import { vida, bloquesDelDia, bloqueActual, avisoDeEntrenoSinHueco, diaPorFecha, guardarDia, SEMANA_TIPO } from "../vida.js?v=80";
import { abrirEditorHorario, abrirAgendaDia } from "./vida-hoy.js?v=80";
import { openModal, closeModal } from "../modal.js?v=80";
import { fechaISO } from "../db.js?v=80";

// Qué vista está puesta y qué fecha tiene el foco. La fecha del foco es la
// que mandan las flechas: en mes salta de mes en mes, en semana de semana
// en semana y en día de día en día.
let vista = "mes"; // "mes" | "semana" | "dia"
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
      else fechaFoco = sumarDias(fechaFoco, dir);
      renderVidaAgenda(null);
      return;
    }
    if (e.target.closest("#agenda-hoy")) {
      fechaFoco = alMediodia(new Date());
      renderVidaAgenda(null);
      return;
    }
    // Tocar un día del mes (o el nombre de un día de la semana) abre su día.
    const diaMes = e.target.closest("[data-ver-dia]");
    if (diaMes) {
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

// La to-do list de UN día: lo que hay que hacer ese día además del horario
// (recados, llamadas, papeleos). Vive en el documento del día (tareas).
function abrirTareasDia(fechaId) {
  let tareas = [...(diaPorFecha(fechaId)?.tareas || [])];
  const fecha = new Date(fechaId + "T12:00:00");
  const titulo = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(fecha);

  const listaHTML = () =>
    tareas.length
      ? tareas
          .map(
            (t, i) => `
        <div class="mini-row">
          <button type="button" class="agenda-tarea ${t.hecho ? "agenda-tarea--hecha" : ""}" data-t-toggle="${i}" style="flex:1;">
            <span class="agenda-tarea__circulo">${t.hecho ? "✓" : ""}</span>${t.texto}
          </button>
          <button type="button" class="row-edit-btn" data-t-quitar="${i}" title="Quitar">✕</button>
        </div>`
          )
          .join("")
      : `<p class="empty-state" style="padding:8px 0;">Nada por hacer este día ✨</p>`;

  openModal(
    `
    <h2 class="modal__title">Para hacer el ${titulo}</h2>
    <div id="tareas-lista">${listaHTML()}</div>
    <form id="form-tarea" class="compras-add" style="margin-top:10px;">
      <input type="text" id="tarea-texto" placeholder="¿Qué hay que hacer?" autocomplete="off" maxlength="80" />
    </form>
    <p class="field-error" id="tarea-error"></p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
      <button type="button" class="btn btn--primary" id="btn-guardar-tareas">Guardar</button>
    </div>`,
    {
      onMount: (root) => {
        const repintar = () => (root.querySelector("#tareas-lista").innerHTML = listaHTML());
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#tareas-lista").addEventListener("click", (e) => {
          const alterna = e.target.closest("[data-t-toggle]");
          if (alterna) {
            const i = Number(alterna.dataset.tToggle);
            tareas[i] = { ...tareas[i], hecho: !tareas[i].hecho };
            repintar();
            return;
          }
          const quitar = e.target.closest("[data-t-quitar]");
          if (quitar) {
            tareas.splice(Number(quitar.dataset.tQuitar), 1);
            repintar();
          }
        });
        root.querySelector("#form-tarea").addEventListener("submit", (e) => {
          e.preventDefault();
          const input = root.querySelector("#tarea-texto");
          const texto = input.value.trim();
          if (!texto) return;
          tareas.push({ texto, hecho: false });
          input.value = "";
          repintar();
        });
        root.querySelector("#btn-guardar-tareas").addEventListener("click", async () => {
          try {
            await guardarDia(fechaId, { tareas });
            closeModal();
          } catch (err) {
            root.querySelector("#tarea-error").textContent = "No se pudo guardar. Revisa la conexión.";
          }
        });
      },
    }
  );
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
        <div class="agenda-dia__bloques">
          ${bloques
            .map((b) => {
              if (b.cita) {
                nCita += 1;
                return `
              <button type="button" class="agenda-bloque agenda-bloque--cita" data-cita-real="${fechaId}|${nCita}" title="Toca para apuntar cuánto tardaste">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo">📌 ${b.titulo}${b.detalle ? ` <span class="agenda-bloque__detalle">· ${b.detalle}</span>` : ""}</span>
              </button>`;
              }
              const ruta = rutaDeBloque(b);
              if (ruta) {
                return `
              <a class="agenda-bloque agenda-bloque--link" href="${ruta.href}">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo"><i class="ph ${ruta.icono}" aria-hidden="true"></i> ${b.titulo} <span class="agenda-bloque__ir">›</span></span>
              </a>`;
              }
              return `
              <div class="agenda-bloque">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo">${b.titulo}</span>
              </div>`;
            })
            .join("")}
        </div>
        ${
          tareas.length
            ? `<div class="agenda-tareas">
          ${tareas
            .map(
              (t, i) => `
            <button type="button" class="agenda-tarea ${t.hecho ? "agenda-tarea--hecha" : ""}" data-tarea-toggle="${fechaId}|${i}">
              <span class="agenda-tarea__circulo">${t.hecho ? "✓" : ""}</span>${t.texto}
            </button>`
            )
            .join("")}
        </div>`
            : ""
        }
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
            return `
          <${etiqueta} class="dia-bloque ${bl.cita ? "dia-bloque--cita" : ""} ${esAhora ? "dia-bloque--ahora" : ""} ${esHoy && i < indiceAhora ? "dia-bloque--pasado" : ""}"${attrs}>
            <span class="dia-bloque__hora">${bl.h}</span>
            <span class="dia-bloque__punto" aria-hidden="true"></span>
            <span class="dia-bloque__cuerpo">
              <span class="dia-bloque__titulo">${bl.cita ? "📌 " : ""}${ruta ? `<i class="ph ${ruta.icono}" aria-hidden="true"></i> ` : ""}${bl.titulo}${ruta ? ` <span class="agenda-bloque__ir">›</span>` : ""}${esAhora ? ` <span class="dia-ahora">AHORA · ${horaTxt}</span>` : ""}</span>
              ${bl.detalle ? `<span class="dia-bloque__detalle">${bl.detalle}</span>` : ""}
            </span>
          </${etiqueta}>`;
          })
          .join("")}
      </div>
      ${
        tareas.length
          ? `<p class="compras-titulo">Para hacer este día</p>
      <div class="agenda-tareas" style="border-top:none; padding-top:0;">
        ${tareas
          .map(
            (t, i) => `
          <button type="button" class="agenda-tarea ${t.hecho ? "agenda-tarea--hecha" : ""}" data-tarea-toggle="${fechaId}|${i}">
            <span class="agenda-tarea__circulo">${t.hecho ? "✓" : ""}</span>${t.texto}
          </button>`
          )
          .join("")}
      </div>`
          : ""
      }
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
      <button type="button" class="chip ${vista === "dia" ? "chip--on" : ""}" data-vista="dia">Día</button>
    </div>
    ${vista === "mes" ? vistaMes() : vista === "semana" ? vistaSemana() : vistaDia()}
  `;
}
// vida:fin
