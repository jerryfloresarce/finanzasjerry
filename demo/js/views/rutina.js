// Rutina: los hábitos que quieres cumplir cada día.
//
// Dos listas en la base de datos: los hábitos en sí ("habitos") y una marca
// por cada día que cumples uno ("habitos_hechos"). Se guarda una marca por
// día en vez de un contador porque así se puede desmarcar sin descuadrar
// nada, y porque el calendario del mes se dibuja leyendo esas marcas.

import {
  addHabitos,
  updateHabitos,
  deleteHabitos,
  addHabitosHechos,
  deleteHabitosHechos,
} from "../db.js?v=99";
import { openModal, closeModal } from "../modal.js?v=99";
import { icon } from "../icons.js?v=99";
import { emojiFieldHTML, attachEmojiPicker } from "../emoji-picker.js?v=99";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=99";

const EMOJIS = ["💪", "🏃", "📖", "🧘", "💧", "🥗", "😴", "🦷", "🧹", "✍️", "🎸", "🌱", "☎️", "🧴", "🚭", "🧊"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const hoyISO = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export function mountRutina() {
  document.getElementById("btn-add-habito").addEventListener("click", () => abrirFormulario());
}

// Cuántos días seguidos, contando hacia atrás desde hoy. Si hoy todavía no
// está marcado no se rompe la racha: se empieza a contar desde ayer, porque
// a las nueve de la mañana nadie ha hecho aún lo del día y ver un cero ahí
// desanima más que ayuda.
function racha(fechasHechas) {
  const hechas = new Set(fechasHechas);
  const dia = new Date();
  dia.setHours(12, 0, 0, 0);
  if (!hechas.has(dia.toISOString().slice(0, 10))) dia.setDate(dia.getDate() - 1);
  let cuenta = 0;
  for (;;) {
    if (!hechas.has(dia.toISOString().slice(0, 10))) break;
    cuenta++;
    dia.setDate(dia.getDate() - 1);
  }
  return cuenta;
}

export function renderRutina(state) {
  const habitos = state.habitos || [];
  const hechos = state.habitosHechos || [];
  const hoy = hoyISO();

  const porHabito = new Map();
  hechos.forEach((h) => {
    if (!porHabito.has(h.habito_id)) porHabito.set(h.habito_id, new Map());
    porHabito.get(h.habito_id).set(h.fecha, h.id);
  });

  // ---- Lo de hoy
  const elHoy = document.getElementById("rutina-hoy");
  if (habitos.length === 0) {
    elHoy.innerHTML = `
      <h2 class="card__title">Hoy</h2>
      <p class="empty-state">Todavía no has añadido ningún hábito. Empieza por uno solo: es más fácil mantener uno que cinco.</p>`;
    document.getElementById("rutina-mes").innerHTML = "";
    return;
  }

  const hechosHoy = habitos.filter((h) => porHabito.get(h.id)?.has(hoy)).length;

  elHoy.innerHTML = `
    <div class="card__header">
      <h2 class="card__title">Hoy</h2>
      <span class="entity-card__tag">${hechosHoy} de ${habitos.length}</span>
    </div>
    <div id="rutina-lista">
      ${habitos
        .map((h) => {
          const dias = porHabito.get(h.id) || new Map();
          const hecho = dias.has(hoy);
          const r = racha([...dias.keys()]);
          return wrapSwipe(
            `
            <div class="entity-row">
              <button type="button" class="habito-check ${hecho ? "is-hecho" : ""}" data-marcar="${h.id}"
                      aria-pressed="${hecho}" aria-label="${hecho ? "Desmarcar" : "Marcar"} ${h.nombre}">
                ${hecho ? "✓" : ""}
              </button>
              <div class="entity-row__body">
                <p class="entity-row__name">${h.icono || "•"} ${h.nombre}</p>
                <p class="entity-row__meta">${r > 0 ? `${r} ${r === 1 ? "día seguido" : "días seguidos"}` : "Sin racha todavía"}</p>
              </div>
              <button type="button" class="row-edit-btn" data-edit="${h.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>`,
            h.id
          );
        })
        .join("")}
    </div>`;

  elHoy.querySelectorAll("[data-marcar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.marcar;
      const dias = porHabito.get(id) || new Map();
      // Se bloquea mientras va y viene: si no, dos toques seguidos crean dos
      // marcas del mismo día y el calendario empieza a contar de más.
      btn.disabled = true;
      try {
        if (dias.has(hoy)) await deleteHabitosHechos(dias.get(hoy));
        else await addHabitosHechos({ habito_id: id, fecha: hoy });
      } finally {
        btn.disabled = false;
      }
    })
  );
  elHoy.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => abrirFormulario(habitos.find((h) => h.id === btn.dataset.edit)))
  );
  // Se le pasa la lista, no la tarjeta entera: attachSwipe solo mira los
  // HIJOS DIRECTOS del elemento que recibe, y las filas cuelgan de
  // #rutina-lista, no de la tarjeta.
  attachSwipe(document.getElementById("rutina-lista"), (id) => deleteHabitos(id), {
    confirmar: "¿Eliminar este hábito? Las marcas de los días que ya cumpliste se quedan guardadas.",
  });

  // ---- El mes
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  // getDay() devuelve 0 para el domingo; aquí la semana empieza en lunes.
  const huecoInicial = (new Date(anio, mes, 1).getDay() + 6) % 7;

  document.getElementById("rutina-mes").innerHTML = `
    <h2 class="card__title">${new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(ahora)}</h2>
    ${habitos
      .map((h) => {
        const dias = porHabito.get(h.id) || new Map();
        const celdas = [];
        for (let i = 0; i < huecoInicial; i++) celdas.push(`<span class="rutina-celda is-vacia"></span>`);
        for (let d = 1; d <= diasDelMes; d++) {
          const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const marcado = dias.has(iso);
          const futuro = iso > hoy;
          celdas.push(
            `<span class="rutina-celda ${marcado ? "is-hecha" : ""} ${futuro ? "is-futura" : ""}" title="${d}">${d}</span>`
          );
        }
        const esteMes = [...dias.keys()].filter((f) => f.startsWith(`${anio}-${String(mes + 1).padStart(2, "0")}`)).length;
        return `
          <div class="rutina-mes__habito">
            <div class="rutina-mes__cabecera">
              <p class="entity-row__name">${h.icono || "•"} ${h.nombre}</p>
              <span class="entity-row__meta">${esteMes} de ${diasDelMes}</span>
            </div>
            <div class="rutina-rejilla" aria-hidden="true">
              ${DIAS.map((d) => `<span class="rutina-celda is-titulo">${d}</span>`).join("")}
              ${celdas.join("")}
            </div>
          </div>`;
      })
      .join("")}`;
}

function abrirFormulario(habito) {
  const editando = Boolean(habito);
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar hábito" : "Nuevo hábito"}</h2>
    <form id="form-habito" class="form-grid">
      <label class="field field--full">
        <span class="field__label">¿Qué quieres hacer cada día?</span>
        <input type="text" name="nombre" required value="${habito?.nombre ?? ""}" placeholder="Beber 2 litros de agua" />
      </label>
      ${emojiFieldHTML(habito?.icono, EMOJIS)}
      <p class="field-error" id="form-habito-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${editando ? "Guardar" : "Añadir"}</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        attachEmojiPicker(root);
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-habito").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const datos = { nombre: f.nombre.value.trim(), icono: f.icono.value.trim() || null };
          try {
            if (editando) await updateHabitos(habito.id, datos);
            else await addHabitos(datos);
            closeModal();
          } catch (err) {
            root.querySelector("#form-habito-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
