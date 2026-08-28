// vida:inicio
// Calendario personal: la semana entera de un vistazo — qué toca cada día,
// hora a hora, con las citas y sus duraciones. Todo editable desde aquí:
// el lápiz cambia la plantilla de ese día de la semana, el ＋ apunta citas
// solo de esa fecha (con cuánto crees que tardarás), y al tocar una cita
// ya pasada apuntas cuánto tardaste al final. Si un día personalizado
// deja el entreno sin hueco, el día lo avisa — la rutina sigue contando
// con los imprevistos, no a pesar de ellos.

import { vida, bloquesDelDia, avisoDeEntrenoSinHueco, diaPorFecha, guardarDia, SEMANA_TIPO } from "../vida.js?v=77";
import { abrirEditorHorario, abrirAgendaDia } from "./vida-hoy.js?v=77";
import { openModal, closeModal } from "../modal.js?v=77";
import { fechaISO } from "../db.js?v=77";

// Qué semana se está viendo: 0 = esta, 1 = la que viene, -1 = la pasada…
let semanaVista = 0;

function lunesDeSemana(offset) {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7) + offset * 7, 12);
  return lunes;
}

export function mountVidaAgenda() {
  const root = document.getElementById("view-agenda");
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#agenda-prev")) {
      semanaVista -= 1;
      renderVidaAgenda(null);
      return;
    }
    if (e.target.closest("#agenda-next")) {
      semanaVista += 1;
      renderVidaAgenda(null);
      return;
    }
    if (e.target.closest("#agenda-hoy")) {
      semanaVista = 0;
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
// (recados, llamadas, papeleos). Vive en el documento del día (tareas) y
// se ve también en la tarjeta del día, donde un toque la marca hecha.
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

export function renderVidaAgenda(_state) {
  const el = document.getElementById("agenda-content");
  if (!el) return;

  const lunes = lunesDeSemana(semanaVista);
  const hoyISO = fechaISO();
  const fmtDia = new Intl.DateTimeFormat("es-ES", { weekday: "long" });
  const fmtCorto = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6, 12);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i, 12);
    const fechaId = fechaISO(fecha);
    const bloques = bloquesDelDia(fecha);
    const agenda = diaPorFecha(fechaId)?.agenda || [];
    const tareas = diaPorFecha(fechaId)?.tareas || [];
    const aviso = avisoDeEntrenoSinHueco(fecha);
    const toca = SEMANA_TIPO[fecha.getDay()];
    // Para enlazar cada bloque-cita con su posición en la agenda del día.
    let nCita = -1;
    return `
      <article class="card agenda-dia ${fechaId === hoyISO ? "agenda-dia--hoy" : ""}">
        <div class="agenda-dia__cabecera">
          <p class="agenda-dia__nombre">${fmtDia.format(fecha)} <span>${fmtCorto.format(fecha).replace(".", "")}</span>${fechaId === hoyISO ? " · hoy" : ""}</p>
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
              return `
              <div class="agenda-bloque">
                <span class="agenda-bloque__hora">${b.h}</span>
                <span class="agenda-bloque__titulo">${b.titulo}${b.detalle ? ` <span class="agenda-bloque__detalle">· ${b.detalle}</span>` : ""}</span>
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

  el.innerHTML = `
    <div class="agenda-nav">
      <button type="button" class="btn btn--ghost btn--sm" id="agenda-prev">‹</button>
      <p class="agenda-nav__titulo">Semana del ${fmtCorto.format(lunes).replace(".", "")} al ${fmtCorto.format(domingo).replace(".", "")}${semanaVista !== 0 ? ` · <button type="button" class="btn btn--ghost btn--sm" id="agenda-hoy">volver a hoy</button>` : ""}</p>
      <button type="button" class="btn btn--ghost btn--sm" id="agenda-next">›</button>
    </div>
    <div class="agenda-grid">${dias}</div>
    <p class="compras-pista">✎ cambia ese día de la semana · ＋ cita con sus minutos aprox · ☑ la to-do list del día · toca una cita para apuntar cuánto tardaste</p>
  `;
}
// vida:fin
