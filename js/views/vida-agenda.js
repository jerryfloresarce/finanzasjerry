// vida:inicio
// Calendario personal: la semana entera de un vistazo — qué toca cada día,
// hora a hora, con las citas y sus duraciones. Todo editable desde aquí:
// el lápiz cambia la plantilla de ese día de la semana, el ＋ apunta citas
// solo de esa fecha (con cuánto crees que tardarás), y al tocar una cita
// ya pasada apuntas cuánto tardaste al final. Si un día personalizado
// deja el entreno sin hueco, el día lo avisa — la rutina sigue contando
// con los imprevistos, no a pesar de ellos.

import { vida, bloquesDelDia, avisoDeEntrenoSinHueco, diaPorFecha, guardarDia, SEMANA_TIPO } from "../vida.js?v=76";
import { abrirEditorHorario, abrirAgendaDia } from "./vida-hoy.js?v=76";
import { fechaISO } from "../db.js?v=76";

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
    <p class="compras-pista">✎ cambia ese día de la semana · ＋ cita solo de esa fecha (con minutos aprox) · toca una cita para apuntar cuánto tardaste</p>
  `;
}
// vida:fin
